import { z } from "zod";
import {
  INSIGHTS_DIGEST_PROMPT_VERSION,
  INSIGHTS_DIGEST_SYSTEM_V2,
  renderInsightsDigestPrompt,
} from "../prompts/insights_digest";
import { modelIdFor } from "../router";
import { runStructured, type NeedsHumanReason, type RunDeps } from "../run";
import { findUnsafe } from "../safety/patterns";
import type { Span } from "../span";

// Insights digest (Sonnet, insights_digest@v1, docs/AI.md §2). The officer's weekly note, written
// only from anonymous aggregates. Grounded in the counts given: a number the input never counts is
// a validation failure (retried, then the page keeps its deterministic actions). It talks about
// topics and practices, never about watching, ranking or blaming people or places. No districts
// are given at all, so no district can be compared or blamed.

/** A count; FEWER when fewer than 5 different teachers are in the group; PRIVATE when kept private. */
export const FEWER = "fewer than 5 teachers";
export const PRIVATE = "kept private";
export type DigestCount = number | typeof FEWER | typeof PRIVATE;

export type DigestInput = {
  kind: "field" | "sample";
  week: { from: string; to: string };
  funnel: { asked: DigestCount; answered: DigestCount; tried: DigestCount; worked: DigestCount };
  teachersWhoAsked: DigestCount;
  topics: Array<{
    topic: string;
    topicKn: string;
    asked: DigestCount;
    waitingForMaster: DigestCount;
  }>;
  practices: Array<{
    title: string;
    titleKn: string;
    master: string | null;
    tried: DigestCount;
    worked: DigestCount;
  }>;
  costPerTeacherInr: number | null;
};

const Line = z.object({
  kn: z.string().min(4).max(320),
  en: z.string().min(4).max(320),
});

export const DigestOutput = z.object({
  headlineKn: z.string().min(4).max(240),
  headlineEn: z.string().min(4).max(240),
  actions: z.array(Line).min(2).max(4),
  watch: z.array(Line).max(3),
});
export type DigestOutput = z.infer<typeof DigestOutput>;

export type DigestResult =
  | { status: "ok"; digest: DigestOutput; attempts: number; replayed: boolean; span: Span }
  | { status: "needs_human"; reason: NeedsHumanReason; problems: string[]; span: Span };

export const DIGEST_TIME_BUDGET_MS = 90_000;

