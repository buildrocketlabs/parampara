import { findDisclosures, findTeacherCrisis } from "@/ai/safety/patterns";

// What an answer needs beyond the next question (Law 5). A child in danger: Childline 1098 on
// screen, and Hanate does not ask about it. The speaker's own despair: Tele MANAS 14416, and a way
// to stop. Both can be true at once. The shared deterministic patterns (patterns@v3) first, then a
// few more phrasings an elder says aloud that the safety re-check of the talk found missing (24 Oct);
// they live here so the teacher path's patterns version is unchanged. Client safe, so Sample mode
// shows the same care as a real talk.

export type Care = "child" | "self" | "both";

// "I feel I should die", ಸಾಯಬೇಕು ಅಂತ ಅನ್ಸ್ತಿದೆ, ನಾನು ಸಾಯ್ತೀನಿ, "I do not want to live".
const MORE_DESPAIR: RegExp[] = [
  /\bi\s+(?:feel|think)\s+(?:like\s+)?i\s+should\s+die\b|\bi\s+do\s+not\s+want\s+to\s+live\b|\bno\s+reason\s+to\s+live\b|\bend\s+it\s+all\b/iu,
  /ಸಾಯಬೇಕು\s*(?:ಅಂತ|ಎಂದು)?\s*(?:ಅನ್ಸ|ಅನಿಸ)|ನಾನು\s*ಸಾಯ್ತೀನಿ|ನಾನು\s*ಸಾಯುತ್ತೇನೆ|ಬದುಕಲು\s*ಇಷ್ಟವಿಲ್ಲ|ಜೀವನ\s*ಸಾಕಾಗಿದೆ/u,
];

// Harm at home by the people a child lives with: ಮನೆಯವರು, ಅಜ್ಜ, ಅಣ್ಣ, ಮಾವ, ಚಿಕ್ಕಪ್ಪ, then a blow.
const HOUSEHOLD = "(?:ಮನೆಯವರು|ಮನೆಯವ್ರು|ಅಜ್ಜ|ಅಜ್ಜಿ|ಅಣ್ಣ|ಮಾವ|ಚಿಕ್ಕಪ್ಪ|ದೊಡ್ಡಪ್ಪ|ಮಲತಂದೆ|ಮಲತಾಯಿ)";
// Clapping, a bell, a whistle, rote learning or chatting are not blows (as in patterns@v3).
const NOT_A_BLOW = "(?:ಚಪ್ಪಾಳೆ|ಚಿಟಿಕೆ|ಸೀಟಿ|ಸಿಳ್ಳೆ|ಗಂಟೆ|ಬೆಲ್|ಡೋಲು|ತಮಟೆ|ಉರು|ಬಾಯಿಪಾಠ|ಹರಟೆ|ಬಣ್ಣ|ಸುಣ್ಣ)";
const MORE_CHILD_HARM: RegExp[] = [
  new RegExp(`${HOUSEHOLD}\\S*\\s+(?:(?!${NOT_A_BLOW})\\S+\\s+){0,4}(?:ಹೊಡೀ|ಹೊಡೆ|ಹೊಡಿ|ಹೊಡ್|ಬಡಿ(?!ಸ)|ಬಾರಿಸ|ಸುಡ|ಕಟ್ಟಿ\\s*ಹಾಕ|ಕೂಡಿ\\s*ಹಾಕ)`, "u"),
  /\b(?:grand(?:father|mother|pa|ma)|uncle|elder brother|step(?:father|mother)|relatives?)\s+(?:\S+\s+){0,3}(?:beats?|hits?|burns?|locks?|ties?)\b/iu,
];

export function careFor(text: string): Care | null {
  if (!text.trim()) return null;
  const child = findDisclosures(text).length > 0 || MORE_CHILD_HARM.some((re) => re.test(text));
  const self = findTeacherCrisis(text) || MORE_DESPAIR.some((re) => re.test(text));
  if (child && self) return "both";
  if (child) return "child";
  return self ? "self" : null;
}

/** Childline for a child, Tele MANAS for the speaker; both when both. */
export function helplines(care: Care): Array<"child" | "self"> {
  return care === "both" ? ["child", "self"] : [care];
}
