import { z } from "zod";
import {
  ANSWERER_PROMPT_VERSION,
  ANSWERER_SYSTEM_V3,
  renderAnswererPrompt,
} from "../prompts/answerer";
import { modelIdFor } from "../router";
import { runStructured, type NeedsHumanReason, type RunDeps } from "../run";
import { hasChildNamePattern } from "../safety/names";
import { findUnsafe } from "../safety/patterns";
import { blankSpan, type Span } from "../span";
import { devanagariLetters, kannadaLetters, latinLetters, tidyEn } from "../text";
import { unsupportedNumbers } from "../grounding";
import { looseText } from "../text";
import type { AskLang } from "./triage";

// Answerer (Sonnet, answerer@v1). The given approved cards in, 2 to 5 steps out, each naming the
// card it restates. The pipeline then drops steps citing other cards and has every step judged.

const TriModel = z.object({
  kn: z.string().min(1),
  en: z.string().min(1),
  hi: z.string().min(1).nullable(),
});
const CardRef = z
  .string()
  .regex(/^K\d+$/)
  .describe("The card this step restates, like K1");

export const AnswerOutput = z.object({
  title: TriModel,
  steps: z
    .array(TriModel.extend({ cardRef: CardRef }))
    .min(2)
    .max(5),
  materials: z.array(TriModel).max(8),
  why: TriModel.nullable(),
});
export type AnswerOutput = z.infer<typeof AnswerOutput>;

type Bi = { kn: string; en: string };
export type Tri = Bi & { hi?: string };

export type FullCard = {
  id: string;
  masterId: string;
  masterName: string | null;
  title: Bi;
  problem: Bi;
  steps: Bi[];
  materials: Bi[];
  why: Bi | null;
  quoteSegmentId: number | null;
  isSample: boolean;
};

export type DraftAnswer = {
  title: Tri;
  steps: Array<Tri & { cardId: string }>;
  materials: Tri[];
  why: Tri | null;
};

export type AnswerInput = {
  question: string;
  lang: AskLang;
  cards: FullCard[];
  traceId?: string;
  itemId?: string;
  /**
   * Live only (D86): each step as soon as the model has finished writing it, before the answer is
   * validated. A step here may not survive (a retry writes new ones), so it is only a hint for work
   * that can be dropped; the pipeline keeps early work only for steps the final answer repeats.
   */
  onStep?: (step: Tri & { cardId: string }) => void;
};

export type AnswerResult =
  | { status: "ok"; answer: DraftAnswer; attempts: number; replayed: boolean; span: Span }
  | { status: "needs_human"; reason: NeedsHumanReason; problems: string[]; span: Span };

/** Sonnet in a 60 s route: one attempt, and a retry only if the first failed quickly. */
export const ANSWER_TIME_BUDGET_MS = 22_000;

/** Everything a card says, for checking numbers against it. */
export function cardText(
  c: Pick<FullCard, "title" | "problem" | "steps" | "materials" | "why">,
): string {
  return [c.title, c.problem, ...c.steps, ...c.materials, ...(c.why ? [c.why] : [])]
    .map((b) => `${b.kn} ${b.en}`)
    .join("\n");
}

export function cardRefs(cards: FullCard[]) {
  const byRef = new Map(cards.map((c, i) => [`K${i + 1}`, c]));
  return byRef;
}

type TriOut = z.infer<typeof TriModel>;

export function validateAnswer(
  ctx: { lang: AskLang; byRef: Map<string, FullCard> },
  out: AnswerOutput,
): string[] {
  const problems: string[] = [];
  const fields: Array<[string, TriOut]> = [
    ["title", out.title],
    ...out.steps.map((s, i) => [`step ${i + 1}`, s] as [string, TriOut]),
    ...out.materials.map((m, i) => [`material ${i + 1}`, m] as [string, TriOut]),
    ...(out.why ? ([["why", out.why]] as Array<[string, TriOut]>) : []),
  ];
  for (const [name, f] of fields) {
    if (kannadaLetters(f.kn) === 0) problems.push(`${name}: kn must be in Kannada script.`);
    if (kannadaLetters(f.en) > latinLetters(f.en)) problems.push(`${name}: en must be in English.`);
    if (ctx.lang === "hi" && (!f.hi || devanagariLetters(f.hi) === 0))
      problems.push(`${name}: hi must be written in Hindi (Devanagari).`);
  }
  out.steps.forEach((s, i) => {
    const card = ctx.byRef.get(s.cardRef);
    if (!card) {
      problems.push(
        `step ${i + 1} cites ${s.cardRef}, which is not one of the cards. Use only K1 to K${ctx.byRef.size}.`,
      );
      return;
    }
    const extra = unsupportedNumbers(s.en, cardText(card));
    if (extra.length)
      problems.push(
        `step ${i + 1} says ${extra.join(", ")}, which ${s.cardRef} does not say. Use the card's own numbers.`,
      );
  });
  // The title, why and materials are shown too, so they are held to the cards as well.
  const all = [...ctx.byRef.values()].map(cardText).join("\n");
  for (const [name, f] of [
    ["title", out.title],
    ...(out.why ? [["why", out.why] as const] : []),
  ] as Array<[string, TriOut]>) {
    const extra = unsupportedNumbers(f.en, all);
    if (extra.length)
      problems.push(`${name} says ${extra.join(", ")}, which the cards do not say.`);
  }
  const cardMaterials = [...ctx.byRef.values()]
    .flatMap((c) => c.materials)
    .map((m) => `${looseText(m.en)}\n${looseText(m.kn)}`)
    .join("\n");
  const cardWords = looseText(all);
  out.materials.forEach((m, i) => {
    const en = looseText(m.en).replace(/^(?:a|an|the|some)\s+/, "");
    const kn = looseText(m.kn);
    if (!cardMaterials.includes(en) && !cardMaterials.includes(kn) && !cardWords.includes(en)) {
      problems.push(`material ${i + 1} is not in the cards. List only materials the cards name.`);
    }
  });
  const harms = findUnsafe(fields.map(([, f]) => `${f.kn}\n${f.en}\n${f.hi ?? ""}`).join("\n"));
  if (harms.length)
    problems.push(
      `The answer must not contain ${harms.join(", ").replace(/_/g, " ")}. Use only the kind practice in the cards.`,
    );
  if (hasChildNamePattern(fields.map(([, f]) => `${f.kn}\n${f.en}\n${f.hi ?? ""}`).join("\n"))) {
    problems.push("The answer must not name a child.");
  }
  return problems;
}

