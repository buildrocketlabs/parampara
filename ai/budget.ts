import { z } from "zod";
import { MODELS, type ModelKey } from "./router";

// Budget is a feature (Law 10, docs/AI.md §7). Pure functions: the caller loads spend from
// ai_calls and decides what to show. Nothing here throws at a teacher.

export type Usage = {
  /** Total input tokens as the SDK reports them (includes cached portions). */
  inputTokens: number;
  outputTokens: number;
  /** When the SDK reports it, the exact uncached input; otherwise derived. */
  noCacheInputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

const LONG_PROMPT_TOKENS = 100_000;

export function costUsd(model: ModelKey, usage: Usage): number {
  const read = usage.cacheReadTokens ?? 0;
  const write = usage.cacheWriteTokens ?? 0;
  const uncached = usage.noCacheInputTokens ?? Math.max(0, usage.inputTokens - read - write);
  const m = MODELS[model];
  const p = "priceLong" in m && usage.inputTokens > LONG_PROMPT_TOKENS ? m.priceLong : m.price;
  const usd =
    (uncached * p.input + read * p.cacheRead + write * p.cacheWrite + usage.outputTokens * p.output) /
    1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

const CapsSchema = z.object({
  AI_BUDGET_USD_CAP: z.coerce.number().positive().default(350),
  AI_DAILY_USD_CAP: z.coerce.number().positive().default(25),
  AI_QUESTIONS_PER_SESSION_PER_HOUR: z.coerce.number().int().positive().default(30),
});

export type Caps = { totalUsd: number; dailyUsd: number; questionsPerSessionPerHour: number };

/** Caps from env, with DECISIONS D14 defaults. Bad values fall back to defaults, never crash. */
export function readCaps(env: Record<string, string | undefined> = process.env): Caps {
  const parsed = CapsSchema.safeParse(env);
  const v = parsed.success ? parsed.data : CapsSchema.parse({});
  return {
    totalUsd: v.AI_BUDGET_USD_CAP,
    dailyUsd: v.AI_DAILY_USD_CAP,
    questionsPerSessionPerHour: v.AI_QUESTIONS_PER_SESSION_PER_HOUR,
  };
}

export type Spend = {
  totalUsd: number;
  todayUsd: number;
  sessionQuestionsLastHour: number;
};

/** Above this share of a cap we prefer cached answers (labelled replayed) to keep a reserve. */
export const NEAR_CAP_SHARE = 0.9;

export type BudgetDecision =
  | { mode: "live" }
  | { mode: "prefer_replay"; reason: "near_total_cap" | "near_daily_cap" }
  | { mode: "replay_only"; reason: "total_cap" | "daily_cap" }
  | { mode: "rate_limited"; retryInMinutes: number };

/**
 * Decide before a call. `estimateUsd` is the expected cost of the call about to be made, so a
 * call that would cross a cap is refused rather than discovered afterwards.
 */
export function checkBudget(spend: Spend, caps: Caps, estimateUsd = 0): BudgetDecision {
  if (spend.sessionQuestionsLastHour >= caps.questionsPerSessionPerHour) {
    return { mode: "rate_limited", retryInMinutes: 60 };
  }
  if (spend.totalUsd + estimateUsd > caps.totalUsd) return { mode: "replay_only", reason: "total_cap" };
  if (spend.todayUsd + estimateUsd > caps.dailyUsd) return { mode: "replay_only", reason: "daily_cap" };
  if (spend.totalUsd + estimateUsd > caps.totalUsd * NEAR_CAP_SHARE) {
    return { mode: "prefer_replay", reason: "near_total_cap" };
  }
  if (spend.todayUsd + estimateUsd > caps.dailyUsd * NEAR_CAP_SHARE) {
    return { mode: "prefer_replay", reason: "near_daily_cap" };
  }
  return { mode: "live" };
}
