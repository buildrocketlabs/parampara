import { describe, expect, it } from "vitest";
import { renderCardExtractorPrompt } from "../prompts/card_extractor";
import { scriptedDeps } from "../testing";
import {
  extractCards,
  finalizeExtraction,
  mergeWindowCards,
  toWindow,
  validateExtraction,
  windowSegments,
  type ExtractedCard,
  type ExtractorOutput,
  type ModelCard,
} from "./card_extractor";

const seg = (id: number, startS: number, speaker: string | null, textKn: string, textEn: string | null = null) => ({
  id,
  startMs: startS * 1000,
  endMs: startS * 1000 + 8000,
  speaker,
  textKn,
  textEn,
});

// Out of order on purpose: refs follow time, not input order.
const segments = [
  seg(503, 24, "master", "ಮರಳು ತಂದು ತಟ್ಟೆಯಲ್ಲಿ ಹಾಕ್ತಿದ್ದೆ, ಮಗು ಬೆರಳಿಂದ 'ಮ' ಬರೀತಿತ್ತು.", "I put sand in a plate and the child wrote ಮ with a finger."),
  seg(501, 0, "interviewer", "ಅಕ್ಷರ ಗುರುತು ಹಿಡಿಯದ ಮಗುಗೆ ಏನು ಮಾಡ್ತಿದ್ರಿ?", "What did you do for a child who could not recognise letters?"),
  seg(502, 12, "master", "ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ.", "Only one letter a day."),
  seg(504, 36, "interviewer", "ಫ್ಲ್ಯಾಶ್ ಕಾರ್ಡ್ ಬಳಸ್ತಿದ್ರಾ?", "Did you use flash cards?"),
  seg(505, 48, "master", "ಮೂರು ದಿನ ಸತತ ತೋರಿಸಿದ್ರೆ ಮುಂದಿನ ಅಕ್ಷರ.", "If the child showed it three days running, we moved on."),
];
const win = toWindow(segments);

const card = (over: Partial<ModelCard> = {}): ModelCard => ({
  titleKn: "ಮರಳಲ್ಲಿ ದಿನಕ್ಕೊಂದು ಅಕ್ಷರ",
  titleEn: "One letter a day in sand",
  problemKn: "ಕೆಲವು ಮಕ್ಕಳು ತಿಂಗಳಾದರೂ ಅಕ್ಷರ ಗುರುತಿಸಲ್ಲ.",
  problemEn: "Some children still cannot recognise letters after months.",
  gradeBand: "1",
  subject: "kannada",
  topic: "letters",
  steps: [
    { kn: "ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ ತೋರಿಸಿ.", en: "Show only one letter a day.", evidence: ["S2"] },
    { kn: "ಮರಳಿನ ತಟ್ಟೆಯಲ್ಲಿ ಬೆರಳಿಂದ ಬರೆಸಿ.", en: "Let the child write it with a finger in a tray of sand.", evidence: ["S3"] },
    { kn: "ಮೂರು ದಿನ ಸತತ ಗುರುತಿಸಿದ ಮೇಲೆ ಮುಂದಿನ ಅಕ್ಷರ.", en: "Move on once the child knows it three days running.", evidence: ["S5"] },
  ],
  materials: [{ kn: "ಮರಳಿನ ತಟ್ಟೆ", en: "a tray of sand" }],
  whyKn: "ಕೈಯಲ್ಲಿ ಬರೆದು ಬಾಯಲ್ಲಿ ಹೇಳಿದರೆ ಅಕ್ಷರ ನೆನಪಿರುತ್ತೆ.",
  whyEn: "Writing it by hand and saying it aloud makes the letter stick.",
  quoteRef: "S3",
  flags: [],
  ...over,
});
const out = (cards: ModelCard[], dropped: ExtractorOutput["dropped"] = []): ExtractorOutput => ({ cards, dropped });

