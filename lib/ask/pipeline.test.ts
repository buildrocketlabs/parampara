import { describe, expect, it, vi } from "vitest";
import { nameEchoCheck } from "@/ai/safety/names";
import { answerCacheKey, ask, gradesOverlap, prefilter } from "./pipeline";
import type {
  AnswerInsert,
  AskAi,
  AskStore,
  CardIndexEntry,
  FullCard,
  PhotoReading,
  QuestionInsert,
  Triage,
} from "./types";

const CARDS: FullCard[] = ["c1", "c2", "c3"].map((id, i) => ({
  id,
  masterId: "m1",
  masterName: "Sharanappa",
  title: { kn: `ಕಾರ್ಡ್ ${i}`, en: `Card ${i}` },
  problem: { kn: "ಸಮಸ್ಯೆ", en: "Problem" },
  steps: [{ kn: "ಕಡ್ಡಿ ಕಟ್ಟು", en: "Bundle sticks in tens" }],
  materials: [],
  why: null,
  quoteSegmentId: null,
  isSample: true,
}));
const INDEX: CardIndexEntry[] = CARDS.map((c) => ({
  id: c.id,
  titleEn: c.title.en,
  problemEn: c.problem.en,
  topic: "number_sense",
  gradeBand: "1-2",
  subject: "maths",
}));

const TRIAGE: Triage = {
  redactedText: "ಒಂದು ಮಗು ಸಂಖ್ಯೆ ಗುರುತಿಸುವುದಿಲ್ಲ",
  language: "kn",
  topic: "number_sense",
  subject: "maths",
  gradeBand: "1",
  intent: "pedagogy",
  needsClarification: false,
  clarifyingQuestion: null,
  safetyFlags: [],
};

const span = {
  role: "x",
  model: "m",
  promptVersion: "x@v1",
  latencyMs: 10,
  tokensIn: 1,
  tokensOut: 1,
  cacheReadTokens: 0,
  costUsd: 0.001,
  attempts: 1,
  replayed: false,
};

function fakeAi(over: Partial<AskAi> = {}): AskAi {
  return {
    transcribe: vi.fn(async () => ({ text: "ರಾಮು ಸಂಖ್ಯೆ ಗುರುತಿಸುವುದಿಲ್ಲ" })),
    triage: vi.fn(async () => ({ status: "ok" as const, triage: TRIAGE, span })),
    rank: vi.fn(async () => ({ status: "ok" as const, cardIds: ["c1", "c2"], reasons: [], span })),
    answer: vi.fn(async () => ({
      status: "ok" as const,
      span,
      answer: {
        title: { kn: "ಕಡ್ಡಿ ಕಟ್ಟು", en: "Stick bundles" },
        steps: [
          { kn: "ಒಂದು", en: "Give ten sticks", cardId: "c1" },
          { kn: "ಎರಡು", en: "Tie a bundle", cardId: "c1" },
          { kn: "ಮೂರು", en: "Count bundles", cardId: "c2" },
          { kn: "ನಾಲ್ಕು", en: "Invented step", cardId: "zzz" },
        ],
        materials: [],
        why: { kn: "ಏಕೆ", en: "Why" },
      },
    })),
    judge: vi.fn(async ({ step }) => ({
      status: "ok" as const,
      verdict: step.en === "Count bundles" ? ("unsupported" as const) : ("supported" as const),
      cardQuote: "quote",
      span,
    })),
    safety: vi.fn(async () => ({
      status: "ok" as const,
      safety: { ok: true, categories: [], escalate: false },
      span,
    })),
    unsafePatterns: (t: string) => (/beat|cane/i.test(t) ? ["physical_punishment"] : []),
    nameEchoCheck: (question: string) => nameEchoCheck(question),
    disclosurePatterns: (t: string) =>
      /ಹೊಡೆಯುತ್ತಾರೆ|beats? (him|her) at home/i.test(t) ? ["child_harm"] : [],
    ...over,
  };
}

function memoryStore() {
  const questions: Array<QuestionInsert & { id: string }> = [];
  const answers: Array<AnswerInsert & { id: string }> = [];
  const queue: Array<{ questionId: string; reason: string; urgent: boolean }> = [];
  const store: AskStore = {
    insertQuestion: async (q) => {
      const id = `q${questions.length + 1}`;
      questions.push({ ...q, id });
      return id;
    },
    insertAnswer: async (a) => {
      const id = `a${answers.length + 1}`;
      answers.push({ ...a, id });
      return id;
    },
    queue: async (questionId, reason, urgent) => {
      queue.push({ questionId, reason, urgent });
    },
    // Every test card is Sample, as the real store would see it (D64).
    cardIndex: async (pool) =>
      INDEX.filter((e) => pool === "all" || !CARDS.find((c) => c.id === e.id)!.isSample),
    fullCards: async (ids, pool) =>
      CARDS.filter((c) => ids.includes(c.id) && (pool === "all" || !c.isSample)),
    libraryVersion: async (pool) => `v1:${pool}`,
    findCachedRaw: async (key) => {
      const hit = answers.find((a) => a.rawKey === key && a.status === "answered");
      if (!hit) return null;
      const q = questions.find((x) => x.id === hit.questionId)!;
      return {
        answerId: hit.id,
        question: {
          textRedacted: q.textRedacted,
          topic: q.topic,
          gradeBand: q.gradeBand,
          safetyFlags: q.safetyFlags,
        },
      };
    },
    findCached: async (key) => {
      const hit = answers.find((a) => a.cacheKey === key && a.status === "answered");
      return hit ? { answerId: hit.id, createdAt: "now" } : null;
    },
    copyAnswer: async (from, questionId, now) => {
      const src = answers.find((a) => a.id === from)!;
      const id = `a${answers.length + 1}`;
      answers.push({ ...src, id, questionId, replayedFrom: from, cacheKey: null, rawKey: null });
      replays.push(now);
      return id;
    },
  };
  const replays: Array<{ latencyMs: number; costUsd: number } | undefined> = [];
  return { store, questions, answers, queue, replays };
}

