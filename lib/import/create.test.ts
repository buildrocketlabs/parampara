import { describe, expect, it } from "vitest";
import { checkPlan, CreateInterviewSchema, type CreateInterviewInput } from "./create";
import { consentOnlyEndMs } from "./store";

const base: CreateInterviewInput = {
  masterId: "00000000-0000-4000-8000-000000000001",
  consent: { mode: "in_recording" },
  parts: [
    { name: "note-1.m4a", mime: "audio/mp4", bytes: 1000, durationMs: 50_000 },
    { name: "note-2.m4a", mime: "audio/mp4", bytes: 1000, durationMs: 20_000 },
  ],
  chunks: [
    { idx: 0, startMs: 0, endMs: 25_000, silent: false },
    { idx: 1, startMs: 25_000, endMs: 50_000, silent: false },
    { idx: 2, startMs: 50_000, endMs: 70_000, silent: true },
  ],
};

describe("import plan check", () => {
  it("accepts a contiguous plan across parts", () => {
    expect(checkPlan(base, 60 * 60_000)).toBeNull();
  });

  it("rejects gaps, long chunks, a timeline that misses the parts, silence only and over cap", () => {
    const gap = {
      ...base,
      chunks: base.chunks.map((c, i) => (i === 1 ? { ...c, startMs: 26_000 } : c)),
    };
    expect(checkPlan(gap, 60 * 60_000)).toBe("chunk_gap");
    const long = { ...base, chunks: [{ idx: 0, startMs: 0, endMs: 70_000, silent: false }] };
    expect(checkPlan(long, 60 * 60_000)).toBe("chunk_length");
    const short = { ...base, chunks: base.chunks.slice(0, 2) };
    expect(checkPlan(short, 60 * 60_000)).toBe("timeline_mismatch");
    const silent = { ...base, chunks: base.chunks.map((c) => ({ ...c, silent: true })) };
    expect(checkPlan(silent, 60 * 60_000)).toBe("no_speech");
    expect(checkPlan(base, 60_000)).toBe("too_long");
  });

  it("a consent first note needs answers after it and must itself hold speech", () => {
    const notes: CreateInterviewInput = {
      ...base,
      consent: { mode: "first_note" },
      chunks: base.chunks.map((c) => ({ ...c, silent: false })),
    };
    expect(checkPlan(notes, 60 * 60_000)).toBeNull();
    const alone = {
      ...notes,
      parts: [{ ...base.parts[0]!, durationMs: 70_000 }],
    };
    expect(checkPlan(alone, 60 * 60_000)).toBe("first_note_alone");
    const silentConsent = {
      ...notes,
      chunks: notes.chunks.map((c) => (c.startMs < 50_000 ? { ...c, silent: true } : c)),
    };
    expect(checkPlan(silentConsent, 60 * 60_000)).toBe("consent_silent");
    const silentAnswers = {
      ...notes,
      chunks: notes.chunks.map((c) => (c.startMs >= 50_000 ? { ...c, silent: true } : c)),
    };
    expect(checkPlan(silentAnswers, 60 * 60_000)).toBe("no_speech");
  });

  it("accepts the four consent modes and nothing else", () => {
    for (const mode of ["in_recording", "first_note", "separate_clip", "recorded_earlier"]) {
      expect(CreateInterviewSchema.safeParse({ ...base, consent: { mode } }).success).toBe(true);
    }
    expect(CreateInterviewSchema.safeParse({ ...base, consent: { mode: "assumed" } }).success).toBe(
      false,
    );
  });
});

describe("consentOnlyEndMs", () => {
  it("reads where a consent only first part ends, and nothing otherwise", () => {
    expect(
      consentOnlyEndMs([
        { start_ms: 0, duration_ms: 61_250, consent_only: true },
        { start_ms: 61_250, duration_ms: 200_000 },
      ]),
    ).toBe(61_250);
    expect(consentOnlyEndMs([{ start_ms: 0, duration_ms: 61_250 }])).toBeNull();
    expect(consentOnlyEndMs([])).toBeNull();
    expect(consentOnlyEndMs(null)).toBeNull();
    expect(consentOnlyEndMs([{ consent_only: "yes", duration_ms: 5 }])).toBeNull();
  });
});
