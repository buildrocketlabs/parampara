import { describe, expect, it } from "vitest";
import { groupQueue, queueCounts, sameWords, urgentNow, type QueueRowLike } from "./queue-groups";

const NOW = new Date("2026-10-29T10:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

let n = 0;
function row(over: Partial<QueueRowLike> & { q: string }): QueueRowLike {
  n += 1;
  return {
    id: `row-${n}`,
    question_id: over.q,
    reason: "safety",
    urgent: true,
    status: "open",
    is_sample: true,
    created_at: hoursAgo(1),
    ...over,
  };
}

const WORDS: Record<string, string> = {
  beats: "A child told me her father beats her. What should I do?",
  beats2: "a child told me her father beats her what should I do",
  field: "A child told me her father beats her. What should I do?",
  coding: "A child keeps asking to learn computer coding.",
};
const wordsOf = (q: string) => WORDS[q.replace(/-\d+$/, "")];

describe("the reviewer queue (D98)", () => {
  it("shows twenty taps of the Sample safety chip as one item asked twenty times", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      row({ q: `beats-${i}`, created_at: hoursAgo(20 - i) }),
    );
    const items = groupQueue(rows, wordsOf, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]!.count).toBe(20);
    expect(items[0]!.ids).toHaveLength(20);
    // The newest tap stands for the item.
    expect(items[0]!.row.created_at).toBe(hoursAgo(1));
    expect(queueCounts(items)).toEqual({ urgentField: 0, urgentSample: 1, open: 1 });
  });

  it("treats the same words with other spacing, case or punctuation as the same question", () => {
    expect(sameWords(WORDS.beats!)).toBe(sameWords(WORDS.beats2!));
    const items = groupQueue([row({ q: "beats-1" }), row({ q: "beats2-1" })], wordsOf, NOW);
    expect(items).toHaveLength(1);
  });

  it("never merges field rows: each is a real teacher", () => {
    const rows = [
      row({ q: "field-1", is_sample: false }),
      row({ q: "field-2", is_sample: false }),
      row({ q: "beats-1" }),
    ];
    const items = groupQueue(rows, wordsOf, NOW);
    expect(items.filter((i) => !i.row.is_sample)).toHaveLength(2);
    expect(items.every((i) => !i.row.is_sample || i.count === 1)).toBe(true);
    expect(queueCounts(items)).toEqual({ urgentField: 2, urgentSample: 1, open: 3 });
  });

  it("lets a Sample urgent item fall out of urgent a day after it was last asked; field never", () => {
    expect(urgentNow(row({ q: "beats-1", created_at: hoursAgo(23) }), NOW)).toBe(true);
    expect(urgentNow(row({ q: "beats-1", created_at: hoursAgo(25) }), NOW)).toBe(false);
    expect(
      urgentNow(row({ q: "field-1", is_sample: false, created_at: hoursAgo(24 * 30) }), NOW),
    ).toBe(true);
    // An old group asked again an hour ago is urgent again.
    const items = groupQueue(
      [
        row({ q: "beats-1", created_at: hoursAgo(72) }),
        row({ q: "beats-2", created_at: hoursAgo(1) }),
      ],
      wordsOf,
      NOW,
    );
    expect(items[0]!.urgentNow).toBe(true);
    const stale = groupQueue([row({ q: "beats-1", created_at: hoursAgo(30) })], wordsOf, NOW);
    expect(stale[0]!.urgentNow).toBe(false);
    expect(queueCounts(stale)).toEqual({ urgentField: 0, urgentSample: 0, open: 1 });
  });

  it("puts a field urgent case first, however many Sample ones arrived after it", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => row({ q: `beats-${i}`, created_at: hoursAgo(i) })),
      row({ q: "coding-1", reason: "no_card", urgent: false, created_at: hoursAgo(48) }),
      row({ q: "field-1", is_sample: false, created_at: hoursAgo(0.5) }),
    ];
    const items = groupQueue(rows, wordsOf, NOW);
    expect(items.map((i) => [i.row.is_sample, i.row.reason])).toEqual([
      [false, "safety"],
      [true, "safety"],
      [true, "no_card"],
    ]);
  });

  it("keeps handled and waiting copies apart, and each reason apart", () => {
    const rows = [
      row({ q: "beats-1" }),
      row({ q: "beats-2", status: "resolved" }),
      row({ q: "beats-3", reason: "no_card", urgent: false }),
      row({ q: "coding-1", reason: "no_card", urgent: false }),
      row({ q: "coding-2", reason: "no_card", urgent: false }),
    ];
    const items = groupQueue(rows, wordsOf, NOW);
    expect(items).toHaveLength(4);
    // The "no card" chip tapped twice is one item too.
    expect(items.find((i) => i.row.question_id.startsWith("coding"))!.count).toBe(2);
    expect(items.at(-1)!.row.status).toBe("resolved");
    expect(queueCounts(items).open).toBe(3);
  });

  it("does not merge a Sample row whose words it cannot read", () => {
    const items = groupQueue([row({ q: "unknown-1" }), row({ q: "unknown-2" })], wordsOf, NOW);
    expect(items).toHaveLength(2);
  });
});
