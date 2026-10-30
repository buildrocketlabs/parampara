// The plan behind `pnpm seed:pulse` (scripts/seed-pulse.mjs): a labelled Sample fortnight for the
// officer and master doors (D66, grown in D88). 120 Sample teachers in seven districts ask about
// 360 questions over the last 14 days, mostly on weekday evenings; answers are built from the
// approved Sample library cards; most teachers later say whether the idea worked, and some send the
// master one of the app's own thank you lines. Questions no approved card fits wait for a master.
// Every row is Sample (Law 7).
//
// Pure: a seeded random generator gives the same plan on every run, dated back from the moment it
// runs. Node runs it directly (type stripping); a unit test checks it against the rules the
// database applies (fewer than 5 different teachers is never shown, "a few" under 3 for a master).
import { pickWeighted, seededRandom, SAMPLE_EMAIL_DOMAIN } from "./sample-world.ts";

export type PulseDistrict =
  "Koppal" | "Raichur" | "Ballari" | "Kalaburagi" | "Dharwad" | "Vijayapura" | "Gadag";
export type PulseOutcome = "worked" | "partly" | "didnt";

export type PulseQuestion = {
  /** The eval case it comes from (already redacted, no names), or "modelled" on the eval set. */
  from: string;
  text: string;
  lang: "kn" | "en";
  topic: string;
  gradeBand: string | null;
  /** Library ids of the approved Sample cards it is answered from; none = no card fits yet. */
  cards: string[];
  /** How often teachers ask it, relative to the others. */
  weight: number;
  /** Asked only by teachers in these districts (a home language spoken there). */
  districts?: PulseDistrict[];
};

const q = (
  from: string,
  text: string,
  lang: "kn" | "en",
  topic: string,
  gradeBand: string | null,
  cards: string[],
  weight: number,
  districts?: PulseDistrict[],
): PulseQuestion => ({ from, text, lang, topic, gradeBand, cards, weight, districts });

const W = (n: number) => `sample-world-${String(n).padStart(2, "0")}`;
const MODELLED = "modelled on the eval set";

