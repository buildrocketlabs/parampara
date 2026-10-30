import { z } from "zod";
import { FlnTopic, GradeBand, Subject } from "@/lib/domain/fln";
import { renderTriagePrompt, TRIAGE_PROMPT_VERSION, TRIAGE_SYSTEM_V4 } from "../prompts/triage";
import { modelIdFor } from "../router";
import { runStructured, type NeedsHumanReason, type RunDeps } from "../run";
import { childNameCandidates, commonNamesIn, hasChildNamePattern, mentionsName } from "../safety/names";
import {
  findDisclosures,
  findTeacherCrisis,
  findUnsafe,
  findWelfareSignals,
} from "../safety/patterns";
import { sumSpans, type Span } from "../span";
import { checkNames } from "./name_check";
import { devanagariLetters, kannadaLetters, latinLetters } from "../text";

// Triage (Haiku, triage@v1). The teacher's raw words go in; only the redacted question, its
// topic and its safety reading come out (Law 5). The pipeline stores nothing before this.

export const INTENTS = [
  "pedagogy",
  "safety_disclosure",
  "teacher_distress",
  "off_topic",
  "greeting",
  "other",
] as const;
export const TRIAGE_FLAGS = [
  "child_harm",
  "abuse",
  "self_harm",
  "child_marriage",
  "child_labour",
  "medical",
  "punishment_request",
  "teacher_distress",
  "injection",
  /** A child comes to class hungry or without eating (D72): a gentle note, never Childline. */
  "hunger",
] as const;

export const TriageOutput = z.object({
  redactedText: z
    .string()
    .min(1)
    .describe("The question word for word, every child's and private person's name replaced"),
  language: z.enum(["kn", "en", "hi", "other"]),
  topic: FlnTopic,
  subject: Subject.nullable(),
  gradeBand: GradeBand.nullable(),
  intent: z.enum(INTENTS),
  needsClarification: z.boolean(),
  clarifyingQuestion: z.object({ kn: z.string().min(1), en: z.string().min(1) }).nullable(),
  safetyFlags: z.array(z.enum(TRIAGE_FLAGS)).max(10),
  namesRedacted: z.boolean(),
});
export type TriageOutput = z.infer<typeof TriageOutput>;

export type AskLang = "kn" | "en" | "hi";

export type Triage = {
  redactedText: string;
  language: "kn" | "en" | "hi" | "other";
  topic: string;
  subject: string | null;
  gradeBand: string | null;
  intent: (typeof INTENTS)[number];
  needsClarification: boolean;
  clarifyingQuestion: { kn: string; en: string } | null;
  safetyFlags: string[];
};

export type TriageInput = {
  text: string;
  lang: AskLang;
  traceId?: string;
  itemId?: string;
  /** A second Haiku reader for names left in the question. On unless AI_TRIAGE_NAME_CHECK=0. */
  secondCheck?: boolean;
  /**
   * Told the first reading before the second name reader runs, so the caller can start work that
   * stores nothing (ranking cards) in the meantime and drop it if the name reader asks again.
   */
  onFirstPass?: (first: Triage) => void;
};

export type TriageResult =
  | { status: "ok"; triage: Triage; attempts: number; replayed: boolean; span: Span }
  | { status: "needs_human"; reason: NeedsHumanReason; problems: string[]; span: Span };

/** Triage is the first step of a 60 s route; a retry only if the first attempt failed fast. */
export const TRIAGE_TIME_BUDGET_MS = 10_000;
const MIN_RATIO = 0.35;
const RATIO_MIN_CHARS = 40;

function dominantScript(s: string): "kn" | "hi" | "latin" | "none" {
  const counts = { kn: kannadaLetters(s), hi: devanagariLetters(s), latin: latinLetters(s) };
  const best = (Object.entries(counts) as Array<[keyof typeof counts, number]>).sort(
    (a, b) => b[1] - a[1],
  )[0]!;
  return best[1] === 0 ? "none" : best[0];
}

