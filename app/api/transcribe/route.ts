import { getActiveSession } from "@/lib/auth/session";
import { readCaps } from "@/ai/budget";
import { askAi } from "@/lib/ask/deps";
import { allowTranscription } from "@/lib/ask/limits";
import { json } from "@/lib/import/http";

// Voice question → words, for the "Did you mean…?" check before asking (DESIGN §8 /t/ask).
// The words go back only to the teacher who spoke them; nothing is stored here.
export const maxDuration = 30;
const MAX_WAV_BYTES = 1_200_000;

export async function POST(req: Request) {
  const session = await getActiveSession();
  if (!session) return json({ error: "sign_in_needed" }, 401);
  if (session.role !== "teacher") return json({ error: "teachers_only" }, 403);
  if (!allowTranscription(session.userId, 2 * readCaps().questionsPerSessionPerHour)) {
    return json({ error: "rate_limited", retryAfterMs: 600_000 }, 429);
  }
  const ai = askAi();
  if (!ai) return json({ error: "ai_not_ready" }, 503);
  const wav = new Uint8Array(await req.arrayBuffer());
  if (wav.byteLength === 0 || wav.byteLength > MAX_WAV_BYTES)
    return json({ error: "too_large" }, 413);
  try {
    const lang = new URL(req.url).searchParams.get("lang");
    const { text } = await ai.transcribe(wav, {
      traceId: crypto.randomUUID(),
      lang: lang === "en" || lang === "hi" ? lang : "kn",
    });
    return json({ text: text.trim() });
  } catch (err) {
    const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;
    if (typeof retryAfterMs === "number") return json({ error: "rate_limited", retryAfterMs }, 429);
    return json({ error: "speech_failed" }, 502);
  }
}
