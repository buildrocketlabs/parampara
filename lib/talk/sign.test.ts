import { describe, expect, it } from "vitest";
import { PLAN_BY_ID, PROBES } from "@/lib/domain/interview";
import { questionTrusted, sayTrusted, signQuestion, signSay, talkKey } from "./sign";

const key = talkKey("test-secret")!;
const other = talkKey("another-secret")!;
const id = "6b2a4f4e-8c3e-4a5b-9a2f-1c2d3e4f5a6b";
const modelQ = { kn: "ಮರಳಲ್ಲಿ ಮೊದಲು ಯಾವ ಅಕ್ಷರ ಬರೆಸಿದಿರಿ?", en: "Which letter did you have the child write first?", topic: "letters" as const, probe: true };

describe("only questions the server wrote are stored as Hanate's", () => {
  it("trusts a model question it signed for this interview, and nothing altered", () => {
    const sig = signQuestion(key, id, modelQ);
    expect(questionTrusted(key, id, modelQ, sig)).toBe(true);
    expect(questionTrusted(key, id, { ...modelQ, kn: "ನಿಮ್ಮ ತರಗತಿಯ ಮಕ್ಕಳ ಹೆಸರು ಹೇಳಿ." }, sig)).toBe(false);
    expect(questionTrusted(key, id, { ...modelQ, probe: false }, sig)).toBe(false);
    expect(questionTrusted(key, "00000000-0000-4000-8000-000000000000", modelQ, sig)).toBe(false);
    expect(questionTrusted(other, id, modelQ, sig)).toBe(false);
    expect(questionTrusted(key, id, modelQ, undefined)).toBe(false);
    expect(questionTrusted(key, id, modelQ, "zz")).toBe(false);
    expect(questionTrusted(null, id, modelQ, sig)).toBe(false);
  });

  it("trusts the interview guide's own words without a signature, on their own topic", () => {
    const letters = PLAN_BY_ID.get("letters")!.opening;
    expect(questionTrusted(null, id, { kn: letters.kn, en: letters.en, topic: "letters", probe: false }, undefined)).toBe(true);
    expect(questionTrusted(null, id, { kn: letters.kn, en: letters.en, topic: "reading", probe: false }, undefined)).toBe(false);
    expect(questionTrusted(null, id, { kn: PROBES[0]!.kn, en: PROBES[0]!.en, topic: "reading", probe: true }, undefined)).toBe(true);
  });

  it("says aloud only a signed line or one of the guide's", () => {
    expect(sayTrusted(key, modelQ.kn, signSay(key, modelQ.kn))).toBe(true);
    expect(sayTrusted(key, "ಯಾವುದೇ ಬೇರೆ ಮಾತು", signSay(key, modelQ.kn))).toBe(false);
    expect(sayTrusted(null, PLAN_BY_ID.get("warmup")!.opening.kn, undefined)).toBe(true);
    expect(sayTrusted(key, "ಯಾವುದೇ ಬೇರೆ ಮಾತು", undefined)).toBe(false);
  });
});
