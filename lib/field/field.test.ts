import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findUnsafe } from "@/ai/safety/patterns";
import { FieldChanges, fieldChanges } from "./changes";
import { fieldIsEmpty, summarizeField, type FieldRows } from "./summary";

const none: FieldRows = {
  masters: 0,
  approvedCards: 0,
  teachers: 0,
  askers: [],
  tried: [],
  firstConsent: null,
};

describe("field summary", () => {
  it("is empty before anything is on record", () => {
    const s = summarizeField(none);
    expect(fieldIsEmpty(s)).toBe(true);
    expect(s.questions).toEqual({ n: 0, hidden: false });
    expect(s.since).toBeNull();
  });

  it("keeps questions and outcomes private while fewer than 5 teachers stand behind them", () => {
    const s = summarizeField({
      ...none,
      masters: 2,
      approvedCards: 9,
      teachers: 3,
      askers: ["a", "a", "b", "c"],
      tried: [
        { teacher: "a", outcome: "worked" },
        { teacher: "b", outcome: "didnt" },
      ],
      firstConsent: "2026-10-25T10:00:00Z",
    });
    expect(fieldIsEmpty(s)).toBe(false);
    expect(s.masters).toBe(2);
    expect(s.teachers).toBe(3);
    expect(s.questions).toEqual({ n: null, hidden: true });
    for (const k of ["tried", "worked", "partly", "didnt"] as const) {
      expect(s[k]).toEqual({ n: null, hidden: true });
    }
    expect(s.since).toBe("2026-10-25T10:00:00Z");
  });

  it("shows counts once 5 different teachers stand behind them", () => {
    const teachers = ["a", "b", "c", "d", "e"];
    const s = summarizeField({
      ...none,
      teachers: 5,
      askers: [...teachers, "a", "b"],
      tried: [
        ...teachers.slice(0, 3).map((t) => ({ teacher: t, outcome: "worked" })),
        { teacher: "d", outcome: "partly" },
        { teacher: "e", outcome: "didnt" },
        { teacher: "a", outcome: "worked" },
      ],
    });
    expect(s.questions).toEqual({ n: 7, hidden: false });
    expect(s.tried).toEqual({ n: 6, hidden: false });
    expect(s.worked).toEqual({ n: 4, hidden: false });
    expect(s.partly).toEqual({ n: 1, hidden: false });
    expect(s.didnt).toEqual({ n: 1, hidden: false });
  });
});

describe("docs/field/changes.json", () => {
  const file = JSON.parse(readFileSync(join(process.cwd(), "docs/field/changes.json"), "utf8"));

  it("is valid, names no one and points at screenshots that exist", () => {
    const parsed = FieldChanges.parse(file);
    for (const e of parsed.entries) {
      const words = [e.said.kn, e.said.en, e.changed.kn, e.changed.en].join(" ");
      expect(words).not.toMatch(/\d{10}|@|https?:\/\//);
      expect(findUnsafe(words)).toEqual([]);
      for (const shot of [e.before, e.after]) {
        if (shot) expect(existsSync(join(process.cwd(), "public", shot))).toBe(true);
      }
    }
  });

  it("refuses a name in place of a role, and sorts newest first", () => {
    const entry = (date: string, who: string) => ({
      date,
      who,
      said: { kn: "ಮಾತು", en: "Words" },
      changed: { kn: "ಬದಲಾವಣೆ", en: "Change" },
      before: null,
      after: "/field/changes/after-1.png",
    });
    const bad = { version: 1, about: "", entries: [entry("2026-10-26", "Lakshmi")] };
    expect(FieldChanges.safeParse(bad).success).toBe(false);
    expect(fieldChanges(bad)).toEqual([]);
    const shotOutside = {
      version: 1,
      about: "",
      entries: [{ ...entry("2026-10-26", "teacher"), after: "https://x.example/a.png" }],
    };
    expect(FieldChanges.safeParse(shotOutside).success).toBe(false);
    const ok = {
      version: 1,
      about: "",
      entries: [entry("2026-10-26", "teacher"), entry("2026-10-28", "master")],
    };
    expect(fieldChanges(ok).map((e) => e.date)).toEqual(["2026-10-28", "2026-10-26"]);
  });
});
