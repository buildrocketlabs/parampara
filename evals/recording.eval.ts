import { describe, expect, it } from "vitest";
import { liveEvalsAllowed, recordingKey } from "@/ai/evals/recording";
import { modelIdFor } from "@/ai/router";

// T0: the harness only. Role suites (triage, answerer, grounding, safety) join in T5 (docs/AI.md §6).
const base = {
  role: "triage",
  model: modelIdFor("triage"),
  promptVersion: "triage@v1",
  settings: { maxOutputTokens: 500, effort: "low" },
  itemId: "sample-001",
  renderedPrompt: "<teacher_input>…</teacher_input>",
};

describe("eval recording cache", () => {
  it("keys are stable regardless of settings key order", () => {
    const reordered = { ...base, settings: { effort: "low", maxOutputTokens: 500 } };
    expect(recordingKey(reordered)).toBe(recordingKey(base));
  });

  it("any prompt version bump is a cache miss", () => {
    expect(recordingKey({ ...base, promptVersion: "triage@v2" })).not.toBe(recordingKey(base));
  });

  it("spends nothing unless LIVE_EVALS=1", () => {
    expect(liveEvalsAllowed({})).toBe(false);
    expect(liveEvalsAllowed({ LIVE_EVALS: "1" })).toBe(true);
  });
});
