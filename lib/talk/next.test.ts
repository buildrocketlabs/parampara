import { describe, expect, it, vi } from "vitest";
import type { ImportStore } from "@/lib/import/types";
import type { AdminClient } from "@/lib/supabase/admin";
import { askedInOrder, nextQuestion, transcriptFor, type TalkAi } from "./next";
import type { LiveInterview, PartMeta } from "./turns";

const part = (kind: PartMeta["kind"], topic?: PartMeta["topic"], probe = false): PartMeta => ({
  path: null,
  name: "x",
  mime: "text/plain",
  bytes: 0,
  start_ms: 0,
  duration_ms: 0,
  storable: false,
  stored: false,
  kind,
  turn_id: crypto.randomUUID(),
  slot: 0,
  chunk_from: 1,
  chunk_to: 1,
  ...(topic ? { topic, probe } : {}),
});

describe("the questions asked so far", () => {
  it("are the answered and skipped turns, in order, so follow ups are counted right", () => {
    const parts = [part("consent"), part("typed", "warmup"), part("typed", "letters"), part("skip", "letters", true), part("typed", "reading")];
    const asked = askedInOrder(parts);
    expect(asked.map((t) => `${t.topic}${t.probe ? "+" : ""}`)).toEqual(["warmup", "letters", "letters+", "reading"]);
  });
});

/** A chainable stand in for the admin client: each table answers with fixed rows and a count. */
function fakeDb(tables: Record<string, { data?: unknown[]; count?: number }>): AdminClient {
  const query = (name: string) => {
    const result = { data: tables[name]?.data ?? [], count: tables[name]?.count ?? 0, error: null };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit", "gte", "lt"]) q[m] = () => q;
    q.then = (resolve: (v: typeof result) => unknown) => resolve(result);
    return q;
  };
  return { from: query } as unknown as AdminClient;
}

const store = {
  getMasterContext: async () => ({ name: "Sample master", years: 30, classes: "1 to 3" }),
  listSegments: async () => [],
} as unknown as ImportStore;

function liveWith(parts: PartMeta[]): LiveInterview {
  return { id: "iv", masterId: "m", status: "recording", isSample: true, startedAt: new Date(0).toISOString(), durationMs: 0, chunkCount: 9, parts };
}