const KANNADA_DIGITS = /[೦-೯]/g;
const NUMBER = /\d+(?:[.,]\d+)*/g;
/** Any decimal digit that is neither ASCII nor Kannada (fullwidth, Devanagari, Arabic and so on). */
const OTHER_DIGITS = /(?![0-9೦-೯])\p{Nd}/u;
// The words "fewer than 5" and "5ಕ್ಕಿಂತ ಕಡಿಮೆ" are how a hidden group is said; their 5 is not a count.
const FEWER_PHRASE = /fewer than (?:5|five)\b|5\s*ಕ್ಕಿಂತ\s*ಕಡಿಮೆ/gi;
const NOT_A_COUNT = /\b(?:no one|one of|one by one|one another|each one|one more)\b/gi;
const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  half: 0.5,
  twice: 2,
  double: 2,
};
// Kannada number words, matched at the start of a word so case endings still count (ಮೂರರಲ್ಲಿ).
// ಒಂದು is left out on purpose: it is also the article "a".
const KANNADA_NUMBER_WORDS: Array<[string, number]> = [
  ["ಎರಡು", 2],
  ["ಎರಡ", 2],
  ["ಮೂರು", 3],
  ["ಮೂರ", 3],
  ["ನಾಲ್ಕು", 4],
  ["ನಾಲ್ಕ", 4],
  ["ಐದು", 5],
  ["ಆರು", 6],
  ["ಏಳು", 7],
  ["ಎಂಟು", 8],
  ["ಒಂಬತ್ತು", 9],
  ["ಹತ್ತು", 10],
  // Stems: 11 to 19 and the tens with any ending (ಇಪ್ಪತ್ತೊಂಬತ್ತು is 29). Any of them, said and not
  // counted, is an invented number; the value only has to be one the counts never give.
  ["ಹನ್ನ", 11],
  ["ಹದಿ", 13],
  ["ಹತ್ತೊ", 19],
  ["ಇಪ್ಪತ್ತ", 20],
  ["ಮೂವತ್ತ", 30],
  ["ನಲವತ್ತ", 40],
  ["ಐವತ್ತ", 50],
  ["ಅರವತ್ತ", 60],
  ["ಎಪ್ಪತ್ತ", 70],
  ["ಎಂಬತ್ತ", 80],
  ["ತೊಂಬತ್ತ", 90],
  ["ನೂರು", 100],
];
// Law 6: the note is about topics and practices, never about watching, ranking or blaming people.
const SURVEILLANCE = new RegExp(
  [
    String.raw`\b(?:rank\w*|leaderboard\w*|monitor\w*|surveil\w*|underperform\w*|worst|lowest|weakest|laggard\w*|lagging|behind|lazy|blame\w*|punish\w*|inspect\w*|show.?cause|disciplin\w*|warn\w*|notice to|compare\w*|comparison|pressure\w*|close watch|watch (?:the|over|those) teachers|name and shame|visit (?:those|the|their) schools?)\b`,
    "ಶಿಕ್ಷೆ|ಶ್ರೇಯಾಂಕ|ತಪಾಸಣೆ|ಕ್ರಮ ಕೈಗೊಳ್ಳ|ಹಿಂದುಳಿ|ಸೋಮಾರಿ|ನೋಟಿಸ್|ನಿಗಾ|ಎಚ್ಚರಿಕೆ|ಹೋಲಿಸ|ಒತ್ತಡ",
  ].join("|"),
  "i",
);
const IDENTIFIER =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[\w.+-]+@[\w-]+\.[\w.]+|teacher_id|https?:\/\/|www\.|(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/i;
const KANNADA = /[ಀ-೿]/;

function toNumber(token: string): number {
  // "1,200" is twelve hundred; our counts never use a decimal comma.
  return Number(token.replace(/,/g, ""));
}

/** Every count the aggregates give (not dates, not the group size): only these may be said. */
export function allowedNumbers(input: DigestInput): Set<number> {
  const counts: DigestCount[] = [
    ...Object.values(input.funnel),
    input.teachersWhoAsked,
    ...input.topics.flatMap((t) => [t.asked, t.waitingForMaster]),
    ...input.practices.flatMap((p) => [p.tried, p.worked]),
  ];
  const nums = counts.filter((c): c is number => typeof c === "number");
  if (input.costPerTeacherInr !== null) nums.push(input.costPerTeacherInr);
  return new Set(nums);
}

/** Numbers a line says, in digits (ASCII or Kannada) or in English or Kannada words. */
export function numbersIn(text: string): number[] {
  const ascii = text
    .replace(KANNADA_DIGITS, (d) => String(d.charCodeAt(0) - 0x0ce6))
    .replace(FEWER_PHRASE, " ")
    .replace(NOT_A_COUNT, " ");
  const found = (ascii.match(NUMBER) ?? []).map(toNumber);
  for (const word of ascii.toLowerCase().match(/\b[a-z]+\b/g) ?? []) {
    const n = NUMBER_WORDS[word];
    if (n !== undefined) found.push(n);
  }
  for (const token of ascii.split(/[\s.,;:!?()“”"'‘’]+/)) {
    const hit = KANNADA_NUMBER_WORDS.find(([w]) => token.startsWith(w));
    if (hit) found.push(hit[1]);
  }
  return found;
}

function lines(out: DigestOutput): Array<{ where: string; text: string; lang: "kn" | "en" }> {
  return [
    { where: "headlineKn", text: out.headlineKn, lang: "kn" },
    { where: "headlineEn", text: out.headlineEn, lang: "en" },
    ...out.actions.flatMap((a, i) => [
      { where: `actions.${i}.kn`, text: a.kn, lang: "kn" as const },
      { where: `actions.${i}.en`, text: a.en, lang: "en" as const },
    ]),
    ...out.watch.flatMap((w, i) => [
      { where: `watch.${i}.kn`, text: w.kn, lang: "kn" as const },
      { where: `watch.${i}.en`, text: w.en, lang: "en" as const },
    ]),
  ];
}

/** Titles, topics and masters quoted back from the input are names, not numbers said. */
function withoutQuotedNames(text: string, input: DigestInput): string {
  const names = [
    ...input.practices.flatMap((p) => [p.title, p.titleKn, p.master ?? ""]),
    ...input.topics.flatMap((t) => [t.topic, t.topicKn]),
  ]
    .filter((n) => n.length >= 3)
    .sort((a, b) => b.length - a.length);
  let out = text;
  for (const name of names) out = out.replace(new RegExp(escapeRe(name), "gi"), " ");
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Deterministic checks; each problem is fed back to the model on retry (Law 3). */
export function validateDigest(input: DigestInput, out: DigestOutput): string[] {
  const allowed = allowedNumbers(input);
  const problems: string[] = [];
  for (const line of lines(out)) {
    const text = withoutQuotedNames(line.text, input);
    if (OTHER_DIGITS.test(text)) {
      problems.push(`${line.where} uses digits other than 0 to 9 or Kannada digits.`);
    }
    const invented = numbersIn(text).filter((n) => !allowed.has(n));
    if (invented.length) {
      problems.push(
        `${line.where} says ${invented.join(", ")}, which is not one of the counts given. Use only counts given, as digits, and never a date.`,
      );
    }
    if (/fewer than (?:5|five) (?:questions|tries|times|answers)/i.test(line.text)) {
      problems.push(
        `${line.where}: a hidden group is "fewer than 5 teachers", never fewer than 5 questions.`,
      );
    }
    if (SURVEILLANCE.test(line.text)) {
      problems.push(
        `${line.where} talks about watching, ranking, comparing or blaming people or places. Talk about topics and practices.`,
      );
    }
    if (findUnsafe(line.text).length) {
      problems.push(`${line.where} mentions punishment, threats or shaming. Remove it.`);
    }
    if (IDENTIFIER.test(line.text))
      problems.push(`${line.where} contains an id, contact or link. Remove it.`);
    if (line.lang === "kn" && !KANNADA.test(line.text))
      problems.push(`${line.where} must be written in Kannada.`);
    if (line.lang === "en" && KANNADA.test(line.text))
      problems.push(`${line.where} must be written in English.`);
    if (/[—–]/.test(line.text)) problems.push(`${line.where} uses a dash. Write plain sentences.`);
  }
  return problems;
}

export function buildDigestRequest(input: DigestInput) {
  return { system: INSIGHTS_DIGEST_SYSTEM_V2, prompt: renderInsightsDigestPrompt(input) };
}

export async function summarizeInsights(
  input: DigestInput & { itemId?: string; traceId?: string },
  deps?: RunDeps,
): Promise<DigestResult> {
  const { itemId, traceId, ...aggregates } = input;
  const { system, prompt } = buildDigestRequest(aggregates);
  const res = await runStructured(
    {
      role: "insights_digest",
      promptVersion: INSIGHTS_DIGEST_PROMPT_VERSION,
      system,
      prompt,
      schema: DigestOutput,
      validate: (out) => validateDigest(aggregates, out),
      itemId,
      traceId,
      timeBudgetMs: DIGEST_TIME_BUDGET_MS,
      minRetryMs: 30_000,
    },
    deps,
  );
  if (res.status !== "ok") {
    return { status: "needs_human", reason: res.reason, problems: res.problems, span: res.span };
  }
  return {
    status: "ok",
    digest: res.output,
    attempts: res.attempts,
    replayed: res.replayed,
    span: res.span,
  };
}

export const insightsDigestRole = {
  id: "insights_digest",
  model: modelIdFor("insights_digest"),
  promptVersion: INSIGHTS_DIGEST_PROMPT_VERSION,
  schema: DigestOutput,
  run: summarizeInsights,
} as const;