const input = {
  text: "ರಾಮು ಸಂಖ್ಯೆ ಗುರುತಿಸುವುದಿಲ್ಲ",
  lang: "kn" as const,
  teacherId: "t1",
  isSample: true,
  traceId: "tr",
};

describe("ask: grounded or silent (Law 4)", () => {
  it("ships only steps a second model supports, drops steps citing cards it was not given", async () => {
    const m = memoryStore();
    const stages: string[] = [];
    const out = await ask(fakeAi(), m.store, input, (s) => stages.push(s));
    expect(out).toMatchObject({ kind: "answered", replayed: false });
    const a = m.answers[0]!;
    expect(a.steps.map((s) => s.en)).toEqual(["Give ten sticks", "Tie a bundle"]);
    expect(a.steps.every((s) => s.verdict === "supported" && s.cardId === "c1")).toBe(true);
    expect(a.cardIds).toEqual(["c1"]);
    const grounding = a.trace.steps.find((s) => s.kind === "grounding")!;
    expect(grounding.verdicts?.filter((v) => v.removed).map((v) => v.step)).toEqual([
      "Count bundles",
      "Invented step",
    ]);
    expect(stages).toEqual(["understanding", "finding", "checking"]);
    expect(a.costUsd).toBeGreaterThan(0);
  });

  it("ranks cards while the second name reader works, and uses that ranking for the same question", async () => {
    const m = memoryStore();
    const order: string[] = [];
    const ai = fakeAi({
      triage: vi.fn(async ({ onFirstPass }) => {
        onFirstPass?.(TRIAGE);
        await new Promise((r) => setTimeout(r, 20)); // the name reader
        order.push("triage done");
        return { status: "ok" as const, triage: TRIAGE, span };
      }),
      rank: vi.fn(async () => {
        order.push("rank");
        return { status: "ok" as const, cardIds: ["c1", "c2"], reasons: [], span };
      }),
    });
    const out = await ask(ai, m.store, input);
    expect(out).toMatchObject({ kind: "answered" });
    expect(order).toEqual(["rank", "triage done"]);
    expect(ai.rank).toHaveBeenCalledOnce();
    // Nothing is stored before the name reader has finished.
    expect(m.questions).toHaveLength(1);
  });

  it("drops the early ranking when the name reader sends triage round again", async () => {
    const m = memoryStore();
    const corrected = { ...TRIAGE, redactedText: "ಒಂದು ಮಗು ಇನ್ನೂ ಸಂಖ್ಯೆ ಗುರುತಿಸುವುದಿಲ್ಲ" };
    const ai = fakeAi({
      triage: vi.fn(async ({ onFirstPass }) => {
        onFirstPass?.(TRIAGE);
        return { status: "ok" as const, triage: corrected, span };
      }),
    });
    await ask(ai, m.store, input);
    expect(ai.rank).toHaveBeenCalledTimes(2);
    expect(vi.mocked(ai.rank).mock.calls[1]![0].triage.redactedText).toBe(corrected.redactedText);
  });

  it("reads the chosen cards during the name reader too, and drafts from them (Track B)", async () => {
    const m = memoryStore();
    const order: string[] = [];
    const fullCards = vi.fn(m.store.fullCards);
    const ai = fakeAi({
      triage: vi.fn(async ({ onFirstPass }) => {
        onFirstPass?.(TRIAGE);
        await new Promise((r) => setTimeout(r, 20)); // the name reader
        order.push("triage done");
        return { status: "ok" as const, triage: TRIAGE, span };
      }),
    });
    const store = {
      ...m.store,
      fullCards: async (ids: string[], pool: "all" | "field") => {
        order.push("cards");
        return fullCards(ids, pool);
      },
    };
    const out = await ask(ai, store, input);
    expect(out).toMatchObject({ kind: "answered" });
    expect(order).toEqual(["cards", "triage done"]);
    expect(fullCards).toHaveBeenCalledOnce();
    expect(vi.mocked(ai.answer).mock.calls[0]![0].cards.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("never drafts from early cards when the name reader changed the words", async () => {
    const m = memoryStore();
    const corrected = { ...TRIAGE, redactedText: "ಒಂದು ಮಗು ಇನ್ನೂ ಸಂಖ್ಯೆ ಗುರುತಿಸುವುದಿಲ್ಲ" };
    const ai = fakeAi({
      triage: vi.fn(async ({ onFirstPass }) => {
        onFirstPass?.(TRIAGE);
        return { status: "ok" as const, triage: corrected, span };
      }),
      rank: vi
        .fn()
        .mockResolvedValueOnce({ status: "ok" as const, cardIds: ["c3"], reasons: [], span })
        .mockResolvedValueOnce({ status: "ok" as const, cardIds: ["c1", "c2"], reasons: [], span }),
    });
    await ask(ai, m.store, input);
    expect(vi.mocked(ai.answer).mock.calls[0]![0].cards.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(vi.mocked(ai.answer).mock.calls[0]![0].question).toBe(corrected.redactedText);
  });

  it("never ranks early for a disclosure or a question that needs care", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      triage: vi.fn(async ({ onFirstPass }) => {
        onFirstPass?.({ ...TRIAGE, intent: "safety_disclosure", safetyFlags: ["child_harm"] });
        return {
          status: "ok" as const,
          triage: { ...TRIAGE, intent: "safety_disclosure" as const, safetyFlags: ["child_harm"] },
          span,
        };
      }),
    });
    const out = await ask(ai, m.store, input);
    expect(out).toMatchObject({ kind: "escalated" });
    expect(ai.rank).not.toHaveBeenCalled();
  });

  it("reads safety while the judges are still out, on every step that could ship (never less)", async () => {
    const m = memoryStore();
    let release: () => void = () => {};
    const judgesHeld = new Promise<void>((r) => (release = r));
    const order: string[] = [];
    const ai = fakeAi({
      judge: vi.fn(async ({ step }) => {
        await judgesHeld;
        order.push("judge");
        return {
          status: "ok" as const,
          verdict: step.en === "Count bundles" ? ("unsupported" as const) : ("supported" as const),
          cardQuote: "quote",
          span,
        };
      }),
      safety: vi.fn(async ({ answerText }) => {
        order.push("safety");
        // The cited steps the judges may still remove are part of what safety reads.
        expect(answerText).toContain("Count bundles");
        expect(answerText).not.toContain("Invented step");
        release();
        return {
          status: "ok" as const,
          safety: { ok: true, categories: [], escalate: false },
          span,
        };
      }),
    });
    const out = await ask(ai, m.store, input);
    expect(order[0]).toBe("safety");
    expect(out).toMatchObject({ kind: "answered" });
    expect(m.answers[0]!.steps.map((s) => s.en)).toEqual(["Give ten sticks", "Tie a bundle"]);
  });

  it("a child at risk seen by the final check comes before too few supported steps", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      judge: vi.fn(async () => ({
        status: "ok" as const,
        verdict: "partial" as const,
        cardQuote: null,
        span,
      })),
      safety: vi.fn(async () => ({
        status: "ok" as const,
        safety: { ok: true, categories: [], escalate: true },
        span,
      })),
    });
    const out = await ask(ai, m.store, input);
    expect(out).toMatchObject({ kind: "escalated" });
    expect(m.queue).toEqual([{ questionId: "q1", reason: "safety", urgent: true }]);
  });

  it("no card for a hungry child: the honest no card outcome with the gentle note, never Childline (D72)", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      triage: vi.fn(async () => ({
        status: "ok" as const,
        triage: { ...TRIAGE, safetyFlags: ["hunger"] },
        span,
      })),
      rank: vi.fn(async () => ({ status: "ok" as const, cardIds: [], reasons: [], span })),
    });
    const out = await ask(ai, m.store, input);
    expect(out).toEqual({ kind: "no_card", answerId: "a1", note: "hunger" });
    expect(m.queue).toEqual([{ questionId: "q1", reason: "no_card", urgent: false }]);
  });

  it("holds a draft that repeats a name from her question, before any judge, and keeps no step of it (Law 5)", async () => {
    const m = memoryStore();
    const judge = vi.fn();
    const ai = fakeAi({
      judge,
      answer: vi.fn(async () => ({
        status: "ok" as const,
        span,
        answer: {
          title: { kn: "ಕಡ್ಡಿ ಕಟ್ಟು", en: "Stick bundles" },
          steps: [
            { kn: "ಒಂದು", en: "Give Ravi ten sticks", cardId: "c1" },
            { kn: "ಎರಡು", en: "Tie a bundle", cardId: "c1" },
          ],
          materials: [],
          why: null,
        },
      })),
    });
    const out = await ask(ai, m.store, {
      ...input,
      text: "Ravi cannot tell what fourteen means. What should I do?",
    });
    expect(out).toMatchObject({ kind: "needs_human", reason: "safety" });
    expect(judge).not.toHaveBeenCalled();
    expect(m.queue).toEqual([{ questionId: "q1", reason: "safety", urgent: false }]);
    expect(JSON.stringify(m.answers)).not.toMatch(/Ravi/);
  });

  it("a held draft with a name still lets the final reading escalate a child at risk", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      judge: vi.fn(),
      safety: vi.fn(async () => ({
        status: "ok" as const,
        safety: { ok: false, categories: [], escalate: true, reason: "danger" },
        span,
      })),
      answer: vi.fn(async () => ({
        status: "ok" as const,
        span,
        answer: {
          title: { kn: "ಕಡ್ಡಿ ಕಟ್ಟು", en: "Stick bundles" },
          steps: [
            { kn: "ಒಂದು", en: "Give Ravi ten sticks", cardId: "c1" },
            { kn: "ಎರಡು", en: "Tie a bundle", cardId: "c1" },
          ],
          materials: [],
          why: null,
        },
      })),
    });
    const out = await ask(ai, m.store, { ...input, text: "Ravi cannot tell what fourteen means." });
    expect(out).toMatchObject({ kind: "escalated", helpline: "both" });
    expect(m.queue).toEqual([{ questionId: "q1", reason: "safety", urgent: true }]);
    expect(JSON.stringify(m.answers)).not.toMatch(/Ravi/);
  });

  it("sends the question to a human when fewer than two steps survive", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      judge: vi.fn(async () => ({
        status: "ok" as const,
        verdict: "partial" as const,
        cardQuote: null,
      })),
    });
    const out = await ask(ai, m.store, input);
    expect(out).toMatchObject({ kind: "needs_human", reason: "unsupported" });
    expect(m.queue).toEqual([{ questionId: "q1", reason: "unsupported", urgent: false }]);
    expect(m.answers[0]!.steps).toEqual([]);
  });

  it("removes a step with punishment advice even if the judge would allow it", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      answer: vi.fn(async () => ({
        status: "ok" as const,
        answer: {
          title: { kn: "t", en: "t" },
          steps: [
            { kn: "a", en: "Give ten sticks", cardId: "c1" },
            { kn: "b", en: "Use the cane if they forget", cardId: "c1" },
            { kn: "c", en: "Tie a bundle", cardId: "c2" },
          ],
          materials: [],
          why: null,
        },
      })),
    });
    await ask(ai, m.store, input);
    expect(m.answers[0]!.steps.map((s) => s.en)).toEqual(["Give ten sticks", "Tie a bundle"]);
  });

  it("holds the answer for a human when the final safety check fails", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      safety: vi.fn(async () => ({
        status: "ok" as const,
        safety: { ok: false, categories: ["shaming"], escalate: false },
      })),
    });
    expect(await ask(ai, m.store, input)).toMatchObject({ kind: "needs_human", reason: "safety" });
    expect(m.queue[0]).toMatchObject({ reason: "safety" });
  });

  it("is honest when no master has answered this yet", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      rank: vi.fn(async () => ({ status: "ok" as const, cardIds: [], reasons: [] })),
    });
    expect(await ask(ai, m.store, input)).toMatchObject({ kind: "no_card" });
    expect(m.queue[0]).toMatchObject({ reason: "no_card", urgent: false });
    expect(ai.answer).not.toHaveBeenCalled();
  });

  it("never answers a real teacher from a Sample master's card (D64)", async () => {
    const m = memoryStore();
    const ai = fakeAi();
    const out = await ask(ai, m.store, { ...input, isSample: false });
    expect(out).toMatchObject({ kind: "no_card" });
    expect(ai.answer).not.toHaveBeenCalled();
    expect(m.answers[0]!.cardIds).toEqual([]);
  });

  it("never replays a demo answer to a real teacher: the pools have their own cache (D64)", async () => {
    const m = memoryStore();
    const ai = fakeAi();
    const rawKey = (s: string) => `raw:${s}`;
    expect(await ask(ai, m.store, { ...input, rawKey })).toMatchObject({ kind: "answered" });
    const out = await ask(ai, m.store, { ...input, rawKey, isSample: false, teacherId: "t2" });
    expect(out).toMatchObject({ kind: "no_card" });
    expect(m.answers.filter((a) => a.replayedFrom)).toEqual([]);
  });

  it("never lets the ranker pick a card outside the prefiltered, approved set", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      rank: vi.fn(async () => ({ status: "ok" as const, cardIds: ["not-approved"], reasons: [] })),
    });
    expect(await ask(ai, m.store, input)).toMatchObject({ kind: "no_card" });
  });
});

