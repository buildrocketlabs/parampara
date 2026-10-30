import { describe, expect, it } from "vitest";
import { districtIn, firstLetter, fitSize, wrapLines } from "./draw-card";

describe("Kannada on the card", () => {
  it("says a known district in the card's language", () => {
    expect(districtIn("Koppal", "kn")).toBe("ಕೊಪ್ಪಳ");
    expect(districtIn(" koppal ", "en")).toBe("Koppal");
    expect(districtIn("Somewhere", "kn")).toBe("Somewhere");
  });

  it("takes a whole akshara as the first letter, never half of one", () => {
    expect(firstLetter("ಕೃಷ್ಣ")).toBe("ಕೃ");
    expect(firstLetter("sharada")).toBe("S");
  });
});

// Layout helpers of the card drawn in the browser; the drawing itself is checked in e2e
// (tests/e2e/card-canvas.shots.spec.ts), where a real browser shapes Kannada.
const mono: (t: string) => number = (t) => t.length * 10;

describe("wrapLines", () => {
  it("breaks at spaces and never splits a word", () => {
    expect(wrapLines("aaa bbb ccc ddd", 70, mono)).toEqual(["aaa bbb", "ccc ddd"]);
    const kn = wrapLines("ಕಡ್ಡಿ ಕಟ್ಟಿನಿಂದ ಹತ್ತು ಮತ್ತು ಬಿಡಿ", 120, mono);
    expect(kn.join(" ")).toBe("ಕಡ್ಡಿ ಕಟ್ಟಿನಿಂದ ಹತ್ತು ಮತ್ತು ಬಿಡಿ");
    for (const line of kn) expect(line.includes(" ") ? mono(line) <= 120 : true).toBe(true);
    expect(wrapLines("Chikkamagaluru", 50, mono)).toEqual(["Chikkamagaluru"]);
  });

  it("ends a clipped block with an ellipsis inside the width", () => {
    const lines = wrapLines("one two three four five six seven eight", 100, mono, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith("…")).toBe(true);
    expect(mono(lines[1] ?? "")).toBeLessThanOrEqual(100);
  });
});

describe("fitSize", () => {
  it("takes the largest size that fits, else the smallest", () => {
    expect(fitSize([46, 42, 38], (s) => s * 10, 400)).toBe(38);
    expect(fitSize([46, 42, 38], (s) => s * 10, 500)).toBe(46);
    expect(fitSize([46, 42, 38], (s) => s * 10, 100)).toBe(38);
  });
});