/** Deterministic checks; the messages go back to the model and never repeat a name. */
export function validateTriage(input: Pick<TriageInput, "text">, out: TriageOutput): string[] {
  const problems: string[] = [];
  const said = input.text.trim();
  const red = out.redactedText.trim();
  // Introduced names ("ರವಿ ಅಂತ ಒಬ್ಬ ಹುಡುಗ"), and common first names said bare ("Ravi in my class"),
  // the listed ones matched exactly on both sides, never by sound (Suma is not "same").
  const names = childNameCandidates(said);
  const listedLeft = commonNamesIn(red).filter((n) => commonNamesIn(said).includes(n));
  if (names.some((n) => mentionsName(red, n)) || listedLeft.length > 0) {
    problems.push(
      "redactedText still has a child's name from the question. Replace it with ಒಂದು ಮಗು, a child or एक बच्चा.",
    );
  } else if (childNameCandidates(red).length > 0) {
    problems.push("redactedText still introduces a child by name. Remove the name.");
  }
  if (said.length >= RATIO_MIN_CHARS && red.length / said.length < MIN_RATIO) {
    problems.push(
      "redactedText is much shorter than the question. Keep the teacher's words; replace only names.",
    );
  }
  if (said.length >= RATIO_MIN_CHARS && red.length / said.length > 3) {
    problems.push("redactedText is much longer than the question. Do not add anything.");
  }
  const from = dominantScript(said);
  if (from !== "none" && dominantScript(red) !== from) {
    problems.push("redactedText must stay in the language the teacher used. Do not translate it.");
  }
  if (out.needsClarification && !out.clarifyingQuestion) {
    problems.push(
      "needsClarification is true, so give a short clarifyingQuestion in Kannada and English.",
    );
  }
  if (out.clarifyingQuestion) {
    const q = out.clarifyingQuestion;
    if (kannadaLetters(q.kn) === 0)
      problems.push("clarifyingQuestion.kn must be in Kannada script.");
    if (latinLetters(q.en) === 0) problems.push("clarifyingQuestion.en must be in English.");
    // The teacher sees this question, so it is held to the same rules as an answer.
    if (findUnsafe(`${q.kn}\n${q.en}`).length || hasChildNamePattern(`${q.kn}\n${q.en}`)) {
      problems.push("clarifyingQuestion must be kind and must not name a child.");
    }
  }
  return problems;
}

const DISCLOSURE_TO_FLAG: Record<string, (typeof TRIAGE_FLAGS)[number]> = {
  child_harm: "child_harm",
  violence_at_home: "child_harm",
  injury: "child_harm",
  abuse: "abuse",
  child_marriage: "child_marriage",
  child_labour: "child_labour",
  self_harm: "self_harm",
  neglect: "child_harm",
};

const CHILD_RISK_FLAGS = new Set(["child_harm", "abuse", "child_marriage", "child_labour"]);
/**
 * A child who comes to class hungry or without eating, in Kannada, English or Hindi (D72). Phrases
 * about coming to school without food, not the bare word: "The Very Hungry Caterpillar", ಹಸಿದ ನರಿ
 * (the hungry fox) and ಉಪವಾಸ (a fast) are stories and faith, not a note for the headmaster.
 */
const HUNGER =
  /ಹಸಿವಿನಿಂದ|ಹಸಿವಾಗಿ|ಹಸಿದುಕೊಂಡು|ಹಸಿದು\s*ಬರ|ಊಟ\s*ಮಾಡದ|ಊಟ\s*ಇಲ್ಲದ|ತಿಂಡಿ\s*(?:ತಿನ್ನದ|ಇಲ್ಲದ|ಮಾಡದ)|ಏನೂ\s*ತಿನ್ನದ|ಏನೂ\s*ತಿಂದಿರಲ್ಲ|\b(?:comes?|coming|came|arrives?|sits?)\s+(?:to (?:school|class)\s+)?hungry\b|\bhungry\s+(?:child|children|kids|boy|girl|students)\b|\b(?:is|are|feels?|looks?|seems?)\s+hungry\b|without\s+(?:eating|food|breakfast|a meal)|\bno\s+breakfast\b|\b(?:hasn[’']?t|has not|haven[’']?t|have not|not)\s+eaten\b|empty\s+stomach|भूखे?\s+(?:आते|आता|आती|रहते|रहता|रहती)|खाली\s+पेट|बिना\s+(?:खाए|खाना\s+खाए|नाश्ता)/iu;
/** Phone, Aadhaar and other ID numbers: eight or more digits, spaces or dashes allowed. */
// Contact numbers in any script we see (ASCII, Kannada ೦-೯, Devanagari ०-९): ten or more digits
// in groups of two or more (a mobile, a landline with its STD code, an Aadhaar), with the usual
// separators. Counting ("1 2 3 … 10"), dates and sums stay untouched (safety audit, 24 Oct).
const DIGIT = "[0-9\\u0CE6-\\u0CEF\\u0966-\\u096F]";
const NUMBER_RUN = new RegExp(`\\+?\\(?${DIGIT}+(?:[\\s().,\\-/]+${DIGIT}+)*\\)?`, "g");
const DIGIT_ONLY = new RegExp(DIGIT, "g");
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

function looksLikeContact(run: string): boolean {
  const digits = run.match(DIGIT_ONLY)?.length ?? 0;
  const groups = run.split(/[^0-9\u0CE6-\u0CEF\u0966-\u096F]+/).filter(Boolean);
  // A phone or ID has a long group (98450 12345, 080 2345 6789); counting runs never do (11 12 13 …).
  return (
    digits >= 10 &&
    groups.length <= 4 &&
    groups.some((g) => g.length >= 4) &&
    groups.every((g) => g.length >= 2)
  );
}

/** Masks contact details in redacted text (exported for tests). */
export function maskContacts(text: string): string {
  return text
    .replace(EMAIL, "[number]")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(NUMBER_RUN, (run) => (looksLikeContact(run) ? "[number]" : run));
}

/**
 * The model's reading plus the deterministic one. The route follows the intent, so any sign that a
 * child is at risk makes it a disclosure (child first, Law 5), and a teacher saying they want to
 * die makes it distress. The patterns only ever add, never remove what the model saw.
 */
