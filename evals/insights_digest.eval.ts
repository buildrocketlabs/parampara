import { describe, expect, it } from "vitest";
import { z } from "zod";
import { liveEvalsAllowed } from "@/ai/evals/recording";
import { INSIGHTS_DIGEST_PROMPT_VERSION } from "@/ai/prompts/insights_digest";
import {
  buildDigestRequest,
  DigestOutput,
  summarizeInsights,
  validateDigest,
  type DigestInput,
  type DigestOutput as Digest,
} from "@/ai/roles/insights_digest";
import { evalEnv, isRecorded, loadJsonl, TODO_NOT_RECORDED } from "./lib";

// insights_digest@v1 (docs/AI.md §2, §6). Two kinds of test, as for the other roles:
//   guardrails: always run, on hand written reference notes and on broken copies of them that the
//               deterministic validator must refuse (an invented number, ranking words, an id).
//   model:      replays the recording of a real model call; with no recording yet the case is a
//               todo, never a failure, until the founder approves the first live run.

const Count = z.union([z.number(), z.literal("fewer than 5 teachers"), z.literal("kept private")]);
const Input: z.ZodType<DigestInput> = z.object({
  kind: z.enum(["field", "sample"]),
  week: z.object({ from: z.string(), to: z.string() }),
  funnel: z.object({ asked: Count, answered: Count, tried: Count, worked: Count }),
  teachersWhoAsked: Count,
  topics: z.array(
    z.object({ topic: z.string(), topicKn: z.string(), asked: Count, waitingForMaster: Count }),
  ),
  practices: z.array(
    z.object({
      title: z.string(),
      titleKn: z.string(),
      master: z.string().nullable(),
      tried: Count,
      worked: Count,
    }),
  ),
  costPerTeacherInr: z.number().nullable(),
});

const DigestCase = z.object({
  id: z.string(),
  sample: z.literal(true),
  adversarial: z.boolean(),
  description: z.string(),
  input: Input,
  expect: z.object({ mention: z.array(z.string()), avoid: z.array(z.string()) }),
  reference: DigestOutput,
});
type DigestCase = z.infer<typeof DigestCase>;

const cases = loadJsonl("insights_digest.jsonl", DigestCase);

const allText = (d: Digest) =>
  [
    d.headlineKn,
    d.headlineEn,
    ...d.actions.flatMap((a) => [a.kn, a.en]),
    ...d.watch.flatMap((w) => [w.kn, w.en]),
  ].join("\n");

function checkDigest(c: DigestCase, out: Digest): string[] {
  const fails = validateDigest(c.input, out);
  const text = allText(out).toLowerCase();
  for (const m of c.expect.mention)
    if (!text.includes(m.toLowerCase())) fails.push(`should mention "${m}"`);
  for (const a of c.expect.avoid)
    if (text.includes(a.toLowerCase())) fails.push(`should not say "${a}"`);
  return fails;
}

describe("insights digest eval set", () => {
  it("has at least 5 synthetic cases, at least 2 adversarial, all marked sample", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    expect(cases.filter((c) => c.adversarial).length).toBeGreaterThanOrEqual(2);
    expect(cases.every((c) => c.sample)).toBe(true);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  it("never puts a teacher identifier into the prompt", () => {
    for (const c of cases) {
      const { prompt } = buildDigestRequest(c.input);
      expect(prompt, c.id).not.toMatch(
        /teacher_?id|profile_?id|@[\w-]+\.\w|[0-9a-f]{8}-[0-9a-f]{4}-/i,
      );
      expect(prompt, c.id).toMatch(/^<aggregates kind="(field|sample)">/);
    }
  });
});

describe.each(cases)("insights digest guardrails: $id", (c) => {
  it("accepts the reference note", () => {
    expect(checkDigest(c, c.reference)).toEqual([]);
  });

  it("refuses a note with a number the aggregates never gave", () => {
    const bad = {
      ...c.reference,
      headlineEn: `${c.reference.headlineEn} That is 63% more than last week.`,
    };
    expect(validateDigest(c.input, bad).join(" ")).toMatch(/63/);
  });

  it("refuses a note that ranks or watches teachers", () => {
    const bad = {
      ...c.reference,
      actions: [
        ...c.reference.actions.slice(0, 1),
        { kn: "ಶಿಕ್ಷಕರ ಶ್ರೇಯಾಂಕ ಮಾಡಿ.", en: "Rank the teachers and monitor the slowest." },
      ],
    };
    expect(validateDigest(c.input, bad).length).toBeGreaterThan(0);
  });

  it("refuses blame, pressure and comparison in Kannada too", () => {
    const bad = {
      ...c.reference,
      watch: [{ kn: "ಹಿಂದುಳಿದ ಶಾಲೆಗಳಿಗೆ ನೋಟಿಸ್ ಕೊಡಿ.", en: "Warn the schools that are behind." }],
    };
    expect(validateDigest(c.input, bad).length).toBeGreaterThanOrEqual(2);
  });

  it("refuses a number in Kannada words or other scripts", () => {
    const bad = {
      ...c.reference,
      headlineKn: `ತೊಂಬತ್ತೊಂಬತ್ತು ಶಿಕ್ಷಕರು. ${c.reference.headlineKn}`,
      headlineEn: "９９ teachers asked.",
    };
    expect(validateDigest(c.input, bad).length).toBeGreaterThanOrEqual(2);
  });
});

describe("insights digest with the model (replayed)", () => {
  for (const c of cases) {
    const { system, prompt } = buildDigestRequest(c.input);
    const recorded = isRecorded({
      role: "insights_digest",
      promptVersion: INSIGHTS_DIGEST_PROMPT_VERSION,
      system,
      prompt,
      itemId: c.id,
    });
    if (!recorded && !liveEvalsAllowed()) {
      it.todo(`${c.id}: ${TODO_NOT_RECORDED}`);
      continue;
    }
    it(c.id, async () => {
      const res = await summarizeInsights({ ...c.input, itemId: c.id }, { env: evalEnv() });
      expect(
        res.status,
        res.status === "needs_human" ? `${res.reason}: ${res.problems.join(" | ")}` : "",
      ).toBe("ok");
      if (res.status === "ok") expect(checkDigest(c, res.digest)).toEqual([]);
    });
  }
});