// Only plain pedagogy: never a disclosure, a teacher in distress, a punishment request, a name or
// an injection. Where an eval case carries an injected part, only the plain question is used.
export const PULSE_QUESTIONS = {
  // Letters
  L1: q(
    "retriever/rank-01-letters",
    "ಒಂದು ಮಗು ಇನ್ನೂ ಅಕ್ಷರ ಗುರುತು ಹಿಡಿಯಲ್ಲ, ಒಂದನೇ ತರಗತಿ.",
    "kn",
    "letters",
    "1",
    ["sample-card-01"],
    4,
  ),
  L2: q(
    "triage/triage-01-kn-name-intro (redacted)",
    "ಒಬ್ಬ ಹುಡುಗ ಇದ್ದಾನೆ, ಎರಡನೇ ಕ್ಲಾಸು, ಇನ್ನೂ ಅಕ್ಷರ ಗುರುತು ಹಿಡಿಯಲ್ಲ. ಏನು ಮಾಡ್ಲಿ?",
    "kn",
    "letters",
    "2",
    ["sample-card-01"],
    2,
  ),
  L3: q(
    "answerer/answer-01-kn-letters",
    "ಒಂದು ಮಗು ಇನ್ನೂ ಅಕ್ಷರ ಗುರುತು ಹಿಡಿಯಲ್ಲ, ಏನು ಮಾಡ್ಲಿ?",
    "kn",
    "letters",
    null,
    ["sample-card-01"],
    2,
  ),
  L4: q(
    "triage/triage-11-code-mixed",
    "Ma'am, class 1 ಅಲ್ಲಿ ಕೆಲವು students ಗೆ phonics sounds confuse ಆಗ್ತಾ ಇದೆ, b and d mix ಮಾಡ್ತಾರೆ",
    "kn",
    "letters",
    "1",
    ["sample-card-01"],
    2,
  ),
  L5: q(
    "retriever/rank-14-code-mixed-letters",
    "Class 1 ಅಲ್ಲಿ ಕೆಲವು students ಗೆ letters recognise ಮಾಡೋಕೆ ಆಗ್ತಿಲ್ಲ, ಎರಡು ತಿಂಗಳಾಯ್ತು.",
    "kn",
    "letters",
    "1",
    ["sample-card-01"],
    2,
  ),
  L6: q(
    "answerer/answer-12-one-step-fits",
    "How do I know when a child is ready to move on to the next letter?",
    "en",
    "letters",
    null,
    ["sample-card-01"],
    2,
  ),
  LA: q(
    MODELLED,
    "ಮಕ್ಕಳು ದ ಮತ್ತು ಧ ಒಂದೇ ಅಂತ ಓದ್ತಾರೆ, ಸಣ್ಣ ವ್ಯತ್ಯಾಸ ಕಾಣಿಸಲ್ಲ.",
    "kn",
    "letters",
    "1",
    [W(1)],
    4,
  ),
  LB: q(
    MODELLED,
    "ಕಾಗುಣಿತ ಬಂದ್ರೆ ಮಕ್ಕಳು ಗೊಂದಲ ಮಾಡ್ಕೊಳ್ತಾರೆ, ಕಿ ಮತ್ತು ಕೀ ಒಂದೇ ತರ ಓದ್ತಾರೆ. ಎರಡನೇ ತರಗತಿ.",
    "kn",
    "letters",
    "2",
    [W(39)],
    4,
  ),
  LC: q(
    "triage/triage-09-injection (the plain question only)",
    "How do I teach ಕಾಗುಣಿತ to class 2?",
    "en",
    "letters",
    "2",
    [W(39)],
    2,
  ),
  LD: q(
    MODELLED,
    "ಮಕ್ಕಳು ವರ್ಣಮಾಲೆ ಚಾರ್ಟ್ ನೋಡಿ ಕ್ರಮವಾಗಿ ಹೇಳ್ತಾರೆ, ಆದ್ರೆ ಒಂದು ಅಕ್ಷರ ಬೇರೆ ತೋರಿಸಿದ್ರೆ ಗೊತ್ತಾಗಲ್ಲ.",
    "kn",
    "letters",
    "1",
    [W(40)],
    3,
  ),
  LE: q(
    MODELLED,
    "My Class 1 children say the letter names but cannot tell which sound a word starts with.",
    "en",
    "letters",
    "1",
    [W(41)],
    2,
  ),
  LF: q(
    MODELLED,
    "ಮೂರನೇ ತರಗತಿಯಲ್ಲಿ ಒತ್ತಕ್ಷರ ಇರೋ ಪದ ಬಂದ್ರೆ ಮಕ್ಕಳು ಅಲ್ಲೇ ನಿಂತುಬಿಡ್ತಾರೆ.",
    "kn",
    "letters",
    "3",
    [W(42)],
    3,
  ),
  // Reading: blending, fluency, meaning
  R1: q(
    "answerer/answer-05 (the question only; its card is never seeded)",
    "ಕೆಲವು ಮಕ್ಕಳು ಓದ್ತಾರೆ, ಕೆಲವರು ಓದಲ್ಲ. ಹೇಗೆ ಕಲಿಸ್ಲಿ?",
    "kn",
    "reading",
    "1",
    ["sample-card-06"],
    2,
  ),
  RK: q(
    "retriever/rank-13-two-letter-words-en",
    "My Class 1 children know the letters but cannot read small two letter words yet.",
    "en",
    "reading",
    "1",
    ["sample-card-06"],
    3,
  ),
  R2: q(
    "answerer/answer-10-two-cards-overlap",
    "ಒಂದನೇ ತರಗತಿ ಮಕ್ಕಳು ಅಕ್ಷರ ಮರೆತುಬಿಡ್ತಾರೆ, ಪದ ಓದೋಕೆ ಇನ್ನೂ ಆಗ್ತಿಲ್ಲ.",
    "kn",
    "reading",
    "1",
    ["sample-card-01", "sample-card-06"],
    3,
  ),
  RA: q(
    MODELLED,
    "ಮಕ್ಕಳು ಪಾಠದ ಪದ ಓದ್ತಾರೆ, ಆದ್ರೆ ಅದೇ ತರದ ಹೊಸ ಪದ ಕೊಟ್ರೆ ಓದೋಕೆ ಆಗಲ್ಲ. ಬಾಯಿಪಾಠ ಮಾಡಿದ್ದಾರೆ ಅನ್ಸುತ್ತೆ.",
    "kn",
    "reading",
    "1-2",
    [W(8)],
    3,
  ),
  RB: q(
    MODELLED,
    "ಮೊದಲ ಅಕ್ಷರ ನೋಡಿ ಪದ ಊಹಿಸಿ ಹೇಳ್ತಾರೆ, ಪೂರ್ತಿ ಪದ ಓದಲ್ಲ. ಎರಡನೇ ತರಗತಿ.",
    "kn",
    "reading",
    "2",
    [W(9)],
    3,
  ),
  RC: q(
    "retriever/rank-19-fluency",
    "My Class 2 children read word by word, very slowly. How do I build fluency?",
    "en",
    "reading",
    "2",
    [W(34)],
    4,
  ),
  RL: q(
    MODELLED,
    "ಎರಡನೇ ತರಗತಿ ಮಕ್ಕಳು ಒಂದೊಂದೇ ಪದ ನಿಧಾನವಾಗಿ ಓದ್ತಾರೆ, ವಾಕ್ಯ ಸರಾಗವಾಗಿ ಬರಲ್ಲ.",
    "kn",
    "reading",
    "2",
    [W(34)],
    3,
  ),
  RD: q(
    MODELLED,
    "ಮಕ್ಕಳು ಜೋರಾಗಿ ಚೆನ್ನಾಗಿ ಓದ್ತಾರೆ, ಆದ್ರೆ ಏನು ಓದಿದ್ರಿ ಅಂತ ಕೇಳಿದ್ರೆ ಹೇಳೋಕೆ ಬರಲ್ಲ.",
    "kn",
    "reading",
    null,
    [W(31)],
    4,
  ),
  RE: q(
    MODELLED,
    "My Class 3 children answer the questions at the end of a lesson by copying any line from it.",
    "en",
    "reading",
    "3",
    [W(33)],
    2,
  ),
  RF: q(
    MODELLED,
    "ಹೊಸ ಪಾಠ ಶುರು ಮಾಡಿದ್ರೆ ಮಕ್ಕಳಿಗೆ ಆಸಕ್ತಿನೇ ಇರಲ್ಲ.",
    "kn",
    "reading",
    null,
    [W(32)],
    2,
  ),
  RG: q(
    "safety/safety-16-threat-kn",
    "ಮಕ್ಕಳು ಓದೋಕೆ ಆಸಕ್ತಿ ತೋರಿಸಲ್ಲ.",
    "kn",
    "reading",
    null,
    [W(43)],
    2,
  ),
  RH: q(
    MODELLED,
    "ನಮ್ಮ ಶಾಲೆಯಲ್ಲಿ ಕಥೆ ಪುಸ್ತಕಗಳೇ ಇಲ್ಲ, ಮಕ್ಕಳಿಗೆ ಓದೋ ಅಭ್ಯಾಸ ಹೇಗೆ ಮಾಡಿಸೋದು?",
    "kn",
    "reading",
    null,
    [W(43)],
    2,
  ),
  RI: q(
    MODELLED,
    "ಮಕ್ಕಳು ಓದ್ತಾರೆ, ಆದ್ರೆ ಎಲ್ಲಾ ಸಾಲೂ ಒಂದೇ ರಾಗದಲ್ಲಿ, ಭಾವ ಇಲ್ಲದೆ.",
    "kn",
    "reading",
    null,
    [W(44)],
    2,
  ),
  RJ: q(
    MODELLED,
    "Children read the words but do not know what the words mean.",
    "en",
    "reading",
    "1-2",
    [W(52)],
    2,
  ),
  // Writing
  WA: q(
    "retriever/rank-11-adjacent-writing",
    "ಮಕ್ಕಳು ಅಕ್ಷರ ಓದ್ತಾರೆ, ಆದ್ರೆ ಬರೆಯೋವಾಗ ಬ ಮತ್ತು ದ ಉಲ್ಟಾ ಬರೀತಾರೆ, ಎರಡನೇ ತರಗತಿ.",
    "kn",
    "writing",
    "2",
    [W(28)],
    3,
  ),
  WB: q(
    MODELLED,
    "ಒಂದನೇ ತರಗತಿ ಮಕ್ಕಳು ಪೆನ್ಸಿಲ್ ಮುಷ್ಟಿಯಲ್ಲಿ ಹಿಡಿತಾರೆ, ಸ್ವಲ್ಪ ಬರೆದ್ರೆ ಕೈ ಸುಸ್ತಾಗುತ್ತೆ ಅಂತಾರೆ.",
    "kn",
    "writing",
    "1",
    [W(26)],
    2,
  ),
  WC: q(
    MODELLED,
    "Their letters are all different sizes and go above and below the line.",
    "en",
    "writing",
    "1-2",
    [W(27)],
    2,
  ),
  WD: q(
    MODELLED,
    "ಕಪ್ಪು ಹಲಗೆಯಿಂದ ನಕಲು ಮಾಡೋಕೆ ಇಡೀ ಪಿರಿಯಡ್ ಹೋಗುತ್ತೆ, ತಪ್ಪುಗಳೂ ತುಂಬಾ.",
    "kn",
    "writing",
    null,
    [W(29)],
    2,
  ),
  WE: q(
    MODELLED,
    "ಮಕ್ಕಳು ನಕಲು ಮಾಡ್ತಾರೆ, ಆದ್ರೆ ನಿಮ್ಮದೇ ಒಂದು ವಾಕ್ಯ ಬರೀರಿ ಅಂದ್ರೆ ಬರೆಯೋಕೆ ಆಗಲ್ಲ.",
    "kn",
    "writing",
    null,
    [W(30)],
    3,
  ),
  // Speaking and listening
  OA: q(
    MODELLED,
    "ಏನು ಕೇಳಿದ್ರೂ ಮಕ್ಕಳು ಒಂದೇ ಪದದಲ್ಲಿ ಉತ್ತರ ಕೊಡ್ತಾರೆ.",
    "kn",
    "oral_language",
    null,
    [W(21)],
    3,
  ),
  OB: q(
    MODELLED,
    "Children do not speak in front of the class, even the ones who chat at play time.",
    "en",
    "oral_language",
    null,
    [W(22)],
    2,
  ),
  OC: q(
    MODELLED,
    "ಒಂದನೇ ತರಗತಿ ಮಕ್ಕಳಿಗೆ ಮಾತಾಡೋಕೆ ಪದಗಳೇ ಕಡಿಮೆ, ಹೇಗೆ ಹೆಚ್ಚಿಸೋದು?",
    "kn",
    "oral_language",
    "1",
    [W(23)],
    2,
  ),
  OD: q(
    MODELLED,
    "ಕಥೆ ಹೇಳಿದ ಮೇಲೆ ಮತ್ತೆ ಹೇಳಿ ಅಂದ್ರೆ ಮಕ್ಕಳಿಗೆ ಹೇಳೋಕೆ ಆಗಲ್ಲ.",
    "kn",
    "oral_language",
    null,
    [W(24)],
    2,
  ),
  OF: q(
    MODELLED,
    "ನಾನು ಹೇಳಿದ ಕೆಲಸವನ್ನ ಮಕ್ಕಳು ಸರಿಯಾಗಿ ಕೇಳಿಸ್ಕೊಳ್ಳಲ್ಲ, ಅರ್ಧ ಮಾತ್ರ ಮಾಡ್ತಾರೆ.",
    "kn",
    "oral_language",
    null,
    [W(25)],
    2,
  ),
  // Number sense and place value
  N1: q(
    "retriever/rank-02-number-sense",
    "ಮಕ್ಕಳು ಬಾಯಿಪಾಠ ಎಣಿಸ್ತಾರೆ, ಆದ್ರೆ ಹದಿನಾಲ್ಕು ಅಂದ್ರೆ ಎಷ್ಟು ಅಂತ ಗೊತ್ತಿಲ್ಲ.",
    "kn",
    "number_sense",
    "2",
    ["sample-card-02"],
    3,
  ),
  N2: q(
    "answerer/answer-02-en-number-sense",
    "My Class 2 children count to a hundred but don't understand what fourteen means.",
    "en",
    "number_sense",
    "2",
    ["sample-card-02"],
    3,
  ),
  NH: q(
    "answerer/answer-07-mixed-kn-en",
    "Ma'am, ನನ್ನ class 2 ಮಕ್ಕಳಿಗೆ place value ಅರ್ಥ ಆಗ್ತಿಲ್ಲ. Tens and ones ಹೇಗೆ ತೋರಿಸ್ಲಿ?",
    "kn",
    "number_sense",
    "2",
    ["sample-card-02"],
    3,
  ),
  NA: q(MODELLED, "ಮಕ್ಕಳು ಹದಿಮೂರು ಅಂತ ಹೇಳಿ 31 ಅಂತ ಬರೀತಾರೆ.", "kn", "number_sense", "2", [W(4)], 3),
  NB: q(
    MODELLED,
    "My Class 2 children cannot tell which is bigger, 29 or 41.",
    "en",
    "number_sense",
    "2",
    [W(5)],
    2,
  ),
  NC: q(
    MODELLED,
    "ಮೂರನೇ ತರಗತಿ ಮಕ್ಕಳಿಗೆ ಮೂರು ಅಂಕಿ ಸಂಖ್ಯೆ ಬಂದ್ರೆ ಗೊಂದಲ, ನೂರರ ಸ್ಥಾನ ಅರ್ಥ ಆಗ್ತಿಲ್ಲ.",
    "kn",
    "number_sense",
    "3",
    [W(6)],
    3,
  ),
  ND: q(
    MODELLED,
    "ಸೊನ್ನೆ ಅಂದ್ರೆ ಏನು ಅಂತ ಒಂದನೇ ತರಗತಿ ಮಕ್ಕಳಿಗೆ ಹೇಗೆ ತಿಳಿಸೋದು?",
    "kn",
    "number_sense",
    "1",
    [W(7)],
    2,
  ),
  NE: q(
    MODELLED,
    "ಎರಡು ರಾಶಿ ಕಲ್ಲು ಇಟ್ರೆ ಯಾವುದರಲ್ಲಿ ಜಾಸ್ತಿ ಅಂತ ಮಕ್ಕಳಿಗೆ ಹೇಳೋಕೆ ಆಗಲ್ಲ.",
    "kn",
    "number_sense",
    "1",
    [W(47)],
    2,
  ),
  NF: q(
    MODELLED,
    "Children do not know which number comes just before or just after another.",
    "en",
    "number_sense",
    "1-2",
    [W(48)],
    2,
  ),
  NG: q(
    MODELLED,
    "ಮೂರೇ ಕಲ್ಲು ಇದ್ರೂ ಮಕ್ಕಳು ಒಂದೊಂದಾಗಿ ಎಣಿಸ್ತಾರೆ, ನೋಡಿದ ತಕ್ಷಣ ಹೇಳಲ್ಲ.",
    "kn",
    "number_sense",
    "1",
    [W(49)],
    2,
  ),
  // No approved card counts objects one by one yet: it waits for a master.
  NI: q(
    "answerer/answer-11-card-without-why",
    "ಮಕ್ಕಳು ಒಂದರಿಂದ ಹತ್ತು ಬಾಯಲ್ಲಿ ಹೇಳ್ತಾರೆ, ಆದರೆ ಕಲ್ಲು ಎಣಿಸೋಕೆ ಹೇಳಿದರೆ ತಪ್ಪು ಮಾಡ್ತಾರೆ.",
    "kn",
    "number_sense",
    "1",
    [],
    2,
  ),
  // Adding and taking away
  PA: q(
    MODELLED,
    "ಕೂಡಿಸುವಾಗ ಮಕ್ಕಳು ಪ್ರತಿ ಸಲ ಒಂದರಿಂದ ಬೆರಳಲ್ಲಿ ಎಣಿಸ್ತಾರೆ.",
    "kn",
    "operations",
    "1-2",
    [W(16)],
    3,
  ),
  PB: q(
    MODELLED,
    "ಕಳೆಯೋ ಲೆಕ್ಕ ಕೊಟ್ರೆ ಮಕ್ಕಳು ಗೊಂದಲದಲ್ಲಿ ಕೂಡಿಸಿಬಿಡ್ತಾರೆ.",
    "kn",
    "operations",
    "1-2",
    [W(17)],
    2,
  ),
  PC: q(
    MODELLED,
    "My children can do sums on the board but cannot do word problems.",
    "en",
    "operations",
    null,
    [W(18)],
    3,
  ),
  PD: q(
    MODELLED,
    "ಮೂರನೇ ತರಗತಿಯಲ್ಲಿ ಕೂಡುವಾಗ ಹತ್ತು ದಾಟಿದ್ರೆ ಹತ್ತರ ಮನೆಗೆ ಒಯ್ಯೋದು ಮಕ್ಕಳಿಗೆ ಗೊತ್ತಾಗಲ್ಲ.",
    "kn",
    "operations",
    "3",
    [W(19)],
    2,
  ),
  PE: q(
    MODELLED,
    "Class 3 children say the tables by heart but do not know what three fours means.",
    "en",
    "operations",
    "3",
    [W(20)],
    2,
  ),
  PF: q(
    MODELLED,
    "ಹತ್ತು ಆಗೋಕೆ ಯಾವ ಎರಡು ಸಂಖ್ಯೆ ಬೇಕು ಅಂತ ಮಕ್ಕಳಿಗೆ ಗೊತ್ತಾಗಲ್ಲ.",
    "kn",
    "operations",
    "1-2",
    [W(38)],
    3,
  ),
  // No approved card teaches the clock: it waits for a master (D66).
  O1: q(
    "retriever/rank-05-no-fit",
    "ಮೂರನೇ ತರಗತಿ ಮಕ್ಕಳಿಗೆ ಗಡಿಯಾರ ನೋಡಿ ಸಮಯ ಹೇಳೋದು ಹೇಗೆ ಕಲಿಸೋದು?",
    "kn",
    "operations",
    "3",
    [],
    3,
  ),
  // Shapes and measuring (topic other, as triage files them), and questions beyond classes 1 to 3
  SA: q(
    MODELLED,
    "ಆಕಾರಗಳ ಹೆಸರು ಪುಸ್ತಕದ ಚಿತ್ರದಲ್ಲಿ ಮಾತ್ರ ಗೊತ್ತು, ಸುತ್ತಮುತ್ತ ಗುರುತಿಸೋಕೆ ಬರಲ್ಲ.",
    "kn",
    "other",
    "1-2",
    [W(35)],
    2,
  ),
  SB: q(
    MODELLED,
    "How do I teach measuring length in Class 2 when there are no rulers for everyone?",
    "en",
    "other",
    "2",
    [W(36)],
    2,
  ),
  SC: q(
    MODELLED,
    "ಭಾರ ಮತ್ತು ಹಗುರ ಮಕ್ಕಳಿಗೆ ಹೇಗೆ ತೋರಿಸೋದು? ಶಾಲೆಯಲ್ಲಿ ತಕ್ಕಡಿ ಇಲ್ಲ.",
    "kn",
    "other",
    null,
    [W(37)],
    2,
  ),
  X1: q(
    "retriever/rank-08-class6-fractions",
    "ಆರನೇ ತರಗತಿಯಲ್ಲಿ ಭಿನ್ನರಾಶಿ ಕೂಡಿಸೋದು ಮಕ್ಕಳಿಗೆ ಅರ್ಥ ಆಗ್ತಿಲ್ಲ.",
    "kn",
    "other",
    null,
    [],
    0.8,
  ),
  X2: q(
    "retriever/rank-09-coding",
    "How do I start Scratch coding with Class 6 when the school has only two computers?",
    "en",
    "other",
    null,
    [],
    0.6,
  ),
  X3: q(
    "retriever/rank-10-evs",
    "How do I teach plants and animals around us in EVS for Class 3 when the textbook pictures are not from our area?",
    "en",
    "other",
    "3",
    [],
    0.6,
  ),
  // Several classes in one room
  M1: q(
    "retriever/rank-03-multi-level",
    "ಒಂದು ಮತ್ತು ಎರಡನೇ ತರಗತಿ ಒಂದೇ ಕೋಣೆ, ಮೂವತ್ತೈದು ಮಕ್ಕಳು, ನಾನೊಬ್ಬಳೇ.",
    "kn",
    "multi_level",
    "1-2",
    ["sample-card-03"],
    3,
  ),
  M2: q(
    "answerer/answer-04-two-cards",
    "ಒಂದು ಮತ್ತು ಎರಡನೇ ತರಗತಿ ಒಟ್ಟಿಗೆ ಇದೆ, ಕೆಲವು ಮಕ್ಕಳಿಗೆ ಇನ್ನೂ ಓದೋಕೆ ಬರಲ್ಲ.",
    "kn",
    "multi_level",
    "1-2",
    ["sample-card-03", "sample-card-06"],
    3,
  ),
  MR: q(
    "retriever/rank-18-multi-level-1-3",
    "ಒಂದರಿಂದ ಮೂರನೇ ತರಗತಿ ಎಲ್ಲಾ ಒಂದೇ ಕೋಣೆಯಲ್ಲಿ, ಓದೋ ಮಟ್ಟ ಬೇರೆ ಬೇರೆ.",
    "kn",
    "multi_level",
    "1-3",
    ["sample-card-03", W(50)],
    3,
  ),
  MA: q(
    MODELLED,
    "ಒಂದು ಗುಂಪಿನ ಜೊತೆ ಕೂತ್ರೆ ಉಳಿದ ಮಕ್ಕಳು ಗಲಾಟೆ ಮಾಡ್ತಾರೆ, ಅಲ್ಲಿ ಇಲ್ಲಿ ಓಡಾಡ್ತಾರೆ.",
    "kn",
    "multi_level",
    "1-2",
    [W(2)],
    4,
  ),
  MB: q(
    MODELLED,
    "My Class 3 children finish their work fast and sit idle while Class 1 needs me.",
    "en",
    "multi_level",
    "1-3",
    [W(3)],
    4,
  ),
  MC: q(
    MODELLED,
    "ಇನ್ನೊಬ್ಬ ಟೀಚರ್ ರಜೆ ಇದ್ರೆ ಮೂರು ತರಗತಿ ನಾನೊಬ್ಬಳೇ ಒಂದೇ ಕೋಣೆಯಲ್ಲಿ ನೋಡ್ಕೋಬೇಕು.",
    "kn",
    "multi_level",
    "1-3",
    [W(53)],
    2,
  ),
  // Attendance and interest
  E1: q(
    "triage/triage-02-kn-bare-name (redacted)",
    "ಮೇಡಂ, ನಮ್ಮ ಕ್ಲಾಸಿನಲ್ಲಿ ಒಂದು ಮಗು ಯಾವಾಗಲೂ ಸುಮ್ಮನೆ ಕೂತಿರ್ತಾಳೆ, ಒಂದು ಮಾತೂ ಆಡಲ್ಲ. ಆ ಮಗುವಿಗೆ ಏನು ಮಾಡ್ಲಿ?",
    "kn",
    "engagement",
    null,
    ["sample-card-07"],
    3,
  ),
  E2: q(
    "retriever/rank-06 (the question before the injected tail)",
    "ಒಂದು ಮಗು ತರಗತಿಯಲ್ಲಿ ಒಂದು ಮಾತೂ ಆಡಲ್ಲ.",
    "kn",
    "engagement",
    null,
    ["sample-card-07"],
    2,
  ),
  EA: q(
    MODELLED,
    "ಒಂದು ಮಗು ತುಂಬಾ ದಿನ ಆದಮೇಲೆ ಶಾಲೆಗೆ ವಾಪಸ್ ಬಂದಿದೆ, ಏನೂ ಅರ್ಥ ಆಗದೆ ಸುಮ್ಮನೆ ಕೂತಿರುತ್ತೆ.",
    "kn",
    "engagement",
    null,
    [W(10)],
    2,
  ),
  EB: q(
    MODELLED,
    "ಕೆಲವು ಮಕ್ಕಳು ವಾರದಲ್ಲಿ ಎರಡು ಮೂರು ದಿನ ಮಾತ್ರ ಶಾಲೆಗೆ ಬರ್ತಾರೆ.",
    "kn",
    "engagement",
    null,
    [W(11)],
    3,
  ),
  EC: q(
    MODELLED,
    "Some children go home after the mid day meal and do not come back in the afternoon.",
    "en",
    "engagement",
    null,
    [W(51)],
    2,
  ),
  ED: q(
    MODELLED,
    "ವರ್ಷದ ಮಧ್ಯದಲ್ಲಿ ಹೊಸ ಮಗು ಸೇರಿದೆ, ಯಾರ ಜೊತೆನೂ ಬೆರೆಯಲ್ಲ.",
    "kn",
    "engagement",
    null,
    [W(54)],
    2,
  ),
  // Running the classroom, and making materials
  C1: q(
    "triage/triage-10-vague-answerable",
    "ಮಕ್ಕಳು ನನ್ನ ಮಾತೇ ಕೇಳಲ್ಲ.",
    "kn",
    "classroom",
    null,
    [W(12)],
    3,
  ),
  CA: q(
    MODELLED,
    "I have to raise my voice all day to be heard in my class.",
    "en",
    "classroom",
    null,
    [W(12)],
    2,
  ),
  CT: q(
    "safety/safety-10-stand-outside (the question only)",
    "Children talk during the lesson.",
    "en",
    "classroom",
    null,
    [W(12)],
    2,
  ),
  CB: q(
    MODELLED,
    "ಊಟ ಆದಮೇಲೆ ಮಕ್ಕಳು ಕೂರೋದೇ ಇಲ್ಲ, ಪಾಠ ಶುರು ಮಾಡೋಕೆ ಆಗಲ್ಲ.",
    "kn",
    "classroom",
    null,
    [W(14)],
    2,
  ),
  CC: q(
    MODELLED,
    "ಹಿಂದಿನ ಸಾಲಿನಲ್ಲಿ ಕೂರೋ ಮಕ್ಕಳು ಪಾಠದಲ್ಲಿ ಭಾಗವಹಿಸಲ್ಲ.",
    "kn",
    "classroom",
    null,
    [W(15)],
    2,
  ),
  CD: q(
    MODELLED,
    "ಹಾಜರಿ ತಗೊಂಡು ಮಕ್ಕಳನ್ನ ಕೂರಿಸೋದ್ರಲ್ಲೇ ಬೆಳಿಗ್ಗೆ ಅರ್ಧ ಗಂಟೆ ಹೋಗುತ್ತೆ.",
    "kn",
    "classroom",
    null,
    [W(55)],
    2,
  ),
  CE: q(
    MODELLED,
    "We have no teaching materials at all in my school. What can I make?",
    "en",
    "classroom",
    null,
    [W(45)],
    2,
  ),
  CF: q(MODELLED, "ಲೆಕ್ಕ ಮಾಡಿಸೋಕೆ ಎಣಿಸೋ ವಸ್ತುಗಳೇ ಇಲ್ಲ.", "kn", "classroom", null, [W(46)], 2),
  CG: q(
    MODELLED,
    "ಯಾವಾಗಲೂ ಅದೇ ನಾಲ್ಕು ಮಕ್ಕಳು ತರಗತಿಯ ಎಲ್ಲಾ ಕೆಲಸ ಮಾಡ್ತಾರೆ, ಉಳಿದವರು ಸುಮ್ಮನಿರ್ತಾರೆ.",
    "kn",
    "classroom",
    null,
    [W(13)],
    2,
  ),
  // Home language: the only card is still a reviewer draft (sample-card-05), so these wait.
  HA: q(
    "retriever/rank-16-urdu-home",
    "ನಮ್ಮ ಶಾಲೆಯ ಅರ್ಧ ಮಕ್ಕಳು ಮನೆಯಲ್ಲಿ ಉರ್ದು ಮಾತಾಡ್ತಾರೆ, ಒಂದನೇ ತರಗತಿಯ ಕನ್ನಡ ಪಾಠ ಅರ್ಥ ಆಗಲ್ಲ.",
    "kn",
    "home_language",
    "1",
    [],
    2,
    ["Raichur", "Kalaburagi", "Vijayapura"],
  ),
  HB: q(
    MODELLED,
    "ನಮ್ಮ ತಾಂಡಾದ ಮಕ್ಕಳು ಮನೆಯಲ್ಲಿ ಲಂಬಾಣಿ ಮಾತಾಡ್ತಾರೆ, ಒಂದನೇ ತರಗತಿಯ ಕನ್ನಡ ಪಾಠ ಅರ್ಥ ಆಗಲ್ಲ.",
    "kn",
    "home_language",
    "1",
    [],
    2,
    ["Koppal", "Ballari", "Vijayapura"],
  ),
  HC: q(
    MODELLED,
    "Half my class speaks Marathi at home. How do I start Kannada reading with them?",
    "en",
    "home_language",
    "1",
    [],
    2,
    ["Vijayapura", "Kalaburagi"],
  ),
  HD: q(
    MODELLED,
    "ಕೆಲವು ಮಕ್ಕಳು ಮನೆಯಲ್ಲಿ ತೆಲುಗು ಮಾತಾಡ್ತಾರೆ, ಕನ್ನಡ ಪದ ಅರ್ಥ ಆಗದೆ ಸುಮ್ಮನಿರ್ತಾರೆ.",
    "kn",
    "home_language",
    "1-2",
    [],
    2,
    ["Raichur", "Ballari"],
  ),
  // Parents: the only card is still a reviewer draft (sample-card-08), so these wait.
  P1: q(
    "retriever/rank-07-parents",
    "ನಮ್ಮ ಶಾಲೆಯ ಪೋಷಕರಿಗೆ ಓದೋಕೆ ಬರಲ್ಲ, ಮಕ್ಕಳ ಕಲಿಕೆಯಲ್ಲಿ ಅವರನ್ನು ಹೇಗೆ ಸೇರಿಸ್ಕೊಳ್ಳೋದು?",
    "kn",
    "parents",
    null,
    [],
    1,
  ),
  PP: q(
    "answerer/answer-16-card-does-not-fit-her",
    "ನಮ್ಮೂರಲ್ಲಿ ಪೋಷಕರು ಕೂಲಿಗೆ ಹೋಗ್ತಾರೆ, ಶನಿವಾರ ಬರೋಕೆ ಆಗಲ್ಲ. ಅವರಿಗೆ ಮಗುವಿನ ಕಲಿಕೆ ಹೇಗೆ ತೋರಿಸ್ಲಿ?",
    "kn",
    "parents",
    null,
    [],
    0.8,
  ),
} satisfies Record<string, PulseQuestion>;

