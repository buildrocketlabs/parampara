import { z } from "zod";
import { getSessionFor } from "@/lib/auth/session";
import { hasSarvam } from "@/lib/env";
import { json } from "@/lib/import/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { sayTrusted, serverTalkKey } from "@/lib/talk/sign";
import { allowSay, SAY_MAX_CHARS, sayCached, speakCallsToday, voiceDailyCap } from "@/lib/talk/voice";

// Hanate says one of her questions aloud (Bulbul, docs/AI.md §2 speak). Masters and reviewers only,
// and only a line the server wrote: the interview guide's own, or a question /turns/next signed.
// Made once per line and voice, cached in the private answers bucket, served as a short lived
// signed link; rate limited per person and capped per day. Without Sarvam it says so, and the
// page reads the question aloud with the phone's own voice, or asks the helper to.
export const maxDuration = 30;

const Body = z.object({
  text: z.string().trim().min(1).max(SAY_MAX_CHARS),
  token: z.string().max(128).optional(),
});

export async function POST(req: Request) {
  const session = await getSessionFor("reviewer", "master");
  if (!session) return json({ error: "sign_in_needed" }, 401);
  const db = createAdminClient();
  if (!db) return json({ error: "not_configured" }, 503);
  if (!hasSarvam()) return json({ error: "speech_not_configured" }, 503);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "invalid" }, 400);
  if (!sayTrusted(serverTalkKey(), body.data.text, body.data.token)) return json({ error: "not_allowed" }, 403);
  if (!allowSay(session.userId)) return json({ error: "rate_limited", retryAfterMs: 60_000 }, 429);
  if ((await speakCallsToday(db)) >= voiceDailyCap()) return json({ error: "budget" }, 429);
  try {
    const { url } = await sayCached(db, body.data.text);
    return json({ url });
  } catch (err) {
    const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;
    if (typeof retryAfterMs === "number") return json({ error: "rate_limited", retryAfterMs }, 429);
    if ((err as Error).name === "SpeechNotConfigured") return json({ error: "speech_not_configured" }, 503);
    return json({ error: "speech_failed" }, 502);
  }
}
