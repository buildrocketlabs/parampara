import { describe, expect, it } from "vitest";
import { fill, nameIn } from "./i18n/fill";
import { say, withName } from "./i18n/messages";
import {
  ANSWER_STAGES,
  clamp01,
  currentView,
  DONE,
  IMPORT_STAGES,
  isComplete,
  overallProgress,
  stageViews,
} from "./stages";

const statuses = (current: string, done?: string[]) =>
  stageViews(ANSWER_STAGES, current, done).map((v) => v.status);

describe("stage ordering", () => {
  it("marks earlier stages done, the current one running and later ones pending", () => {
    expect(statuses("checking")).toEqual(["done", "done", "current", "pending"]);
  });

  it("starts with only the first stage running", () => {
    expect(statuses("understanding")).toEqual(["current", "pending", "pending", "pending"]);
  });

  it("honours an explicit done list for stages that finished out of order", () => {
    expect(statuses("finding", ["voicing"])).toEqual(["done", "current", "pending", "done"]);
  });

  it("finishes everything on DONE", () => {
    const views = stageViews(ANSWER_STAGES, DONE);
    expect(isComplete(views)).toBe(true);
    expect(currentView(views)).toBeUndefined();
  });

  it("treats an unknown current key as nothing running, not as complete", () => {
    const views = stageViews(ANSWER_STAGES, "nope");
    expect(views.every((v) => v.status === "pending")).toBe(true);
    expect(isComplete(views)).toBe(false);
  });

  it("is complete when the done list covers every stage", () => {
    const keys = IMPORT_STAGES.map((s) => s.key);
    expect(isComplete(stageViews(IMPORT_STAGES, "extracting", keys))).toBe(true);
  });

  it("keeps the given order and index", () => {
    expect(stageViews(IMPORT_STAGES, "reading").map((v) => v.index)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("overall progress", () => {
  it("counts finished stages whole and the current one by its own progress", () => {
    const views = stageViews(ANSWER_STAGES, "checking");
    expect(overallProgress(views)).toBe(0.5);
    expect(overallProgress(views, 0.5)).toBeCloseTo(0.625);
  });

  it("never invents progress and never passes 1", () => {
    expect(overallProgress(stageViews(ANSWER_STAGES, "understanding"))).toBe(0);
    expect(overallProgress(stageViews(ANSWER_STAGES, DONE), 4)).toBe(1);
    expect(overallProgress([], 0.5)).toBe(0);
  });

  it("clamps odd inputs", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(undefined)).toBe(0);
  });
});

describe("copy placeholders", () => {
  it("fills named vars and leaves unknown ones visible", () => {
    expect(fill("Step {n} of {total}", { n: 2, total: 4 })).toBe("Step 2 of 4");
    expect(fill("Hear {name} say it", {})).toBe("Hear {name} say it");
  });

  it("fills a name in each language's own spelling", () => {
    const name = { kn: "ಶಾಂತಮ್ಮ ಕೆ.", en: "Shantamma K." };
    expect(withName("answer.from", name)).toEqual({
      kn: "ಶಾಂತಮ್ಮ ಕೆ. ಅವರಿಂದ",
      en: "from Shantamma K.",
    });
    expect(nameIn("Shivappa", "kn")).toBe("Shivappa");
  });

  it("reads a key or a {kn, en} pair", () => {
    expect(say("en", "loader.step", { n: 1, total: 3 })).toBe("Step 1 of 3");
    expect(say("kn", { kn: "ಕನ್ನಡ", en: "English" })).toBe("ಕನ್ನಡ");
  });
});