describe("ask: children are safe by construction (Law 5)", () => {
  it("escalates a disclosure of harm with Childline, urgently, without any pedagogy", async () => {
    const m = memoryStore();
    const ai = fakeAi();
    const out = await ask(ai, m.store, { ...input, text: "ಅವನ ಅಪ್ಪ ಮನೆಯಲ್ಲಿ ಹೊಡೆಯುತ್ತಾರೆ" });
    expect(out).toMatchObject({ kind: "escalated", helpline: "childline" });
    expect(m.queue).toEqual([{ questionId: "q1", reason: "safety", urgent: true }]);
    expect(ai.rank).not.toHaveBeenCalled();
    expect(ai.answer).not.toHaveBeenCalled();
    expect(m.questions[0]!.safetyFlags).toContain("child_harm");
  });

  it("escalates when triage recognises a disclosure the patterns missed", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      triage: vi.fn(async () => ({
        status: "ok" as const,
        triage: { ...TRIAGE, intent: "safety_disclosure" as const },
      })),
    });
    expect(await ask(ai, m.store, input)).toMatchObject({ kind: "escalated" });
  });

  it("stores only the redacted question; if triage fails nothing raw is kept", async () => {
    const m = memoryStore();
    await ask(fakeAi(), m.store, input);
    expect(m.questions[0]!.textRedacted).toBe(TRIAGE.redactedText);
    expect(JSON.stringify(m.answers)).not.toContain("ರಾಮು");

    const m2 = memoryStore();
    const out = await ask(
      fakeAi({
        triage: vi.fn(async () => ({ status: "needs_human" as const, reason: "invalid" })),
      }),
      m2.store,
      input,
    );
    expect(out).toMatchObject({ kind: "needs_human", reason: "model" });
    expect(m2.questions[0]!.textRedacted).not.toContain("ರಾಮು");
  });

  it("transcribes a voice question and treats it the same way", async () => {
    const m = memoryStore();
    const ai = fakeAi();
    expect(
      await ask(ai, m.store, { ...input, text: undefined, wav: new Uint8Array(4) }),
    ).toMatchObject({ kind: "answered" });
    expect(ai.transcribe).toHaveBeenCalledOnce();
  });
});

