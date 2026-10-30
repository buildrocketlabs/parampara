import type { Trace, TraceStep, Verdict } from "@/lib/ask/types";
import type { Lang } from "@/lib/i18n";
import { fill, type Lookup } from "@/lib/i18n/fill";
import { formatWhen } from "@/lib/when";

// Labels for the TraceDrawer (docs/AI.md §2): how long, how many tokens, what it cost. Every
// number shown comes from the trace itself (Law 7); these only format it.

export function formatLatency(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function formatUsd(usd: number | undefined): string {
  if (usd === undefined || !Number.isFinite(usd) || usd < 0) return "";
  if (usd === 0) return "$0";
  if (usd < 0.001) return "<$0.001";
  return `$${usd.toFixed(usd < 0.1 ? 3 : 2)}`;
}

export function formatTokens(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n) || n < 0) return "";
  return Math.round(n).toLocaleString("en-IN");
}

/** A verdict line is struck through when the judge said unsupported or the step was removed. */
export function isRemoved(v: { verdict: Verdict; removed?: boolean }): boolean {
  return v.removed === true || v.verdict === "unsupported";
}

/** Counts for the grounding summary: how many steps were kept, and how many removed. */
export function verdictCounts(steps: readonly TraceStep[]): { kept: number; removed: number } {
  let kept = 0;
  let removed = 0;
  for (const s of steps) {
    for (const v of s.verdicts ?? []) {
      if (isRemoved(v)) removed++;
      else kept++;
    }
  }
  return { kept, removed };
}

// ── Replays (D35, F-P1) ─────────────────────────────────────────────────────────────────────
// A replayed answer carries its first answer's trace and totals. The drawer must not show those as
// if they happened now: it says what the replay took and spent, and when and for how much the
// first answer was made.

/** Older replays wrote the first answer's raw ISO time into the cache step's detail. */
const LEGACY_AT = /^first answered at (\S+?);\s*/;

export type ReplayInfo = {
  /** The replay's own time; unknown for replays made before F-P1. */
  nowMs?: number;
  /** What the replay spent: nothing, or one triage call. */
  nowUsd: number;
  /** When the first answer was made (ISO), if known. */
  firstAt: string | null;
  firstMs: number;
  firstUsd: number;
};

/** Replay facts from a trace whose first step is the cache step; null for a fresh answer. */
export function replayInfo(trace: Trace, firstAnsweredAt?: string | null): ReplayInfo | null {
  const step = trace.steps[0];
  if (!step || step.kind !== "cache") return null;
  return {
    nowMs: step.latencyMs,
    nowUsd: step.costUsd ?? 0,
    firstAt: step.at ?? firstAnsweredAt ?? step.detail?.match(LEGACY_AT)?.[1] ?? null,
    firstMs: trace.totals.latencyMs,
    firstUsd: trace.totals.costUsd,
  };
}

/**
 * "Replayed in 0.7 s · nothing spent now · first answered on Thu, 29 Oct, 9:10 pm in 13 s for
 * $0.019", in both languages, the time in IST with the day part in words for Kannada.
 */
export function replayLine(info: ReplayInfo, look: Lookup): { kn: string; en: string } {
  const line = (lang: Lang) => {
    const now =
      info.nowMs !== undefined
        ? fill(look(lang, "trace.replay.now"), { t: formatLatency(info.nowMs) })
        : look(lang, "trace.replay.nowPlain");
    const spent =
      info.nowUsd > 0
        ? fill(look(lang, "trace.replay.spent"), { cost: formatUsd(info.nowUsd) })
        : look(lang, "trace.replay.free");
    const at = formatWhen(info.firstAt, lang);
    const vars = { at: at ?? "", t: formatLatency(info.firstMs), cost: formatUsd(info.firstUsd) };
    const first = fill(look(lang, at ? "trace.replay.first" : "trace.replay.firstPlain"), vars);
    return [now, spent, first].join(" · ");
  };
  return { kn: line("kn"), en: line("en") };
}

/** A cache step's detail without the raw ISO time older replays carried. */
export function cacheDetail(detail: string | undefined): string | undefined {
  if (!detail) return detail;
  const rest = detail.replace(LEGACY_AT, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
