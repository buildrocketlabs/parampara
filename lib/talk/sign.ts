import { createHmac, timingSafeEqual } from "node:crypto";
import type { InterviewTopic } from "@/lib/domain/interview";
import { isScriptedLine, isScriptedQuestion } from "./script";

// Hanate's questions are stored as the interviewer's words, so the server only stores (and only
// says aloud) a question it wrote itself: one of the interview guide's own lines, or a model
// question it signed in /turns/next after the interviewer's rules passed (M4 safety audit, 24 Oct).
// The key is derived from a server secret with a purpose label, so it signs nothing else. Server only.

export type SignedQuestion = { kn: string; en: string; topic: InterviewTopic; probe: boolean };

const PURPOSE = "parampara/talk-question/v1";

export function talkKey(secret: string | undefined): Buffer | null {
  if (!secret) return null;
  return createHmac("sha256", secret).update(PURPOSE).digest();
}

/** The deployment's key for talk signatures (the service role key never leaves the server). */
export function serverTalkKey(): Buffer | null {
  return talkKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function mac(key: Buffer, parts: string[]): string {
  return createHmac("sha256", key).update(parts.join("\u0000")).digest("hex");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === 32 && y.length === 32 && timingSafeEqual(x, y);
}

export function signQuestion(key: Buffer, interviewId: string, q: SignedQuestion): string {
  return mac(key, ["q", interviewId, q.topic, String(q.probe), q.kn.trim(), q.en.trim()]);
}

/** A question the server may store: the guide's own words, or one it signed for this interview. */
export function questionTrusted(key: Buffer | null, interviewId: string, q: SignedQuestion, sig: string | undefined): boolean {
  if (isScriptedQuestion(q)) return true;
  if (!key || !sig) return false;
  return same(sig, signQuestion(key, interviewId, q));
}

/** Lets /api/voice/say make Hanate's voice for this exact line, and nothing else. */
export function signSay(key: Buffer, kn: string): string {
  return mac(key, ["say", kn.trim()]);
}

export function sayTrusted(key: Buffer | null, kn: string, token: string | undefined): boolean {
  if (isScriptedLine(kn)) return true;
  if (!key || !token) return false;
  return same(token, signSay(key, kn));
}
