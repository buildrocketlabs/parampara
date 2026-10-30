import type { AnswerStep, AnswerText } from "@/components/parampara/AnswerCard";
import type { Trace } from "@/lib/ask/types";
import type { FieldChange } from "@/lib/field/changes";
import type { FieldSummary } from "@/lib/field/summary";

// Gallery only. A made up answer and its trace, shown with a Sample label (Law 7). The masters'
// names here are invented; no real person's words are put in anyone's mouth.
export const SAMPLE_TITLE: AnswerText = {
  kn: "ಹತ್ತರ ಕಟ್ಟು: ಕಡ್ಡಿಗಳಿಂದ ಸ್ಥಾನಬೆಲೆ",
  en: "Bundles of ten: place value with sticks",
};

export const SAMPLE_STEPS: AnswerStep[] = [
  {
    kn: "ಹತ್ತು ಕಡ್ಡಿಗಳನ್ನು ಎಣಿಸಿ, ರಬ್ಬರ್ ಬ್ಯಾಂಡ್ ಹಾಕಿ ಒಂದು ಕಟ್ಟು ಮಾಡಿ.",
    en: "Count ten sticks and tie them with a rubber band into one bundle.",
    cardId: "sample-card-1",
    masterName: { kn: "ಶಾಂತಮ್ಮ ಕೆ.", en: "Shantamma K." },
  },
  {
    kn: "ಕಟ್ಟು ಎತ್ತಿ ಹಿಡಿದು, ಎಲ್ಲರೂ ಒಟ್ಟಿಗೆ ಒಂದು ಹತ್ತು ಎಂದು ಹೇಳಿ.",
    en: "Hold the bundle up and say one ten together.",
    cardId: "sample-card-1",
    masterName: { kn: "ಶಾಂತಮ್ಮ ಕೆ.", en: "Shantamma K." },
  },
  {
    kn: "ಮಕ್ಕಳು ಜೋಡಿಯಾಗಿ ಕಟ್ಟು ಮತ್ತು ಬಿಡಿ ಕಡ್ಡಿಗಳಿಂದ ಸಂಖ್ಯೆಗಳನ್ನು ಮಾಡಲಿ.",
    en: "Let children in pairs build numbers with bundles and loose sticks.",
    cardId: "sample-card-2",
    masterName: { kn: "ಬಸವರಾಜ ಹ.", en: "Basavaraj H." },
  },
];

export const SAMPLE_MATERIALS: AnswerText[] = [
  { kn: "ಪ್ರತಿ ಜೋಡಿಗೆ ಹತ್ತು ಕಡ್ಡಿಗಳು", en: "10 sticks for each pair" },
  { kn: "ರಬ್ಬರ್ ಬ್ಯಾಂಡ್‌ಗಳು", en: "rubber bands" },
  { kn: "ಸ್ಲೇಟು", en: "a slate" },
];

export const SAMPLE_WHY: AnswerText = {
  kn: "ಹತ್ತನ್ನು ಮಕ್ಕಳು ಕೈಯಲ್ಲಿ ಹಿಡಿಯುತ್ತಾರೆ, ಆಗ ಸ್ಥಾನಬೆಲೆ ಕಣ್ಣಿಗೆ ಕಾಣುತ್ತದೆ.",
  en: "Children hold a ten in their hands, so place value becomes something they can see.",
};

export const SAMPLE_MASTER = {
  name: { kn: "ಶಾಂತಮ್ಮ ಕೆ.", en: "Shantamma K." },
  years: 34,
  district: { kn: "ಕೊಪ್ಪಳ", en: "Koppal" },
  portraitSrc: "/illustrations/sample-master-a.svg",
};

/** The first steps of a "Show me" question (M5.3): her words, the photo, then triage. Sample. */
export const SAMPLE_PHOTO_STEPS: Trace["steps"] = [
  {
    kind: "transcript",
    title: { kn: "ನೀವು ಹೇಳಿದ್ದು", en: "What you said" },
    detail: "ಒಂದು ಮಗು ಹನ್ನೆರಡು ಬದಲು 21 ಎಂದು ಬರೆಯುತ್ತದೆ. ಏನು ಮಾಡಲಿ?",
  },
  {
    kind: "photo",
    title: { kn: "ನೀವು ತೋರಿಸಿದ ಫೋಟೋ", en: "The photo you showed" },
    detail:
      "Digits are reversed in 3 of 4 numbers (21 for twelve, 41 for fourteen, 61 for sixteen).",
    model: "Sonnet 5.5",
    latencyMs: 2_900,
    tokensIn: 1_820,
    tokensOut: 120,
    costUsd: 0.0048,
    promptVersion: "photo_reader@v1",
  },
  {
    kind: "triage",
    title: { kn: "ಸ್ಥಾನ ಬೆಲೆ, 2ನೇ ತರಗತಿ", en: "Place value, grade 2" },
    detail: "No child's name to hide. No safety concern.",
    model: "Haiku 5.5",
    latencyMs: 790,
    tokensIn: 690,
    tokensOut: 92,
    costUsd: 0.0004,
    promptVersion: "triage@v2",
  },
];

