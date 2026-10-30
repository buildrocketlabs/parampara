import { z } from "zod";
import { renderRetrieverPrompt, renderRetrieverSystem, RETRIEVER_PROMPT_VERSION } from "../prompts/retriever";
import { modelIdFor } from "../router";
import { runStructured, type NeedsHumanReason, type RunDeps } from "../run";
import { blankSpan, type Span } from "../span";
import { tidyEn } from "../text";
import type { Triage } from "./triage";

// Retriever (Haiku, retriever@v1). Ranks the compact index of approved cards the pipeline has
// already prefiltered (D11). The model sees short refs (C1, C2), never database ids, and may
// honestly return none: "no master has answered this yet" beats a card about something else.

export const MAX_PICKS = 3;

export const RankOutput = z.object({
  picks: z
    .array(
      z.object({
        ref: z.string().regex(/^C\d+$/).describe("A card ref from the index, like C3"),
        reason: z.string().min(1).max(300),
      }),
    )
    .max(MAX_PICKS),
  noneFit: z.boolean(),
});
export type RankOutput = z.infer<typeof RankOutput>;

export type CardIndexEntry = {
  id: string;
  titleEn: string;
  problemEn: string;
  topic: string | null;
  gradeBand: string | null;
  subject: string | null;
};

export type RankInput = { triage: Triage; index: CardIndexEntry[]; traceId?: string; itemId?: string };

export type RankResult =
  | { status: "ok"; cardIds: string[]; reasons: string[]; attempts: number; replayed: boolean; span: Span }
  | { status: "needs_human"; reason: NeedsHumanReason; problems: string[]; span: Span };

export const RANK_TIME_BUDGET_MS = 7_000;

/** Index lines in id order, so the same library gives the same cached system block. */
export function indexRefs(index: CardIndexEntry[]) {
  const sorted = [...index].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const lines = sorted.map((c, i) => ({ ...c, ref: `C${i + 1}` }));
  return { lines, idOf: new Map(lines.map((l) => [l.ref, l.id])), refOf: new Map(lines.map((l) => [l.id, l.ref])) };
}

export function validateRanking(idOf: Map<string, string>, out: RankOutput): string[] {
  const problems: string[] = [];
  const unknown = out.picks.map((p) => p.ref).filter((r) => !idOf.has(r));
  if (unknown.length) problems.push(`${unknown.join(", ")} not in the card index. Pick only refs from the index.`);
  const refs = out.picks.map((p) => p.ref);
  if (new Set(refs).size !== refs.length) problems.push("Each card may be picked once.");
  if (out.noneFit && out.picks.length > 0) problems.push("noneFit is true but you picked cards. Either pick cards or say none fit.");
  return problems;
}

export function buildRankRequest(input: Pick<RankInput, "triage" | "index">) {
  const { lines, idOf } = indexRefs(input.index);
  return { idOf, system: renderRetrieverSystem(lines), prompt: renderRetrieverPrompt(input.triage) };
}

export async function rankCards(input: RankInput, deps?: RunDeps): Promise<RankResult> {
  if (input.index.length === 0) {
    return { status: "ok", cardIds: [], reasons: [], attempts: 0, replayed: false, span: blankSpan("retriever", modelIdFor("retriever"), RETRIEVER_PROMPT_VERSION) };
  }
  const { idOf, system, prompt } = buildRankRequest(input);
  const res = await runStructured(
    {
      role: "retriever",
      promptVersion: RETRIEVER_PROMPT_VERSION,
      system,
      prompt,
      schema: RankOutput,
      traceId: input.traceId,
      itemId: input.itemId,
      timeBudgetMs: RANK_TIME_BUDGET_MS,
      minRetryMs: 3_000,
      validate: (out) => validateRanking(idOf, out),
    },
    deps,
  );
  if (res.status !== "ok") return { status: "needs_human", reason: res.reason, problems: res.problems, span: res.span };
  const picks = res.output.noneFit ? [] : res.output.picks;
  return {
    status: "ok",
    cardIds: picks.map((p) => idOf.get(p.ref)!),
    reasons: picks.map((p) => tidyEn(p.reason)),
    attempts: res.attempts,
    replayed: res.replayed,
    span: res.span,
  };
}

export const retrieverRole = {
  id: "retriever",
  model: modelIdFor("retriever"),
  promptVersion: RETRIEVER_PROMPT_VERSION,
  schema: RankOutput,
  run: rankCards,
} as const;
