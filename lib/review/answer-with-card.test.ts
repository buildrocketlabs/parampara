import { describe, expect, it } from "vitest";
import { answerFromCard, reviewerTraceStep, type CardForAnswer } from "./answer-with-card";

const card: CardForAnswer = {
  id: "c1",
  status: "approved",
  isSample: false,
  masterConsented: true,
  titleKn: "ಹತ್ತರ ಕಟ್ಟು",
  titleEn: "Bundles of ten",
  steps: [
    { kn: "ಹತ್ತು ಕಡ್ಡಿ ಕಟ್ಟಿ", en: "Tie ten sticks" },
    { kn: "ಎಣಿಸಿ", en: "Count" },
  ],
  materials: [{ kn: "ಕಡ್ಡಿ", en: "sticks" }],
  whyKn: "ಕೈಯಲ್ಲಿ ಹಿಡಿಯಬಹುದು",
  whyEn: "They can hold it",
};
const fieldRow = { reason: "no_card", status: "open", isSample: false };
const field = { isSample: false };

describe("answering a waiting question with a card (D83)", () => {
  it("gives her the card word for word, every step citing it", () => {
    const r = answerFromCard(fieldRow, card, field);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.update.steps).toEqual([
      { kn: "ಹತ್ತು ಕಡ್ಡಿ ಕಟ್ಟಿ", en: "Tie ten sticks", card_id: "c1", verdict: "supported" },
      { kn: "ಎಣಿಸಿ", en: "Count", card_id: "c1", verdict: "supported" },
    ]);
    expect(r.update).toMatchObject({
      status: "answered",
      outcome: "answered",
      card_ids: ["c1"],
      title_en: "Bundles of ten",
      why: { kn: "ಕೈಯಲ್ಲಿ ಹಿಡಿಯಬಹುದು", en: "They can hold it" },
    });
  });

  it("never gives a field teacher a Sample card (D64)", () => {
    expect(answerFromCard(fieldRow, { ...card, isSample: true }, field)).toEqual({
      ok: false,
      error: "card_not_allowed",
    });
  });

  it("lets a Sample question use a field card, as the demo does", () => {
    expect(answerFromCard({ ...fieldRow, isSample: true }, card, { isSample: true }).ok).toBe(true);
  });

  it("refuses a draft card, or a master who withdrew consent", () => {
    expect(answerFromCard(fieldRow, { ...card, status: "draft" }, field).ok).toBe(false);
    expect(answerFromCard(fieldRow, { ...card, masterConsented: false }, field).ok).toBe(false);
  });

  it("keeps the demo reviewer on Sample rows (D38)", () => {
    expect(answerFromCard(fieldRow, card, { isSample: true })).toEqual({
      ok: false,
      error: "sample_reviewer",
    });
  });

  it("answers only open no card rows, never a safety case", () => {
    expect(answerFromCard({ ...fieldRow, status: "resolved" }, card, field).ok).toBe(false);
    expect(answerFromCard({ ...fieldRow, reason: "safety" }, card, field)).toEqual({
      ok: false,
      error: "not_no_card",
    });
  });

  it("leaves out a reason the card does not have in both languages", () => {
    const r = answerFromCard(fieldRow, { ...card, whyEn: null }, field);
    expect(r.ok && r.update.why).toBeNull();
  });

  it("says in the trace that a person chose the card", () => {
    const step = reviewerTraceStep("Bundles of ten");
    expect(step.kind).toBe("retrieval");
    expect(step.title.en).toBe("A reviewer chose this card");
    expect(step.detail).toContain("Bundles of ten");
  });
});
