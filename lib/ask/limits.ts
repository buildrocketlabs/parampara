import { createHmac } from "node:crypto";

// Small server side helpers for the teacher's question routes.

/**
 * A keyed, one way hash for replaying the very same question (lib/ask/pipeline.ts AskInput.rawKey).
 * The key is a server secret, so the stored value cannot be turned back into words or brute forced
 * from a list of likely questions without it.
 */
export function rawKeyHasher(
  secret: string | undefined,
): ((normalised: string) => string) | undefined {
  if (!secret) return undefined;
  return (normalised) => createHmac("sha256", secret).update(normalised).digest("hex");
}

/**
 * Per instance limit on speech to text calls per person per hour. Serverless instances do not share
 * memory, so this is a brake on bursts, not an exact cap; questions themselves are capped in the
 * database (docs/AI.md §7).
 */
const seen = new Map<string, number[]>();
export function allowTranscription(userId: string, perHour: number, now = Date.now()): boolean {
  const recent = (seen.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= perHour) {
    seen.set(userId, recent);
    return false;
  }
  recent.push(now);
  seen.set(userId, recent);
  return true;
}

/**
 * Fresh (not replayed) questions allowed per account per hour. The one tap demo teacher is a single
 * account that every juror shares, so the per person cap (30, D14) would lock all of them out at
 * once after a busy hour. Sample accounts get a larger shared allowance instead; the total and daily
 * dollar caps still bound the spend (D95).
 */
export const SAMPLE_QUESTIONS_PER_HOUR_DEFAULT = 150;
export function questionsPerHourFor(
  isSample: boolean,
  perPerson: number,
  env: Record<string, string | undefined> = process.env,
): number {
  if (!isSample) return perPerson;
  const n = Number(env.AI_SAMPLE_QUESTIONS_PER_HOUR);
  const shared = Number.isInteger(n) && n > 0 ? n : SAMPLE_QUESTIONS_PER_HOUR_DEFAULT;
  return Math.max(perPerson, shared);
}