describe("ask: safety audit regressions (M3)", () => {
  it("escalates on any child risk flag, not only child_harm", async () => {
    for (const flag of ["abuse", "child_marriage", "child_labour"]) {
      const m = memoryStore();
      const ai = fakeAi({
        triage: vi.fn(async () => ({
          status: "ok" as const,
          triage: { ...TRIAGE, safetyFlags: [flag] },
        })),
      });
      expect(await ask(ai, m.store, input)).toMatchObject({ kind: "escalated" });
      expect(m.queue[0]).toMatchObject({ reason: "safety", urgent: true });
    }
  });

  it("a child's self harm escalates; the teacher's own crisis goes to Tele MANAS", async () => {
    const child = fakeAi({
      triage: vi.fn(async () => ({
        status: "ok" as const,
        triage: { ...TRIAGE, safetyFlags: ["self_harm"] },
      })),
    });
    expect(await ask(child, memoryStore().store, input)).toMatchObject({ kind: "escalated" });
    const teacher = fakeAi({
      triage: vi.fn(async () => ({
        status: "ok" as const,
        triage: { ...TRIAGE, intent: "teacher_distress" as const, safetyFlags: ["self_harm"] },
      })),
    });
    expect(await ask(teacher, memoryStore().store, input)).toMatchObject({ kind: "distress" });
  });

  it("the final safety check can escalate, after the answer was drafted", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      safety: vi.fn(async () => ({
        status: "ok" as const,
        safety: { ok: false, categories: ["child_harm"], escalate: true },
      })),
    });
    expect(await ask(ai, m.store, input)).toMatchObject({ kind: "escalated", helpline: "both" });
    expect(m.queue[0]).toMatchObject({ reason: "safety", urgent: true });
    expect(m.answers[0]!.outcome).toBe("care");
  });

  it("checks the Kannada and Hindi words too, not only the English", async () => {
    const m = memoryStore();
    const safety = vi.fn(async () => ({
      status: "ok" as const,
      safety: { ok: true, categories: [], escalate: false },
    }));
    await ask(fakeAi({ safety }), m.store, input);
    const text = (safety.mock.calls[0] as unknown as [{ answerText: string }])[0].answerText;
    expect(text).toContain("ಕಡ್ಡಿ ಕಟ್ಟು");
    expect(text).toContain("Give ten sticks");
  });

  it("a failed triage still tells a person a teacher asked", async () => {
    const m = memoryStore();
    await ask(
      fakeAi({
        triage: vi.fn(async () => ({ status: "needs_human" as const, reason: "model_error" })),
      }),
      m.store,
      input,
    );
    expect(m.queue).toEqual([{ questionId: "q1", reason: "unsupported", urgent: false }]);
  });

  it("a health question is answered from cards and also shown to a person", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      triage: vi.fn(async () => ({
        status: "ok" as const,
        triage: { ...TRIAGE, safetyFlags: ["medical"] },
      })),
    });
    expect(await ask(ai, m.store, input)).toMatchObject({ kind: "answered" });
    expect(m.queue[0]).toMatchObject({ reason: "safety", urgent: false });
  });

  it("a new prompt version never replays the old prompt's answer", async () => {
    const m = memoryStore();
    const ai = fakeAi();
    await ask(ai, m.store, { ...input, versionTag: "answerer@v1" });
    expect(await ask(ai, m.store, { ...input, versionTag: "answerer@v2" })).toMatchObject({
      replayed: false,
    });
    expect(ai.answer).toHaveBeenCalledTimes(2);
  });
});

