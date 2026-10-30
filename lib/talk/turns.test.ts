import { describe, expect, it } from "vitest";
import {
  activeElapsedMs,
  checkConsentAudio,
  checkTurnChunks,
  CONSENT_MIN_MS,
  MAX_GAP_MS,
  partFor,
  planSlot,
  redactBatches,
  RESUME_WINDOW_MS,
  resumeOffer,
  SLOT_SIZE,
  TurnBody,
  typedPhrases,
  type TurnAudio,
} from "./turns";
import { allowSay, voicePath } from "./voice";

const audio = (ms: number[], silent = false): TurnAudio => {
  let t = 0;
  const chunks = ms.map((d) => {
    const c = { startMs: t, endMs: t + d, silent };
    t += d;
    return c;
  });
  return { name: "turn-3.webm", mime: "audio/webm", bytes: 120_000, durationMs: t, chunks };
};
const Q = { kn: "ಆಮೇಲೆ ನೀವು ಏನು ಮಾಡಿದಿರಿ?", en: "What did you do next?", topic: "letters" as const, probe: true };

describe("a turn's chunk plan", () => {
  it("must be contiguous, under the speech limit and cover the audio", () => {
    expect(checkTurnChunks(audio([29_000, 20_000]))).toBeNull();
    expect(checkTurnChunks(audio([31_000]))).toBe("chunk_length");
    expect(checkTurnChunks({ ...audio([10_000, 10_000]), durationMs: 30_000 })).toBe("timeline_mismatch");
    const gap = audio([10_000, 10_000]);
    gap.chunks[1]!.startMs += 500;
    expect(checkTurnChunks(gap)).toBe("chunk_gap");
  });
});

describe("slots on one timeline", () => {
  it("reserves a slot for the question, then lays the audio chunks at the end of the timeline", () => {
    const plan = planSlot({ durationMs: 95_000, chunkCount: 7 }, audio([29_000, 11_000]), true);
    expect(plan.slot).toBe(7);
    expect(plan.chunkRows).toEqual([
      { idx: 8, start_ms: 95_000, end_ms: 124_000, status: "pending" },
      { idx: 9, start_ms: 124_000, end_ms: 135_000, status: "pending" },
    ]);
    expect(plan).toMatchObject({ nextChunkCount: 10, nextDurationMs: 135_000 });
  });

  it("keeps conversation order in segment indexes: the question before the answer", () => {
    const plan = planSlot({ durationMs: 0, chunkCount: 3 }, audio([20_000]), true);
    const questionIdx = plan.slot * SLOT_SIZE;
    const firstAnswerIdx = plan.chunkRows[0]!.idx * SLOT_SIZE;
    expect(questionIdx).toBeLessThan(firstAnswerIdx);
  });

  it("stores chunks as silent when speech to text is not connected, so extraction is not held up", () => {
    const plan = planSlot({ durationMs: 0, chunkCount: 0 }, audio([20_000]), false);
    expect(plan.chunkRows.every((r) => r.status === "silent")).toBe(true);
  });

  it("a typed answer takes a slot and no time", () => {
    const plan = planSlot({ durationMs: 60_000, chunkCount: 4 }, null, true);
    expect(plan).toMatchObject({ slot: 4, chunkRows: [], nextChunkCount: 5, nextDurationMs: 60_000 });
  });

  it("remembers the question and where its chunks are", () => {
    const body = TurnBody.parse({ kind: "answer", turnId: "6b2a4f4e-8c3e-4a5b-9a2f-1c2d3e4f5a6b", question: Q, audio: audio([20_000]) });
    const plan = planSlot({ durationMs: 10_000, chunkCount: 2 }, body.kind === "answer" ? body.audio : null, true);
    expect(partFor("iv", 2, body, plan)).toMatchObject({
      path: "iv/part-2.webm",
      kind: "answer",
      slot: 2,
      chunk_from: 3,
      chunk_to: 4,
      topic: "letters",
      probe: true,
      question_kn: Q.kn,
      start_ms: 10_000,
    });
  });
});