/** A made up trace in exactly the shape lib/ask produces, numbers included only as a Sample. */
export const SAMPLE_TRACE: Trace = {
  steps: [
    {
      kind: "transcript",
      title: { kn: "ನೀವು ಹೇಳಿದ್ದು", en: "What you said" },
      detail: "ಮಕ್ಕಳಿಗೆ ಹತ್ತರ ನಂತರದ ಸಂಖ್ಯೆಗಳು ಗೊಂದಲ. ನಾಳೆ ಏನು ಮಾಡಲಿ?",
      model: "saaras:v4",
      latencyMs: 1_240,
    },
    {
      kind: "triage",
      title: { kn: "ಸಂಖ್ಯೆಯ ಅರಿವು, 1 ಮತ್ತು 2ನೇ ತರಗತಿ", en: "Number sense, grades 1 and 2" },
      detail: "No child's name to hide. No safety concern.",
      model: "Haiku 5.5",
      latencyMs: 820,
      tokensIn: 612,
      tokensOut: 96,
      costUsd: 0.0004,
      promptVersion: "triage@v2",
    },
    {
      kind: "retrieval",
      title: { kn: "2 ಒಪ್ಪಿದ ಕಾರ್ಡುಗಳು ಸಿಕ್ಕವು", en: "2 approved cards found" },
      detail: "Bundles of ten (Shantamma K.) · Number line on the floor (ಬಸವರಾಜ ಹ.)",
      model: "Haiku 5.5",
      latencyMs: 940,
      tokensIn: 3_820,
      tokensOut: 64,
      costUsd: 0.0011,
      promptVersion: "rank@v1",
    },
    {
      kind: "draft",
      title: { kn: "4 ಹಂತಗಳ ಕರಡು", en: "A draft of 4 steps" },
      model: "Sonnet 5.5",
      latencyMs: 4_610,
      tokensIn: 5_120,
      tokensOut: 742,
      costUsd: 0.0177,
      promptVersion: "answerer@v3",
    },
    {
      kind: "grounding",
      title: { kn: "ಪ್ರತಿ ಹಂತಕ್ಕೂ ಕಾರ್ಡಿನ ಆಧಾರ", en: "Every step checked against its card" },
      model: "Haiku 5.5",
      latencyMs: 1_080,
      tokensIn: 2_400,
      tokensOut: 210,
      costUsd: 0.0009,
      promptVersion: "judge@v2",
      verdicts: [
        {
          step: "Count ten sticks and tie them with a rubber band into one bundle.",
          verdict: "supported",
          quote: "We tied ten sticks with a rubber band into one bundle.",
        },
        {
          step: "Hold the bundle up and say one ten together.",
          verdict: "supported",
          quote: "A child would hold the bundle up and say one ten aloud.",
        },
        {
          step: "Let children in pairs build numbers with bundles and loose sticks.",
          verdict: "partial",
          quote: "We laid the bundles in a row and all counted together.",
        },
        {
          step: "Give a star to the child who finishes first.",
          verdict: "unsupported",
          removed: true,
        },
      ],
    },
    {
      kind: "safety",
      title: { kn: "ಸುರಕ್ಷಿತ ಸಲಹೆ", en: "Safe advice" },
      detail: "No punishment, shaming or comparison of children.",
      model: "Haiku 5.5",
      latencyMs: 690,
      tokensIn: 880,
      tokensOut: 40,
      costUsd: 0.0003,
      promptVersion: "safety@v1",
    },
    {
      kind: "voice",
      title: { kn: "ಕನ್ನಡ ಧ್ವನಿ", en: "Kannada voice" },
      model: "bulbul:v3",
      latencyMs: 2_150,
    },
  ],
  totals: { latencyMs: 11_530, costUsd: 0.0204 },
};

// The /how field card, to show its layout only. Shown with a Sample badge, never the field badge:
// these numbers are not the field test, and the change entry is placeholder words, not a quote.
export const FIELD_SPECIMEN: FieldSummary = {
  masters: 6,
  approvedCards: 48,
  teachers: 21,
  questions: { n: 134, hidden: false },
  tried: { n: 57, hidden: false },
  worked: { n: 31, hidden: false },
  partly: { n: 17, hidden: false },
  didnt: { n: 9, hidden: false },
  since: "2026-10-25T10:00:00+05:30",
};

export const FIELD_SPECIMEN_FEW: FieldSummary = {
  masters: 1,
  approvedCards: 7,
  teachers: 3,
  questions: { n: null, hidden: true },
  tried: { n: null, hidden: true },
  worked: { n: null, hidden: true },
  partly: { n: null, hidden: true },
  didnt: { n: null, hidden: true },
  since: "2026-10-25T10:00:00+05:30",
};

export const FIELD_CHANGE_SPECIMEN: FieldChange = {
  date: "2026-10-27",
  who: "teacher",
  said: {
    kn: "ಇಲ್ಲಿ ಅವರು ಹೇಳಿದ ಮಾತು, ಅವರದೇ ಪದಗಳಲ್ಲಿ.",
    en: "What they said goes here, in their own words.",
  },
  changed: {
    kn: "ನಾವು ಏನು ಬದಲಿಸಿದೆವು ಎಂದು ಒಂದು ವಾಕ್ಯದಲ್ಲಿ.",
    en: "What we changed, in one sentence.",
  },
  // Wireframes, not app screenshots (public/design/). Real entries use public/field/changes/.
  before: "/design/field-before.svg",
  after: "/design/field-after.svg",
};
