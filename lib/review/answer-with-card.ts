import type { TraceStep } from "@/lib/ask/types";

// A reviewer answers a question no card could (D83): she picks an approved card that fits, and
// the teacher's own "no master yet" answer becomes that card, word for word. Nothing is written by
// a model, so every step is the card's own and cites it (Law 4). The pool rule is D64's: a field
// question is answered only from a real card of a consented master; a Sample question may use
// either. Pure: the server action reads the rows and writes what this returns.

export type QueueRowForAnswer = {
  reason: string;
  status: string;
  isSample: boolean;
};

export type CardForAnswer = {
  id: string;
  status: string;
  isSample: boolean;
  masterConsented: boolean;
  titleKn: string;
  titleEn: string;
  steps: Array<{ kn: string; en: string }>;
  materials: Array<{ kn: string; en: string }>;
  whyKn: string | null;
  whyEn: string | null;
};

export type AnswerUpdate = {
  status: "answered";
  outcome: "answered";
  title_kn: string;
  title_en: string;
  steps: Array<{ kn: string; en: string; card_id: string; verdict: "supported" }>;
  materials: Array<{ kn: string; en: string }>;
  why: { kn: string; en: string } | null;
  card_ids: string[];
  verdict: "supported";
};

export type AnswerRefusal = "not_open" | "not_no_card" | "sample_reviewer" | "card_not_allowed";

/** Whether this reviewer may answer this row with this card, and the answer row's new words. */
export function answerFromCard(
  row: QueueRowForAnswer,
  card: CardForAnswer,
  reviewer: { isSample: boolean },
): { ok: true; update: AnswerUpdate } | { ok: false; error: AnswerRefusal } {
  if (row.status === "resolved") return { ok: false, error: "not_open" };
  if (row.reason !== "no_card") return { ok: false, error: "not_no_card" };
  // D38: a Sample (demo) reviewer acts on Sample rows only.
  if (reviewer.isSample && !row.isSample) return { ok: false, error: "sample_reviewer" };
  // D64: a field teacher never receives a Sample card; nobody receives an unapproved card or one
  // whose master has withdrawn consent.
  const allowed =
    card.status === "approved" &&
    card.masterConsented &&
    card.steps.length > 0 &&
    (row.isSample || !card.isSample);
  if (!allowed) return { ok: false, error: "card_not_allowed" };
  return {
    ok: true,
    update: {
      status: "answered",
      outcome: "answered",
      title_kn: card.titleKn,
      title_en: card.titleEn,
      steps: card.steps.map((s) => ({
        kn: s.kn,
        en: s.en,
        card_id: card.id,
        verdict: "supported",
      })),
      materials: card.materials.map((m) => ({ kn: m.kn, en: m.en })),
      why: card.whyKn && card.whyEn ? { kn: card.whyKn, en: card.whyEn } : null,
      card_ids: [card.id],
      verdict: "supported",
    },
  };
}

/** The trace says plainly that a person chose the card, after the search that found none. */
export function reviewerTraceStep(cardTitleEn: string): TraceStep {
  return {
    kind: "retrieval",
    title: { kn: "ಪರಿಶೀಲಕರು ಆರಿಸಿದ ಕಾರ್ಡ್", en: "A reviewer chose this card" },
    detail: `No card fitted at first, so the question waited for a reviewer, who chose "${cardTitleEn}". Its steps are given word for word.`,
  };
}
