import { describe, expect, it } from "vitest";
import { initialOf } from "./names";

describe("initialOf", () => {
  it("takes the first Latin letter, upper cased, skipping honorifics", () => {
    expect(initialOf("shivappa K Hosamani")).toBe("S");
    expect(initialOf("Sri Mahesh Bedavatti")).toBe("M");
    expect(initialOf("  Dr. Kamala")).toBe("K");
  });

  it("keeps a Kannada letter with its vowel sign", () => {
    expect(initialOf("ಉಮಾ")).toBe("ಉ");
    expect(initialOf("ಮಹೇಶ")).toBe("ಮ");
    expect(initialOf("ಕೀರ್ತಿ")).toBe("ಕೀ");
  });

  it("keeps a conjunct whole", () => {
    expect(initialOf("ಶ್ರೀನಿವಾಸ")).toBe("ಶ್ರೀ");
  });

  it("is empty for no name", () => {
    expect(initialOf(null)).toBe("");
    expect(initialOf("   ")).toBe("");
  });
});
