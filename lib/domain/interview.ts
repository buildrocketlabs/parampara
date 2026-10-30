import { z } from "zod";

// The live interview plan (docs/field/interview-guide.md): a warm up, seven FLN topics, one real
// story each, and the signature line to close. Shared by the interviewer role (ai/) and the talk
// screen (chapters). Plain data, safe for client components.

export type Bi = { kn: string; en: string };

export const INTERVIEW_TOPICS = [
  "warmup",
  "letters",
  "reading",
  "number_sense",
  "multi_level",
  "engagement",
  "home_language",
  "parents",
  "close",
] as const;
export const InterviewTopic = z.enum(INTERVIEW_TOPICS);
export type InterviewTopic = z.infer<typeof InterviewTopic>;

export type TopicPlan = {
  id: InterviewTopic;
  /** Chapter header on screen. */
  label: Bi;
  /** The guide's opening question, asked as is when the model is not available. */
  opening: Bi;
  /** What the guide wants drawn out (for the model, in English). */
  probes: string;
};

export const INTERVIEW_PLAN: TopicPlan[] = [
  {
    id: "warmup",
    label: { kn: "ಮೊದಲು ನಿಮ್ಮ ಬಗ್ಗೆ", en: "About you" },
    opening: {
      kn: "ನಮಸ್ಕಾರ. ಮೊದಲು ನಿಮ್ಮ ಬಗ್ಗೆ ಸ್ವಲ್ಪ ಹೇಳಿ: ಎಷ್ಟು ವರ್ಷ ಪಾಠ ಮಾಡಿದಿರಿ, ಯಾವ ತರಗತಿಗಳಿಗೆ, ಯಾವ ಶಾಲೆಯಲ್ಲಿ?",
      en: "Namaskara. First, tell me a little about yourself: how many years you taught, which classes, and at which school?",
    },
    probes: "Years of teaching, which classes, which school, a child they still remember (never the name).",
  },
  {
    id: "letters",
    label: { kn: "ಅಕ್ಷರ ಗುರುತು", en: "Letter sounds" },
    opening: {
      kn: "ಒಂದನೇ ತರಗತಿಯಲ್ಲಿ ತಿಂಗಳುಗಟ್ಟಲೆ ಆದರೂ ಒಂದು ಮಗು ಅಕ್ಷರ ಗುರುತು ಹಿಡಿಯದಿದ್ದಾಗ ನೀವು ಏನು ಮಾಡಿದಿರಿ? ಒಂದು ನಿಜವಾದ ಕಥೆ ಹೇಳಿ.",
      en: "A child in Class 1 still could not recognise letters after months. What did you do? Tell me one real story.",
    },
    probes: "Materials used? How many days? How did you know it worked?",
  },
  {
    id: "reading",
    label: { kn: "ಓದು", en: "Reading words" },
    opening: {
      kn: "ಒಂದು ಮಗುವಿಗೆ ಅಕ್ಷರ ಗೊತ್ತು, ಆದರೆ ಪದ ಓದೋಕೆ ಬರಲ್ಲ. ಅಂಥ ಮಗುವಿಗೆ ನೀವು ಏನು ಮಾಡಿದಿರಿ?",
      en: "A child knows the letters but cannot read words. What did you do for such a child?",
    },
    probes: "Which words first? Games? Pair reading?",
  },
  {
    id: "number_sense",
    label: { kn: "ಸಂಖ್ಯೆ ಜ್ಞಾನ", en: "Number sense" },
    opening: {
      kn: "ಒಂದು ಮಗು ಬಾಯಿಪಾಠವಾಗಿ ಎಣಿಸುತ್ತೆ, ಆದರೆ ಎಷ್ಟು ಅಂತ ಅರ್ಥ ಆಗಲ್ಲ. ಆಗ ನೀವು ಏನು ಮಾಡಿದಿರಿ?",
      en: "A child counts by heart but does not understand how many. What did you do then?",
    },
    probes: "Stones, sticks, bundles? Local objects?",
  },
  {
    id: "multi_level",
    label: { kn: "ಬಹು ಹಂತದ ತರಗತಿ", en: "Many levels in one room" },
    opening: {
      kn: "ಒಂದು ಮತ್ತು ಎರಡನೇ ತರಗತಿ ಒಟ್ಟಿಗೆ, ನಲವತ್ತು ಮಕ್ಕಳು, ನೀವೊಬ್ಬರೇ ಶಿಕ್ಷಕರು. ಹೇಗೆ ನಿಭಾಯಿಸಿದಿರಿ?",
      en: "Classes 1 and 2 together, forty children, and you the only teacher. How did you manage?",
    },
    probes: "How did you group them? What did the others do meanwhile?",
  },
  {
    id: "engagement",
    label: { kn: "ಹಾಜರಿ ಮತ್ತು ಆಸಕ್ತಿ", en: "Attendance and interest" },
    opening: {
      kn: "ಒಂದು ಮಗು ಶಾಲೆಗೆ ಬರೋದು ನಿಲ್ಲಿಸಿದಾಗ, ಅಥವಾ ಸುಮ್ಮನೆ ಕೂತಿರುವಾಗ, ನೀವು ಏನು ಮಾಡಿದಿರಿ?",
      en: "When a child stopped coming, or sat silently, what did you do?",
    },
    probes: "A home visit? Parents? The first small win?",
  },
  {
    id: "home_language",
    label: { kn: "ಮನೆ ಭಾಷೆ", en: "Home language" },
    opening: {
      kn: "ಮನೆಯಲ್ಲಿ ಲಂಬಾಣಿ, ಉರ್ದು ಅಥವಾ ಮರಾಠಿ ಮಾತಾಡೋ ಮಕ್ಕಳಿಗೆ ಕನ್ನಡ ಹೇಗೆ ಕಲಿಸಿದಿರಿ?",
      en: "How did you teach Kannada to children who speak Lambani, Urdu or Marathi at home?",
    },
    probes: "Bridging words? Songs?",
  },
  {
    id: "parents",
    label: { kn: "ಪೋಷಕರು ಮತ್ತು ಸಮುದಾಯ", en: "Parents and community" },
    opening: {
      kn: "ಓದೋಕೆ ಬರದ ಪೋಷಕರನ್ನು ಮಗುವಿನ ಕಲಿಕೆಯಲ್ಲಿ ಹೇಗೆ ಸೇರಿಸಿಕೊಂಡಿರಿ?",
      en: "How did you bring parents who cannot read into their child's learning?",
    },
    probes: "Melas, homework without reading, the SDMC?",
  },
  {
    id: "close",
    label: { kn: "ನಿಮ್ಮ ಒಂದು ಮಾತು", en: "Your one line" },
    opening: {
      kn: "ಒಬ್ಬ ಯುವ ಶಿಕ್ಷಕರು ನಿಮ್ಮಿಂದ ಒಂದೇ ಒಂದು ವಿಷಯ ನೆನಪಿಟ್ಟುಕೊಳ್ಳುವುದಾದರೆ, ಅದು ಏನಾಗಿರಬೇಕು?",
      en: "If a young teacher remembers only one thing from you, what should it be?",
    },
    probes: "This becomes the master's signature line.",
  },
];