describe("card extractor validation", () => {
  it("accepts grounded cards", () => {
    expect(validateExtraction(win, out([card()]))).toEqual([]);
  });

  it("rejects a citation outside the window", () => {
    const bad = card({ steps: [card().steps[0]!, { kn: "ಹೊಸ ಹೆಜ್ಜೆ", en: "A new step", evidence: ["S99"] }] });
    expect(validateExtraction(win, out([bad]))[0]).toMatch(/Card 1 step 2 cites S99.*S1 to S5/);
  });

  it("rejects a step that rests only on the interviewer's suggestion", () => {
    const bad = card({ steps: [card().steps[0]!, { kn: "ಫ್ಲ್ಯಾಶ್ ಕಾರ್ಡ್ ಬಳಸಿ", en: "Use flash cards", evidence: ["S4"] }] });
    expect(validateExtraction(win, out([bad]))[0]).toContain("does not cite the master's own words");
  });

  it("with speaker labels, a step needs the master's own words; without any, an unknown speaker will do", () => {
    const unlabelled = toWindow(segments.map((s) => ({ ...s, speaker: s.id === 505 ? null : s.speaker })));
    const onNull = card({ steps: [card().steps[0]!, { kn: "ಮೂರು ದಿನ ನೋಡಿ", en: "Check for three days", evidence: ["S5"] }] });
    expect(validateExtraction(unlabelled, out([onNull]))[0]).toContain("master's own words");
    const noLabels = toWindow(segments.map((s) => ({ ...s, speaker: null })));
    expect(validateExtraction(noLabels, out([onNull]))).toEqual([]);
  });

  it("rejects a number the cited segments never say", () => {
    const bad = card({ steps: [card().steps[0]!, { kn: "ದಿನಕ್ಕೆ ಹತ್ತು ನಿಮಿಷ ಮರಳಲ್ಲಿ ಬರೆಸಿ", en: "Ten minutes a day of writing in sand", evidence: ["S3"] }] });
    expect(validateExtraction(win, out([bad]))[0]).toMatch(/step 2 says 10/);
    const digits = card({ steps: [card().steps[0]!, { kn: "ಮೂರು ದಿನ", en: "After 3 days in a row, move on", evidence: ["S5"] }] });
    expect(validateExtraction(win, out([digits]))).toEqual([]);
  });

  it("asks for a rewrite when a card labels a child", () => {
    expect(validateExtraction(win, out([card({ problemEn: "Slow learners cannot recognise letters." })]))[0]).toContain("labels or diagnoses a child");
  });

  it("checks each language is in its own script", () => {
    expect(validateExtraction(win, out([card({ titleKn: "One letter a day" })]))[0]).toContain("Kannada script");
    expect(validateExtraction(win, out([card({ whyEn: "ಕೈಯಲ್ಲಿ ಬರೆದು ಹೇಳಿದರೆ ನೆನಪಿರುತ್ತೆ" })]))[0]).toContain("written in English");
  });
});