describe("ask: other paths", () => {
  it("answers a distressed teacher privately with Tele-MANAS, no queue", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      triage: vi.fn(async () => ({
        status: "ok" as const,
        triage: { ...TRIAGE, intent: "teacher_distress" as const },
      })),
    });
    expect(await ask(ai, m.store, input)).toMatchObject({
      kind: "distress",
      helpline: "telemanas",
    });
    expect(m.queue).toEqual([]);
  });

  it("asks back when the question is unclear", async () => {
    const m = memoryStore();
    const q = { kn: "ಯಾವ ತರಗತಿ?", en: "Which class?" };
    const ai = fakeAi({
      triage: vi.fn(async () => ({
        status: "ok" as const,
        triage: { ...TRIAGE, needsClarification: true, clarifyingQuestion: q },
      })),
    });
    expect(await ask(ai, m.store, input)).toEqual({ kind: "clarify", question: q });
  });

  it("replays the same question against the same library and says so (D35)", async () => {
    const m = memoryStore();
    const ai = fakeAi();
    await ask(ai, m.store, input);
    const again = await ask(ai, m.store, input);
    expect(again).toMatchObject({ kind: "answered", replayed: true });
    expect(ai.answer).toHaveBeenCalledTimes(1);
    expect(m.answers[1]!.replayedFrom).toBe("a1");
    // The replay's own time and spend (its triage) go with it, not the first answer's (F-P1).
    const firstTriage = m.answers[0]!.trace.steps.filter(
      (s) => s.kind === "transcript" || s.kind === "triage",
    ).reduce((a, s) => a + (s.costUsd ?? 0), 0);
    expect(m.replays[0]).toEqual({ latencyMs: expect.any(Number), costUsd: firstTriage });
  });

  it("an empty question is gently redirected", async () => {
    expect(await ask(fakeAi(), memoryStore().store, { ...input, text: "  " })).toEqual({
      kind: "redirect",
      reason: "empty",
    });
  });
});