describe("typed answers", () => {
  it("are joined into phrases of up to 400 characters for the redactor, every word kept", () => {
    const phrases = typedPhrases("ಮರಳು ತಂದೆ. ತಟ್ಟೆಯಲ್ಲಿ ಹಾಕಿದೆ!\nಮಗು ಬರೆಯಿತು", 5_000);
    expect(phrases.map((p) => p.text)).toEqual(["ಮರಳು ತಂದೆ. ತಟ್ಟೆಯಲ್ಲಿ ಹಾಕಿದೆ! ಮಗು ಬರೆಯಿತು"]);
    expect(phrases.every((p) => p.startMs === 5_000 && p.endMs === 5_000)).toBe(true);
    expect(typedPhrases("ಅ".repeat(900), 0).every((p) => p.text.length <= 400)).toBe(true);
  });

  it("keeps all of a long answer made of many short sentences (no silent cap)", () => {
    const text = Array.from({ length: 200 }, (_, i) => `ವಾಕ್ಯ ${i}.`).join(" ").slice(0, 4_000);
    const phrases = typedPhrases(text, 0);
    expect(phrases.length).toBeLessThanOrEqual(20);
    expect(phrases.map((p) => p.text).join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " ").trim());
  });

  it("goes to the redactor in small batches, so a long Kannada answer is never cut short", () => {
    const phrases = typedPhrases("ಅ".repeat(3_900), 0);
    const batches = redactBatches(phrases);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((b) => b.reduce((n, p) => n + p.text.length, 0) <= 1_200)).toBe(true);
    expect(batches.flat()).toEqual(phrases);
  });

  it("has nothing to send when there are no words, only marks", () => {
    expect(typedPhrases("... !!! ?", 0)).toEqual([]);
  });

  it("are refused when empty or far too long", () => {
    const base = { kind: "typed", turnId: "6b2a4f4e-8c3e-4a5b-9a2f-1c2d3e4f5a6b", question: Q };
    expect(TurnBody.safeParse({ ...base, text: "   " }).success).toBe(false);
    expect(TurnBody.safeParse({ ...base, text: "ಅ".repeat(4_001) }).success).toBe(false);
  });
});

describe("consent", () => {
  it("is a real recording: long enough to say the line, and not all silence", () => {
    expect(checkConsentAudio(audio([20_000]))).toBeNull();
    expect(checkConsentAudio(audio([3_000]))).toBe("consent_short");
    expect(checkConsentAudio(audio([20_000, 9_000], true))).toBe("consent_silent");
    expect(CONSENT_MIN_MS).toBeGreaterThanOrEqual(5_000);
  });
});

describe("Hanate's voice", () => {
  it("caches one file per line of text and voice", () => {
    expect(voicePath("ನಮಸ್ಕಾರ")).toBe(voicePath(" ನಮಸ್ಕಾರ "));
    expect(voicePath("ನಮಸ್ಕಾರ")).not.toBe(voicePath("ಧನ್ಯವಾದ"));
    expect(voicePath("ನಮಸ್ಕಾರ")).toMatch(/^voice\/[0-9a-f]{64}\.mp3$/);
  });

  it("limits one person to 40 new lines in ten minutes", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 40; i++) expect(allowSay("u-limit", t0 + i)).toBe(true);
    expect(allowSay("u-limit", t0 + 41)).toBe(false);
    expect(allowSay("u-limit", t0 + 11 * 60_000)).toBe(true);
  });
});

describe("coming back to a talk", () => {
  const at = (min: number) => new Date(Date.UTC(2026, 9, 24, 9, min)).toISOString();
  const base = { path: null, name: "x", mime: "text/plain", bytes: 0, start_ms: 0, duration_ms: 0, storable: false, stored: false, slot: 0, chunk_from: 1, chunk_to: 1 };
  const parts = [
    { ...base, kind: "consent" as const, turn_id: "c", at: at(0) },
    { ...base, kind: "typed" as const, turn_id: "a", topic: "warmup" as const, probe: false, question_kn: "ನಮಸ್ಕಾರ?", question_en: "Hello?", at: at(4) },
    { ...base, kind: "skip" as const, turn_id: "b", topic: "letters" as const, probe: false, question_kn: "ಅಕ್ಷರ?", question_en: "Letters?", at: at(6) },
  ];

  it("counts the time spent talking, not a long break", () => {
    const live = { startedAt: at(0), parts };
    // 4 + 2 minutes of talk, then a two hour break counted as at most ten minutes.
    expect(activeElapsedMs(live, Date.parse(at(6)) + 2 * 60 * 60_000)).toBe((6 + 10) * 60_000);
    expect(activeElapsedMs({ startedAt: null, parts }, Date.now())).toBe(0);
  });

  it("offers the answered and skipped counts and the last question asked", () => {
    const live = { id: "iv", masterId: "m", status: "recording", isSample: true, startedAt: at(0), durationMs: 0, chunkCount: 3, parts };
    expect(resumeOffer(live, at(6))).toEqual({
      interviewId: "iv",
      masterId: "m",
      answered: 1,
      skipped: 1,
      lastQuestion: { kn: "ಅಕ್ಷರ?", en: "Letters?" },
      updatedAt: at(6),
    });
    expect(MAX_GAP_MS).toBe(10 * 60_000);
    expect(RESUME_WINDOW_MS).toBe(6 * 60 * 60_000);
  });

  it("a skip is a turn of its own, with no audio and nothing for the transcript", () => {
    const body = TurnBody.parse({ kind: "skip", turnId: "6b2a4f4e-8c3e-4a5b-9a2f-1c2d3e4f5a6b", question: Q });
    const plan = planSlot({ durationMs: 10_000, chunkCount: 4 }, null, true);
    expect(partFor("iv", 3, body, plan)).toMatchObject({ kind: "skip", path: null, slot: 4, topic: "letters", question_kn: Q.kn });
    expect(plan).toMatchObject({ chunkRows: [], nextChunkCount: 5, nextDurationMs: 10_000 });
  });
});
