import { z } from "zod";
import { renderSafetyPrompt, SAFETY_PROMPT_VERSION, SAFETY_SYSTEM_V3 } from "../prompts/safety";
import { modelIdFor } from "../router";
import { runStructured, type NeedsHumanReason, type RunDeps } from "../run";
import { hasChildNamePattern } from "../safety/names";
import { findDisclosures, findUnsafe, type UnsafeCategory } from "../safety/patterns";
import type { Span } from "../span";

// Safety (Haiku, safety@v1, docs/AI.md §5). Last on the final answer. The patterns can only make
// it stricter: a model "ok" never overrides a pattern hit, and a model failure is a human's job.

export const SAFETY_CATEGORIES = [
  "punishment",
  "threat",
  "shaming",
  "comparison",
  "label",
  "bias",
  "withholding",
  "diagnosis",
  "child_name",
  "medical_advice",
  "other",
] as const;

export const SafetyOutput = z.object({
  ok: z.boolean(),
  categories: z.array(z.enum(SAFETY_CATEGORIES)).max(11),
  escalate: z.boolean(),
  reason: z.string().max(300),
});
export type SafetyOutput = z.infer<typeof SafetyOutput>;

export type SafetyCheck = { ok: boolean; categories: string[]; escalate: boolean };
export type SafetyInput = { question: string; answerText: string; traceId?: string; itemId?: string };

export type SafetyResult =
  | { status: "ok"; safety: SafetyCheck; attempts: number; replayed: boolean; span: Span }
  | { status: "needs_human"; reason: NeedsHumanReason; problems: string[]; span: Span };

export const SAFETY_TIME_BUDGET_MS = 6_000;

const FROM_PATTERN: Record<UnsafeCategory, (typeof SAFETY_CATEGORIES)[number]> = {
  physical_punishment: "punishment",
  threat: "threat",
  shaming: "shaming",
  label: "label",
  bias: "bias",
  withholding: "withholding",
  diagnosis: "diagnosis",
};

export function finalizeSafety(input: Pick<SafetyInput, "question" | "answerText">, out: SafetyOutput): SafetyCheck {
  const categories = new Set<string>(out.categories);
  for (const c of findUnsafe(input.answerText)) categories.add(FROM_PATTERN[c]);
  if (hasChildNamePattern(input.answerText)) categories.add("child_name");
  if (!out.ok && categories.size === 0) categories.add("other");
  return {
    ok: out.ok && categories.size === 0,
    categories: [...categories],
    escalate: out.escalate || findDisclosures(input.question).length > 0,
  };
}

export function buildSafetyRequest(input: Pick<SafetyInput, "question" | "answerText">) {
  return { system: SAFETY_SYSTEM_V3, prompt: renderSafetyPrompt(input) };
}

export async function checkSafety(input: SafetyInput, deps?: RunDeps): Promise<SafetyResult> {
  const { system, prompt } = buildSafetyRequest(input);
  const res = await runStructured(
    {
      role: "safety",
      promptVersion: SAFETY_PROMPT_VERSION,
      system,
      prompt,
      schema: SafetyOutput,
      traceId: input.traceId,
      itemId: input.itemId,
      timeBudgetMs: SAFETY_TIME_BUDGET_MS,
      minRetryMs: 3_000,
    },
    deps,
  );
  if (res.status !== "ok") return { status: "needs_human", reason: res.reason, problems: res.problems, span: res.span };
  return { status: "ok", safety: finalizeSafety(input, res.output), attempts: res.attempts, replayed: res.replayed, span: res.span };
}

export const safetyRole = {
  id: "safety",
  model: modelIdFor("safety"),
  promptVersion: SAFETY_PROMPT_VERSION,
  schema: SafetyOutput,
  run: checkSafety,
} as const;
