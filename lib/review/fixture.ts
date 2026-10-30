import type { DraftSummary, ReviewCard, ReviewSegment } from "./types";

// Fixture mode (no keys, docs/BUILD.md §1): one Sample draft card beside the transcript it came
// from, so the reviewer's room, the card review and the queue can be seen and tested without a
// database. From the extractor eval set (evals/card_extractor.jsonl, "extractor-01-letter-sounds"),
// with the master named as Sample. Labelled Sample everywhere (Law 7).
export const FIXTURE_REVIEW_CARD_ID = "00000000-0000-4000-8000-00000000c001";

export const FIXTURE_SEGMENTS: ReviewSegment[] = [
  {
    id: 1101,
    startMs: 0,
    endMs: 10355,
    kn: "ಸರ್, ಒಂದನೇ ಕ್ಲಾಸಿನಲ್ಲಿ ಒಂದು ಮಗು ತಿಂಗಳುಗಟ್ಟಲೆ ಆದ್ರೂ ಅಕ್ಷರ ಗುರುತು ಹಿಡಿಯೋಕೆ ಆಗ್ತಿಲ್ಲ ಅಂದ್ರೆ ನೀವು ಏನು ಮಾಡ್ತಿದ್ರಿ?",
    en: "Sir, if a child in Class 1 still cannot recognise letters after months, what did you do?",
    speaker: "interviewer",
    redacted: false,
  },
  {
    id: 1102,
    startMs: 10955,
    endMs: 20550,
    kn: "ಹೌದು, ಅಂಥ ಮಕ್ಕಳು ಪ್ರತಿ ವರ್ಷ ಇರ್ತಿದ್ರು. ಒಂದು ಮಗು ಇತ್ತು, ಮೂರು ತಿಂಗಳು ಆದ್ರೂ 'ಅ' ಕೂಡ ಗುರುತು ಹಿಡೀತಿರಲಿಲ್ಲ.",
    en: "Yes, there were such children every year. There was one child who could not recognise even 'ಅ' after three months.",
    speaker: "master",
    redacted: false,
  },
  {
    id: 1103,
    startMs: 21150,
    endMs: 29130,
    kn: "ನಾನು ಮೊದಲು ಮಾಡಿದ್ದು ಏನಂದ್ರೆ, ಎಲ್ಲಾ ಅಕ್ಷರ ಒಟ್ಟಿಗೆ ಕಲಿಸೋದು ಬಿಟ್ಟೆ. ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ.",
    en: "The first thing I did was stop teaching all the letters together. Just one letter a day.",
    speaker: "master",
    redacted: false,
  },
  {
    id: 1104,
    startMs: 29730,
    endMs: 40370,
    kn: "ಮರಳು ತಂದು ಒಂದು ತಟ್ಟೆಯಲ್ಲಿ ಹಾಕ್ತಿದ್ದೆ. ಮಗು ಬೆರಳಿಂದ ಮರಳಲ್ಲಿ 'ಮ' ಬರೀತಿತ್ತು, ಬರೀತಾ ಬರೀತಾ 'ಮ, ಮ' ಅಂತ ಜೋರಾಗಿ ಹೇಳ್ಬೇಕು.",
    en: "I brought sand and spread it in a plate. The child wrote 'ಮ' in the sand with a finger, saying 'ಮ, ಮ' aloud while writing.",
    speaker: "master",
    redacted: false,
  },
  {
    id: 1105,
    startMs: 40970,
    endMs: 51325,
    kn: "ಆಮೇಲೆ ಆ ಅಕ್ಷರಕ್ಕೆ ಒಂದು ವಸ್ತು ಜೋಡಿಸ್ತಿದ್ದೆ. 'ಮ' ಅಂದ್ರೆ ಮಾವಿನಕಾಯಿ. ಒಂದ್ಸಲ ನಿಜವಾದ ಮಾವಿನಕಾಯಿನೇ ಕ್ಲಾಸಿಗೆ ತಂದಿದ್ದೆ.",
    en: "Then I tied the letter to a thing. 'ಮ' is for ಮಾವಿನಕಾಯಿ, a raw mango. Once I brought a real mango to class.",
    speaker: "master",
    redacted: false,
  },
  {
    id: 1106,
    startMs: 51925,
    endMs: 55925,
    kn: "ಎಷ್ಟು ದಿನ ಹೀಗೆ ಮಾಡ್ತಿದ್ರಿ?",
    en: "For how many days did you do this?",
    speaker: "interviewer",
    redacted: false,
  },
  {
    id: 1107,
    startMs: 56525,
    endMs: 70680,
    kn: "ಮೊದಲ ಹದಿನೈದು ದಿನ, ದಿನಕ್ಕೆ ಹತ್ತು ನಿಮಿಷ, ಪ್ರಾರ್ಥನೆ ಆದ ಮೇಲೆ. ಆ ಮಗು ಜೊತೆ ಇನ್ನೂ ಮೂರು ನಾಲ್ಕು ಮಕ್ಕಳನ್ನ ಸೇರಿಸ್ಕೊಳ್ತಿದ್ದೆ, ಒಬ್ಬರೇ ಅಂದ್ರೆ ಮಗುಗೆ ನಾಚಿಕೆ ಆಗುತ್ತೆ.",
    en: "For the first fifteen days, ten minutes a day after the morning prayer. I added three or four more children with that child, because alone the child would feel shy.",
    speaker: "master",
    redacted: false,
  },
  {
    id: 1108,
    startMs: 71280,
    endMs: 78975,
    kn: "ಗುರುತು ಹಿಡಿದ ದಿನ ಎಲ್ಲಾ ಮಕ್ಕಳು ಚಪ್ಪಾಳೆ ಹೊಡೀತಿದ್ರು. ಆ ಮಗುವಿನ ಮುಖ ನೋಡ್ಬೇಕಿತ್ತು ನೀವು.",
    en: "The day the child recognised it, all the children clapped. You should have seen the child's face.",
    speaker: "master",
    redacted: false,
  },
  {
    id: 1109,
    startMs: 79575,
    endMs: 88790,
    kn: "ಒಂದು ವೇಳೆ ಮರೆತುಬಿಟ್ರೆ ಬೈಯೋದಲ್ಲ. ಮರುದಿನ ಮತ್ತೆ ಅದೇ ಅಕ್ಷರ, ಮರಳಲ್ಲಿ. ಹಳೇದು ಗಟ್ಟಿ ಆದ ಮೇಲೆನೇ ಹೊಸ ಅಕ್ಷರ.",
    en: "If the child forgot, no scolding. The same letter again the next day, in the sand. A new letter only once the old one was firm.",
    speaker: "master",
    redacted: false,
  },
  {
    id: 1110,
    startMs: 89390,
    endMs: 93390,
    kn: "ಇದು ಕೆಲಸ ಮಾಡ್ತು ಅಂತ ಹೇಗೆ ಗೊತ್ತಾಗ್ತಿತ್ತು?",
    en: "How did you know it was working?",
    speaker: "interviewer",
    redacted: false,
  },
  {
    id: 1111,
    startMs: 93990,
    endMs: 103870,
    kn: "ಬೋರ್ಡ್ ಮೇಲೆ ನಾಲ್ಕು ಅಕ್ಷರ ಬರೆದು, 'ಮ ಎಲ್ಲಿದೆ ತೋರಿಸು' ಅಂತ ಕೇಳ್ತಿದ್ದೆ. ಮೂರು ದಿನ ಸತತ ತೋರಿಸಿದ್ರೆ ಮುಂದಿನ ಅಕ್ಷರ.",
    en: "I wrote four letters on the board and asked, 'Show me where ಮ is.' If the child showed it three days in a row, we moved to the next letter.",
    speaker: "master",
    redacted: false,
  },
  {
    id: 1112,
    startMs: 104470,
    endMs: 109885,
    kn: "ಡಿಸೆಂಬರ್ ಹೊತ್ತಿಗೆ ಆ ಮಗು ಇಪ್ಪತ್ತು ಅಕ್ಷರ ಗುರುತು ಹಿಡೀತಿತ್ತು.",
    en: "By December the child could recognise twenty letters.",
    speaker: "master",
    redacted: false,
  },
];

