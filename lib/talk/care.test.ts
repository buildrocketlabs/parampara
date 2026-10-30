import { describe, expect, it } from "vitest";
import { careFor, helplines } from "./care";

describe("care after an answer", () => {
  it.each([
    ["ಒಂದು ಮಗು ಹೇಳ್ತು, ಮನೇಲಿ ಅಪ್ಪ ಕುಡಿದು ಬಂದು ದಿನಾ ಹೊಡೀತಾರಂತೆ", "child"],
    ["ಆ ಹುಡುಗನಿಗೆ ಮನೆಯವರು ದಿನಾ ಹೊಡೀತಾರೆ", "child"],
    ["ಅವಳ ಮಲತಂದೆ ಅವಳನ್ನ ಕೂಡಿ ಹಾಕ್ತಾರೆ", "child"],
    ["Her grandfather beats her when she is late", "child"],
    ["ನನಗೆ ಸಾಯಬೇಕು ಅಂತ ಅನ್ಸ್ತಿದೆ", "self"],
    ["I feel I should die, nobody listens to old teachers", "self"],
    ["I do not want to live like this", "self"],
  ] as const)("finds %s", (text, care) => {
    expect(careFor(text)).toBe(care);
  });

  it("names both helplines when a child is in danger and the speaker is in despair", () => {
    const care = careFor("ಮನೆಯವರು ಆ ಮಗುವಿಗೆ ಹೊಡೀತಾರೆ. ನನಗೂ ಸಾಯಬೇಕು ಅಂತ ಅನ್ಸ್ತಿದೆ");
    expect(care).toBe("both");
    expect(helplines(care!)).toEqual(["child", "self"]);
  });

  it.each([
    "ಅಜ್ಜ ಬಂದು ಮಕ್ಕಳ ಜೊತೆ ಚಪ್ಪಾಳೆ ಹೊಡೆದರು",
    "ಅಣ್ಣ ಗಂಟೆ ಬಾರಿಸಿದ ಮೇಲೆ ಮಕ್ಕಳು ಒಳಗೆ ಬಂದರು",
    "ಮರಳು ತಂದು ತಟ್ಟೆಯಲ್ಲಿ ಹಾಕ್ತಿದ್ದೆ, ಮಗು ಬೆರಳಿಂದ ಬರೀತಿತ್ತು",
    "",
  ])("finds nothing in an everyday answer: %s", (text) => {
    expect(careFor(text)).toBeNull();
  });
});
