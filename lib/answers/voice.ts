import type { AdminClient } from "@/lib/supabase/admin";

// The answer read aloud (DESIGN §4 VoicePlayer, docs/AI.md §4): which lines are spoken, in what
// order, and where the one file per answer is kept. Shared by the ask route, which starts the voice
// while the steps are being checked (D86), and /api/answers/[id]/voice, which serves it.

export const VOICE_LANG_CODE = { kn: "kn-IN", en: "en-IN", hi: "hi-IN" } as const;
export type VoiceLang = keyof typeof VOICE_LANG_CODE;

type Tri = { kn: string; en: string; hi?: string | null };

/** One line in the answer's language (Hindi falls back to Kannada where a field has no Hindi). */
export function spokenLine(lang: VoiceLang, t: Tri): string {
  return (lang === "hi" ? t.hi || t.kn : t[lang]).trim();
}

/** A step's spoken line carries its number among the steps she sees. */
export function spokenStep(lang: VoiceLang, step: Tri, index: number): string {
  return `${index + 1}. ${spokenLine(lang, step)}`;
}

/** Title, numbered steps, then why: exactly what the answer page shows, read aloud. */
export function spokenLines(
  lang: VoiceLang,
  a: { title: Tri; steps: Tri[]; why: Tri | null },
): string[] {
  const lines = [spokenLine(lang, a.title), ...a.steps.map((s, i) => spokenStep(lang, s, i))];
  if (a.why) lines.push(spokenLine(lang, a.why));
  return lines.filter((l) => l.replace(/^\d+\.\s*/, "").length > 0);
}

/** The file's place in the private `answers` bucket. */
export function voicePath(answerId: string): string {
  return `${answerId}.mp3`;
}

/** Keeps the spoken answer and points the answer at it; false if either write failed. */
export async function storeAnswerVoice(
  admin: AdminClient,
  answerId: string,
  audio: Uint8Array,
  mime: string,
): Promise<boolean> {
  const path = voicePath(answerId);
  const up = await admin.storage
    .from("answers")
    .upload(path, audio, { contentType: mime, upsert: true });
  if (up.error) return false;
  const { error } = await admin.from("answers").update({ audio_path: path }).eq("id", answerId);
  return !error;
}