export function finalizeTriage(input: Pick<TriageInput, "text">, out: TriageOutput): Triage {
  const flags = new Set<string>(out.safetyFlags);
  const disclosures = findDisclosures(input.text);
  for (const d of disclosures) {
    const flag = DISCLOSURE_TO_FLAG[d];
    if (flag) flags.add(flag);
  }
  if (
    findUnsafe(input.text).some(
      (c) =>
        c === "physical_punishment" || c === "threat" || c === "shaming" || c === "withholding",
    )
  ) {
    flags.add("punishment_request");
  }
  if (findWelfareSignals(input.text).includes("teacher_distress")) flags.add("teacher_distress");
  // The gentle hunger note (D72) also follows the teacher's own words, not only the model's flag.
  if (HUNGER.test(input.text)) flags.add("hunger");
  const crisis = findTeacherCrisis(input.text);
  if (crisis) flags.add("teacher_distress");
  // A model self_harm flag on a question that is not the teacher's own crisis is about a child.
  const childAtRisk =
    disclosures.length > 0 ||
    [...flags].some((f) => CHILD_RISK_FLAGS.has(f)) ||
    (flags.has("self_harm") && !crisis && out.intent !== "teacher_distress");
  if (childAtRisk) flags.add("child_harm");
  const intent = childAtRisk ? "safety_disclosure" : crisis ? "teacher_distress" : out.intent;
  const clarify = out.needsClarification ? out.clarifyingQuestion : null;
  return {
    redactedText: maskContacts(out.redactedText.trim()),
    language: out.language,
    topic: out.topic,
    subject: out.subject,
    gradeBand: out.gradeBand,
    intent,
    needsClarification: clarify !== null,
    clarifyingQuestion: clarify,
    safetyFlags: [...flags],
  };
}

export function buildTriageRequest(
  input: Pick<TriageInput, "text" | "lang"> & { recheck?: boolean },
) {
  return { system: TRIAGE_SYSTEM_V4, prompt: renderTriagePrompt(input) };
}

export function triageNameCheckEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.AI_TRIAGE_NAME_CHECK !== "0";
}

/**
 * Triage, then (by default) a second reader for any name left in the redacted question: one more
 * triage if it finds one, then a human. Fails closed: no stored question text without both.
 */
export async function triageQuestion(input: TriageInput, deps?: RunDeps): Promise<TriageResult> {
  const first = await triageOnce(input, deps);
  if (first.status !== "ok" || !(input.secondCheck ?? triageNameCheckEnabled(deps?.env)))
    return first;
  input.onFirstPass?.(first.triage);
  const spans: Span[] = [first.span];
  let current = first;
  for (let round = 0; round < 2; round++) {
    const check = await checkNames(
      {
        phrases: [{ textKn: current.triage.redactedText, textEn: "" }],
        traceId: input.traceId,
        itemId: input.itemId ? `${input.itemId}:name_check:${round}` : undefined,
        timeBudgetMs: 5_000,
      },
      deps,
    );
    spans.push(check.span);
    const span = sumSpans(spans[0]!, ...spans.slice(1));
    if (check.status !== "ok")
      return {
        status: "needs_human",
        reason: check.reason,
        problems: ["the second name check was unavailable"],
        span,
      };
    if (check.flagged.length === 0) return { ...current, span };
    if (round === 1)
      return {
        status: "needs_human",
        reason: "invalid_output",
        problems: ["a second check still finds a possible name"],
        span,
      };
    const again = await triageOnce({ ...input, recheck: true }, deps);
    spans.push(again.span);
    if (again.status !== "ok") return { ...again, span: sumSpans(spans[0]!, ...spans.slice(1)) };
    current = again;
  }
  return {
    status: "needs_human",
    reason: "invalid_output",
    problems: ["unreachable"],
    span: sumSpans(spans[0]!, ...spans.slice(1)),
  };
}

async function triageOnce(
  input: TriageInput & { recheck?: boolean },
  deps?: RunDeps,
): Promise<TriageResult> {
  const { system, prompt } = buildTriageRequest(input);
  const res = await runStructured(
    {
      role: "triage",
      promptVersion: TRIAGE_PROMPT_VERSION,
      system,
      prompt,
      schema: TriageOutput,
      traceId: input.traceId,
      itemId: input.itemId,
      timeBudgetMs: TRIAGE_TIME_BUDGET_MS,
      minRetryMs: 4_000,
      validate: (out) => validateTriage(input, out),
    },
    deps,
  );
  if (res.status !== "ok")
    return { status: "needs_human", reason: res.reason, problems: res.problems, span: res.span };
  return {
    status: "ok",
    triage: finalizeTriage(input, res.output),
    attempts: res.attempts,
    replayed: res.replayed,
    span: res.span,
  };
}

export const triageRole = {
  id: "triage",
  model: modelIdFor("triage"),
  promptVersion: TRIAGE_PROMPT_VERSION,
  schema: TriageOutput,
  run: triageQuestion,
} as const;
