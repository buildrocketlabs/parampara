import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSpendLoader, istDayStart, noteSpend, resetSpendCache } from "./spend";

// D85: the spend sum is never in front of a teacher's model call once this instance has seen it.

const NOON_IST = Date.UTC(2026, 9, 28, 6, 30);

describe("spend memory (stale while revalidate)", () => {
  beforeEach(() => resetSpendCache());

  it("waits for the first sum, then serves memory without a query", async () => {
    let now = NOON_IST;
    const fetchTotals = vi.fn(async () => ({ totalUsd: 10, todayUsd: 1 }));
    const load = createSpendLoader(fetchTotals, () => now);
    expect(await load()).toEqual({ totalUsd: 10, todayUsd: 1 });
    now += 5_000;
    expect(await load()).toEqual({ totalUsd: 10, todayUsd: 1 });
    expect(fetchTotals).toHaveBeenCalledTimes(1);
  });

  it("serves a stale memory at once and refreshes behind it, once", async () => {
    let now = NOON_IST;
    let release: (v: { totalUsd: number; todayUsd: number }) => void = () => {};
    const fetchTotals = vi
      .fn<(dayStart: number) => Promise<{ totalUsd: number; todayUsd: number } | null>>()
      .mockResolvedValueOnce({ totalUsd: 10, todayUsd: 1 })
      .mockImplementationOnce(() => new Promise((r) => (release = r)));
    const load = createSpendLoader(fetchTotals, () => now);
    await load();
    now += 60_000;
    // Stale: answered from memory, without waiting for the slow query.
    expect(await load()).toEqual({ totalUsd: 10, todayUsd: 1 });
    expect(await load()).toEqual({ totalUsd: 10, todayUsd: 1 });
    expect(fetchTotals).toHaveBeenCalledTimes(2);
    release({ totalUsd: 12, todayUsd: 3 });
    await new Promise((r) => setTimeout(r, 0));
    expect(await load()).toEqual({ totalUsd: 12, todayUsd: 3 });
  });

  it("counts this instance's own spend at once", async () => {
    const now = NOON_IST;
    const load = createSpendLoader(
      async () => ({ totalUsd: 10, todayUsd: 1 }),
      () => now,
    );
    await load();
    noteSpend(0.5, now);
    expect(await load()).toEqual({ totalUsd: 10.5, todayUsd: 1.5 });
  });

  it("a new Indian day waits for a fresh sum; a failed query keeps the running total", async () => {
    let now = NOON_IST;
    const fetchTotals = vi
      .fn<(dayStart: number) => Promise<{ totalUsd: number; todayUsd: number } | null>>()
      .mockResolvedValueOnce({ totalUsd: 10, todayUsd: 1 })
      .mockRejectedValueOnce(new Error("down"));
    const load = createSpendLoader(fetchTotals, () => now);
    await load();
    now = istDayStart(now) + 86_400_000 + 60_000;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await load()).toEqual({ totalUsd: 10, todayUsd: 0 });
    warn.mockRestore();
  });

  it("shares one query between callers that arrive together", async () => {
    const fetchTotals = vi.fn(async () => ({ totalUsd: 2, todayUsd: 2 }));
    const load = createSpendLoader(fetchTotals, () => NOON_IST);
    await Promise.all([load(), load(), load()]);
    expect(fetchTotals).toHaveBeenCalledTimes(1);
  });
});