export type PulseQuestionKey = keyof typeof PULSE_QUESTIONS;
const QUESTION_KEYS = Object.keys(PULSE_QUESTIONS) as PulseQuestionKey[];

/** Teachers per district: not every district equal; Gadag's three fold into "elsewhere" (D54). */
export const PULSE_DISTRICT_TEACHERS: Readonly<Record<PulseDistrict, number>> = {
  Koppal: 28,
  Raichur: 24,
  Ballari: 20,
  Kalaburagi: 18,
  Dharwad: 15,
  Vijayapura: 12,
  Gadag: 3,
};

export type PulseTeacher = { key: string; district: PulseDistrict };

export const PULSE_TEACHERS: readonly PulseTeacher[] = (
  Object.entries(PULSE_DISTRICT_TEACHERS) as Array<[PulseDistrict, number]>
)
  .flatMap(([district, n]) => Array.from({ length: n }, () => district))
  .map((district, i) => ({ key: `t${String(i + 1).padStart(3, "0")}`, district }));

/** Sample teacher accounts: a reserved domain that can never receive mail, and no password. */
export function pulseEmail(teacherKey: string): string {
  return `sample-pulse-${teacherKey}@${SAMPLE_EMAIL_DOMAIN}`;
}

/** Every account seed:pulse has ever made (the 24 Oct week used t01 to t18). */
export const PULSE_EMAIL_RE = /^sample-pulse-t\d{2,3}@demo\.parampara\.invalid$/;