export const FIXTURE_REVIEW_CARD: ReviewCard = {
  id: FIXTURE_REVIEW_CARD_ID,
  status: "draft",
  isSample: true,
  title: { kn: "ಮರಳಲ್ಲಿ ದಿನಕ್ಕೊಂದು ಅಕ್ಷರ", en: "One letter a day, written in sand" },
  problem: {
    kn: "ಒಂದನೇ ತರಗತಿಯ ಕೆಲವು ಮಕ್ಕಳು ತಿಂಗಳುಗಟ್ಟಲೆ ಆದರೂ ಒಂದು ಅಕ್ಷರವನ್ನೂ ಗುರುತಿಸಲ್ಲ.",
    en: "Some children in Class 1 cannot recognise a single letter even after months.",
  },
  steps: [
    {
      kn: "ಎಲ್ಲಾ ಅಕ್ಷರ ಒಟ್ಟಿಗೆ ಕಲಿಸೋದು ಬಿಡಿ. ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ.",
      en: "Stop teaching all the letters together. Just one letter a day.",
      evidenceSegmentIds: [1103],
    },
    {
      kn: "ಒಂದು ತಟ್ಟೆಯಲ್ಲಿ ಮರಳು ಹಾಕಿ. ಮಗು ಬೆರಳಿಂದ ಮರಳಲ್ಲಿ ಅಕ್ಷರ ಬರೆಯಲಿ, ಬರೆಯುತ್ತಾ 'ಮ, ಮ' ಅಂತ ಜೋರಾಗಿ ಹೇಳಲಿ.",
      en: "Spread sand in a plate. Let the child write the letter in it with a finger, saying it aloud while writing: 'ಮ, ಮ'.",
      evidenceSegmentIds: [1104],
    },
    {
      kn: "ಅಕ್ಷರಕ್ಕೆ ಮಗುವಿಗೆ ಗೊತ್ತಿರುವ ಒಂದು ವಸ್ತು ಜೋಡಿಸಿ: 'ಮ' ಅಂದ್ರೆ ಮಾವಿನಕಾಯಿ. ಸಾಧ್ಯವಾದರೆ ನಿಜವಾದ ವಸ್ತುವನ್ನೇ ತನ್ನಿ.",
      en: "Tie the letter to a thing the child knows: 'ಮ' for ಮಾವಿನಕಾಯಿ, a raw mango. Bring the real thing if you can.",
      evidenceSegmentIds: [1105],
    },
    {
      kn: "ಮೊದಲ ಹದಿನೈದು ದಿನ, ಪ್ರಾರ್ಥನೆ ಆದ ಮೇಲೆ ದಿನಕ್ಕೆ ಹತ್ತು ನಿಮಿಷ ಮಾಡಿ. ಆ ಮಗು ಜೊತೆ ಇನ್ನೂ ಮೂರು ನಾಲ್ಕು ಮಕ್ಕಳನ್ನು ಸೇರಿಸಿ, ಒಬ್ಬರೇ ಅಂದ್ರೆ ಮಗುಗೆ ನಾಚಿಕೆ ಆಗುತ್ತೆ.",
      en: "For the first fifteen days, do this for ten minutes after the morning prayer. Add three or four other children, so the child does not feel shy alone.",
      evidenceSegmentIds: [1107],
    },
    {
      kn: "ಮರೆತುಬಿಟ್ಟರೆ ಬೈಯಬೇಡಿ. ಮರುದಿನ ಅದೇ ಅಕ್ಷರ ಮತ್ತೆ ಮರಳಲ್ಲಿ. ಹಳೇದು ಗಟ್ಟಿ ಆದ ಮೇಲೆ ಮಾತ್ರ ಹೊಸ ಅಕ್ಷರ.",
      en: "If the child forgets, do not scold. The same letter again the next day, in the sand. A new letter only once the old one is firm.",
      evidenceSegmentIds: [1109],
    },
    {
      kn: "ಬೋರ್ಡ್ ಮೇಲೆ ನಾಲ್ಕು ಅಕ್ಷರ ಬರೆದು 'ಮ ಎಲ್ಲಿದೆ ತೋರಿಸು' ಅಂತ ಕೇಳಿ. ಮೂರು ದಿನ ಸತತ ತೋರಿಸಿದರೆ ಮುಂದಿನ ಅಕ್ಷರಕ್ಕೆ ಹೋಗಿ.",
      en: "Write four letters on the board and ask, 'Show me where ಮ is.' When the child shows it three days in a row, move to the next letter.",
      evidenceSegmentIds: [1111],
    },
  ],
  materials: [
    { kn: "ಮರಳು ಹಾಕಿದ ತಟ್ಟೆ", en: "a plate of sand" },
    {
      kn: "ಅಕ್ಷರಕ್ಕೆ ಹೊಂದುವ ನಿಜವಾದ ವಸ್ತು, ಮಾವಿನಕಾಯಿ ತರ",
      en: "a real thing for the letter, such as a raw mango",
    },
  ],
  why: {
    kn: "ಒಂದೇ ಅಕ್ಷರ ಗಟ್ಟಿಯಾದ ಮೇಲೆ ಮುಂದೆ ಹೋಗೋದು. ಗುರುತು ಹಿಡಿದ ದಿನ ಎಲ್ಲಾ ಮಕ್ಕಳು ಚಪ್ಪಾಳೆ ಹೊಡೆದಾಗ ಆ ಮಗುವಿನ ಮುಖ ಅರಳುತ್ತೆ.",
    en: "One letter at a time, moving on only when it is firm. When the whole class claps on the day the child gets it, the child's face lights up.",
  },
  gradeBand: "1",
  subject: "kannada",
  topic: "letters",
  flags: [],
  evidenceSegmentIds: [1103, 1104, 1105, 1107, 1109, 1111],
  quoteSegmentId: null,
  createdAt: "2026-10-22T10:00:00.000Z",
  master: {
    id: "00000000-0000-4000-8000-0000000000a1",
    name: "Shankarappa H.",
    years: 32,
    district: "Koppal",
    consented: true,
    voicePublic: true,
  },
  interviewId: "00000000-0000-4000-8000-0000000000b1",
};

