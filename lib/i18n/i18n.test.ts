import { describe, expect, it } from "vitest";
import { en } from "./en";
import { kn } from "./kn";

describe("i18n", () => {
  it("has an English line for every Kannada line", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(kn).sort());
  });

  it("keeps English copy free of em dashes and hyphenated filler (CLAUDE.md Style)", () => {
    for (const [key, line] of Object.entries(en)) {
      expect(line, key).not.toMatch(/[—–]|\w-\w/);
    }
  });

  it("never leaves a line empty", () => {
    for (const [key, line] of [...Object.entries(kn), ...Object.entries(en)]) {
      expect(line.trim(), key).not.toBe("");
    }
  });
});
