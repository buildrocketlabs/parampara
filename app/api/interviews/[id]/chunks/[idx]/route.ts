import { wavDurationMs } from "@/lib/audio/wav";
import { importAi } from "@/lib/import/deps";
import { importContext, interviewFor, json, traceIdFor } from "@/lib/import/http";
import { keepChunkWav } from "@/lib/import/clips";
import { PipelineError, transcribeChunk } from "@/lib/import/pipeline";

// One chunk of the recording (16 kHz mono WAV, under 30 s, under 1 MB) → speech to text →
// redaction → segments. The chunk is kept only until extraction cuts the teachers' quote clips, then
// removed (lib/import/clips.ts, D39 as amended 24 Oct).
const MAX_CHUNK_BYTES = 1_200_000;

export const maxDuration = 60;

export async function PUT(req: Request, ctx: RouteContext<"/api/interviews/[id]/chunks/[idx]">) {
  const c = await importContext();
  if (c instanceof Response) return c;
  const { id, idx: rawIdx } = await ctx.params;
  const idx = Number(rawIdx);
  if (!Number.isInteger(idx) || idx < 0) return json({ error: "not_found" }, 404);
  const found = await interviewFor(c, id);
  if (found instanceof Response) return found;
  const ai = importAi();
  if (!ai) return json({ error: "ai_not_ready" }, 503);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_CHUNK_BYTES) return json({ error: "too_large" }, 413);
  const wav = new Uint8Array(await req.arrayBuffer());
  if (wav.byteLength === 0 || wav.byteLength > MAX_CHUNK_BYTES)
    return json({ error: "too_large" }, 413);
  let durationMs: number;
  try {
    durationMs = wavDurationMs(wav);
  } catch {
    return json({ error: "not_wav" }, 415);
  }

  try {
    const result = await transcribeChunk(ai, c.store, {
      interview: found.interview,
      idx,
      wav,
      wavDurationMs: durationMs,
      traceId: traceIdFor(id),
    });
    // Kept only until extraction cuts the quote clips (lib/import/clips.ts); never played whole.
    if (result.status === "transcribed") await keepChunkWav(c.db, id, idx, wav).catch(() => {});
    return json(result);
  } catch (err) {
    if (err instanceof PipelineError) {
      const status = {
        not_found: 404,
        mismatch: 409,
        retry_later: 503,
        gave_up: 422,
        wrong_phase: 409,
      }[err.kind];
      return json({ error: err.kind }, status);
    }
    // Speech service rate limit (60 a minute, D40): tell the page when to try again.
    const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;
    if (typeof retryAfterMs === "number") {
      return json({ error: "rate_limited", retryAfterMs }, 429, {
        "retry-after": String(Math.ceil(retryAfterMs / 1000)),
      });
    }
    if ((err as Error).name === "SpeechNotConfigured")
      return json({ error: "speech_not_configured" }, 503);
    return json({ error: "speech_failed" }, 502);
  }
}
