import { APICallError } from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { memoryRecordingStore } from "./evals/recording";
import type { AiCallRow } from "./log";
import { aiMode, MIN_RETRY_MS, recordingKeyFor, runStructured, type RunDeps } from "./run";

const schema = z.object({ answer: z.string(), n: z.number().int() });
const SECRET = "PROMPT-SENTINEL-ರವಿ";

type Gen = { text: string; finish?: "stop" | "length" };

function reply({ text, finish = "stop" }: Gen) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: finish, raw: finish === "stop" ? "end_turn" : "max_tokens" },
    usage: {
      inputTokens: { total: 1_000, noCache: 1_000, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 200, text: 200, reasoning: 0 },
    },
    warnings: [],
  };
}

function harness(replies: Array<Gen | Error>, over: Partial<RunDeps> = {}) {
  const prompts: string[] = [];
  let i = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (opts) => {
      prompts.push(JSON.stringify(opts.prompt));
      const next = replies[Math.min(i++, replies.length - 1)]!;
      if (next instanceof Error) throw next;
      return reply(next);
    },
  });
  const rows: AiCallRow[] = [];
  const store = memoryRecordingStore();
  const deps: RunDeps = {
    model,
    env: { ANTHROPIC_API_KEY: "test" },
    store,
    log: async (r) => void rows.push(r),
    spend: async () => ({ totalUsd: 0, todayUsd: 0 }),
    ...over,
  };
  return { deps, rows, prompts, store, calls: () => i };
}

const base = {
  role: "redactor" as const,
  promptVersion: "test@v1",
  system: "system rules",
  prompt: `<transcript>${SECRET}</transcript>`,
  schema,
};

describe("aiMode", () => {
  it("replays without a key or with AI_REPLAY=1, records with LIVE_EVALS or AI_RECORD", () => {
    expect(aiMode({})).toBe("replay");
    expect(aiMode({ ANTHROPIC_API_KEY: "k", AI_REPLAY: "1" })).toBe("replay");
    expect(aiMode({ ANTHROPIC_API_KEY: "k", LIVE_EVALS: "1" })).toBe("record");
    expect(aiMode({ ANTHROPIC_API_KEY: "k", AI_RECORD: "1" })).toBe("record");
    expect(aiMode({ ANTHROPIC_API_KEY: "k" })).toBe("live");
  });
});

