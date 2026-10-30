import { z } from "zod";
import {
  phraseRef,
  REDACTOR_PROMPT_VERSION,
  REDACTOR_SYSTEM_V1,
  renderRedactorPrompt,
} from "../prompts/redactor";
import { modelIdFor } from "../router";
import { runStructured, type NeedsHumanReason, type RunDeps, type RunResult } from "../run";
import { sumSpans, type Span } from "../span";
import { checkNames, nameCheckEnabled } from "./name_check";
import { childNameCandidates, mentionsName } from "../safety/names";

// Redactor (Haiku, redactor@v1). Runs on every transcribed chunk BEFORE anything is stored, so no
// child's name reaches the database, an answer, a log or a trace (Law 5).

export const RedactorOutput = z.object({
  phrases: z.array(
    z.object({
      ref: z.string().describe("The input phrase ref, unchanged: P1, P2, ..."),
      textKn: z.string().describe("The phrase in Kannada script, names redacted, otherwise word for word"),
      textEn: z.string().describe("Faithful plain English rendering of the redacted phrase"),
      childNameRedacted: z.boolean(),
      otherNameRedacted: z.boolean(),
      speakerGuess: z.enum(["master", "interviewer", "other"]).nullable(),
    }),
  ),
});
export type RedactorOutput = z.infer<typeof RedactorOutput>;

export type Phrase = { startMs: number; endMs: number; text: string };

export type RedactInput = {
  phrases: Phrase[];
  masterName?: string;
  /** The previous chunk's last phrase, already redacted, so a story carries across chunks. */
  previousText?: string;
  traceId?: string;
  /** Eval case id; product calls leave it out. */
  itemId?: string;
  /** Default keeps a hung call inside the chunk route's 300 s limit, retries included. */
  timeBudgetMs?: number;
  /** A second Haiku reader of the result (default: AI_NAME_CHECK=1). Fails closed. */
  secondCheck?: boolean;
};

export const DEFAULT_REDACT_TIME_BUDGET_MS = 120_000;

export type RedactedPhrase = {
  startMs: number;
  endMs: number;
  textKn: string;
  textEn: string;
  childNameRedacted: boolean;
  otherNameRedacted: boolean;
  speakerGuess: "master" | "interviewer" | "other" | null;
};

export type RedactResult =
  | { status: "ok"; phrases: RedactedPhrase[]; attempts: number; replayed: boolean; span: Span }
  | { status: "needs_human"; reason: NeedsHumanReason; problems: string[]; span: Span };

// Removing a name clause shortens a phrase; a summary shortens it far more.
const MIN_RATIO = 0.35;
const MAX_RATIO = 3;
const RATIO_MIN_CHARS = 40;

/**
 * Deterministic checks on the model's answer. Messages go back to the model on retry, so they
 * never repeat a name: they say where the problem is, not what it is.
 */
export function validateRedaction(
  input: Pick<RedactInput, "phrases" | "masterName">,
  out: RedactorOutput,
): string[] {
  const problems: string[] = [];
  const n = input.phrases.length;
  if (out.phrases.length !== n) {
    problems.push(`Return exactly ${n} items (${phraseRef(0)} to ${phraseRef(n - 1)}); you returned ${out.phrases.length}.`);
  }
  const masterTokens = new Set((input.masterName ?? "").split(/\s+/).filter(Boolean));
  const candidates = childNameCandidates(input.phrases.map((p) => p.text).join("\n")).filter((c) => !masterTokens.has(c));

  out.phrases.forEach((p, i) => {
    const ref = phraseRef(i);
    if (p.ref.trim() !== ref) problems.push(`Item ${i + 1} must have ref ${ref}, in input order.`);
    const said = input.phrases[i]?.text.trim() ?? "";
    if (!said) return;
    const kn = p.textKn.trim();
    if (!kn) problems.push(`${ref}: textKn is empty; keep the speaker's words.`);
    if (!p.textEn.trim()) problems.push(`${ref}: textEn is empty; give a faithful English rendering.`);
    if (kn && said.length >= RATIO_MIN_CHARS) {
      const ratio = kn.length / said.length;
      if (ratio < MIN_RATIO) problems.push(`${ref}: textKn is much shorter than what was said; keep every word except names.`);
      if (ratio > MAX_RATIO) problems.push(`${ref}: textKn is much longer than what was said; do not add anything.`);
    }
    const both = `${p.textKn}\n${p.textEn}`;
    if (candidates.some((c) => mentionsName(both, c))) {
      problems.push(`${ref}: a child's name from the transcript is still there; replace it with ಒಂದು ಮಗು or ಆ ಮಗು ("a child").`);
    } else if (childNameCandidates(both).some((c) => !masterTokens.has(c))) {
      problems.push(`${ref}: still introduces a child by name; remove the name.`);
    }
  });
  return problems;
}