describe("finalizeExtraction", () => {
  it("maps refs to database ids in time order and unions evidence", () => {
    const { cards } = finalizeExtraction(win, out([card()]));
    expect(cards[0]!.steps.map((s) => s.evidenceSegmentIds)).toEqual([[502], [503], [505]]);
    expect(cards[0]!.evidenceSegmentIds).toEqual([502, 503, 505]);
    expect(cards[0]!.quoteSegmentId).toBe(503);
  });

  it("drops a card whose advice involves punishment, in either language", () => {
    const kn = card({ steps: [...card().steps.slice(0, 2), { kn: "ಮರೆತರೆ ಕೈ ಮೇಲೆ ಎರಡು ಏಟು ಕೊಡಿ.", en: "If the child forgets, be firm.", evidence: ["S5"] }] });
    const en = card({ whyEn: "Children learn when they are scared of the cane." });
    const res = finalizeExtraction(win, out([kn, en]));
    expect(res.cards).toEqual([]);
    expect(res.dropped.map((d) => d.reason)).toEqual(["punishment", "punishment"]);
  });

  it("drops shaming advice as shaming, and keeps a card that advises against harm with a flag", () => {
    const shaming = card({ steps: [card().steps[0]!, { kn: "ಎಲ್ಲರ ಮುಂದೆ ಅವಮಾನ ಮಾಡಿ.", en: "Make an example of the child.", evidence: ["S3"] }] });
    const kind = card({ whyEn: "Never scold the child for forgetting; repeat the letter the next day." });
    const res = finalizeExtraction(win, out([shaming, kind]));
    expect(res.dropped).toEqual([expect.objectContaining({ reason: "shaming" })]);
    expect(res.cards).toHaveLength(1);
    expect(res.cards[0]!.flags).toContain("negated_harm_mention");
  });

  it("flags but keeps a card whose problem describes harm at home", () => {
    const res = finalizeExtraction(win, out([card({ problemKn: "ಆ ಮಗುಗೆ ಮನೇಲಿ ಅಪ್ಪ ಹೊಡೀತಿದ್ರು, ಶಾಲೆಗೆ ಬರೋಕೆ ಹೆದರ್ತಿತ್ತು." })]));
    expect(res.cards).toHaveLength(1);
    expect(res.cards[0]!.flags).toEqual(expect.arrayContaining(["sensitive_context", "welfare_signal"]));
  });

  it("replaces an interviewer quote with a master segment the card cites", () => {
    const res = finalizeExtraction(win, out([card({ quoteRef: "S1" })]));
    expect(res.cards[0]!.quoteSegmentId).toBe(502);
  });

  it("never plays a clip the card does not cite, one with a name redacted, or one describing harm", () => {
    const harmSeg = seg(506, 60, "master", "ಮೊದಲು ಬೆತ್ತದಿಂದ ಏಟು ಕೊಡ್ತಿದ್ದೆ, ಆಮೇಲೆ ಬಿಟ್ಟೆ.", "At first I gave strokes of the cane; later I stopped.");
    const w = toWindow([...segments.map((s) => (s.id === 503 ? { ...s, redacted: true } : s)), harmSeg]);
    const notCited = finalizeExtraction(w, out([card({ quoteRef: "S6" })]));
    expect(notCited.cards[0]!.quoteSegmentId).toBe(502);
    const harmCited = card({ steps: [...card().steps, { kn: "ಆಮೇಲೆ ಬಿಡಿ", en: "Then stop", evidence: ["S6"] }], quoteRef: "S6" });
    const res = finalizeExtraction(w, out([harmCited]));
    expect(res.cards[0]!.quoteSegmentId).toBe(502);
    expect(res.cards[0]!.flags).toContain("evidence_mentions_harm");
    const onlyRedacted = card({ steps: [card().steps[1]!, card().steps[1]!], quoteRef: "S3" });
    expect(finalizeExtraction(w, out([onlyRedacted])).cards[0]!.quoteSegmentId).toBeNull();
  });

  it("holds back a card that may name a child, and never stores a summary that does", () => {
    const res = finalizeExtraction(win, out([card({ problemEn: "A boy named Ravi could not read." })], [{ reason: "unclear", summaryEn: "A girl named Priya was mentioned." }]));
    expect(res.cards).toEqual([]);
    expect(JSON.stringify(res.dropped)).not.toMatch(/Ravi|Priya/);
    expect(res.dropped.map((d) => d.reason).sort()).toEqual(["child_identifying", "unclear"]);
  });

  it("lists every segment that may disclose harm to a child, card or not", () => {
    const w = toWindow([...segments, seg(507, 70, "master", "ಆ ಮಗುಗೆ ಮನೇಲಿ ಅಪ್ಪ ಹೊಡೀತಾರೆ ಅಂತ ಹೇಳ್ತು.", "The child said the father hits her at home.")]);
    expect(finalizeExtraction(w, out([])).welfareSegmentIds).toEqual([507]);
  });

  it("passes the model's own drops through", () => {
    const res = finalizeExtraction(win, out([], [{ reason: "not_a_practice", summaryEn: "Memories of the old school bus." }]));
    expect(res.dropped).toEqual([{ reason: "not_a_practice", summaryEn: "Memories of the old school bus." }]);
  });
});

