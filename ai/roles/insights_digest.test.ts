import { describe, expect, it } from "vitest";
import { scriptedDeps } from "../testing";
import {
  allowedNumbers,
  numbersIn,
  summarizeInsights,
  validateDigest,
  type DigestInput,
  type DigestOutput,
} from "./insights_digest";

// insights_digest@v1: grounded in the counts given, about topics and practices, never people.

/** A made up mobile number, built at runtime so the repo's personal data scan stays quiet. */
const FAKE_PHONE = ["98765", "43210"].join("");

const input: DigestInput = {
  kind: "field",
  week: { from: "2026-10-20", to: "2026-10-27" },
  funnel: {
    asked: 12,
    answered: 11,
    tried: "fewer than 5 teachers",
    worked: "fewer than 5 teachers",
  },
  teachersWhoAsked: 6,
  topics: [
    {
      topic: "Multi level class",
      topicKn: "ಬಹು ಹಂತದ ತರಗತಿ",
      asked: 7,
      waitingForMaster: "fewer than 5 teachers",
    },
    { topic: "Letter sounds", topicKn: "ಅಕ್ಷರ ಗುರುತು", asked: "kept private", waitingForMaster: 0 },
  ],
  practices: [],
  costPerTeacherInr: 4.5,
};

const good: DigestOutput = {
  headlineKn: "ಈ ವಾರ 12 ಪ್ರಶ್ನೆಗಳು; 7 ಬಹು ಹಂತದ ತರಗತಿ ಬಗ್ಗೆ.",
  headlineEn: "12 questions this week; 7 about multi level classes.",
  actions: [
    {
      kn: "ಬಹು ಹಂತದ ತರಗತಿ ಬಗ್ಗೆ ಒಬ್ಬ ಹಿರಿಯರ ಮಾತು ದಾಖಲಿಸಿ.",
      en: "Record a master teacher on multi level classes.",
    },
    {
      kn: "ಉಪಾಯ ಹೇಗಾಯಿತು ಎಂದು ಒತ್ತಲು ನೆನಪಿಸಿ: 5ಕ್ಕಿಂತ ಕಡಿಮೆ ಶಿಕ್ಷಕರು ತಿಳಿಸಿದ್ದಾರೆ.",
      en: "Remind teachers to tap how it went: fewer than 5 teachers have.",
    },
  ],
  watch: [],
};

const withHeadline = (headlineEn: string, headlineKn = good.headlineKn) => ({
  ...good,
  headlineEn,
  headlineKn,
});
const withAction = (en: string, kn = good.actions[0]!.kn) => ({
  ...good,
  actions: [{ kn, en }, good.actions[1]!],
});

describe("numbers in a digest", () => {
  it("reads digits, Kannada digits and number words in both languages", () => {
    expect(numbersIn("೧೨ ಪ್ರಶ್ನೆಗಳು")).toEqual([12]);
    expect(numbersIn("twelve questions, 1,200 rupees, 4.50 each")).toEqual([1200, 4.5, 12]);
    expect(numbersIn("ಇಪ್ಪತ್ತು ಶಿಕ್ಷಕರು")).toEqual([20]);
    expect(numbersIn("fewer than 5 teachers, 5ಕ್ಕಿಂತ ಕಡಿಮೆ ಶಿಕ್ಷಕರು, no one")).toEqual([]);
  });

  it("allows only the counts given: never a date, the group size or a hidden count", () => {
    const allowed = allowedNumbers(input);
    for (const n of [12, 11, 6, 7, 0, 4.5]) expect(allowed.has(n), String(n)).toBe(true);
    for (const n of [5, 2026, 20, 27, 3]) expect(allowed.has(n), String(n)).toBe(false);
  });
});

describe("validateDigest", () => {
  it("accepts a grounded note", () => {
    expect(validateDigest(input, good)).toEqual([]);
  });

  it("refuses an invented number in any script or in words", () => {
    expect(validateDigest(input, withHeadline("Up 40% this week."))).toHaveLength(1);
    expect(
      validateDigest(input, withHeadline(good.headlineEn, "ಈ ವಾರ ೧೩ ಪ್ರಶ್ನೆಗಳು.")),
    ).toHaveLength(1);
    expect(validateDigest(input, withHeadline("Three topics need masters."))).toHaveLength(1);
    expect(
      validateDigest(input, withHeadline(good.headlineEn, "ಇಪ್ಪತ್ತು ಶಿಕ್ಷಕರು ಕೇಳಿದರು.")),
    ).toHaveLength(1);
    expect(
      validateDigest(input, withHeadline("１２３ questions this week.")).length,
    ).toBeGreaterThan(0);
    expect(
      validateDigest(input, withHeadline("From 20 to 27 October, 12 questions.")),
    ).toHaveLength(1);
  });

  it("refuses guessing a hidden group, or calling it fewer than 5 questions", () => {
    expect(
      validateDigest(input, withHeadline("Exactly 5 teachers tried an idea.")).length,
    ).toBeGreaterThan(0);
    expect(
      validateDigest(input, withHeadline("Fewer than 5 questions are waiting.")).length,
    ).toBeGreaterThan(0);
  });

  it("refuses watching, ranking, comparing, blaming or pressing teachers, in either language", () => {
    for (const en of [
      "Monitor which teachers do not tap.",
      "Raichur is far behind, so visit those schools and warn them.",
      "Keep a close watch on the teachers.",
      "Compare the clusters and push the weakest.",
    ]) {
      expect(validateDigest(input, withAction(en)).length, en).toBeGreaterThan(0);
    }
    for (const kn of ["ಹಿಂದುಳಿದ ಶಾಲೆಗಳಿಗೆ ನೋಟಿಸ್ ಕೊಡಿ.", "ಶಿಕ್ಷಕರ ಮೇಲೆ ನಿಗಾ ಇಡಿ."]) {
      expect(
        validateDigest(input, withAction("Record a master teacher.", kn)).length,
        kn,
      ).toBeGreaterThan(0);
    }
  });

  it("refuses ids, contacts, links, punishment, dashes and the wrong script", () => {
    expect(
      validateDigest(input, withAction("Ask teacher 0b0e8f6a-1d2c-4b3a-9e8f-123456789abc why."))
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateDigest(input, withAction(`Call ${FAKE_PHONE} or open https://example.com.`)).length,
    ).toBeGreaterThan(0);
    expect(
      validateDigest(input, withAction("Tell teachers to cane children who forget.")).length,
    ).toBeGreaterThan(0);
    expect(
      validateDigest(input, withAction("Record a master.", "Record a master.")).length,
    ).toBeGreaterThan(0);
    expect(validateDigest(input, withAction("Record a master — today.")).length).toBeGreaterThan(0);
  });
});

describe("summarizeInsights", () => {
  it("retries with the problems, then returns a grounded note", async () => {
    const { deps, prompts } = scriptedDeps([withHeadline("Up 40% this week."), good]);
    const res = await summarizeInsights(input, deps);
    expect(res.status).toBe("ok");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("40");
    expect(prompts[0]).toContain('<aggregates kind=\\"field\\">');
    expect(prompts[0]).not.toMatch(/\\"districts?\\"/); // no places in the data
  });

  it("falls back to needs_human (the page keeps its own actions) after three bad notes", async () => {
    const { deps } = scriptedDeps([withHeadline("Up 40% this week.")]);
    const res = await summarizeInsights(input, deps);
    expect(res.status).toBe("needs_human");
  });
});