/**
 * What one answered question costs, from docs/AI.md (budget: "about 2 to 3 US cents" per answered
 * question). These answers were composed by the seed, not by a model, so this is the stated
 * estimate, never a measurement; the rows are Sample. A question no card fits costs nothing here.
 */
export const PULSE_ESTIMATED_ANSWER_USD = 0.025;

/**
 * The app's own thank you lines a teacher taps (lib/i18n/kn.ts tried.thanks.p1 to p3; a unit test
 * keeps them equal). A Sample thank you is only ever one of these, never someone's own words.
 */
export const PULSE_THANKS_KN = [
  "ನಿಮ್ಮ ಉಪಾಯ ನನ್ನ ತರಗತಿಯಲ್ಲಿ ಫಲ ಕೊಟ್ಟಿತು. ಧನ್ಯವಾದಗಳು.",
  "ಮಕ್ಕಳು ಖುಷಿಯಿಂದ ಕಲಿತರು. ನಿಮಗೆ ನಮನ.",
  "ನಿಮ್ಮ ಅನುಭವ ನನಗೆ ದಾರಿ ತೋರಿಸಿತು.",
] as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const IST = 330 * MINUTE;
export const PULSE_DAYS = 14;
const SEED = 20261028;

/** One question as planned, before ids. */
export type PulseAsk = {
  teacher: string;
  question: PulseQuestionKey;
  askedAt: Date;
  /** What the teacher said after trying it, and when; null when not tried (yet). */
  said: PulseOutcome | null;
  saidAt: Date | null;
  /** Index into PULSE_THANKS_KN when she also thanked the master. */
  thanks: number | null;
};

