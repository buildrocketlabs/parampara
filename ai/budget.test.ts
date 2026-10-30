import { describe, expect, it } from "vitest";
import { checkBudget, costUsd, readCaps, type Caps } from "./budget";

const caps: Caps = { totalUsd: 350, dailyUsd: 25, questionsPerSessionPerHour: 30 };
const calm = { totalUsd: 10, todayUsd: 1, sessionQuestionsLastHour: 0 };

describe("costUsd", () => {
  it("prices a typical Sonnet answer (about 5k in, 700 out) near 1.7 cents", () => {
    expect(costUsd("sonnet", { inputTokens: 5_000, outputTokens: 700 })).toBeCloseTo(0.017, 6);
  });

  it("charges cached input at the cache read price", () => {
    const cold = costUsd("haiku", { inputTokens: 10_000, outputTokens: 100 });
    const warm = costUsd("haiku", { inputTokens: 10_000, outputTokens: 100, cacheReadTokens: 9_000 });
    expect(warm).toBeLessThan(cold);
    expect(warm).toBeCloseTo((1_000 * 0.1 + 9_000 * 0.01 + 100 * 0.5) / 1e6, 8);
  });

  it("prefers the SDK's exact uncached count when present", () => {
    const usd = costUsd("sonnet", {
      inputTokens: 3_000,
      noCacheInputTokens: 1_000,
      cacheWriteTokens: 2_000,
      outputTokens: 0,
    });
    expect(usd).toBeCloseTo((1_000 * 2 + 2_000 * 2.5) / 1e6, 8);
  });

  it("uses Haiku's long prompt tier above 100k tokens", () => {
    expect(costUsd("haiku", { inputTokens: 200_000, outputTokens: 0 })).toBeCloseTo(0.1, 6);
  });
});

describe("readCaps", () => {
  it("defaults to DECISIONS D14", () => {
    expect(readCaps({})).toEqual(caps);
  });

  it("reads env values", () => {
    expect(readCaps({ AI_BUDGET_USD_CAP: "100", AI_DAILY_USD_CAP: "5" }).totalUsd).toBe(100);
  });

  it("falls back to defaults on nonsense instead of crashing", () => {
    expect(readCaps({ AI_BUDGET_USD_CAP: "lots" })).toEqual(caps);
  });
});

describe("checkBudget", () => {
  it("goes live when calm", () => {
    expect(checkBudget(calm, caps, 0.03)).toEqual({ mode: "live" });
  });

  it("rate limits a session at 30 questions an hour", () => {
    expect(checkBudget({ ...calm, sessionQuestionsLastHour: 30 }, caps).mode).toBe("rate_limited");
  });

  it("refuses a call that would cross the total cap", () => {
    expect(checkBudget({ ...calm, totalUsd: 349.99 }, caps, 0.03)).toEqual({
      mode: "replay_only",
      reason: "total_cap",
    });
  });

  it("refuses a call that would cross the daily cap", () => {
    expect(checkBudget({ ...calm, todayUsd: 24.99 }, caps, 0.03)).toEqual({
      mode: "replay_only",
      reason: "daily_cap",
    });
  });

  it("prefers replays near a cap to keep the evaluator reserve", () => {
    expect(checkBudget({ ...calm, totalUsd: 320 }, caps, 0.03)).toEqual({
      mode: "prefer_replay",
      reason: "near_total_cap",
    });
    expect(checkBudget({ ...calm, todayUsd: 23 }, caps, 0.03)).toEqual({
      mode: "prefer_replay",
      reason: "near_daily_cap",
    });
  });
});