describe("runStructured", () => {
  it("returns validated output and logs one ok row with cost", async () => {
    const h = harness([{ text: '{"answer":"ಹೌದು","n":2}' }]);
    const out = await runStructured(base, h.deps);
    expect(out).toMatchObject({
      status: "ok",
      output: { answer: "ಹೌದು", n: 2 },
      attempts: 1,
      replayed: false,
    });
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0]).toMatchObject({
      role: "redactor",
      status: "ok",
      tokensIn: 1_000,
      tokensOut: 200,
    });
    expect(h.rows[0]!.costUsd).toBeGreaterThan(0);
    expect(out.span).toMatchObject({
      role: "redactor",
      promptVersion: "test@v1",
      tokensIn: 1_000,
      tokensOut: 200,
      attempts: 1,
      replayed: false,
    });
    expect(out.span.costUsd).toBe(h.rows[0]!.costUsd);
  });

  it("sums the span over every attempt, also when it gives up", async () => {
    const h = harness([{ text: '{"answer":"x","n":1}' }]);
    const out = await runStructured({ ...base, validate: () => ["never good enough"] }, h.deps);
    expect(out.status).toBe("needs_human");
    expect(out.span).toMatchObject({ tokensIn: 3_000, tokensOut: 600, attempts: 3 });
    expect(out.span.costUsd).toBeCloseTo(
      h.rows.reduce((n, r) => n + r.costUsd, 0),
      6,
    );
  });

  it("retries a schema failure with the problem appended, then succeeds", async () => {
    const h = harness([{ text: '{"answer":"x","n":"two"}' }, { text: '{"answer":"x","n":2}' }]);
    const out = await runStructured(base, h.deps);
    expect(out.status).toBe("ok");
    expect(h.rows.map((r) => r.status)).toEqual(["retry", "ok"]);
    expect(h.rows[0]!.error).toBe("schema");
    expect(h.prompts[1]).toContain("previous_attempt_problems");
    expect(h.prompts[1]).toContain("n:");
    // The retry names the problem, never the model's raw text.
    expect(h.prompts[1]).not.toContain('\\"two\\"');
  });

  it("feeds semantic validation problems back and gives up after three attempts", async () => {
    const h = harness([{ text: '{"answer":"x","n":1}' }]);
    const out = await runStructured(
      { ...base, validate: (o) => (o.n < 5 ? ["n must be at least 5"] : []) },
      h.deps,
    );
    expect(out).toMatchObject({ status: "needs_human", reason: "invalid_output", attempts: 3 });
    expect(h.rows.map((r) => r.status)).toEqual(["retry", "retry", "invalid"]);
    expect(h.prompts[2]).toContain("n must be at least 5");
  });

  it("tells the model when its answer was cut off", async () => {
    const h = harness([
      { text: '{"answer":"x"', finish: "length" },
      { text: '{"answer":"x","n":1}' },
    ]);
    const out = await runStructured(base, h.deps);
    expect(out.status).toBe("ok");
    expect(h.rows[0]!.error).toBe("truncated");
    expect(h.prompts[1]).toContain("cut off");
  });

  it("does not retry a provider error and hands the item to a human", async () => {
    const err = new APICallError({
      message: "overloaded",
      url: "x",
      requestBodyValues: {},
      statusCode: 529,
      isRetryable: false,
    });
    const h = harness([err]);
    const out = await runStructured(base, h.deps);
    expect(out).toMatchObject({ status: "needs_human", reason: "model_error", attempts: 1 });
    expect(h.rows).toEqual([expect.objectContaining({ status: "error", error: "http_529" })]);
  });

  it("never puts prompt text into an ai_calls row", async () => {
    const h = harness([{ text: '{"answer":"x","n":"bad"}' }, { text: '{"answer":"x","n":1}' }]);
    await runStructured(base, h.deps);
    expect(JSON.stringify(h.rows)).not.toContain("SENTINEL");
  });

  it("refuses a call over the budget cap without touching the model", async () => {
    const h = harness([{ text: '{"answer":"x","n":1}' }], {
      spend: async () => ({ totalUsd: 350, todayUsd: 0 }),
    });
    const out = await runStructured(base, h.deps);
    expect(out).toMatchObject({ status: "needs_human", reason: "budget" });
    expect(h.calls()).toBe(0);
    expect(h.rows).toEqual([expect.objectContaining({ status: "fallback", error: "budget" })]);
  });

  it("serves a recording instead when over the cap", async () => {
    const h = harness([{ text: '{"answer":"live","n":1}' }], {
      spend: async () => ({ totalUsd: 0, todayUsd: 25 }),
    });
    h.store.put(recordingFor({ answer: "recorded", n: 3 }));
    const out = await runStructured(base, h.deps);
    expect(out).toMatchObject({ status: "ok", replayed: true, output: { answer: "recorded" } });
    expect(h.calls()).toBe(0);
  });

  it("stops retrying when the time budget would cut the next attempt off", async () => {
    let t = 0;
    const h = harness([{ text: '{"answer":"x","n":"bad"}' }], { now: () => (t += 50_000) });
    const out = await runStructured({ ...base, timeBudgetMs: 2 * MIN_RETRY_MS }, h.deps);
    expect(out).toMatchObject({ status: "needs_human", reason: "timeout" });
    expect(h.calls()).toBe(1);
  });
});

function recordingFor(output: unknown, itemId = "") {
  return {
    key: recordingKeyFor({ ...base, itemId }),
    role: "redactor",
    model: "m",
    promptVersion: base.promptVersion,
    itemId,
    recordedAt: "2026-10-23T00:00:00Z",
    attempts: 1,
    usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
    costUsd: 0.001,
    outcome: "ok" as const,
    output,
  };
}

