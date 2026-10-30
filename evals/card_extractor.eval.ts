import { describe, expect, it } from "vitest";
import { liveEvalsAllowed } from "@/ai/evals/recording";
import { CARD_EXTRACTOR_PROMPT_VERSION } from "@/ai/prompts/card_extractor";
import {
  buildExtractorRequest,
  extractCards,
  finalizeExtraction,
  mergeWindowCards,
  toWindow,
  validateExtraction,
  windowSegments,
} from "@/ai/roles/card_extractor";
import { checkExtraction, evalEnv, ExtractorCase, isRecorded, loadJsonl, TODO_NOT_RECORDED } from "./lib";

// card_extractor@v1 (docs/AI.md §6). Guardrails always run on hand written model outputs: the
// reference answer must pass and meet the expectations, and each faulty answer must be refused or
// have its harmful card dropped. Model cases replay recordings, or are todos until recorded.
const cases = loadJsonl("card_extractor.jsonl", ExtractorCase);

describe("card extractor eval set", () => {
  it("has at least 12 synthetic cases, at least 2 adversarial, all marked sample", () => {
    expect(cases.length).toBeGreaterThanOrEqual(12);
    expect(cases.filter((c) => c.adversarial).length).toBeGreaterThanOrEqual(2);
    expect(cases.every((c) => c.sample)).toBe(true);
  });

  it("uses segment ids that are unique across the whole set", () => {
    const ids = cases.flatMap((c) => c.input.segments.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(cases)("card extractor guardrails: $id", (c) => {
  const win = toWindow(c.input.segments);

  it("accepts the reference answer", () => {
    expect(validateExtraction(win, c.reference)).toEqual([]);
  });

  it("the reference answer meets the case's expectations after the safety pass", () => {
    expect(checkExtraction(c, finalizeExtraction(win, c.reference))).toEqual([]);
  });

  it("every evidence id in the result resolves to a segment of this window (Law 4)", () => {
    const ids = new Set(c.input.segments.map((s) => s.id));
    const { cards } = finalizeExtraction(win, c.reference);
    for (const card of cards) {
      for (const id of [...card.evidenceSegmentIds, ...(card.quoteSegmentId ? [card.quoteSegmentId] : [])]) {
        expect(ids.has(id)).toBe(true);
      }
    }
  });

  for (const f of c.faulty) {
    it(`guards against: ${f.why}`, () => {
      const problems = validateExtraction(win, f.output);
      if (f.guardrail === "rejected") {
        expect(problems.length).toBeGreaterThan(0);
        return;
      }
      expect(problems).toEqual([]);
      const reason = f.guardrail.split(":")[1];
      const res = finalizeExtraction(win, f.output);
      expect(res.dropped.some((d) => d.reason === reason)).toBe(true);
      expect(res.cards.length).toBeLessThan(f.output.cards.length);
      expect(checkExtraction({ ...c, expect: { ...c.expect, minCards: 0 } }, res)).toEqual([]);
    });
  }
});

describe("windowing and merging across a long interview", () => {
  it("splits the whole eval set, laid end to end, into windows that merge back without duplicates", () => {
    let offset = 0;
    const timeline = cases.flatMap((c) => {
      const shifted = c.input.segments.map((s) => ({ ...s, startMs: s.startMs + offset, endMs: s.endMs + offset }));
      offset = shifted[shifted.length - 1]!.endMs + 1_000;
      return shifted;
    });
    const windows = windowSegments(timeline, { maxMs: 2 * 60_000, overlapMs: 30_000 });
    expect(windows.length).toBeGreaterThan(1);
    expect(new Set(windows.flat().map((s) => s.id))).toEqual(new Set(timeline.map((s) => s.id)));

    const all = cases.flatMap((c) => finalizeExtraction(toWindow(c.input.segments), c.reference).cards);
    expect(mergeWindowCards([all, all])).toHaveLength(all.length);
  });
});

describe("card extractor with the model (replayed)", () => {
  for (const c of cases) {
    const { system, prompt } = buildExtractorRequest(c.input);
    const recorded = isRecorded({ role: "card_extractor", promptVersion: CARD_EXTRACTOR_PROMPT_VERSION, system, prompt, itemId: c.id });
    if (!recorded && !liveEvalsAllowed()) {
      it.todo(`${c.id}: ${TODO_NOT_RECORDED}`);
      continue;
    }
    it(c.id, async () => {
      const res = await extractCards({ ...c.input, itemId: c.id }, { env: evalEnv() });
      expect(res.status, res.status === "needs_human" ? `${res.reason}: ${res.problems.join(" | ")}` : "").toBe("ok");
      if (res.status === "ok") expect(checkExtraction(c, res)).toEqual([]);
    });
  }
});
