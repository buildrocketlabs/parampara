import { describe, expect, it } from "vitest";
import { z } from "zod";
import { liveEvalsAllowed } from "@/ai/evals/recording";
import { INTERVIEWER_PROMPT_VERSION } from "@/ai/prompts/interviewer";
import {
  buildInterviewerRequest,
  InterviewerOutput,
  nextInterviewQuestion,
  validateInterviewer,
  type NextQuestion,
} from "@/ai/roles/interviewer";
import { findUnsafe } from "@/ai/safety/patterns";
import { InterviewTopic } from "@/lib/domain/interview";
import { evalEnv, isRecorded, loadJsonl, TODO_NOT_RECORDED } from "./lib";

// interviewer@v1 (docs/field/interview-guide.md). Guardrails always run on hand written outputs;
// model cases replay recordings, or are todos until the founder approves a live run.
const Case = z.object({
  id: z.string(),
  sample: z.literal(true),
  adversarial: z.boolean(),
  description: z.string(),
  input: z.object({
    master: z.object({ name: z.string().nullable(), years: z.number().nullable(), classes: z.string().nullable() }),
    transcript: z.array(z.object({ speaker: z.string().nullable(), textKn: z.string(), textEn: z.string().nullable() })),
    turns: z.array(z.object({ topic: InterviewTopic, probe: z.boolean() })),
    cardsCaptured: z.array(z.string()),
    elapsedMs: z.number(),
    lastAnswerHadName: z.boolean(),
  }),
  expect: z.object({
    topics: z.array(InterviewTopic).nullable(),
    probe: z.boolean().nullable(),
    done: z.boolean().nullable(),
    knIncludes: z.array(z.string()),
  }),
  reference: InterviewerOutput,
  faulty: z.array(z.object({ why: z.string(), output: InterviewerOutput })),
});
type Case = z.infer<typeof Case>;
const cases = loadJsonl("interviewer.jsonl", Case);

function check(c: Case, q: NextQuestion | z.infer<typeof InterviewerOutput>): string[] {
  const fails: string[] = [];
  const e = c.expect;
  if (e.topics && !e.topics.includes(q.topic)) fails.push(`topic ${q.topic} not in ${e.topics.join(", ")}`);
  if (e.probe !== null && q.probe !== e.probe) fails.push(`probe ${q.probe}, expected ${e.probe}`);
  if (e.done !== null && q.done !== e.done) fails.push(`done ${q.done}, expected ${e.done}`);
  for (const w of e.knIncludes) if (!q.questionKn.includes(w)) fails.push(`questionKn lacks "${w}"`);
  if (findUnsafe(`${q.questionKn}\n${q.questionEn}`).length) fails.push("question mentions harm");
  return fails;
}

describe("interviewer eval set", () => {
  it("has at least 6 synthetic cases, some adversarial", () => {
    expect(cases.length).toBeGreaterThanOrEqual(6);
    expect(cases.filter((c) => c.adversarial).length).toBeGreaterThanOrEqual(2);
    expect(cases.every((c) => c.sample)).toBe(true);
  });
});

describe.each(cases)("interviewer guardrails: $id", (c) => {
  it("accepts the reference and it meets the expectations", () => {
    expect(validateInterviewer(c.input, c.reference)).toEqual([]);
    expect(check(c, c.reference)).toEqual([]);
  });

  for (const f of c.faulty) {
    it(`refuses: ${f.why}`, () => {
      expect(validateInterviewer(c.input, f.output).length).toBeGreaterThan(0);
    });
  }
});

describe("interviewer with the model (replayed)", () => {
  for (const c of cases) {
    const { system, prompt } = buildInterviewerRequest(c.input);
    if (!isRecorded({ role: "interviewer", promptVersion: INTERVIEWER_PROMPT_VERSION, system, prompt, itemId: c.id }) && !liveEvalsAllowed()) {
      it.todo(`${c.id}: ${TODO_NOT_RECORDED}`);
      continue;
    }
    it(c.id, async () => {
      const res = await nextInterviewQuestion({ ...c.input, itemId: c.id }, { env: evalEnv() });
      expect(res.status).toBe("ok");
      if (res.status === "ok") expect(check(c, res.question)).toEqual([]);
    });
  }
});
