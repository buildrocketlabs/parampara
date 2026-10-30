import { SAMPLE_TRACE } from "@/app/design/sample-data";
import { FIXTURE_ANSWER, FIXTURE_ANSWER_ID } from "@/lib/tried/fixture";
import type { RecentAnswer } from "./recent";
import type { AnswerView } from "./store";
import type { Trace } from "@/lib/ask/types";

// Fixture mode (no keys, docs/BUILD.md §1): the Sample answer the tried loop already uses, in full,
// so the answer page, its trace and its Tomorrow card can be seen and tested without a database.
// Steps from the Sample library (evals/library.json, "Tens and ones with bundles of sticks").
// Labelled Sample everywhere (Law 7).
const STEPS = [
  {
    kn: "ಬೆಂಕಿ ಕಡ್ಡಿ, ಐಸ್‌ಕ್ರೀಮ್ ಕಡ್ಡಿಯನ್ನು ಮಕ್ಕಳೇ ಸಂಗ್ರಹ ಮಾಡಲಿ. ಪ್ರತಿ ಮಗುವಿಗೂ ಒಂದು ಡಬ್ಬಿ.",
    en: "Let the children collect matchsticks and ice cream sticks themselves. One small box for each child.",
  },
  {
    kn: "ಹತ್ತು ಕಡ್ಡಿ ಆದ ತಕ್ಷಣ ರಬ್ಬರ್ ಬ್ಯಾಂಡ್ ಹಾಕಿ ಒಂದು ಕಟ್ಟು ಮಾಡಿಸಿ, 'ಇದು ಒಂದು ಹತ್ತು' ಅಂತ ಹೇಳಿಸಿ.",
    en: "As soon as there are ten sticks, have them put a rubber band round to make a bundle and say, 'This is one ten.'",
  },
  {
    kn: "ಹದಿನಾಲ್ಕು ಅಂದ್ರೆ ಒಂದು ಕಟ್ಟು, ನಾಲ್ಕು ಬಿಡಿ ಕಡ್ಡಿ. ಮಕ್ಕಳೇ ಮಾಡಿ ತೋರಿಸಲಿ.",
    en: "Fourteen is one bundle and four loose sticks. Let the children make it and show you.",
  },
  {
    kn: "ನೆಲದ ಮೇಲೆ ಸೀಮೆಸುಣ್ಣದಲ್ಲಿ ಹತ್ತರ ಮನೆ ಮತ್ತು ಬಿಡಿ ಮನೆ ಬರೆಯಿರಿ.",
    en: "Draw a tens house and a ones house on the floor with chalk.",
  },
];

// The trace of this answer: the design gallery's Sample trace, with the card it found and the
// grounding check made to match the four steps above (and one step the check removed).
const FIXTURE_TRACE: Trace = {
  ...SAMPLE_TRACE,
  // The gallery's total less its voice step (2.15 s, no cost), which this trace leaves out.
  totals: { ...SAMPLE_TRACE.totals, latencyMs: SAMPLE_TRACE.totals.latencyMs - 2_150 },
  // No voice is made without keys, so the trace does not claim one (the answer says the same).
  steps: SAMPLE_TRACE.steps
    .filter((step) => step.kind !== "voice")
    .map((step) => {
      if (step.kind === "retrieval") {
        return {
          ...step,
          title: { kn: "1 ಒಪ್ಪಿದ ಕಾರ್ಡ್ ಸಿಕ್ಕಿತು", en: "1 approved card found" },
          detail: "Tens and ones with bundles of sticks (Sharanappa)",
        };
      }
      if (step.kind === "draft") {
        return { ...step, title: { kn: "5 ಹಂತಗಳ ಕರಡು", en: "A draft of 5 steps" } };
      }
      if (step.kind === "grounding") {
        return {
          ...step,
          verdicts: [
            {
              step: STEPS[0]!.en,
              verdict: "supported" as const,
              quote: "The children brought the sticks themselves, each in a small box.",
            },
            {
              step: STEPS[1]!.en,
              verdict: "supported" as const,
              quote: "Ten sticks, a rubber band, and they said: this is one ten.",
            },
            {
              step: STEPS[2]!.en,
              verdict: "supported" as const,
              quote: "Fourteen was one bundle and four loose sticks, and they showed me.",
            },
            {
              step: STEPS[3]!.en,
              verdict: "supported" as const,
              quote: "I drew a tens house and a ones house on the floor with chalk.",
            },
            {
              step: "Give a star to the child who finishes first.",
              verdict: "unsupported" as const,
              removed: true,
            },
          ],
        };
      }
      return step;
    }),
};

