import { createHash } from "node:crypto";
import { SPEAK_VOICE_ID, speak } from "@/ai";
import type { AdminClient } from "@/lib/supabase/admin";

// Hanate's voice for a line of Kannada (Bulbul via @/ai). Each line is made once and kept in the
// private answers bucket under the hash of the voice and the text; every later request gets a short
// lived signed link to the same file. Sarvam bills per character, so the cache is the budget. Only
// lines the server wrote can be said (lib/talk/sign sayTrusted), so the route is not a free speaker.

export const SAY_MAX_CHARS = 600;
const LINK_SECONDS = 60 * 60;

/** Every talk voice line is logged under this trace, so its daily cap is its own, not the teachers'. */
export const TALK_VOICE_TRACE = "7a1c0000-0000-4000-8000-000000000001";

export function voicePath(text: string): string {
  const hash = createHash("sha256").update(`${SPEAK_VOICE_ID}\n${text.trim()}`).digest("hex");
  return `voice/${hash}.mp3`;
}

export async function sayCached(db: AdminClient, text: string): Promise<{ url: string; made: boolean }> {
  const path = voicePath(text);
  const bucket = db.storage.from("answers");
  const existing = await bucket.createSignedUrl(path, LINK_SECONDS);
  if (existing.data?.signedUrl) return { url: existing.data.signedUrl, made: false };
  const { audio, mime } = await speak(text.trim(), { codec: "mp3", traceId: TALK_VOICE_TRACE });
  const up = await bucket.upload(path, audio, { contentType: mime, upsert: true });
  if (up.error) throw new Error(`voice upload failed (${up.error.message.slice(0, 40)})`);
  const made = await bucket.createSignedUrl(path, LINK_SECONDS);
  if (!made.data?.signedUrl) throw new Error("voice link failed");
  return { url: made.data.signedUrl, made: true };
}

/** In this server instance: no one person asks for more than this many lines in ten minutes. */
const WINDOW_MS = 10 * 60_000;
const PER_PERSON = 40;
const recent = new Map<string, number[]>();

export function allowSay(userId: string, now = Date.now()): boolean {
  const times = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= PER_PERSON) {
    recent.set(userId, times);
    return false;
  }
  times.push(now);
  recent.set(userId, times);
  return true;
}

const IST_OFFSET_MS = 330 * 60_000;
/** New talk voice lines a day across the whole deployment (Sarvam is billed separately, Law 10). */
export function voiceDailyCap(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.TALK_VOICE_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? n : 2_000;
}

/** Talk voice lines made today (IST), counted in the database so every server instance agrees. */
export async function speakCallsToday(db: AdminClient, now = Date.now()): Promise<number> {
  const shifted = now + IST_OFFSET_MS;
  const dayStart = new Date(shifted - (shifted % 86_400_000) - IST_OFFSET_MS).toISOString();
  const { count } = await db
    .from("ai_calls")
    .select("id", { count: "exact", head: true })
    .eq("role", "speak")
    .eq("trace_id", TALK_VOICE_TRACE)
    .gte("created_at", dayStart);
  return count ?? 0;
}
