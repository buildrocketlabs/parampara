import { describe, expect, it } from "vitest";
import {
  clipBounds,
  clipFraction,
  findCue,
  formatTime,
  isPastEnd,
  nextSpeed,
  resamplePeaks,
  seekWithin,
  withMediaFragment,
  type Cue,
} from "./player";

describe("clip bounds", () => {
  it("plays the whole file when no clip is asked for", () => {
    expect(clipBounds(42_000)).toEqual({ startMs: 0, endMs: 42_000, lengthMs: 42_000 });
  });

  it("plays exactly the master's seconds inside a long recording", () => {
    expect(clipBounds(2_400_000, 754_200, 768_900)).toEqual({
      startMs: 754_200,
      endMs: 768_900,
      lengthMs: 14_700,
    });
  });

  it("clamps an end past the file and a negative start", () => {
    expect(clipBounds(10_000, -500, 12_000)).toEqual({
      startMs: 0,
      endMs: 10_000,
      lengthMs: 10_000,
    });
  });

  it("falls back to the file end when the end is before the start", () => {
    expect(clipBounds(10_000, 6_000, 2_000)).toEqual({
      startMs: 6_000,
      endMs: 10_000,
      lengthMs: 4_000,
    });
  });

  it("trusts the requested bounds before metadata arrives", () => {
    expect(clipBounds(Number.NaN, 3_000, 5_000)).toEqual({
      startMs: 3_000,
      endMs: 5_000,
      lengthMs: 2_000,
    });
    expect(clipBounds(Number.POSITIVE_INFINITY, 3_000)).toMatchObject({
      startMs: 3_000,
      lengthMs: 0,
    });
  });

  it("maps positions inside the clip both ways", () => {
    const b = clipBounds(60_000, 10_000, 20_000);
    expect(clipFraction(15_000, b)).toBe(0.5);
    expect(clipFraction(5_000, b)).toBe(0);
    expect(clipFraction(25_000, b)).toBe(1);
    expect(seekWithin(0.25, b)).toBe(12_500);
    expect(seekWithin(2, b)).toBe(20_000);
  });

  it("knows when the clip has reached its end, with a small tolerance", () => {
    const b = clipBounds(60_000, 10_000, 20_000);
    expect(isPastEnd(19_900, b)).toBe(false);
    expect(isPastEnd(19_970, b)).toBe(true);
    expect(isPastEnd(25_000, b)).toBe(true);
  });

  it("adds a media fragment so Safari starts at the clip, keeping signed query strings", () => {
    expect(withMediaFragment("https://x.test/a.m4a?token=abc", 754_200, 768_900)).toBe(
      "https://x.test/a.m4a?token=abc#t=754.2,768.9",
    );
    expect(withMediaFragment("/a.mp3", 0, undefined)).toBe("/a.mp3");
    expect(withMediaFragment("/a.mp3#t=1", 2_000, 3_000)).toBe("/a.mp3#t=1");
    expect(withMediaFragment("blob:http://x/1", 2_000, 3_000)).toBe("blob:http://x/1");
  });
});

describe("cue lookup", () => {
  const cues: Cue[] = [
    { startMs: 0, endMs: 2_000, kn: "ಒಂದು", en: "one" },
    { startMs: 2_400, endMs: 5_000, kn: "ಎರಡು", en: "two" },
    { startMs: 5_000, endMs: 8_000, kn: "ಮೂರು", en: "three" },
  ];

  it("finds the sentence being spoken", () => {
    expect(findCue(cues, 0)).toBe(0);
    expect(findCue(cues, 1_999)).toBe(0);
    expect(findCue(cues, 3_000)).toBe(1);
    expect(findCue(cues, 5_000)).toBe(2);
  });

  it("returns -1 in a pause, before the first and after the last", () => {
    expect(findCue(cues, 2_200)).toBe(-1);
    expect(findCue(cues, 9_000)).toBe(-1);
    expect(findCue(cues, -1)).toBe(-1);
    expect(findCue([], 100)).toBe(-1);
  });
});

describe("labels and peaks", () => {
  it("formats time for short answers and long interviews", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(42_400)).toBe("0:42");
    expect(formatTime(754_200)).toBe("12:34");
    expect(formatTime(3_725_000)).toBe("1:02:05");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });

  it("cycles 0.8x, 1x, 1.2x", () => {
    expect(nextSpeed(1)).toBe(1.2);
    expect(nextSpeed(1.2)).toBe(0.8);
    expect(nextSpeed(0.8)).toBe(1);
    expect(nextSpeed(3)).toBe(0.8);
  });

  it("down samples peaks by bucket maximum and scales to 1", () => {
    expect(resamplePeaks([0.1, 0.5, 0.2, 0.25], 2)).toEqual([1, 0.5]);
    expect(resamplePeaks([0, 0, 0], 3)).toEqual([0, 0, 0]);
    expect(resamplePeaks([], 4)).toEqual([]);
    expect(resamplePeaks([0.2, -0.4], 4)).toHaveLength(4);
  });
});

describe("segment audio body", () => {
  it("accepts the documented shape and refuses anything off", async () => {
    const { parseSegmentAudio } = await import("./player");
    expect(parseSegmentAudio({ url: "https://x/a.m4a", startMs: 0, endMs: 1200 })).toEqual({
      url: "https://x/a.m4a",
      startMs: 0,
      endMs: 1200,
    });
    expect(parseSegmentAudio({ url: "u", startMs: 5, endMs: 9, mime: "audio/mp4" })?.mime).toBe(
      "audio/mp4",
    );
    for (const bad of [
      null,
      "x",
      {},
      { url: "", startMs: 0, endMs: 1 },
      { url: "u", startMs: -1, endMs: 1 },
      { url: "u", startMs: 0, endMs: 0 },
      { url: "u", startMs: 0, endMs: Number.NaN },
      { url: "u", startMs: 0, endMs: 1, mime: 3 },
    ]) {
      expect(parseSegmentAudio(bad)).toBeNull();
    }
  });
});
