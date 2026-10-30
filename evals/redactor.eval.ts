import { describe, expect, it } from "vitest";
import { REDACTOR_PROMPT_VERSION } from "@/ai/prompts/redactor";
import { buildRedactorRequest, redactPhrases, validateRedaction } from "@/ai/roles/redactor";
import { NAME_CHECK_PROMPT_VERSION } from "@/ai/prompts/name_check";
import { buildNameCheckRequest, checkNames, validateNameCheck } from "@/ai/roles/name_check";
import { liveEvalsAllowed } from "@/ai/evals/recording";
import { checkRedaction, evalEnv, isRecorded, loadJsonl, RedactorCase, TODO_NOT_RECORDED } from "./lib";

// redactor@v1 (docs/AI.md §6). Two kinds of test:
//   guardrails: always run, on hand written model outputs (the reference answer, and an
//               unredacted copy the deterministic check must refuse).
//   model:      replays the recording of a real model call; with no recording yet the case is a
//               todo, never a failure, until the founder approves the first live run.
const cases = loadJsonl("redactor.jsonl", RedactorCase);

describe("redactor eval set", () => {
  it("has at least 6 synthetic cases, at least 2 adversarial, all marked sample", () => {
    expect(cases.length).toBeGreaterThanOrEqual(6);
    expect(cases.filter((c) => c.adversarial).length).toBeGreaterThanOrEqual(2);
    expect(cases.every((c) => c.sample)).toBe(true);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });
});

describe.each(cases)("redactor guardrails: $id", (c) => {
  it("accepts the reference answer", () => {
    expect(validateRedaction(c.input, c.reference)).toEqual([]);
  });

  it("the reference answer meets the case's expectations", () => {
    expect(checkRedaction(c, c.reference.phrases)).toEqual([]);
  });

  it("refuses an answer that drops a phrase", () => {
    const short = { phrases: c.reference.phrases.slice(0, -1) };
    expect(validateRedaction(c.input, short).length).toBeGreaterThan(0);
  });

  if (c.expect.backstop) {
    it("refuses an unredacted copy of the transcript, even if the model says it redacted", () => {
      const copy = {
        phrases: c.input.phrases.map((p, i) => ({ ...c.reference.phrases[i]!, textKn: p.text, textEn: p.text })),
      };
      expect(validateRedaction(c.input, copy).length).toBeGreaterThan(0);
    });
  }
});

describe("redactor with the model (replayed)", () => {
  for (const c of cases) {
    const { system, prompt } = buildRedactorRequest(c.input);
    const recorded = isRecorded({ role: "redactor", promptVersion: REDACTOR_PROMPT_VERSION, system, prompt, itemId: c.id });
    if (!recorded && !liveEvalsAllowed()) {
      it.todo(`${c.id}: ${TODO_NOT_RECORDED}`);
      continue;
    }
    it(c.id, async () => {
      const res = await redactPhrases({ ...c.input, itemId: c.id }, { env: evalEnv() });
      expect(res.status, res.status === "needs_human" ? `${res.reason}: ${res.problems.join(" | ")}` : "").toBe("ok");
      if (res.status === "ok") expect(checkRedaction(c, res.phrases)).toEqual([]);
    });
  }
});

// The optional second reader (AI_NAME_CHECK=1): a clean redaction must pass, a leaky one must not.
describe("second name check guardrails", () => {
  it("accepts only refs that exist", () => {
    expect(validateNameCheck(3, { flagged: ["P1", "P3"] })).toEqual([]);
    expect(validateNameCheck(3, { flagged: ["P4"] }).length).toBeGreaterThan(0);
  });
});

describe("second name check with the model (replayed)", () => {
  const variants = cases.flatMap((c) => [
    { c, id: `${c.id}:clean`, phrases: c.reference.phrases, expectFlag: false },
    ...(c.expect.absent.length
      ? [{ c, id: `${c.id}:leaky`, phrases: c.input.phrases.map((p) => ({ textKn: p.text, textEn: p.text })), expectFlag: true }]
      : []),
  ]);
  for (const v of variants) {
    const input = { phrases: v.phrases, masterName: v.c.input.masterName };
    const { system, prompt } = buildNameCheckRequest(input);
    if (!isRecorded({ role: "name_check", promptVersion: NAME_CHECK_PROMPT_VERSION, system, prompt, itemId: v.id }) && !liveEvalsAllowed()) {
      it.todo(`${v.id}: ${TODO_NOT_RECORDED}`);
      continue;
    }
    it(v.id, async () => {
      const res = await checkNames({ ...input, itemId: v.id }, { env: evalEnv() });
      expect(res.status).toBe("ok");
      if (res.status === "ok") expect(res.flagged.length > 0).toBe(v.expectFlag);
    });
  }
});