function tri(f: TriOut, lang: AskLang): Tri {
  const base = { kn: f.kn.trim(), en: tidyEn(f.en) };
  return lang === "hi" && f.hi ? { ...base, hi: f.hi.trim() } : base;
}

export function finalizeAnswer(
  ctx: { lang: AskLang; byRef: Map<string, FullCard> },
  out: AnswerOutput,
): DraftAnswer {
  return {
    title: tri(out.title, ctx.lang),
    steps: out.steps.map((s) => ({ ...tri(s, ctx.lang), cardId: ctx.byRef.get(s.cardRef)!.id })),
    materials: out.materials.map((m) => tri(m, ctx.lang)),
    why: out.why ? tri(out.why, ctx.lang) : null,
  };
}

/**
 * Turns the growing partial answer into finished steps, each told once per attempt: a step is
 * finished when the next one has begun or the steps list has closed (materials or why follow).
 * Steps are shaped exactly as finalizeAnswer shapes them, so an early step and a final one match.
 */
export function finishedSteps(
  ctx: { lang: AskLang; byRef: Map<string, FullCard> },
  onStep: (step: Tri & { cardId: string }) => void,
) {
  const told = new Set<string>();
  return (partial: unknown, attempt: number) => {
    const p = partial as Partial<{
      steps: Array<Partial<z.infer<typeof TriModel> & { cardRef: string }>>;
      materials: unknown;
      why: unknown;
    }> | null;
    const steps = Array.isArray(p?.steps) ? p.steps : [];
    const closed = p?.materials !== undefined || p?.why !== undefined;
    steps.forEach((s, i) => {
      if (!(closed || i < steps.length - 1)) return;
      const key = `${attempt}:${i}`;
      if (
        told.has(key) ||
        !s ||
        typeof s.kn !== "string" ||
        typeof s.en !== "string" ||
        !s.kn.trim() ||
        !s.en.trim()
      )
        return;
      const card = typeof s.cardRef === "string" ? ctx.byRef.get(s.cardRef) : undefined;
      if (!card) return;
      told.add(key);
      onStep({
        ...tri({ kn: s.kn, en: s.en, hi: typeof s.hi === "string" ? s.hi : null }, ctx.lang),
        cardId: card.id,
      });
    });
  };
}

export function buildAnswerRequest(input: Pick<AnswerInput, "question" | "lang" | "cards">) {
  const byRef = cardRefs(input.cards);
  const prompt = renderAnswererPrompt({
    question: input.question,
    lang: input.lang,
    cards: [...byRef].map(([ref, c]) => ({
      ref,
      masterName: c.masterName,
      title: c.title,
      problem: c.problem,
      steps: c.steps,
      materials: c.materials,
      why: c.why,
    })),
  });
  return { byRef, system: ANSWERER_SYSTEM_V3, prompt };
}

export async function answerQuestion(input: AnswerInput, deps?: RunDeps): Promise<AnswerResult> {
  if (input.cards.length === 0) {
    return {
      status: "needs_human",
      reason: "invalid_output",
      problems: ["no cards"],
      span: blankSpan("answerer", modelIdFor("answerer"), ANSWERER_PROMPT_VERSION),
    };
  }
  const { byRef, system, prompt } = buildAnswerRequest(input);
  const ctx = { lang: input.lang, byRef };
  const res = await runStructured(
    {
      role: "answerer",
      promptVersion: ANSWERER_PROMPT_VERSION,
      system,
      prompt,
      schema: AnswerOutput,
      traceId: input.traceId,
      itemId: input.itemId,
      timeBudgetMs: ANSWER_TIME_BUDGET_MS,
      minRetryMs: 10_000,
      validate: (out) => validateAnswer(ctx, out),
      onPartial: input.onStep ? finishedSteps(ctx, input.onStep) : undefined,
    },
    deps,
  );
  if (res.status !== "ok")
    return { status: "needs_human", reason: res.reason, problems: res.problems, span: res.span };
  return {
    status: "ok",
    answer: finalizeAnswer(ctx, res.output),
    attempts: res.attempts,
    replayed: res.replayed,
    span: res.span,
  };
}

export const answererRole = {
  id: "answerer",
  model: modelIdFor("answerer"),
  promptVersion: ANSWERER_PROMPT_VERSION,
  schema: AnswerOutput,
  run: answerQuestion,
} as const;
