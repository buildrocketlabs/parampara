// The reviewer queue as a person reads it (D98). Every tap of the Sample safety chip on the one tap
// demo account adds an urgent row with the same redacted words, so jurors alone could bury a real
// child safety case under twenty copies of one Sample question. Here:
// - Sample rows with the same reason and the same redacted words become one item that says how
//   many times it was asked (the safety chip, and the "no card" chip too); field rows are never
//   merged, each is a real teacher.
// - A Sample urgent item stops counting as urgent a day after it was last asked; a field urgent item
//   stays urgent until a person handles it.
// - Urgent items lead, field before Sample, so a real case on Thursday is always first.

export const SAMPLE_URGENT_HOURS = 24;

export type QueueRowLike = {
  id: string;
  question_id: string;
  reason: string;
  urgent: boolean;
  status: string;
  is_sample: boolean;
  created_at: string;
};

export type QueueItem<R extends QueueRowLike> = {
  /** The newest row: its id anchors the item, its day is shown. */
  row: R;
  /** Every row the item stands for, so handling it handles them all. */
  ids: string[];
  /** How many times it was asked (1 for every field row). */
  count: number;
  /** Shown and counted as urgent now. */
  urgentNow: boolean;
};

const open = (r: QueueRowLike) => r.status !== "resolved";

/** The same words, however they were spaced or cased. */
export function sameWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Urgent now: a field urgent row always; a Sample one for a day after it was asked. */
export function urgentNow(r: QueueRowLike, now: Date): boolean {
  if (!r.urgent || !open(r)) return false;
  if (!r.is_sample) return true;
  return now.getTime() - new Date(r.created_at).getTime() < SAMPLE_URGENT_HOURS * 3_600_000;
}

export function groupQueue<R extends QueueRowLike>(
  rows: R[],
  wordsOf: (questionId: string) => string | undefined,
  now: Date,
): QueueItem<R>[] {
  const groups = new Map<string, R[]>();
  const items: R[][] = [];
  for (const r of rows) {
    const words = wordsOf(r.question_id);
    const mergeable = r.is_sample && words !== undefined;
    if (!mergeable) {
      items.push([r]);
      continue;
    }
    const key = `${open(r) ? "open" : "done"}|${r.reason}|${sameWords(words)}`;
    const group = groups.get(key);
    if (group) group.push(r);
    else {
      const fresh = [r];
      groups.set(key, fresh);
      items.push(fresh);
    }
  }
  return items
    .map((members) => {
      const sorted = [...members].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const row = sorted[0]!;
      return {
        row,
        ids: sorted.map((m) => m.id),
        count: sorted.length,
        urgentNow: urgentNow(row, now),
      };
    })
    .sort(byPriority);
}

/** Open first; urgent now first, field before Sample; then the oldest first, as before. */
function byPriority<R extends QueueRowLike>(a: QueueItem<R>, b: QueueItem<R>): number {
  const rank = (i: QueueItem<R>) =>
    (open(i.row) ? 0 : 4) + (i.urgentNow ? 0 : 2) + (i.urgentNow && i.row.is_sample ? 1 : 0);
  return rank(a) - rank(b) || a.row.created_at.localeCompare(b.row.created_at);
}

/** What the reviewer's room counts: urgent items now, field and Sample apart, and items waiting. */
export function queueCounts<R extends QueueRowLike>(
  items: QueueItem<R>[],
): { urgentField: number; urgentSample: number; open: number } {
  const waiting = items.filter((i) => open(i.row));
  return {
    urgentField: waiting.filter((i) => i.urgentNow && !i.row.is_sample && i.row.reason === "safety")
      .length,
    urgentSample: waiting.filter((i) => i.urgentNow && i.row.is_sample && i.row.reason === "safety")
      .length,
    open: waiting.length,
  };
}