describe("recordings", () => {
  it("replay mode serves a recording and spends nothing", async () => {
    const h = harness([], { env: {} });
    h.store.put(recordingFor({ answer: "r", n: 1 }, "case-1"));
    const out = await runStructured({ ...base, itemId: "case-1" }, h.deps);
    expect(out).toMatchObject({
      status: "ok",
      replayed: true,
      span: { costUsd: 0, replayed: true, attempts: 0 },
    });
    expect(h.calls()).toBe(0);
    expect(h.rows).toEqual([expect.objectContaining({ status: "replayed", costUsd: 0 })]);
  });

  it("a replay miss is needs_human no_recording, never a throw", async () => {
    const h = harness([], { env: {} });
    const out = await runStructured({ ...base, itemId: "missing" }, h.deps);
    expect(out).toMatchObject({ status: "needs_human", reason: "no_recording" });
  });

  it("re-validates recorded output, so a tightened guardrail fails an old recording", async () => {
    const h = harness([], { env: { AI_REPLAY: "1", ANTHROPIC_API_KEY: "k" } });
    h.store.put(recordingFor({ answer: "r", n: 1 }));
    const out = await runStructured({ ...base, validate: () => ["new rule"] }, h.deps);
    expect(out).toMatchObject({
      status: "needs_human",
      reason: "invalid_output",
      problems: ["new rule"],
    });
  });

  it("records only eval items, never live product calls", async () => {
    const h = harness([{ text: '{"answer":"x","n":1}' }], {
      env: { ANTHROPIC_API_KEY: "k", AI_RECORD: "1" },
    });
    await runStructured(base, h.deps);
    expect(h.store.all()).toHaveLength(0);
    await runStructured({ ...base, itemId: "case-9" }, h.deps);
    expect(h.store.all()).toEqual([
      expect.objectContaining({ itemId: "case-9", outcome: "ok", output: { answer: "x", n: 1 } }),
    ]);
    expect(JSON.stringify(h.store.all())).not.toContain("SENTINEL");
  });

  it("records what a refused attempt got wrong when a retry then succeeds", async () => {
    const h = harness([{ text: '{"answer":"","n":1}' }, { text: '{"answer":"fine","n":1}' }], {
      env: { ANTHROPIC_API_KEY: "k", LIVE_EVALS: "1" },
    });
    const out = await runStructured(
      {
        ...base,
        itemId: "case-r",
        validate: (o: { answer: string }) => (o.answer ? [] : ["answer is empty"]),
      },
      h.deps,
    );
    expect(out).toMatchObject({ status: "ok", attempts: 2 });
    expect(h.store.all()[0]).toMatchObject({
      outcome: "ok",
      attempts: 2,
      retriedFor: ["answer is empty"],
    });
  });

  it("an eval-only model override gets its own recording, model name and price, never the role's", async () => {
    const h = harness([{ text: '{"answer":"h","n":1}' }], {
      env: { ANTHROPIC_API_KEY: "k", LIVE_EVALS: "1" },
      modelOverride: "haiku",
    });
    const out = await runStructured({ ...base, role: "answerer", itemId: "case-h" }, h.deps);
    expect(out).toMatchObject({ status: "ok", span: { model: "claude-haiku-5-5" } });
    expect(h.rows[0]).toMatchObject({ model: "claude-haiku-5-5" });
    const [saved] = h.store.all();
    expect(saved).toMatchObject({ model: "claude-haiku-5-5", itemId: "case-h" });
    const sonnetKey = recordingKeyFor({ ...base, role: "answerer", itemId: "case-h" });
    const haikuKey = recordingKeyFor({
      ...base,
      role: "answerer",
      itemId: "case-h",
      modelKey: "haiku",
    });
    expect(saved!.key).toBe(haikuKey);
    expect(haikuKey).not.toBe(sonnetKey);
    // Haiku's price: 1,000 in and 200 out at $0.10 and $0.50 per million.
    expect(saved!.costUsd).toBeCloseTo((1_000 * 0.1 + 200 * 0.5) / 1_000_000, 8);
  });

  it("records only what is missing or no longer passes: an unchanged recorded call is replayed, not paid for", async () => {
    const h = harness([{ text: '{"answer":"new","n":2}' }], {
      env: { ANTHROPIC_API_KEY: "k", LIVE_EVALS: "1" },
    });
    h.store.put(recordingFor({ answer: "kept", n: 1 }, "case-1"));
    const kept = await runStructured({ ...base, itemId: "case-1" }, h.deps);
    expect(kept).toMatchObject({ status: "ok", replayed: true, output: { answer: "kept" } });
    expect(h.calls()).toBe(0);
    // A recording the guardrails now refuse is recorded again.
    const strict = {
      ...base,
      itemId: "case-1",
      validate: (o: { n: number }) => (o.n < 2 ? ["n must be 2"] : []),
    };
    const again = await runStructured(strict, h.deps);
    expect(again).toMatchObject({ status: "ok", replayed: false, output: { answer: "new" } });
    expect(h.calls()).toBe(1);
  });
});