// Weekday evenings are busiest; Saturday is a half day, Sunday quiet. India time.
const DAY_WEIGHT = [0.3, 1, 1, 1, 1, 0.95, 0.6]; // Sunday .. Saturday
const SLOTS: Array<{ from: number; minutes: number; weight: number }> = [
  { from: 6 * 60 + 30, minutes: 120, weight: 14 }, // before school
  { from: 13 * 60, minutes: 90, weight: 12 }, // the lunch break
  { from: 16 * 60 + 30, minutes: 150, weight: 12 }, // after school
  { from: 19 * 60, minutes: 180, weight: 62 }, // the evening, after the house work
];
const ACTIVITY = [1, 2, 3, 4, 5, 6, 7, 8];
const ACTIVITY_WEIGHT = [16, 26, 24, 14, 9, 5, 3, 3];
// Teachers in one district meet at the same cluster meetings and share the same worries, so each
// district asks more about a few problems. The weights only shape the Sample; nothing is inferred.
const DISTRICT_FOCUS: Record<PulseDistrict, string[]> = {
  Koppal: ["letters", "multi_level"],
  Raichur: ["writing", "reading"],
  Ballari: ["operations", "oral_language"],
  Kalaburagi: ["letters", "other"],
  Dharwad: ["reading", "classroom"],
  Vijayapura: ["number_sense", "multi_level"],
  Gadag: [],
};
const FOCUS_WEIGHT = 2;
// And a master's practice is heard of first near home, so it is tried there more often.
const LOCAL_WEIGHT = 4;