describe("helpers", () => {
  it("overlaps class bands", () => {
    expect(gradesOverlap("1-2", "1")).toBe(true);
    expect(gradesOverlap("3", "1-2")).toBe(false);
    expect(gradesOverlap("any", "4")).toBe(true);
    expect(gradesOverlap(null, "2")).toBe(true);
  });

  it("prefilters by topic but falls back to the whole small library", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ...INDEX[0]!, id: `n${i}` }));
    const other = { ...INDEX[0]!, id: "o", topic: "letters", subject: "kannada" };
    expect(prefilter([...many, other], TRIAGE).map((c) => c.id)).not.toContain("o");
    expect(prefilter([INDEX[0]!, other], TRIAGE)).toHaveLength(2);
  });

  it("cache keys ignore punctuation and spacing, not language or library version", () => {
    const a = answerCacheKey("ಒಂದು ಮಗು, ಓದುವುದಿಲ್ಲ!", "kn", "v1");
    expect(answerCacheKey("ಒಂದು  ಮಗು ಓದುವುದಿಲ್ಲ", "kn", "v1")).toBe(a);
    expect(answerCacheKey("ಒಂದು ಮಗು ಓದುವುದಿಲ್ಲ", "hi", "v1")).not.toBe(a);
    expect(answerCacheKey("ಒಂದು ಮಗು ಓದುವುದಿಲ್ಲ", "kn", "v2")).not.toBe(a);
  });
});

describe("ask: safety audit 24 Oct", () => {
  const rawKey = (s: string) => `k:${s}`;

  it("the very same words replay their checked answer without any model call (budget cap)", async () => {
    const m = memoryStore();
    await ask(fakeAi(), m.store, { ...input, rawKey });
    const ai = fakeAi();
    const again = await ask(ai, m.store, { ...input, rawKey });
    expect(again).toMatchObject({ kind: "answered", replayed: true });
    expect(ai.triage).not.toHaveBeenCalled();
    expect(m.questions[1]!.textRedacted).toBe(TRIAGE.redactedText);
    expect(m.replays[0]).toEqual({ latencyMs: expect.any(Number), costUsd: 0 });
  });

  it("a disclosure is never served from the raw cache", async () => {
    const m = memoryStore();
    const text = "ಅವನ ಅಪ್ಪ ಮನೆಯಲ್ಲಿ ಹೊಡೆಯುತ್ತಾರೆ";
    await ask(fakeAi(), m.store, { ...input, text, rawKey });
    expect(await ask(fakeAi(), m.store, { ...input, text, rawKey })).toMatchObject({
      kind: "escalated",
    });
  });

  it("a teacher's distress keeps her words out of the trace and is marked distress", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      triage: vi.fn(async () => ({
        status: "ok" as const,
        triage: { ...TRIAGE, intent: "teacher_distress" as const, redactedText: "I cannot go on" },
      })),
    });
    await ask(ai, m.store, input);
    const a = m.answers[0]!;
    expect(a.outcome).toBe("distress");
    // Flagged even when only the model saw distress, so the reviewer view hides it.
    expect(m.questions[0]!.safetyFlags).toContain("teacher_distress");
    expect(JSON.stringify(a.trace)).not.toContain("I cannot go on");
  });

  it("an unsafe draft step is never stored, not even struck through", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      answer: vi.fn(async () => ({
        status: "ok" as const,
        answer: {
          title: { kn: "t", en: "t" },
          steps: [
            { kn: "a", en: "Give ten sticks", cardId: "c1" },
            { kn: "b", en: "Use the cane if they forget", cardId: "c1" },
            { kn: "c", en: "Tie a bundle", cardId: "c2" },
          ],
          materials: [],
          why: null,
        },
      })),
    });
    await ask(ai, m.store, input);
    expect(JSON.stringify(m.answers[0]!.trace)).not.toContain("cane");
  });

  it("answers keep their language and outcome", async () => {
    const m = memoryStore();
    await ask(fakeAi(), m.store, { ...input, lang: "hi" });
    expect(m.answers[0]).toMatchObject({ lang: "hi", outcome: "answered" });
  });
});