export function buildRedactorRequest(
  input: Pick<RedactInput, "phrases" | "masterName" | "previousText"> & { recheck?: string[] },
) {
  return { system: REDACTOR_SYSTEM_V1, prompt: renderRedactorPrompt(input) };
}

const tidyEn = (s: string) => s.replace(/\s*[—–]\s*/g, ", ").trim();

export async function redactPhrases(input: RedactInput, deps?: RunDeps): Promise<RedactResult> {
  if (input.phrases.length === 0) {
    const span: Span = {
      role: "redactor",
      model: modelIdFor("redactor"),
      promptVersion: REDACTOR_PROMPT_VERSION,
      latencyMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      cacheReadTokens: 0,
      costUsd: 0,
      attempts: 0,
      replayed: false,
    };
    return { status: "ok", phrases: [], attempts: 0, replayed: false, span };
  }
  const first = await redactOnce(input, deps);
  if (first.status !== "ok") return { status: "needs_human", reason: first.reason, problems: first.problems, span: first.span };
  if (!(input.secondCheck ?? nameCheckEnabled(deps?.env))) return toResult(input, first, first.span);

  // Second reader: one more redaction pass on what it flags, then a human if it still flags.
  const spans: Span[] = [first.span];
  let current = first;
  for (let round = 0; round < 2; round++) {
    const check = await checkNames(
      {
        phrases: current.output.phrases.map((p) => ({ textKn: p.textKn, textEn: p.textEn })),
        masterName: input.masterName,
        traceId: input.traceId,
        itemId: input.itemId ? `${input.itemId}:name_check:${round}` : undefined,
      },
      deps,
    );
    spans.push(check.span);
    const span = sumSpans(spans[0]!, ...spans.slice(1));
    if (check.status !== "ok") {
      return { status: "needs_human", reason: check.reason, problems: ["the second name check was unavailable"], span };
    }
    if (check.flagged.length === 0) return toResult(input, current, span);
    if (round === 1) {
      return { status: "needs_human", reason: "invalid_output", problems: [`a second check still finds a possible name in ${check.flagged.join(", ")}`], span };
    }
    const again = await redactOnce(input, deps, check.flagged);
    spans.push(again.span);
    if (again.status !== "ok") {
      return { status: "needs_human", reason: again.reason, problems: again.problems, span: sumSpans(spans[0]!, ...spans.slice(1)) };
    }
    current = again;
  }
  return { status: "needs_human", reason: "invalid_output", problems: ["unreachable"], span: sumSpans(spans[0]!, ...spans.slice(1)) };
}

function redactOnce(input: RedactInput, deps: RunDeps | undefined, recheck?: string[]) {
  const { system, prompt } = buildRedactorRequest({ ...input, recheck });
  return runStructured(
    {
      role: "redactor",
      promptVersion: REDACTOR_PROMPT_VERSION,
      system,
      prompt,
      schema: RedactorOutput,
      traceId: input.traceId,
      itemId: input.itemId,
      timeBudgetMs: input.timeBudgetMs ?? DEFAULT_REDACT_TIME_BUDGET_MS,
      validate: (out) => validateRedaction(input, out),
    },
    deps,
  );
}

function toResult(
  input: RedactInput,
  res: Extract<RunResult<RedactorOutput>, { status: "ok" }>,
  span: Span,
): RedactResult {
  return {
    status: "ok",
    attempts: res.attempts,
    replayed: res.replayed,
    span,
    // Timings come from the speech service, never from the model.
    phrases: input.phrases.map((src, i) => {
      const p = res.output.phrases[i]!;
      return {
        startMs: src.startMs,
        endMs: src.endMs,
        textKn: p.textKn.trim(),
        textEn: tidyEn(p.textEn),
        childNameRedacted: p.childNameRedacted,
        otherNameRedacted: p.otherNameRedacted,
        speakerGuess: p.speakerGuess,
      };
    }),
  };
}

export const redactorRole = {
  id: "redactor",
  model: modelIdFor("redactor"),
  promptVersion: REDACTOR_PROMPT_VERSION,
  schema: RedactorOutput,
  run: redactPhrases,
} as const;