/**
 * The fortnight's questions and outcomes. Same `now`, same plan. `cardDistricts` maps a library card
 * id to its master's district (lib/seed/library-plan.ts cardDistricts).
 */
export function planPulseAsks(now: Date, cardDistricts: Record<string, string>): PulseAsk[] {
  const rand = seededRandom(SEED);
  const todayIst = Math.floor((now.getTime() + IST) / DAY);
  const asks: PulseAsk[] = [];
  for (const teacher of PULSE_TEACHERS) {
    const wants = pickWeighted(ACTIVITY, (a) => ACTIVITY_WEIGHT[a - 1]!, rand());
    // Most teachers were there all fortnight; some joined during it and have asked less so far.
    const firstDay = rand() < 0.8 ? PULSE_DAYS - 1 : 5 + Math.floor(rand() * 6);
    const n = Math.min(wants, 1 + Math.floor(firstDay / 2));
    const days = Array.from({ length: firstDay + 1 }, (_, d) => d);
    const asked = new Set<PulseQuestionKey>();
    const mine = QUESTION_KEYS.filter((k) => {
      const d: PulseDistrict[] | undefined = PULSE_QUESTIONS[k].districts;
      return !d || d.includes(teacher.district);
    });
    const focus = DISTRICT_FOCUS[teacher.district];
    const weightOf = (k: PulseQuestionKey) =>
      PULSE_QUESTIONS[k].weight *
      (focus.includes(PULSE_QUESTIONS[k].topic) ? FOCUS_WEIGHT : 1) *
      (cardDistricts[PULSE_QUESTIONS[k].cards[0] ?? ""] === teacher.district ? LOCAL_WEIGHT : 1);
    for (let i = 0; i < n; i++) {
      let key = pickWeighted(mine, weightOf, rand());
      for (let tries = 0; asked.has(key) && tries < 6; tries++) {
        key = pickWeighted(mine, weightOf, rand());
      }
      if (asked.has(key)) continue;
      asked.add(key);
      const d = pickWeighted(
        days,
        (x) => DAY_WEIGHT[(((todayIst - x + 4) % 7) + 7) % 7]! * (1 + 0.02 * (PULSE_DAYS - 1 - x)),
        rand(),
      );
      const slot = pickWeighted(SLOTS, (s) => s.weight, rand());
      const minute = slot.from + Math.floor(rand() * slot.minutes);
      let at = (todayIst - d) * DAY - IST + minute * MINUTE;
      // Never in the future, never in the last quarter hour: such a question moves a day back.
      if (at > now.getTime() - 15 * MINUTE) at -= DAY;
      const askedAt = new Date(at);

      const r = rand();
      const r2 = rand();
      const r3 = rand();
      const r4 = rand();
      let said: PulseOutcome | null = null;
      let saidAt: Date | null = null;
      let thanks: number | null = null;
      // Told the next day or the one after, never later than the run itself; most say something.
      const earliest = at + 14 * HOUR;
      const latest = Math.min(at + 44 * HOUR, now.getTime() - 10 * MINUTE);
      if (PULSE_QUESTIONS[key].cards.length > 0 && latest > earliest && r < 0.7) {
        said = r2 < 0.56 ? "worked" : r2 < 0.85 ? "partly" : "didnt";
        saidAt = new Date(earliest + Math.floor(r3 * (latest - earliest)));
        if (said === "worked" && r4 < 0.45) thanks = Math.floor(r4 * 1000) % PULSE_THANKS_KN.length;
      }
      asks.push({ teacher: teacher.key, question: key, askedAt, said, saidAt, thanks });
    }
  }
  return asks.sort((a, b) => a.askedAt.getTime() - b.askedAt.getTime());
}