export const FIXTURE_CARD_ID = "00000000-0000-4000-8000-00000000c002";

/**
 * The same Sample answer asked again and replayed from the cache (D35), so the trace drawer's
 * replay note can be seen and tested without a database (F-P1). Its cache step is shaped exactly
 * as lib/ask/store.ts copyAnswer writes one.
 */
export const FIXTURE_REPLAY_ID = "00000000-0000-4000-8000-0000000a0002";
const FIXTURE_FIRST_AT = "2026-10-23T15:30:00.000Z";

export function fixtureAnswerView(id: string): AnswerView | null {
  if (id === FIXTURE_REPLAY_ID) {
    const first = fixtureAnswerView(FIXTURE_ANSWER_ID)!;
    return {
      ...first,
      id,
      replayed: true,
      firstAnsweredAt: FIXTURE_FIRST_AT,
      createdAt: "2026-10-28T16:05:00.000Z",
      trace: {
        ...FIXTURE_TRACE,
        steps: [
          {
            kind: "cache",
            title: { kn: "ಹಿಂದೆ ಕೊಟ್ಟ ಉತ್ತರ", en: "Answered before" },
            detail: "Same question, same checked cards",
            at: FIXTURE_FIRST_AT,
            latencyMs: 700,
            costUsd: 0,
          },
          ...FIXTURE_TRACE.steps,
        ],
      },
    };
  }
  if (id !== FIXTURE_ANSWER_ID) return null;
  const masterName = FIXTURE_ANSWER.master.name;
  return {
    id,
    status: "answered",
    outcome: "answered",
    lang: "kn",
    title: FIXTURE_ANSWER.title,
    steps: STEPS.map((s) => ({ ...s, cardId: FIXTURE_CARD_ID, masterName })),
    materials: [
      { kn: "ಬೆಂಕಿ ಕಡ್ಡಿ ಅಥವಾ ಐಸ್‌ಕ್ರೀಮ್ ಕಡ್ಡಿ", en: "matchsticks or ice cream sticks" },
      { kn: "ರಬ್ಬರ್ ಬ್ಯಾಂಡ್", en: "rubber bands" },
      { kn: "ಸೀಮೆಸುಣ್ಣ", en: "chalk" },
    ],
    why: {
      kn: "ಸಂಖ್ಯೆ ಕೈಯಲ್ಲಿ ಹಿಡಿಯೋ ಹಾಗೆ ಆದಾಗ ಮಗುವಿಗೆ ಅದರ ಅರ್ಥ ಕಾಣುತ್ತೆ.",
      en: "When a number becomes something children can hold, they see what it means.",
    },
    master: {
      name: masterName,
      years: FIXTURE_ANSWER.master.years,
      district: FIXTURE_ANSWER.master.district,
      isSample: true,
    },
    // No recording without a database: the player shows its calm "cannot be played here" state.
    quoteSegmentId: 1,
    cardIds: [FIXTURE_CARD_ID],
    trace: FIXTURE_TRACE,
    replayed: false,
    firstAnsweredAt: null,
    isSample: true,
    createdAt: FIXTURE_FIRST_AT,
    question: "ಮಕ್ಕಳಿಗೆ ಹತ್ತರ ನಂತರದ ಸಂಖ್ಯೆಗಳು ಗೊಂದಲ. ನಾಳೆ ಏನು ಮಾಡಲಿ?",
    note: null,
  };
}

/** The Sample answer as yesterday's, not yet tried: the home asks "Did it work?" about it. */
export function fixtureRecent(now = Date.now()): RecentAnswer[] {
  return [
    {
      id: FIXTURE_ANSWER_ID,
      title: FIXTURE_ANSWER.title,
      createdAt: new Date(now - 20 * 60 * 60_000).toISOString(),
      outcome: null,
    },
  ];
}