export const FIXTURE_DRAFTS: DraftSummary[] = [
  {
    id: FIXTURE_REVIEW_CARD_ID,
    title: FIXTURE_REVIEW_CARD.title,
    topic: FIXTURE_REVIEW_CARD.topic,
    gradeBand: FIXTURE_REVIEW_CARD.gradeBand,
    steps: FIXTURE_REVIEW_CARD.steps.length,
    flags: [],
    isSample: true,
    masterName: FIXTURE_REVIEW_CARD.master.name,
    createdAt: FIXTURE_REVIEW_CARD.createdAt,
  },
];

export function fixtureReviewCard(id: string) {
  return id === FIXTURE_REVIEW_CARD_ID
    ? { card: FIXTURE_REVIEW_CARD, segments: FIXTURE_SEGMENTS }
    : null;
}

/** Questions waiting for an elder (the human queue), as the queue page lists them. */
export const FIXTURE_QUEUE = [
  {
    id: "00000000-0000-4000-8000-00000000d001",
    question_id: "00000000-0000-4000-8000-00000000e001",
    reason: "no_card",
    urgent: false,
    status: "open",
    is_sample: true,
    created_at: "2026-10-24T08:10:00.000Z",
    resolution_note: null,
    text: "ಒಂದು ಮಗು ಕಂಪ್ಯೂಟರ್ ಕೋಡಿಂಗ್ ಕಲಿಯಬೇಕು ಅಂತ ಕೇಳುತ್ತಿದೆ. ಎರಡನೇ ತರಗತಿಯಲ್ಲಿ ಹೇಗೆ ಶುರು ಮಾಡಲಿ?",
    textEn: "A child keeps asking to learn computer coding. How do I start in Class 2?",
    topic: "other",
    grade_band: "2",
  },
  {
    id: "00000000-0000-4000-8000-00000000d002",
    question_id: "00000000-0000-4000-8000-00000000e002",
    reason: "unsupported",
    urgent: false,
    status: "resolved",
    is_sample: true,
    created_at: "2026-10-23T16:40:00.000Z",
    resolution_note: "Answered in person by a master teacher.",
    text: "ಒಂದು ಮಗು ಪದಗಳನ್ನು ಓದುತ್ತದೆ ಆದರೆ ಅರ್ಥ ಹೇಳಲು ಆಗುವುದಿಲ್ಲ.",
    textEn: "A child reads the words but cannot say what they mean.",
    topic: "reading",
    grade_band: "2",
  },
  // The Sample safety chip tapped three times (D98): one item, "asked 3 times".
  {
    id: "00000000-0000-4000-8000-00000000d010",
    question_id: "00000000-0000-4000-8000-00000000e010",
    reason: "safety",
    urgent: true,
    status: "open",
    is_sample: true,
    created_at: "2026-10-24T08:00:00.000Z",
    hoursAgo: 1,
    resolution_note: null,
    text: "ಒಂದು ಮಗು ಮನೆಯಲ್ಲಿ ಅಪ್ಪ ದಿನಾ ಹೊಡೆಯುತ್ತಾರೆ ಅಂತ ಹೇಳಿತು. ನಾನು ಏನು ಮಾಡಲಿ?",
    textEn: "A child told me her father beats her at home every day. What should I do?",
    topic: "other",
    grade_band: null,
  },
  {
    id: "00000000-0000-4000-8000-00000000d011",
    question_id: "00000000-0000-4000-8000-00000000e011",
    reason: "safety",
    urgent: true,
    status: "open",
    is_sample: true,
    created_at: "2026-10-24T08:00:00.000Z",
    hoursAgo: 3,
    resolution_note: null,
    text: "ಒಂದು ಮಗು ಮನೆಯಲ್ಲಿ ಅಪ್ಪ ದಿನಾ ಹೊಡೆಯುತ್ತಾರೆ ಅಂತ ಹೇಳಿತು. ನಾನು ಏನು ಮಾಡಲಿ?",
    textEn: "A child told me her father beats her at home every day. What should I do?",
    topic: "other",
    grade_band: null,
  },
  {
    id: "00000000-0000-4000-8000-00000000d012",
    question_id: "00000000-0000-4000-8000-00000000e012",
    reason: "safety",
    urgent: true,
    status: "open",
    is_sample: true,
    created_at: "2026-10-24T08:00:00.000Z",
    hoursAgo: 6,
    resolution_note: null,
    text: "ಒಂದು ಮಗು ಮನೆಯಲ್ಲಿ ಅಪ್ಪ ದಿನಾ ಹೊಡೆಯುತ್ತಾರೆ ಅಂತ ಹೇಳಿತು. ನಾನು ಏನು ಮಾಡಲಿ?",
    textEn: "A child told me her father beats her at home every day. What should I do?",
    topic: "other",
    grade_band: null,
  },
];


const globalQueue = globalThis as typeof globalThis & {
  __paramparaQueueAnswers?: Map<string, string>;
};

/** Fixture mode: queue rows a reviewer answered with a card (row id → card title), in memory. */
export function fixtureQueueAnswers(): Map<string, string> {
  globalQueue.__paramparaQueueAnswers ??= new Map();
  return globalQueue.__paramparaQueueAnswers;
}