describe("Hanate's next question", () => {
  const modelQuestion = { questionKn: "ಮರಳಲ್ಲಿ ಮೊದಲು ಯಾವ ಅಕ್ಷರ ಬರೆಸಿದಿರಿ?", questionEn: "Which letter first?", why: "", topic: "letters" as const, probe: true, done: false };
  const ai = (): TalkAi & { next: ReturnType<typeof vi.fn> } => ({
    next: vi.fn(async () => ({ status: "ok" as const, question: modelQuestion, attempts: 1, replayed: false, span: {} as never })),
  });

  it("after an answer that speaks of a child in danger: no model, the guide's thank you, and care", async () => {
    const parts = [part("consent"), part("typed", "warmup"), { ...part("typed", "letters"), slot: 2, chunk_to: 3, care: "child" as const }];
    const m = ai();
    const res = await nextQuestion(fakeDb({}), store, liveWith(parts), m, "iv", { now: 600_000 });
    expect(m.next).not.toHaveBeenCalled();
    expect(res).toMatchObject({ source: "script", care: "child", question: { probe: false, topic: "reading" } });
  });

  it("finds the same care in a spoken answer's redacted words", async () => {
    const parts = [part("consent"), { ...part("answer", "engagement"), slot: 1, chunk_from: 2, chunk_to: 3 }];
    const db = fakeDb({ segments: { data: [{ chunk_idx: 2, text_kn: "ಮನೆಯಲ್ಲಿ ಅಪ್ಪ ಹೊಡ್ದಿದ್ದಾರೆ ಅಂತ ಹುಡುಗಿ ಹೇಳಿದ್ಲು", text_en: null, speaker: "master", redacted: false }] } });
    const m = ai();
    const res = await nextQuestion(db, store, liveWith(parts), m, "iv", { now: 600_000 });
    expect(m.next).not.toHaveBeenCalled();
    expect(res.care).toBe("child");
  });

  it("a question skipped after that answer means the moment has passed", async () => {
    const parts = [part("consent"), part("typed", "warmup"), { ...part("typed", "letters"), care: "child" as const }, part("skip", "reading")];
    const m = ai();
    const res = await nextQuestion(fakeDb({}), store, liveWith(parts), m, "iv", { now: 600_000 });
    expect(m.next).toHaveBeenCalledOnce();
    expect(res).toMatchObject({ source: "model", care: null });
  });

  it("stops asking the model once an interview has used its share of calls", async () => {
    const parts = [part("consent"), part("typed", "warmup")];
    const m = ai();
    const res = await nextQuestion(fakeDb({ ai_calls: { count: 500 } }), store, liveWith(parts), m, "iv", { now: 600_000 });
    expect(m.next).not.toHaveBeenCalled();
    expect(res.source).toBe("script");
  });

  it("asks from the guide while the last answer's words are still on their way", async () => {
    const parts = [part("consent"), { ...part("answer", "letters"), slot: 1, chunk_from: 2, chunk_to: 4 }];
    const db = fakeDb({ audio_chunks: { data: [{ idx: 2, status: "done" }, { idx: 3, status: "pending" }] } });
    const m = ai();
    const res = await nextQuestion(db, store, liveWith(parts), m, "iv", { now: 600_000 });
    expect(m.next).not.toHaveBeenCalled();
    expect(res.source).toBe("script");
  });
});

describe("what the interviewer model reads", () => {
  it("never sees an answer that needed care", () => {
    const t = transcriptFor([
      { n: 1, kind: "typed", topic: "letters", probe: false, question: { kn: "ಪ್ರಶ್ನೆ", en: "Q" }, lines: [{ kn: "ಮರಳು ತಂದೆ", en: null }], pending: 0, nameRedacted: false, care: null },
      { n: 2, kind: "typed", topic: "letters", probe: true, question: { kn: "ಆಮೇಲೆ?", en: "Next?" }, lines: [{ kn: "ಮನೇಲಿ ಅಪ್ಪ ಹೊಡೀತಾರಂತೆ", en: null }], pending: 0, nameRedacted: false, care: "child" },
    ]);
    expect(t.map((x) => x.textKn).join(" ")).toContain("ಮರಳು ತಂದೆ");
    expect(t.map((x) => x.textKn).join(" ")).not.toContain("ಹೊಡೀತಾರಂತೆ");
    expect(t.some((x) => x.textKn.includes("left out"))).toBe(true);
  });
});

describe("the live demo master", () => {
  it("a Sample (demo) master's talk on a deployment asks the real interviewer, not the script", async () => {
    // Sample is a label on the data, never a switch to the scripted guide: only fixture mode
    // (no database at all) is scripted, and that never reaches this server code.
    const parts = [part("consent"), part("typed", "warmup")];
    const live = { ...liveWith(parts), isSample: true };
    const modelQuestion = { questionKn: "ಆ ಮಗುವಿಗೆ ಮೊದಲು ಏನು ಮಾಡಿಸಿದಿರಿ?", questionEn: "What did you have the child do first?", why: "", topic: "letters" as const, probe: false, done: false };
    const m = { next: vi.fn(async () => ({ status: "ok" as const, question: modelQuestion, attempts: 1, replayed: false, span: {} as never })) };
    const res = await nextQuestion(fakeDb({}), store, live, m, "iv", { now: 600_000 });
    expect(m.next).toHaveBeenCalledOnce();
    expect(res).toMatchObject({ source: "model", question: { questionEn: "What did you have the child do first?" } });
  });
});
