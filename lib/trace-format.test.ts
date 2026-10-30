import { describe, expect, it } from "vitest";
import type { Trace, TraceStep } from "@/lib/ask/types";
import type { Lookup } from "@/lib/i18n/fill";
import { messages } from "@/lib/i18n/messages";
import {
  cacheDetail,
  formatLatency,
  formatTokens,
  formatUsd,
  isRemoved,
  replayInfo,
  replayLine,
  verdictCounts,
} from "./trace-format";

describe("trace labels", () => {
  it("formats latency in ms below a second and in seconds above", () => {
    expect(formatLatency(640)).toBe("640 ms");
    expect(formatLatency(8_420)).toBe("8.4 s");
    expect(formatLatency(12_600)).toBe("13 s");
    expect(formatLatency(undefined)).toBe("");
  });

  it("formats cost without inventing precision", () => {
    expect(formatUsd(0.0213)).toBe("$0.021");
    expect(formatUsd(0.0004)).toBe("<$0.001");
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(1.234)).toBe("$1.23");
    expect(formatUsd(Number.NaN)).toBe("");
  });

  it("groups tokens the Indian way", () => {
    expect(formatTokens(5120)).toBe("5,120");
    expect(formatTokens(123456)).toBe("1,23,456");
  });

  it("treats unsupported or removed steps as removed and counts them", () => {
    expect(isRemoved({ verdict: "unsupported" })).toBe(true);
    expect(isRemoved({ verdict: "partial", removed: true })).toBe(true);
    expect(isRemoved({ verdict: "supported" })).toBe(false);
    expect(
      verdictCounts([
        {
          kind: "grounding",
          title: { kn: "", en: "" },
          verdicts: [
            { step: "a", verdict: "supported" },
            { step: "b", verdict: "partial" },
            { step: "c", verdict: "unsupported" },
          ],
        },
      ]),
    ).toEqual({ kept: 2, removed: 1 });
  });
});

describe("a replayed answer's trace (D35, F-P1)", () => {
  const look: Lookup = (lang, key) => messages[lang][key];
  const graded: TraceStep = { kind: "grounding", title: { kn: "", en: "" }, costUsd: 0.006 };
  const replay: Trace = {
    steps: [
      {
        kind: "cache",
        title: { kn: "ಹಿಂದೆ ಕೊಟ್ಟ ಉತ್ತರ", en: "Answered before" },
        detail: "Same question, same checked cards",
        at: "2026-10-23T15:30:00.000Z",
        latencyMs: 700,
        costUsd: 0,
      },
      graded,
    ],
    totals: { latencyMs: 13_000, costUsd: 0.019 },
  };

  it("is not a replay without a cache step first", () => {
    expect(replayInfo({ steps: [graded], totals: replay.totals })).toBeNull();
  });

  it("says what the replay took now and what the first answer took, and when", () => {
    const info = replayInfo(replay)!;
    expect(info).toEqual({
      nowMs: 700,
      nowUsd: 0,
      firstAt: "2026-10-23T15:30:00.000Z",
      firstMs: 13_000,
      firstUsd: 0.019,
    });
    const line = replayLine(info, look);
    expect(line.en).toBe(
      "Replayed in 700 ms · nothing spent now · first answered on Fri, 23 Oct, 9:00 pm in 13 s for $0.019",
    );
    expect(line.kn).toBe(
      "ಈಗ 700 ms ನಲ್ಲಿ ತೋರಿಸಿದ್ದು · ಈಗ ಏನೂ ಖರ್ಚಾಗಿಲ್ಲ · ಮೊದಲು ಉತ್ತರಿಸಿದ್ದು ಶುಕ್ರವಾರ, 23 ಅಕ್ಟೋಬರ್, ರಾತ್ರಿ 9:00; ಆಗ 13 s, $0.019 ಖರ್ಚು",
    );
    expect(`${line.kn} ${line.en}`).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("names a triage call a replay paid for, and never invents a replay time", () => {
    const paid: Trace = {
      ...replay,
      steps: [{ ...replay.steps[0]!, latencyMs: undefined, costUsd: 0.0021 }, graded],
    };
    const line = replayLine(replayInfo(paid)!, look);
    expect(line.en.startsWith("Replayed · $0.002 spent now · ")).toBe(true);
  });

  it("reads the first answer's time from an older replay's detail, shown without the raw ISO", () => {
    const legacy: Trace = {
      ...replay,
      steps: [
        {
          kind: "cache",
          title: { kn: "", en: "Answered before" },
          detail:
            "first answered at 2026-10-23T15:30:00.000+00:00; same question, same checked cards",
        },
        graded,
      ],
    };
    const info = replayInfo(legacy)!;
    expect(info.firstAt).toBe("2026-10-23T15:30:00.000+00:00");
    expect(replayLine(info, look).en).toContain("first answered on Fri, 23 Oct, 9:00 pm");
    expect(cacheDetail(legacy.steps[0]!.detail)).toBe("Same question, same checked cards");
    // The answer's own record wins over nothing; a missing time drops the date, never shows a raw one.
    const bare: Trace = { ...replay, steps: [{ ...replay.steps[0]!, at: undefined }, graded] };
    expect(replayLine(replayInfo(bare)!, look).en).toContain("first answered in 13 s for $0.019");
    expect(replayInfo(bare, "2026-10-23T15:30:00.000Z")!.firstAt).toBe("2026-10-23T15:30:00.000Z");
  });
});