export type PulseCard = {
  id: string;
  master_id: string;
  title_kn: string;
  title_en: string;
  steps: Array<{ kn: string; en: string }>;
  materials: Array<{ kn: string; en: string }>;
  why_kn: string | null;
  why_en: string | null;
};

export type PulseRows = {
  questions: Array<Record<string, unknown>>;
  answers: Array<Record<string, unknown>>;
  tried: Array<Record<string, unknown>>;
  thanks: Array<Record<string, unknown>>;
  queue: Array<Record<string, unknown>>;
};

/**
 * The rows to insert. `teacherIds` maps a teacher key to its profile id, `cards` maps a library
 * card id to its approved Sample card in the database (with its master).
 */
export function buildPulseRows(input: {
  now: Date;
  teacherIds: Record<string, string>;
  cards: Record<string, PulseCard>;
  /** Library card id → its master's district (lib/seed/library-plan.ts cardDistricts). */
  cardDistricts: Record<string, string>;
  uuid: () => string;
}): PulseRows {
  const { now, teacherIds, cards, cardDistricts, uuid } = input;
  const rows: PulseRows = { questions: [], answers: [], tried: [], thanks: [], queue: [] };
  let n = 0;
  for (const ask of planPulseAsks(now, cardDistricts)) {
    n += 1;
    const teacherId = teacherIds[ask.teacher];
    if (!teacherId) throw new Error(`no profile for ${ask.teacher}`);
    const qn = PULSE_QUESTIONS[ask.question];
    const questionId = uuid();
    rows.questions.push({
      id: questionId,
      teacher_id: teacherId,
      text_redacted: qn.text,
      lang: qn.lang,
      topic: qn.topic,
      grade_band: qn.gradeBand,
      safety_flags: [],
      is_sample: true,
      created_at: ask.askedAt.toISOString(),
    });
    const answeredAt = new Date(ask.askedAt.getTime() + 9_000 + (n % 5) * 1_000).toISOString();
    const answerId = uuid();
    if (qn.cards.length === 0) {
      rows.answers.push({
        ...answerBase(answerId, questionId, qn.lang, answeredAt),
        status: "needs_human",
        outcome: "no_card",
        cost_usd: 0,
      });
      rows.queue.push({
        id: uuid(),
        question_id: questionId,
        reason: "no_card",
        urgent: false,
        status: "open",
        is_sample: true,
        created_at: answeredAt,
      });
      continue;
    }
    const used = qn.cards.map((libraryId) => {
      const card = cards[libraryId];
      if (!card) throw new Error(`approved Sample card missing: ${libraryId}`);
      return card;
    });
    // One card: its first four steps. Two cards: the first two steps of each.
    const perCard = used.length > 1 ? 2 : 4;
    const first = used[0]!;
    rows.answers.push({
      ...answerBase(answerId, questionId, qn.lang, answeredAt),
      status: "answered",
      outcome: "answered",
      title_kn: first.title_kn,
      title_en: first.title_en,
      steps: used.flatMap((c) =>
        c.steps.slice(0, perCard).map((s) => ({
          kn: s.kn,
          en: s.en,
          hi: null,
          card_id: c.id,
          verdict: "supported",
        })),
      ),
      materials: used.flatMap((c) => c.materials),
      why: first.why_kn && first.why_en ? { kn: first.why_kn, en: first.why_en } : null,
      card_ids: used.map((c) => c.id),
      verdict: "supported",
      cost_usd: PULSE_ESTIMATED_ANSWER_USD,
    });
    if (!ask.said || !ask.saidAt) continue;
    const triedId = uuid();
    rows.tried.push({
      id: triedId,
      answer_id: answerId,
      teacher_id: teacherId,
      outcome: ask.said,
      note_redacted: null,
      is_sample: true,
      created_at: ask.saidAt.toISOString(),
    });
    if (ask.thanks === null) continue;
    // To the master of the answer's first card, as the app sends it (lib/tried/store.ts).
    const sentAt = ask.saidAt.getTime() + (1 + (n % 9)) * MINUTE;
    const read = sentAt + 18 * HOUR;
    rows.thanks.push({
      id: uuid(),
      tried_id: triedId,
      master_id: first.master_id,
      text: PULSE_THANKS_KN[ask.thanks],
      audio_path: null,
      // The newest notes are still waiting for their master; older ones were read.
      delivered_at: now.getTime() - sentAt < 2 * DAY ? null : new Date(read).toISOString(),
      is_sample: true,
      created_at: new Date(sentAt).toISOString(),
    });
  }
  return rows;
}

function answerBase(id: string, questionId: string, lang: string, createdAt: string) {
  return {
    id,
    question_id: questionId,
    lang,
    title_kn: null,
    title_en: null,
    title_hi: null,
    steps: [],
    materials: [],
    why: null,
    card_ids: [],
    verdict: null,
    latency_ms: null,
    // Nothing was generated live: replayed keeps these rows out of /how's measured cost and speed,
    // and with no cache keys they are never served to a real teacher as a cached answer.
    replayed: true,
    cache_key: null,
    raw_key: null,
    trace: {},
    is_sample: true,
    created_at: createdAt,
  };
}

// ── What the officer and master doors will show (the rules of 0005 and 0006, in TypeScript) ────
// For `--dry-run` and the unit test: the database stays the source of truth on the screens.

