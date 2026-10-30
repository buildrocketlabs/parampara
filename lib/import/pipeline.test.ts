import { describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "./memory-store";
import { dedupeAgainst, overlap, PipelineError, step, transcribeChunk } from "./pipeline";
import type { ExtractedCard, ImportAi, InterviewRow, SegmentForExtraction } from "./types";

const interview: InterviewRow = {
  id: "iv-1",
  masterId: "m-1",
  status: "transcribing",
  isSample: true,
  durationMs: 75_000,
  error: null,
};

const CHUNKS = [
  { idx: 0, startMs: 0, endMs: 25_000 },
  { idx: 1, startMs: 25_000, endMs: 50_000 },
  { idx: 2, startMs: 50_000, endMs: 75_000 },
];

function card(evidence: number[], steps = 2): ExtractedCard {
  return {
    titleKn: "ಕಡ್ಡಿ ಕಟ್ಟು",
    titleEn: "Stick bundles",
    problemKn: "ಸಂಖ್ಯೆ",
    problemEn: "Numbers",
    gradeBand: "1-2",
    subject: "maths",
    topic: "number_sense",
    steps: Array.from({ length: steps }, (_, i) => ({
      kn: `ಹಂತ ${i}`,
      en: `Step ${i}`,
      evidenceSegmentIds: [evidence[0]!],
    })),
    materials: [{ kn: "ಕಡ್ಡಿ", en: "sticks" }],
    whyKn: "ಏಕೆ",
    whyEn: "Why",
    evidenceSegmentIds: evidence,
    quoteSegmentId: evidence[0] ?? null,
    flags: [],
  };
}

function fakeAi(overrides: Partial<ImportAi> = {}): ImportAi {
  return {
    promptVersion: "card_extractor@test",
    transcribe: vi.fn(async () => ({
      text: "ಮಗು ರಾಮು ಕಡ್ಡಿ ಎಣಿಸಿದ",
      phrases: [
        { startMs: 0, endMs: 4_000, text: "ಮಗು ರಾಮು ಕಡ್ಡಿ ಎಣಿಸಿದ" },
        { startMs: 4_000, endMs: 26_000, text: "ಆಮೇಲೆ ಹತ್ತರ ಕಟ್ಟು" },
      ],
    })),
    redact: vi.fn(
      async ({
        phrases,
      }: {
        phrases: Array<{ startMs: number; endMs: number; text: string }>;
      }) => ({
        status: "ok" as const,
        phrases: phrases.map((p) => ({
          startMs: 999_999, // the model's timings must never be trusted
          endMs: 999_999,
          textKn: p.text.replace("ರಾಮು", "ಒಂದು ಮಗು"),
          textEn: "redacted",
          childNameRedacted: p.text.includes("ರಾಮು"),
          speakerGuess: "master" as const,
        })),
      }),
    ),
    extract: vi.fn(async ({ segments }) => ({
      status: "ok" as const,
      cards: [card(segments.slice(0, 2).map((s: SegmentForExtraction) => s.id))],
      dropped: [],
    })),
    windows: (segments) => [segments.slice(0, 4), segments.slice(3)],
    ...overrides,
  };
}

const wav = new Uint8Array(10);

describe("transcribeChunk", () => {
  it("stores only redacted text, on the interview timeline, with speech service timings", async () => {
    const store = createMemoryStore({ interview, chunks: CHUNKS });
    const res = await transcribeChunk(fakeAi(), store, {
      interview,
      idx: 1,
      wav,
      wavDurationMs: 25_000,
      traceId: "t",
    });
    expect(res.status).toBe("transcribed");
    expect(store.segments).toHaveLength(2);
    expect(store.segments.every((s) => !s.textKn.includes("ರಾಮು"))).toBe(true);
    expect(store.segments[0]).toMatchObject({
      startMs: 25_000,
      endMs: 29_000,
      idx: 1000,
      chunkIdx: 1,
      redacted: true,
    });
    // A phrase running past the chunk end is clamped inside it.
    expect(store.segments[1]).toMatchObject({ startMs: 29_000, endMs: 50_000 });
    expect((await store.getChunk("iv-1", 1))?.status).toBe("transcribed");
  });

  it("is idempotent: a retried chunk is not transcribed twice", async () => {
    const ai = fakeAi();
    const store = createMemoryStore({ interview, chunks: CHUNKS });
    await transcribeChunk(ai, store, {
      interview,
      idx: 0,
      wav,
      wavDurationMs: 25_000,
      traceId: "t",
    });
    const again = await transcribeChunk(ai, store, {
      interview,
      idx: 0,
      wav,
      wavDurationMs: 25_000,
      traceId: "t",
    });
    expect(again.status).toBe("already_done");
    expect(ai.transcribe).toHaveBeenCalledTimes(1);
    expect(store.segments).toHaveLength(2);
  });

  it("refuses audio that does not match the planned chunk (a different file on resume)", async () => {
    const store = createMemoryStore({ interview, chunks: CHUNKS });
    await expect(
      transcribeChunk(fakeAi(), store, {
        interview,
        idx: 0,
        wav,
        wavDurationMs: 21_000,
        traceId: "t",
      }),
    ).rejects.toMatchObject({ kind: "mismatch" });
  });

  it("never stores text when redaction fails, and marks the chunk for retry", async () => {
    const ai = fakeAi({
      redact: vi.fn(async () => ({ status: "needs_human" as const, reason: "invalid" })),
    });
    const store = createMemoryStore({ interview, chunks: CHUNKS });
    await expect(
      transcribeChunk(ai, store, { interview, idx: 0, wav, wavDurationMs: 25_000, traceId: "t" }),
    ).rejects.toBeInstanceOf(PipelineError);
    expect(store.segments).toHaveLength(0);
    expect(await store.getChunk("iv-1", 0)).toMatchObject({
      status: "failed",
      attempts: 1,
      error: "redaction_invalid",
    });
  });

  it("marks a chunk with no speech as silent", async () => {
    const ai = fakeAi({ transcribe: vi.fn(async () => ({ text: "", phrases: [] })) });
    const store = createMemoryStore({ interview, chunks: CHUNKS });
    expect(
      (
        await transcribeChunk(ai, store, {
          interview,
          idx: 2,
          wav,
          wavDurationMs: 25_000,
          traceId: "t",
        })
      ).status,
    ).toBe("silent");
    expect((await store.getChunk("iv-1", 2))?.status).toBe("silent");
  });

  it("gives up after three failed attempts", async () => {
    const ai = fakeAi({ transcribe: vi.fn(async () => Promise.reject(new Error("boom"))) });
    const store = createMemoryStore({ interview, chunks: CHUNKS });
    for (let i = 0; i < 3; i++) {
      await expect(
        transcribeChunk(ai, store, { interview, idx: 0, wav, wavDurationMs: 25_000, traceId: "t" }),
      ).rejects.toThrow();
    }
    await expect(
      transcribeChunk(ai, store, { interview, idx: 0, wav, wavDurationMs: 25_000, traceId: "t" }),
    ).rejects.toMatchObject({ kind: "gave_up" });
  });
});

describe("step (extraction)", () => {
  async function transcribed(ai = fakeAi()) {
    const store = createMemoryStore({
      interview,
      chunks: CHUNKS,
      master: { name: "Sharanappa", years: 32, classes: "1-4" },
    });
    for (const c of CHUNKS)
      await transcribeChunk(ai, store, {
        interview,
        idx: c.idx,
        wav,
        wavDurationMs: 25_000,
        traceId: "t",
      });
    return store;
  }

  it("waits while chunks are still being transcribed", async () => {
    const store = createMemoryStore({ interview, chunks: CHUNKS });
    const p = await step(fakeAi(), store, { interview, traceId: "t" });
    expect(p.phase).toBe("transcribing");
    expect(p.chunks).toEqual({ total: 3, done: 0, failed: 0 });
  });

  it("runs one window per call, lands draft cards, then finishes", async () => {
    const ai = fakeAi();
    const store = await transcribed(ai);
    const first = await step(ai, store, { interview, traceId: "t" });
    expect(first).toMatchObject({ phase: "extracting", windows: { total: 2, done: 1 }, cards: 1 });
    expect(store.interview.status).toBe("extracting");
    const second = await step(ai, store, { interview, traceId: "t" });
    expect(second.phase).toBe("done");
    expect(store.interview.status).toBe("done");
    expect(store.cards.every((c) => c.isSample && c.masterId === "m-1")).toBe(true);
    expect(ai.extract).toHaveBeenCalledTimes(2);
  });

  it("retries a window that needs a human, then leaves it failed after three attempts", async () => {
    const ai = fakeAi({
      extract: vi.fn(async () => ({ status: "needs_human" as const, reason: "invalid" })),
    });
    const store = await transcribed(ai);
    let p = await step(ai, store, { interview, traceId: "t" });
    for (let i = 0; i < 10 && p.phase === "extracting"; i++)
      p = await step(ai, store, { interview, traceId: "t" });
    expect(p.phase).toBe("needs_attention");
    expect(store.interview).toMatchObject({ status: "failed", error: "some_windows_failed" });
    expect(store.cards).toHaveLength(0);
  });

  it("keeps a consent only first note out of every window, without moving the timeline", async () => {
    // WhatsApp import (F-A1): chunk 0 is the master's consent note, chunks 1 and 2 his answers.
    const consentFirst = { ...interview, consentOnlyEndMs: 25_000 };
    const ai = fakeAi({ windows: (segments) => [segments] });
    const store = createMemoryStore({ interview: consentFirst, chunks: CHUNKS });
    for (const c of CHUNKS)
      await transcribeChunk(ai, store, {
        interview: consentFirst,
        idx: c.idx,
        wav,
        wavDurationMs: 25_000,
        traceId: "t",
      });
    expect(store.segments.filter((s) => s.startMs < 25_000)).toHaveLength(2); // still stored
    const p = await step(ai, store, { interview: consentFirst, traceId: "t" });
    expect(p.phase).toBe("done");
    const seen = vi.mocked(ai.extract).mock.calls[0]![0].segments;
    expect(seen.map((s) => s.startMs)).toEqual([25_000, 29_000, 50_000, 54_000]);
    expect(store.cards).toHaveLength(1);
  });

  it("an interview that is only a consent note ends honestly with nothing to extract", async () => {
    const consentOnly = { ...interview, consentOnlyEndMs: 75_000 };
    const ai = fakeAi();
    const store = createMemoryStore({ interview: consentOnly, chunks: CHUNKS });
    for (const c of CHUNKS)
      await transcribeChunk(ai, store, {
        interview: consentOnly,
        idx: c.idx,
        wav,
        wavDurationMs: 25_000,
        traceId: "t",
      });
    const p = await step(ai, store, { interview: consentOnly, traceId: "t" });
    expect(p.phase).toBe("needs_attention");
    expect(store.interview).toMatchObject({ status: "failed", error: "no_speech" });
    expect(ai.extract).not.toHaveBeenCalled();
  });

  it("does not retry a budget refusal", async () => {
    const ai = fakeAi({
      extract: vi.fn(async () => ({ status: "needs_human" as const, reason: "budget" })),
    });
    const store = await transcribed(ai);
    await step(ai, store, { interview, traceId: "t" });
    expect(store.jobs.filter((j) => j.status === "failed")).toHaveLength(1);
  });
});

describe("dedupe across overlapping windows", () => {
  it("measures overlap against the smaller evidence set", () => {
    expect(overlap([1, 2, 3, 4], [3, 4])).toBe(1);
    expect(overlap([1, 2], [3])).toBe(0);
    expect(overlap([], [1])).toBe(0);
  });

  it("drops a twin and replaces a poorer twin with the richer card", () => {
    const existing = [{ id: "a", evidenceSegmentIds: [1, 2, 3], stepCount: 2 }];
    const { keep, replace } = dedupeAgainst(existing, [
      card([2, 3], 2),
      card([3, 1], 4),
      card([9, 10]),
    ]);
    expect(replace).toEqual(["a"]);
    expect(keep.map((c) => c.evidenceSegmentIds)).toEqual([
      [3, 1],
      [9, 10],
    ]);
  });
});
