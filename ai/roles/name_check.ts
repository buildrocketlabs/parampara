import { z } from "zod";
import { NAME_CHECK_PROMPT_VERSION, NAME_CHECK_SYSTEM_V2, renderNameCheckPrompt } from "../prompts/name_check";
import { phraseRef } from "../prompts/redactor";
import { runStructured, type NeedsHumanReason, type RunDeps } from "../run";
import type { Span } from "../span";

// A second reader of redacted phrases (Law 5, behind AI_NAME_CHECK=1). Catches what the redactor
// cannot see in one chunk, like a name introduced a chunk earlier and repeated bare here.

export const NameCheckOutput = z.object({
  flagged: z.array(z.string().regex(/^P\d+$/)).describe("Refs of phrases that may still contain a name"),
});
export type NameCheckOutput = z.infer<typeof NameCheckOutput>;

export type NameCheckInput = {
  phrases: Array<{ textKn: string; textEn: string }>;
  masterName?: string;
  traceId?: string;
  itemId?: string;
  timeBudgetMs?: number;
};

export type NameCheckResult =
  | { status: "ok"; flagged: string[]; span: Span }
  | { status: "needs_human"; reason: NeedsHumanReason; problems: string[]; span: Span };

export function nameCheckEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AI_NAME_CHECK === "1";
}

export function validateNameCheck(count: number, out: NameCheckOutput): string[] {
  const known = new Set(Array.from({ length: count }, (_, i) => phraseRef(i)));
  const unknown = out.flagged.filter((r) => !known.has(r));
  return unknown.length ? [`${unknown.join(", ")} not in the transcript. Use only P1 to P${count}.`] : [];
}

export function buildNameCheckRequest(input: Pick<NameCheckInput, "phrases" | "masterName">) {
  return { system: NAME_CHECK_SYSTEM_V2, prompt: renderNameCheckPrompt(input) };
}

export async function checkNames(input: NameCheckInput, deps?: RunDeps): Promise<NameCheckResult> {
  const { system, prompt } = buildNameCheckRequest(input);
  const res = await runStructured(
    {
      role: "name_check",
      promptVersion: NAME_CHECK_PROMPT_VERSION,
      system,
      prompt,
      schema: NameCheckOutput,
      traceId: input.traceId,
      itemId: input.itemId,
      timeBudgetMs: input.timeBudgetMs ?? 45_000,
      minRetryMs: Math.min(10_000, Math.floor((input.timeBudgetMs ?? 45_000) / 3)),
      validate: (out) => validateNameCheck(input.phrases.length, out),
    },
    deps,
  );
  if (res.status !== "ok") return { status: "needs_human", reason: res.reason, problems: res.problems, span: res.span };
  return { status: "ok", flagged: [...new Set(res.output.flagged)], span: res.span };
}