describe("ask: show me (M5.3)", () => {
  const photo = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const reading = (over: Partial<PhotoReading> = {}) => ({
    status: "ok" as const,
    span,
    reading: {
      seenKn: "ಆರು ಪದಗಳಲ್ಲಿ ನಾಲ್ಕರಲ್ಲಿ ಬ ಮತ್ತು ದ ಅದಲು ಬದಲಾಗಿವೆ",
      seenEn: "Letters ಬ and ದ are swapped in 4 of 6 words",
      relevant: true,
      faces: false,
      welfareConcern: false,
      problemHint: "letter swap",
      ...over,
    },
  });
  const triageAs = (over: Partial<Triage>) =>
    vi.fn(async () => ({ status: "ok" as const, triage: { ...TRIAGE, ...over }, span }));

  it("reads the photo without her words, and adds what the work shows to her question before triage", async () => {
    const m = memoryStore();
    const readPhoto = vi.fn(async () => reading());
    const ai = fakeAi({ readPhoto });
    const stages: string[] = [];
    const seen: string[] = [];
    const out = await ask(
      ai,
      m.store,
      { ...input, photo },
      (s) => stages.push(s),
      (r) => seen.push(r.seenEn),
    );
    expect(out.kind).toBe("answered");
    expect(readPhoto).toHaveBeenCalledWith({ photo, lang: "kn", traceId: "tr" });
    expect(vi.mocked(ai.triage).mock.calls[0]![0].text).toBe(
      `${input.text}\n[What the photo shows: Letters ಬ and ದ are swapped in 4 of 6 words]`,
    );
    expect(stages.slice(0, 2)).toEqual(["seeing", "understanding"]);
    expect(seen).toEqual(["Letters ಬ and ದ are swapped in 4 of 6 words"]);
    const trace = m.answers[0]!.trace.steps;
    expect(trace.map((s) => s.kind).slice(0, 3)).toEqual(["transcript", "photo", "triage"]);
  });

  it("keeps the reader's own words out of the stored trace: only triage's redacted text is kept", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      readPhoto: vi.fn(async () => reading({ seenEn: "Name: Ravi Kumar; 21 for twelve" })),
    });
    await ask(ai, m.store, { ...input, photo });
    const stored = JSON.stringify(m.answers[0]!.trace);
    expect(stored).not.toContain("Ravi");
    expect(m.answers[0]!.trace.steps.find((s) => s.kind === "photo")!.detail).toMatch(/^Used/);
  });

  it("refuses kindly on a person in the photo, after triage found nothing that needs care", async () => {
    const m = memoryStore();
    const ai = fakeAi({ readPhoto: vi.fn(async () => reading({ faces: true, relevant: false })) });
    const out = await ask(ai, m.store, { ...input, photo });
    expect(out).toEqual({ kind: "photo_refused", reason: "faces" });
    // Triage ran on her words alone; the question is kept, unanswered, and counts toward the limit.
    expect(vi.mocked(ai.triage).mock.calls[0]![0].text).toBe(input.text);
    expect(m.answers).toHaveLength(0);
    expect(m.questions).toHaveLength(1);
    expect(m.questions[0]!.safetyFlags).toContain("photo_faces");
  });

  it("a person in the photo never hides harm or distress in her words (audit H1)", async () => {
    const faces = vi.fn(async () => reading({ faces: true, relevant: false }));
    const harm = await ask(
      fakeAi({ readPhoto: faces, triage: triageAs({ intent: "safety_disclosure" }) }),
      memoryStore().store,
      { ...input, photo, text: "She has marks all over her back and is afraid to go home" },
    );
    expect(harm).toMatchObject({ kind: "escalated", helpline: "childline" });
    const distress = await ask(
      fakeAi({ readPhoto: faces, triage: triageAs({ intent: "teacher_distress" }) }),
      memoryStore().store,
      { ...input, photo, text: "I cannot go on any more" },
    );
    expect(distress).toMatchObject({ kind: "distress", helpline: "telemanas" });
  });

  it("does not send the photo anywhere when her words already disclose harm or crisis (audit M6)", async () => {
    for (const [text, extra] of [
      ["ಅವನ ಅಪ್ಪ ಮನೆಯಲ್ಲಿ ಹೊಡೆಯುತ್ತಾರೆ", {}],
      ["I want to end my life", { crisisPatterns: (t: string) => /end my life/.test(t) }],
    ] as const) {
      const readPhoto = vi.fn(async () => reading());
      const m = memoryStore();
      await ask(fakeAi({ readPhoto, ...extra }), m.store, { ...input, photo, text });
      expect(readPhoto).not.toHaveBeenCalled();
    }
  });

  it("escalates a child's own writing about harm, used or not, face or not (audit H3)", async () => {
    for (const over of [
      { welfareConcern: true },
      { welfareConcern: true, faces: true, relevant: false },
      { relevant: false, seenEn: "The child wrote: Appa beats her at home" },
    ]) {
      const m = memoryStore();
      const ai = fakeAi({
        readPhoto: vi.fn(async () => reading(over)),
        disclosurePatterns: (t: string) =>
          /beats? (him|her) at home/i.test(t) ? ["child_harm"] : [],
      });
      const out = await ask(ai, m.store, { ...input, photo });
      expect(out, JSON.stringify(over)).toMatchObject({ kind: "escalated" });
      expect(m.questions[0]!.safetyFlags).toContain("child_harm");
    }
  });

  it("leaves an unrelated photo out, and answers from her words alone when the reader fails", async () => {
    for (const read of [
      vi.fn(async () => reading({ relevant: false })),
      vi.fn(async () => ({
        status: "needs_human" as const,
        reason: "budget" as const,
        problems: [],
        span,
      })),
    ]) {
      const m = memoryStore();
      const seen: string[] = [];
      const ai = fakeAi({ readPhoto: read });
      const out = await ask(ai, m.store, { ...input, photo }, undefined, (r) =>
        seen.push(r.seenEn),
      );
      expect(out.kind).toBe("answered");
      expect(vi.mocked(ai.triage).mock.calls[0]![0].text).toBe(input.text);
      expect(m.answers[0]!.trace.steps.find((s) => s.kind === "photo")!.detail).toMatch(/^Not/);
      expect(seen).toHaveLength(1);
    }
  });

  it("does not replay an answer by her words alone when a photo came with them", async () => {
    const m = memoryStore();
    const rawKey = (q: string) => `k:${q}`;
    await ask(fakeAi(), m.store, { ...input, rawKey });
    const ai = fakeAi({ readPhoto: vi.fn(async () => reading()) });
    await ask(ai, m.store, { ...input, rawKey, photo });
    // The words alone matched, but the photo was still read and the question still triaged.
    expect(ai.readPhoto).toHaveBeenCalled();
    expect(ai.triage).toHaveBeenCalled();
  });
});