export const PLAN_BY_ID = new Map(INTERVIEW_PLAN.map((t) => [t.id, t]));

/** Follow ups the guide asks for, in order: what next, the exact words, materials and days, did it work. */
export const PROBES: Bi[] = [
  { kn: "ಆಮೇಲೆ ನೀವು ಏನು ಮಾಡಿದಿರಿ?", en: "What did you do next?" },
  { kn: "ಆಗ ನೀವು ಆ ಮಗುವಿಗೆ ಏನು ಹೇಳಿದಿರಿ? ನಿಮ್ಮ ಮಾತಲ್ಲೇ ಹೇಳಿ.", en: "What exactly did you say to the child, in your own words?" },
  { kn: "ಅದಕ್ಕೆ ಏನೇನು ಬಳಸಿದಿರಿ, ಎಷ್ಟು ದಿನ ಹಿಡಿಯಿತು?", en: "What did you use for it, and how many days did it take?" },
];

/** The guide: "let us call the child ondu magu" when a name comes up. */
export const NAME_REMINDER: Bi = {
  kn: "ಮಗುವಿನ ಹೆಸರು ಬೇಡ, ಆ ಮಗುವನ್ನು 'ಒಂದು ಮಗು' ಅಂತ ಕರೆಯೋಣ.",
  en: "No need for the child's name; let us call the child 'a child'.",
};

/**
 * When an answer speaks of a child in danger, Hanate does not ask about it: a short thank you, then
 * the next topic. The screen shows Childline 1098 beside it (lib/talk/care.ts).
 */
export const CARE_CHILD: Bi = {
  kn: "ಇದನ್ನು ಹಂಚಿಕೊಂಡಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದ. ಈಗ ಬೇರೆ ವಿಷಯಕ್ಕೆ ಹೋಗೋಣ.",
  en: "Thank you for telling me this. Let us move to something else now.",
};

/** When the master speaks of their own despair: warmth, no questions about it, and a way to stop. */
export const CARE_SELF: Bi = {
  kn: "ಇದನ್ನು ಹೇಳಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದ. ನೀವು ಒಬ್ಬರೇ ಅಲ್ಲ. ಬೇಕಾದರೆ ಇವತ್ತು ಇಲ್ಲಿಗೆ ನಿಲ್ಲಿಸಬಹುದು.",
  en: "Thank you for telling me. You are not alone. We can stop here for today if you wish.",
};

export const THANK_YOU: Bi = {
  kn: "ತುಂಬಾ ಧನ್ಯವಾದ. ನಿಮ್ಮ ಅನುಭವ ಎಷ್ಟೋ ಯುವ ಶಿಕ್ಷಕರಿಗೆ ದೀಪ ಆಗುತ್ತದೆ.",
  en: "Thank you so much. Your experience will be a lamp for many young teachers.",
};

/** A session is 30 to 40 minutes (the guide); the signature line is asked by 38. */
export const SESSION_TARGET_MS = 35 * 60_000;
export const SESSION_CLOSE_BY_MS = 38 * 60_000;
/** "What did you do next?" up to three times, then the next topic. */
export const MAX_PROBES_PER_TOPIC = 3;
/** A bound on one live interview: questions asked (answered or skipped) before Hanate closes. */
export const MAX_QUESTIONS = 60;
