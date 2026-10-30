import { z } from "zod";

// Foundational literacy and numeracy vocabulary shared by the AI roles and the UI. Plain data: no
// server imports, so client components can use the labels too.

export type Bilingual = { kn: string; en: string };

export const FLN_TOPICS = [
  "letters",
  "reading",
  "writing",
  "oral_language",
  "number_sense",
  "operations",
  "multi_level",
  "engagement",
  "home_language",
  "parents",
  "classroom",
  "other",
] as const;

export const FlnTopic = z.enum(FLN_TOPICS);
export type FlnTopic = z.infer<typeof FlnTopic>;

export const FLN_TOPIC_LABELS: Record<FlnTopic, Bilingual> = {
  letters: { kn: "ಅಕ್ಷರ ಗುರುತು", en: "Letter sounds" },
  reading: { kn: "ಓದು", en: "Reading" },
  writing: { kn: "ಬರವಣಿಗೆ", en: "Writing" },
  oral_language: { kn: "ಮಾತು", en: "Speaking and listening" },
  number_sense: { kn: "ಸಂಖ್ಯೆ ಜ್ಞಾನ", en: "Number sense" },
  operations: { kn: "ಲೆಕ್ಕ", en: "Adding and taking away" },
  multi_level: { kn: "ಬಹು ಹಂತದ ತರಗತಿ", en: "Multi level class" },
  engagement: { kn: "ಹಾಜರಿ ಮತ್ತು ಆಸಕ್ತಿ", en: "Attendance and interest" },
  home_language: { kn: "ಮನೆ ಭಾಷೆ", en: "Home language" },
  parents: { kn: "ಪೋಷಕರು ಮತ್ತು ಸಮುದಾಯ", en: "Parents and community" },
  classroom: { kn: "ತರಗತಿ ನಿರ್ವಹಣೆ", en: "Running the classroom" },
  other: { kn: "ಇತರೆ", en: "Other" },
};

export const SUBJECTS = ["kannada", "maths", "english", "evs", "general"] as const;
export const Subject = z.enum(SUBJECTS);
export type Subject = z.infer<typeof Subject>;

export const SUBJECT_LABELS: Record<Subject, Bilingual> = {
  kannada: { kn: "ಕನ್ನಡ", en: "Kannada" },
  maths: { kn: "ಗಣಿತ", en: "Maths" },
  english: { kn: "ಇಂಗ್ಲಿಷ್", en: "English" },
  evs: { kn: "ಪರಿಸರ ಅಧ್ಯಯನ", en: "Environmental studies" },
  general: { kn: "ಎಲ್ಲಾ ವಿಷಯ", en: "Any subject" },
};

export const GRADE_BANDS = ["1", "2", "3", "1-2", "1-3", "any"] as const;
export const GradeBand = z.enum(GRADE_BANDS);
export type GradeBand = z.infer<typeof GradeBand>;

export const GRADE_BAND_LABELS: Record<GradeBand, Bilingual> = {
  "1": { kn: "1ನೇ ತರಗತಿ", en: "Class 1" },
  "2": { kn: "2ನೇ ತರಗತಿ", en: "Class 2" },
  "3": { kn: "3ನೇ ತರಗತಿ", en: "Class 3" },
  "1-2": { kn: "1 ಮತ್ತು 2ನೇ ತರಗತಿ", en: "Classes 1 and 2" },
  "1-3": { kn: "1 ರಿಂದ 3ನೇ ತರಗತಿ", en: "Classes 1 to 3" },
  any: { kn: "ಎಲ್ಲಾ ತರಗತಿ", en: "Any class" },
};