describe("ask: the voice starts while the steps are checked (D86)", () => {
  function voiceSpy() {
    return {
      start: vi.fn<(line: string) => void>(),
      finish: vi.fn<(answerId: string, lines: string[]) => void>(),
    };
  }

  it("speaks the title, why and each supported step early, then keeps exactly the stored answer's lines", async () => {
    const m = memoryStore();
    const voice = voiceSpy();
    const out = await ask(fakeAi(), m.store, { ...input, voice });
    expect(out).toMatchObject({ kind: "answered", answerId: "a1" });
    const started = voice.start.mock.calls.map((c) => c[0]);
    expect(started).toEqual(expect.arrayContaining(["ಕಡ್ಡಿ ಕಟ್ಟು", "ಏಕೆ", "1. ಒಂದು", "2. ಎರಡು"]));
    // A step the judge removed, or one citing a card it was not given, is never spoken.
    expect(started.some((l) => l.includes("ಮೂರು") || l.includes("ನಾಲ್ಕು"))).toBe(false);
    expect(voice.finish).toHaveBeenCalledExactlyOnceWith("a1", [
      "ಕಡ್ಡಿ ಕಟ್ಟು",
      "1. ಒಂದು",
      "2. ಎರಡು",
      "ಏಕೆ",
    ]);
  });

  it("numbers the kept steps as she sees them when an earlier step is removed", async () => {
    const m = memoryStore();
    const voice = voiceSpy();
    const ai = fakeAi({
      judge: vi.fn(async ({ step }) => ({
        status: "ok" as const,
        verdict: step.en === "Give ten sticks" ? ("unsupported" as const) : ("supported" as const),
        cardQuote: "quote",
        span,
      })),
    });
    await ask(ai, m.store, { ...input, voice });
    expect(voice.finish.mock.calls[0]![1]).toEqual(["ಕಡ್ಡಿ ಕಟ್ಟು", "1. ಎರಡು", "2. ಮೂರು", "ಏಕೆ"]);
  });

  it("keeps no voice for an answer that is not shipped, and never speaks an unsafe step", async () => {
    const m = memoryStore();
    const voice = voiceSpy();
    const ai = fakeAi({
      answer: vi.fn(async () => ({
        status: "ok" as const,
        span,
        answer: {
          title: { kn: "ಶೀರ್ಷಿಕೆ", en: "Title" },
          steps: [
            { kn: "ಒಂದು", en: "Give ten sticks", cardId: "c1" },
            { kn: "ಬೆತ್ತ", en: "Beat the child with a cane", cardId: "c1" },
          ],
          materials: [],
          why: null,
        },
      })),
    });
    const out = await ask(ai, m.store, { ...input, voice });
    expect(out).toMatchObject({ kind: "needs_human" });
    expect(voice.finish).not.toHaveBeenCalled();
    expect(voice.start.mock.calls.map((c) => c[0]).some((l) => l.includes("ಬೆತ್ತ"))).toBe(false);
  });
});

describe("ask: steps are judged while the answer is written (D86)", () => {
  const FINAL = [
    { kn: "ಒಂದು", en: "Give ten sticks", cardId: "c1" },
    { kn: "ಎರಡು", en: "Tie a bundle", cardId: "c1" },
  ];

  it("judges a finished step once, early, and uses that judgment for the same step", async () => {
    const m = memoryStore();
    const order: string[] = [];
    const ai = fakeAi({
      answer: vi.fn(async ({ onStep }) => {
        for (const s of FINAL) onStep?.(s);
        await new Promise((r) => setTimeout(r, 10)); // the model writes materials and why
        order.push("draft done");
        return {
          status: "ok" as const,
          span,
          answer: {
            title: { kn: "ಶೀರ್ಷಿಕೆ", en: "Title" },
            steps: FINAL,
            materials: [],
            why: null,
          },
        };
      }),
      judge: vi.fn(async ({ step }) => {
        order.push(`judge ${step.en}`);
        return { status: "ok" as const, verdict: "supported" as const, cardQuote: "quote", span };
      }),
    });
    const out = await ask(ai, m.store, input);
    expect(out).toMatchObject({ kind: "answered" });
    expect(ai.judge).toHaveBeenCalledTimes(2);
    expect(order.indexOf("judge Give ten sticks")).toBeLessThan(order.indexOf("draft done"));
    expect(m.answers[0]!.steps.map((s) => s.en)).toEqual(["Give ten sticks", "Tie a bundle"]);
  });

  it("never uses an early judgment for a step the final answer changed, or one citing an unknown card", async () => {
    const m = memoryStore();
    const ai = fakeAi({
      answer: vi.fn(async ({ onStep }) => {
        // A first attempt the validator refused, then the answer that ships.
        onStep?.({ kn: "ಒಂದು", en: "Give eleven sticks", cardId: "c1" });
        onStep?.({ kn: "ಮೂರು", en: "Made up", cardId: "zzz" });
        return {
          status: "ok" as const,
          span,
          answer: {
            title: { kn: "ಶೀರ್ಷಿಕೆ", en: "Title" },
            steps: FINAL,
            materials: [],
            why: null,
          },
        };
      }),
      judge: vi.fn(async ({ step }) => ({
        status: "ok" as const,
        verdict:
          step.en === "Give eleven sticks" ? ("supported" as const) : ("unsupported" as const),
        cardQuote: null,
        span,
      })),
    });
    const out = await ask(ai, m.store, input);
    // The final steps were judged on their own words, and both were unsupported.
    expect(out).toMatchObject({ kind: "needs_human", reason: "unsupported" });
    const judgedSteps = vi.mocked(ai.judge).mock.calls.map((c) => c[0].step.en);
    expect(judgedSteps).toEqual(["Give eleven sticks", "Give ten sticks", "Tie a bundle"]);
  });
});
