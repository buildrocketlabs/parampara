import { describe, expect, it } from "vitest";
import { findUnsafe, findWelfareSignals } from "@/ai/safety/patterns";
import { decideNote, NOTE_MAX } from "./note";

const checks = { findUnsafe, findWelfareSignals };

describe("tried note policy (Law 5)", () => {
  it("keeps a short, safe note, tidied", () => {
    expect(decideNote("  I used pebbles   instead of sticks. ", checks)).toEqual({
      keep: "I used pebbles instead of sticks.",
    });
  });

  it("keeps nothing for an empty note", () => {
    expect(decideNote("   ", checks)).toEqual({ keep: null, reason: "empty" });
    expect(decideNote(undefined, checks)).toEqual({ keep: null, reason: "empty" });
  });

  it("drops a note over the length cap", () => {
    expect(decideNote("a".repeat(NOTE_MAX + 1), checks)).toEqual({
      keep: null,
      reason: "too_long",
    });
  });

  it("never stores advice of harm", () => {
    expect(decideNote("It worked after I hit the child", checks)).toMatchObject({
      keep: null,
      reason: "unsafe",
    });
  });

  it("routes a welfare signal to the helpline and stores nothing", () => {
    const d = decideNote("I think a child in my class is being beaten at home", {
      findUnsafe: () => [],
      findWelfareSignals: () => ["child_welfare"],
    });
    expect(d).toEqual({ keep: null, reason: "welfare", helpline: "childline" });
    const t = decideNote("I feel I cannot go on", {
      findUnsafe: () => [],
      findWelfareSignals: () => ["teacher_distress"],
    });
    expect(t).toEqual({ keep: null, reason: "welfare", helpline: "telemanas" });
  });
});

describe("decideNote: safety audit 24 Oct", () => {
  it("a disclosure in her note is never stored and always turns into Childline", async () => {
    const { findDisclosures, findUnsafe, findWelfareSignals } = await import("@/ai");
    const checks = { findUnsafe, findWelfareSignals, findDisclosures };
    for (const note of ["His father hits him but the card worked", "Her uncle touches her but it worked"]) {
      const d = decideNote(note, checks);
      expect(d.keep, note).toBeNull();
      if (findDisclosures(note).length > 0 || findWelfareSignals(note).includes("child_welfare")) {
        expect(d, note).toMatchObject({ reason: "welfare", helpline: "childline" });
      }
    }
  });
});
