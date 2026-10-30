import { createAdminClient } from "@/lib/supabase/admin";

// Spend so far, summed from ai_calls (Law 10). Cached briefly in memory so a burst of calls costs
// one query, and bumped locally after every call so the cache never lags this instance's own spend.

export type SpendTotals = { totalUsd: number; todayUsd: number };
export type SpendSource = () => Promise<SpendTotals>;

const CACHE_MS = 30_000;
const PAGE = 1_000;
const MAX_PAGES = 100;
/** The daily cap follows the Indian day, when teachers and the founder actually work. */
const IST_OFFSET_MS = 330 * 60_000;

export function istDayStart(now: number): number {
  const shifted = now + IST_OFFSET_MS;
  return shifted - (shifted % 86_400_000) - IST_OFFSET_MS;
}

type Cache = { at: number; dayStart: number; totals: SpendTotals };
let cache: Cache | null = null;

export function resetSpendCache() {
  cache = null;
}

/** Called after every paid call so the next budget check sees it without a query. */
export function noteSpend(usd: number, now = Date.now()) {
  if (!cache || !(usd > 0)) return;
  cache.totals.totalUsd += usd;
  if (now >= cache.dayStart) cache.totals.todayUsd += usd;
}

async function sumFromDb(dayStart: number): Promise<SpendTotals | null> {
  const db = createAdminClient();
  if (!db) return null;
  let totalUsd = 0;
  let todayUsd = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await db
      .from("ai_calls")
      .select("cost_usd, created_at")
      .gt("cost_usd", 0)
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`spend query failed: ${error.code ?? "unknown"}`);
    for (const row of data ?? []) {
      const usd = Number(row.cost_usd) || 0;
      totalUsd += usd;
      if (Date.parse(String(row.created_at)) >= dayStart) todayUsd += usd;
    }
    if (!data || data.length < PAGE) break;
  }
  return { totalUsd, todayUsd };
}

/**
 * Spend totals with a short memory, built on any source of totals (exported for tests).
 *
 * Latency (Track B, D85): the full sum pages through every paid ai_calls row, which on a cold or
 * idle instance put several database round trips in front of the teacher's first model call. Now
 * a stale memory is served at once while one refresh runs behind it (stale while revalidate), and
 * concurrent callers share one query. Only a cold instance (no memory yet, or a new Indian day)
 * waits for the sum, and the ask screen warms that on open (GET /api/ask). This instance's own
 * calls are still added the moment they are paid (noteSpend), so the cap never lags its own spend.
 *
 * Without a database (fixture mode) or when the query fails, spend falls back to what this
 * instance has seen: a database blip must not stop a teacher's answer, and this instance's own
 * calls are still counted against the cap.
 */
export function createSpendLoader(
  fetchTotals: (dayStart: number) => Promise<SpendTotals | null>,
  clock: () => number = Date.now,
): SpendSource {
  let inflight: Promise<SpendTotals> | null = null;
  const refresh = (now: number, dayStart: number): Promise<SpendTotals> => {
    inflight ??= (async () => {
      let totals: SpendTotals | null = null;
      try {
        totals = await fetchTotals(dayStart);
      } catch {
        console.warn("[budget] spend query failed; using this instance's own count");
      }
      const local =
        cache && cache.dayStart === dayStart
          ? cache.totals
          : { totalUsd: cache?.totals.totalUsd ?? 0, todayUsd: 0 };
      cache = { at: now, dayStart, totals: totals ?? { ...local } };
      return { ...cache.totals };
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  };
  return async () => {
    const now = clock();
    const dayStart = istDayStart(now);
    if (cache && cache.dayStart === dayStart) {
      if (now - cache.at >= CACHE_MS) void refresh(now, dayStart).catch(() => {});
      return { ...cache.totals };
    }
    return refresh(now, dayStart);
  };
}

export const loadSpend: SpendSource = createSpendLoader(sumFromDb);
