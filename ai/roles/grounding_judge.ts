import { z } from "zod";
import { JUDGE_PROMPT_VERSION, JUDGE_SYSTEM_V1, renderJudgePrompt } from "../prompts/grounding_judge";
import { modelIdFor } from "../router";
import { runStructured, type NeedsHumanReason, type RunDeps } from "../run";
import { findUnsafe } from "../safety/patterns";
import type { Span } from "../span";
import { looseText } from "../text";
import { unsupportedNumbers } from "../grounding";
import { cardText, type FullCard, type Tri } from "./answerer";

// Grounding judge (Haiku, grounding_judge@v1). One step against the card it cites (Law 4). The
// model's verdict is checked twice without it: a quote must really be in the card, and a number
// the card never says cannot be "supported".

export const JudgeOutput = z.object({
  verdict: z.enum(["supported", "partial", "unsupported"]),
  cardQuote: z.string().nullable().describe("Words copied exactly from the card"),
  reason: z.string().max(300),
});
export type JudgeOutput = z.infer<typeof JudgeOutput>;

export type Verdict = JudgeOutput["verdict"];
export type JudgeInput = { step: Tri & { cardId: string }; card: FullCard; traceId?: string; itemId?: string };

export type JudgeResult =
  | { status: "ok"; verdict: Verdict; cardQuote: string | null; attempts: number; replayed: boolean; span: Span }
  | { status: "needs_human"; reason: NeedsHumanReason; problems: string[]; span: Span };

export const JUDGE_TIME_BUDGET_MS = 7_000;

/** What a step can rest on: the card's steps, materials and reason, not its title or problem. */
function practiceText(card: FullCard): string {
  return [...card.steps, ...card.materials, ...(card.why ? [card.why] : [])].map((b) => `${b.kn}\n${b.en}`).join("\n");
}

/** Is the quote really the card's practice, word for word (ignoring case, spacing and quotes)? */
export function quoteInCard(card: FullCard, quote: string): boolean {
  const q = looseText(quote).replace(/[.,;:!?।]+$/u, "");
  if (q.length < 12) return false;
  return looseText(practiceText(card)).includes(q);
}

export function validateJudgement(card: FullCard, out: JudgeOutput): string[] {
  if (out.verdict === "unsupported") return [];
  if (!out.cardQuote) return [`A ${out.verdict} verdict needs cardQuote: the card's own words that support the step.`];
  if (!quoteInCard(card, out.cardQuote)) {
    return ["cardQuote must be copied exactly from the card, as one passage. Do not paraphrase or join pieces."];
  }
  return [];
}

/** The verdict after the deterministic checks: harm or a number the card never says is not supported. */
export function finalizeJudgement(step: Tri, card: FullCard, out: JudgeOutput): { verdict: Verdict; cardQuote: string | null } {
  let verdict = out.verdict;
  if (findUnsafe(`${step.kn}\n${step.en}\n${step.hi ?? ""}`).length > 0) verdict = "unsupported";
  if (verdict === "supported" && unsupportedNumbers(`${step.en} ${step.kn}`, cardText(card)).length > 0) verdict = "partial";
  return { verdict, cardQuote: verdict === "unsupported" ? null : out.cardQuote };
}

export function buildJudgeRequest(input: Pick<JudgeInput, "step" | "card">) {
  return { system: JUDGE_SYSTEM_V1, prompt: renderJudgePrompt(input) };
}

export async function judgeStep(input: JudgeInput, deps?: RunDeps): Promise<JudgeResult> {
  const { system, prompt } = buildJudgeRequest(input);
  const res = await runStructured(
    {
      role: "grounding_judge",
      promptVersion: JUDGE_PROMPT_VERSION,
      system,
      prompt,
      schema: JudgeOutput,
      traceId: input.traceId,
      itemId: input.itemId,
      timeBudgetMs: JUDGE_TIME_BUDGET_MS,
      minRetryMs: 3_000,
      validate: (out) => validateJudgement(input.card, out),
    },
    deps,
  );
  if (res.status !== "ok") return { status: "needs_human", reason: res.reason, problems: res.problems, span: res.span };
  return { status: "ok", ...finalizeJudgement(input.step, input.card, res.output), attempts: res.attempts, replayed: res.replayed, span: res.span };
}

export const groundingJudgeRole = {
  id: "grounding_judge",
  model: modelIdFor("grounding_judge"),
  promptVersion: JUDGE_PROMPT_VERSION,
  schema: JudgeOutput,
  run: judgeStep,
} as const;