export type PulsePreview = {
  week: {
    since: string;
    until: string;
    asked: number;
    teachers: number;
    answered: number;
    tried: number;
    worked: number;
    waiting: number;
  };
  topics: Array<{
    topic: string;
    asked: number | null;
    teachers: number;
    waiting: number;
    shielded: boolean;
  }>;
  districts: Array<{ district: string; asked: number | null; teachers: number }>;
  lamps: Array<{ district: string; helped: number | null; teachers: number }>;
  practicesShown: number;
  practicesPrivate: number;
  masters: Array<{
    master: string;
    cards: number;
    reached: number | null;
    tried: number | null;
    worked: number | null;
    thanks: number;
  }>;
  outcomes: Record<PulseOutcome, number>;
};

const MIN_GROUP = 5;
const FEW = 3;

export function previewPulse(
  rows: PulseRows,
  teacherDistrict: Record<string, string>,
  masterOfCard: Record<string, string>,
  approvedCardsOf: Record<string, number>,
): PulsePreview {
  const qById = new Map(rows.questions.map((r) => [r.id as string, r]));
  const aById = new Map(rows.answers.map((r) => [r.id as string, r]));
  const t = (r: Record<string, unknown>) => Date.parse(r.created_at as string);
  const until = Math.max(...rows.questions.map(t));
  const since = until - 7 * DAY;
  const inWeek = (r: Record<string, unknown>) => t(r) > since && t(r) <= until;
  const weekQs = rows.questions.filter(inWeek);
  const weekQIds = new Set(weekQs.map((r) => r.id as string));
  const weekAs = rows.answers.filter((a) => weekQIds.has(a.question_id as string));
  const weekAIds = new Set(weekAs.map((a) => a.id as string));
  const weekTried = rows.tried.filter((x) => weekAIds.has(x.answer_id as string));
  const distinct = (xs: unknown[]) => new Set(xs).size;
  const shown = (n: number, people: number) => (people >= 1 && people < MIN_GROUP ? null : n);
  const few = (n: number) => (n >= 1 && n < FEW ? null : n);
  const group = <T>(xs: T[], key: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
    return m;
  };
  const teacherOf = (questionId: string) => qById.get(questionId)!.teacher_id as string;
  const openNoCard = rows.queue.filter((h) => h.status !== "resolved" && h.reason === "no_card");

  const topics = [...group(weekQs, (r) => (r.topic as string) ?? "other")].map(([topic, qs]) => {
    const waiting = openNoCard.filter((h) => qById.get(h.question_id as string)?.topic === topic);
    const people = distinct(qs.map((r) => r.teacher_id));
    return {
      topic,
      asked: shown(qs.length, people) as number | null,
      teachers: people,
      waiting: waiting.length,
      shielded: false,
    };
  });
  // Complementary suppression (0006 insights_topics): with exactly one hidden topic, the smallest
  // shown topic is kept private too, so the hidden one is never the total minus the rest.
  if (topics.filter((x) => x.asked === null).length === 1) {
    const smallest = topics
      .filter((x) => x.asked !== null && x.asked > 0)
      .sort((a, b) => a.asked! - b.asked! || a.topic.localeCompare(b.topic))[0];
    if (smallest) Object.assign(smallest, { asked: null, shielded: true });
  }

  const place = (teachers: Array<{ teacher: string }>) => {
    const perDistrict = group(teachers, (x) => teacherDistrict[x.teacher] ?? "elsewhere");
    const placed: Array<{ district: string; teacher: string }> = [];
    for (const [d, xs] of perDistrict) {
      const named = distinct(xs.map((x) => x.teacher)) >= MIN_GROUP;
      for (const x of xs) placed.push({ district: named ? d : "elsewhere", teacher: x.teacher });
    }
    return [...group(placed, (x) => x.district)].map(([district, xs]) => {
      const people = distinct(xs.map((x) => x.teacher));
      return { district, n: xs.length, teachers: people };
    });
  };
  const districts = place(weekQs.map((r) => ({ teacher: r.teacher_id as string }))).map((g) => ({
    district: g.district,
    asked: shown(g.n, g.teachers),
    teachers: g.teachers,
  }));
  const worked = rows.tried.filter((x) => x.outcome === "worked");
  const lamps = place(worked.map((x) => ({ teacher: x.teacher_id as string }))).map((g) => ({
    district: g.district,
    helped: shown(g.n, g.teachers),
    teachers: g.teachers,
  }));

  const triersByCard = new Map<string, Set<string>>();
  for (const x of rows.tried) {
    for (const c of aById.get(x.answer_id as string)!.card_ids as string[]) {
      triersByCard.set(c, (triersByCard.get(c) ?? new Set()).add(x.teacher_id as string));
    }
  }
  const triers = [...triersByCard.values()].map((s) => s.size);

  const masterKeys = [...new Set(Object.values(masterOfCard))];
  const triedById = new Map(rows.tried.map((x) => [x.id as string, x]));
  // A thank you goes to the master of the first card of the answer that was tried.
  const thankedMaster = (h: Record<string, unknown>) => {
    const tried = triedById.get(h.tried_id as string)!;
    const first = (aById.get(tried.answer_id as string)!.card_ids as string[])[0]!;
    return masterOfCard[first];
  };
  const masters = masterKeys.map((m) => {
    const used = rows.answers.filter(
      (a) => a.status === "answered" && (a.card_ids as string[]).some((c) => masterOfCard[c] === m),
    );
    const usedIds = new Set(used.map((a) => a.id as string));
    const perTeacher = new Map<string, boolean>();
    for (const x of rows.tried.filter((x) => usedIds.has(x.answer_id as string))) {
      const k = x.teacher_id as string;
      perTeacher.set(k, (perTeacher.get(k) ?? false) || x.outcome === "worked");
    }
    const triedN = perTeacher.size;
    return {
      master: m,
      cards: approvedCardsOf[m] ?? 0,
      reached: few(distinct(used.map((a) => teacherOf(a.question_id as string)))),
      tried: few(triedN),
      worked: triedN >= 1 && triedN < FEW ? null : [...perTeacher.values()].filter(Boolean).length,
      thanks: rows.thanks.filter((h) => thankedMaster(h) === m).length,
    };
  });

  const said = (o: PulseOutcome) => rows.tried.filter((x) => x.outcome === o).length;
  return {
    week: {
      since: new Date(since).toISOString(),
      until: new Date(until).toISOString(),
      asked: weekQs.length,
      teachers: distinct(weekQs.map((r) => r.teacher_id)),
      answered: weekAs.filter((a) => a.status === "answered").length,
      tried: weekTried.length,
      worked: weekTried.filter((x) => x.outcome === "worked").length,
      waiting: openNoCard.length,
    },
    topics: topics.sort((a, b) => (b.asked ?? -1) - (a.asked ?? -1)),
    districts: districts.sort((a, b) => (b.asked ?? -1) - (a.asked ?? -1)),
    lamps: lamps.sort((a, b) => (b.helped ?? -1) - (a.helped ?? -1)),
    practicesShown: triers.filter((s) => s >= MIN_GROUP).length,
    practicesPrivate: triers.filter((s) => s > 0 && s < MIN_GROUP).length,
    masters,
    outcomes: { worked: said("worked"), partly: said("partly"), didnt: said("didnt") },
  };
}
