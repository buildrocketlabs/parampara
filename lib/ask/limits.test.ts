import { describe, expect, it } from "vitest";
import {
  allowTranscription,
  questionsPerHourFor,
  rawKeyHasher,
  SAMPLE_QUESTIONS_PER_HOUR_DEFAULT,
} from "./limits";

describe("ask limits", () => {
  it("hashes with a secret: same words, same key; another secret, another key; no secret, no key", () => {
    const a = rawKeyHasher("s1")!;
    expect(a("kn\nv1\nಒಂದು ಮಗು")).toBe(a("kn\nv1\nಒಂದು ಮಗು"));
    expect(rawKeyHasher("s2")!("kn\nv1\nಒಂದು ಮಗು")).not.toBe(a("kn\nv1\nಒಂದು ಮಗು"));
    expect(rawKeyHasher(undefined)).toBeUndefined();
  });

  it("brakes transcription bursts per person per hour", () => {
    const t0 = 1_000_000;
    expect([1, 2, 3].map((i) => allowTranscription("u", 2, t0 + i))).toEqual([true, true, false]);
    expect(allowTranscription("u", 2, t0 + 3_600_010)).toBe(true);
    expect(allowTranscription("other", 2, t0)).toBe(true);
  });
});

describe("questionsPerHourFor", () => {
  it("keeps the per person cap for a field teacher", () => {
    expect(questionsPerHourFor(false, 30, {})).toBe(30);
  });
  it("gives the shared Sample accounts a larger hourly allowance", () => {
    expect(questionsPerHourFor(true, 30, {})).toBe(SAMPLE_QUESTIONS_PER_HOUR_DEFAULT);
    expect(questionsPerHourFor(true, 30, { AI_SAMPLE_QUESTIONS_PER_HOUR: "80" })).toBe(80);
    expect(questionsPerHourFor(true, 30, { AI_SAMPLE_QUESTIONS_PER_HOUR: "lots" })).toBe(150);
    expect(questionsPerHourFor(true, 200, { AI_SAMPLE_QUESTIONS_PER_HOUR: "80" })).toBe(200);
  });
});