describe("extractCards", () => {
  it("shows the model short refs and times, never database ids", () => {
    const prompt = renderCardExtractorPrompt({ master: { name: "ಶಂಕರಪ್ಪ", years: 32, classes: "1 to 4" }, segments: win.segments });
    expect(prompt).toContain("S1 [00:00–00:08] interviewer:");
    expect(prompt).toContain("S5 [00:48–00:56] master:");
    const unknown = renderCardExtractorPrompt({ master: { name: null, years: null, classes: null }, segments: toWindow([{ ...segments[0]!, speaker: null }]).segments });
    expect(unknown).toContain("S1 [00:24–00:32] unknown:");
    expect(prompt).not.toMatch(/\b50[1-5]\b/);
  });

  it("retries a bad citation and returns cards with ids and a span", async () => {
    const bad = card({ steps: [card().steps[0]!, { kn: "ಹೊಸ ಹೆಜ್ಜೆ", en: "A new step", evidence: ["S9"] }] });
    const h = scriptedDeps([out([bad]), out([card()])]);
    const res = await extractCards({ master: { name: null, years: null, classes: null }, segments }, h.deps);
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.cards[0]!.evidenceSegmentIds).toEqual([502, 503, 505]);
    expect(h.prompts[1]).toContain("S9");
    expect(res.span).toMatchObject({ role: "card_extractor", attempts: 2 });
  });

  it("does not call the model for an empty window", async () => {
    const h = scriptedDeps([]);
    expect(await extractCards({ master: { name: null, years: null, classes: null }, segments: [] }, h.deps)).toMatchObject({ status: "ok", cards: [] });
    expect(h.calls()).toBe(0);
  });
});

describe("windowSegments", () => {
  const minute = (m: number, len = 20) => ({ startMs: m * 60_000, endMs: m * 60_000 + len * 1000 });

  it("keeps a short interview in one window", () => {
    const s = [minute(0), minute(3), minute(9)];
    expect(windowSegments(s)).toEqual([s]);
  });

  it("cuts 10 minute windows that overlap by about a minute and cover every segment", () => {
    const s = Array.from({ length: 50 }, (_, i) => minute(i * 0.5));
    const w = windowSegments(s);
    expect(w.length).toBe(3);
    for (const win of w) expect(win[win.length - 1]!.endMs - win[0]!.startMs).toBeLessThanOrEqual(10 * 60_000);
    expect(new Set(w.flat())).toEqual(new Set(s));
    expect(w[1]![0]!.startMs).toBeLessThan(w[0]![w[0]!.length - 1]!.endMs);
    expect(w[0]![w[0]!.length - 1]!.endMs - w[1]![0]!.startMs).toBeLessThanOrEqual(60_000);
  });

  it("always makes progress, even past a segment longer than a window", () => {
    const s = [minute(0, 20), { startMs: 60_000, endMs: 60_000 + 11 * 60_000 }, minute(13)];
    const w = windowSegments(s);
    expect(new Set(w.flat())).toEqual(new Set(s));
  });

  it("sorts by time and returns nothing for nothing", () => {
    expect(windowSegments([])).toEqual([]);
    expect(windowSegments([minute(5), minute(1)])[0]!.map((x) => x.startMs)).toEqual([60_000, 300_000]);
  });
});

describe("mergeWindowCards", () => {
  const c = (title: string, evidence: number[], steps = 2): ExtractedCard => ({
    ...finalizeExtraction(win, out([card()])).cards[0]!,
    titleEn: title,
    evidenceSegmentIds: evidence,
    steps: Array.from({ length: steps }, () => ({ kn: "ಹೆಜ್ಜೆ", en: "step", evidenceSegmentIds: evidence })),
  });

  it("keeps the richer of two cards that share most evidence across an overlap", () => {
    const merged = mergeWindowCards([[c("a", [1, 2, 3]), c("b", [10, 11])], [c("a+", [2, 3, 4, 5], 4), c("c", [20, 21])]]);
    expect(merged.map((m) => m.titleEn)).toEqual(["a+", "b", "c"]);
  });

  it("keeps different practices that happen to share one segment", () => {
    const merged = mergeWindowCards([[c("a", [1, 2, 3, 4])], [c("b", [4, 5, 6, 7])]]);
    expect(merged).toHaveLength(2);
  });
});
