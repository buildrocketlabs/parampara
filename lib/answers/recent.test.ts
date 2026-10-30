import { describe, expect, it } from "vitest";
import { answerToFollowUp, partOfDay, type RecentAnswer } from "./recent";

const at = (h: number) => new Date(Date.UTC(2026, 9, 23, h - 5, 30)); // h:00 IST is h−5:30 UTC

describe("teacher home helpers", () => {
  it("greets by the hour in Karnataka", () => {
    expect(partOfDay(at(8))).toBe("morning");
    expect(partOfDay(at(14))).toBe("afternoon");
    expect(partOfDay(at(21))).toBe("evening");
  });

  it("asks about the newest unmarked answer, only once it could have been tried", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    const a = (
      id: string,
      hoursAgo: number,
      outcome: RecentAnswer["outcome"] = null,
    ): RecentAnswer => ({
      id,
      title: { kn: "", en: "" },
      createdAt: new Date(now - hoursAgo * 3_600_000).toISOString(),
      outcome,
    });
    expect(answerToFollowUp([a("fresh", 1), a("yesterday", 14), a("older", 30)], now)?.id).toBe(
      "yesterday",
    );
    expect(answerToFollowUp([a("fresh", 1)], now)).toBeNull();
    expect(answerToFollowUp([a("done", 20, "worked")], now)).toBeNull();
  });
});