describe("runStructured streaming (D86)", () => {
  const usage = {
    inputTokens: { total: 1_000, noCache: 1_000, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 200, text: 200, reasoning: 0 },
  };
  /** A model that streams each reply in small pieces, or fails mid stream. */
  function streamer(replies: Array<string | Error>) {
    let i = 0;
    const model = new MockLanguageModelV4({
      doStream: async () => {
        const next = replies[Math.min(i++, replies.length - 1)]!;
        const pieces = typeof next === "string" ? (next.match(/.{1,6}/gsu) ?? []) : [];
        return {
          stream: convertArrayToReadableStream([
            { type: "stream-start" as const, warnings: [] },
            { type: "text-start" as const, id: "t" },
            ...pieces.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
            ...(next instanceof Error ? [{ type: "error" as const, error: next }] : []),
            { type: "text-end" as const, id: "t" },
            {
              type: "finish" as const,
              finishReason: { unified: "stop" as const, raw: "end_turn" },
              usage,
            },
          ]),
        };
      },
    });
    return { model, calls: () => i };
  }

  it("passes growing partial outputs, then validates and logs the final one like a plain call", async () => {
    const s = streamer(['{"answer":"ಹೌದು ಇದು ಉದ್ದದ ಉತ್ತರ","n":2}']);
    const h = harness([], { model: s.model });
    const partials: unknown[] = [];
    const out = await runStructured(
      { ...base, onPartial: (p, attempt) => partials.push([p, attempt]) },
      h.deps,
    );
    expect(out).toMatchObject({
      status: "ok",
      output: { answer: "ಹೌದು ಇದು ಉದ್ದದ ಉತ್ತರ", n: 2 },
      attempts: 1,
    });
    expect(partials.length).toBeGreaterThan(1);
    expect(partials.at(-1)).toEqual([{ answer: "ಹೌದು ಇದು ಉದ್ದದ ಉತ್ತರ", n: 2 }, 1]);
    expect(h.rows).toEqual([
      expect.objectContaining({ status: "ok", tokensIn: 1_000, tokensOut: 200 }),
    ]);
    expect(h.rows[0]!.costUsd).toBeGreaterThan(0);
  });

  it("retries a streamed output that breaks the schema, and says which attempt each partial is", async () => {
    const s = streamer(['{"answer":"x","n":"two"}', '{"answer":"y","n":3}']);
    const h = harness([], { model: s.model });
    const attempts = new Set<number>();
    const out = await runStructured({ ...base, onPartial: (_p, a) => attempts.add(a) }, h.deps);
    expect(out).toMatchObject({ status: "ok", output: { answer: "y", n: 3 }, attempts: 2 });
    expect([...attempts]).toEqual([1, 2]);
    expect(h.rows.map((r) => r.status)).toEqual(["retry", "ok"]);
  });

  it("an error mid stream is a model error, as with a plain call", async () => {
    const s = streamer([
      new APICallError({
        message: "overloaded",
        url: "u",
        requestBodyValues: {},
        statusCode: 529,
        isRetryable: false,
      }),
    ]);
    const h = harness([], { model: s.model });
    const out = await runStructured({ ...base, onPartial: () => {} }, h.deps);
    expect(out).toMatchObject({ status: "needs_human", reason: "model_error" });
  });

  it("AI_STREAM=0 turns streaming off, and a replay never streams", async () => {
    const h = harness([{ text: '{"answer":"plain","n":1}' }], {
      env: { ANTHROPIC_API_KEY: "test", AI_STREAM: "0" },
    });
    const partials: unknown[] = [];
    const out = await runStructured({ ...base, onPartial: (p) => partials.push(p) }, h.deps);
    expect(out).toMatchObject({ status: "ok", output: { answer: "plain" } });
    expect(partials).toEqual([]);
  });
});
