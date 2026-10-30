import { describe, expect, it } from "vitest";
import {
  appendChange,
  buildChange,
  FieldChanges,
  shotPath,
  wordsLang,
  type ChangeInput,
} from "./change-schema";

// scripts/add-change.mjs (founder only, D82): a quotable field feedback row → one changes.json entry.

const row = {
  id: "3f2c9a10-1111-4222-8333-944455556666",
  text: "ಧ್ವನಿ ಸ್ವಲ್ಪ ವೇಗವಾಗಿತ್ತು",
  quoteOk: true,
  roleWord: "teacher",
  isSample: false,
  createdAt: "2026-10-29T05:00:00Z",
};
const input: ChangeInput = {
  feedback: row,
  saidOther: "The voice was a little fast",
  changedKn: "ಧ್ವನಿ ಈಗ ನಿಧಾನ",
  changedEn: "The voice is slower now",
  beforeExt: "png",
  afterExt: "png",
};
const empty = { version: 1, about: "x", entries: [] };

describe("buildChange", () => {
  it("turns a quotable field row into a valid entry, her words untouched", () => {
    const r = buildChange(input);
    expect(r).toEqual({
      ok: true,
      entry: {
        date: "2026-10-29",
        who: "teacher",
        said: { kn: "ಧ್ವನಿ ಸ್ವಲ್ಪ ವೇಗವಾಗಿತ್ತು", en: "The voice was a little fast" },
        changed: { kn: "ಧ್ವನಿ ಈಗ ನಿಧಾನ", en: "The voice is slower now" },
        before: "/field/changes/fb-3f2c9a10-before.png",
        after: "/field/changes/fb-3f2c9a10-after.png",
      },
    });
  });

  it("puts English words on the English side", () => {
    const r = buildChange({
      ...input,
      feedback: { ...row, text: "The steps were clear" },
      saidOther: "ಹಂತಗಳು ಸ್ಪಷ್ಟವಾಗಿದ್ದವು",
    });
    expect(r.ok && r.entry.said).toEqual({
      kn: "ಹಂತಗಳು ಸ್ಪಷ್ಟವಾಗಿದ್ದವು",
      en: "The steps were clear",
    });
  });

  it("refuses words she did not agree to have quoted", () => {
    expect(buildChange({ ...input, feedback: { ...row, quoteOk: false } })).toEqual({
      ok: false,
      error: "not_quotable",
    });
  });

  it("refuses Sample rows, rows without words and rows without a role word", () => {
    expect(buildChange({ ...input, feedback: { ...row, isSample: true } })).toEqual({
      ok: false,
      error: "sample",
    });
    expect(buildChange({ ...input, feedback: { ...row, text: null } })).toEqual({
      ok: false,
      error: "no_words",
    });
    expect(buildChange({ ...input, feedback: { ...row, roleWord: null } })).toEqual({
      ok: false,
      error: "no_role",
    });
    expect(buildChange({ ...input, feedback: { ...row, roleWord: "Lakshmi" } })).toEqual({
      ok: false,
      error: "no_role",
    });
  });

  it("needs the other language and allows screenshots only as pictures", () => {
    expect(buildChange({ ...input, saidOther: " " })).toEqual({
      ok: false,
      error: "needs_other_language",
    });
    expect(buildChange({ ...input, afterExt: "pdf" })).toEqual({ ok: false, error: "bad_shot" });
    const noShots = buildChange({ ...input, beforeExt: null, afterExt: null });
    expect(noShots.ok && [noShots.entry.before, noShots.entry.after]).toEqual([null, null]);
  });

  it("uses the given date, and the India date of her words otherwise", () => {
    expect(
      buildChange({ ...input, date: "2026-10-31" }).ok &&
        buildChange({ ...input, date: "2026-10-31" }),
    ).toMatchObject({
      entry: { date: "2026-10-31" },
    });
    const lateNight = buildChange({
      ...input,
      feedback: { ...row, createdAt: "2026-10-29T19:00:00Z" },
    });
    expect(lateNight.ok && lateNight.entry.date).toBe("2026-10-30");
  });
});

describe("appendChange", () => {
  it("adds one entry and the file stays valid; the same words twice are refused", () => {
    const built = buildChange(input);
    if (!built.ok) throw new Error("unreachable");
    const once = appendChange(empty, built.entry);
    expect(once.ok && FieldChanges.safeParse(once.file).success).toBe(true);
    expect(once.ok && once.file.entries).toHaveLength(1);
    if (!once.ok) return;
    expect(appendChange(once.file, built.entry)).toEqual({ ok: false, error: "duplicate" });
    expect(appendChange({ version: 2 }, built.entry)).toEqual({ ok: false, error: "invalid_file" });
  });
});

describe("helpers", () => {
  it("knows Kannada words from English ones", () => {
    expect(wordsLang("ಧ್ವನಿ fast")).toBe("kn");
    expect(wordsLang("fast")).toBe("en");
  });
  it("names screenshots by the row, never by a person", () => {
    expect(shotPath("ABCDEF12-3456", "after", ".PNG")).toBe("/field/changes/fb-abcdef12-after.png");
  });
});
