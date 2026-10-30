import { encodeWav16, parseWav } from "@/lib/audio/wav";
import type { AdminClient } from "@/lib/supabase/admin";

// "Hear it from the master" plays exactly the quoted seconds, nothing more (safety audit, 24 Oct).
// A signed URL of the whole original would let a teacher hear every name spoken in it, so teachers
// get a separate clip file per quoted moment. The chunk WAVs that pass through speech to text are
// kept only until extraction finishes, the quote clips are cut from them, then they are removed.
// Reviewers and the master still hear the full original (they may hear everything).

const BUCKET = "interviews";

export const chunkPath = (interviewId: string, idx: number) => `${interviewId}/chunks/${idx}.wav`;
export const clipPath = (interviewId: string, segmentId: number) =>
  `${interviewId}/clips/${segmentId}.wav`;

export async function keepChunkWav(
  db: AdminClient,
  interviewId: string,
  idx: number,
  wav: Uint8Array,
) {
  await db.storage
    .from(BUCKET)
    .upload(chunkPath(interviewId, idx), wav, { contentType: "audio/wav", upsert: true });
}

/** Cuts one clip per card quote (only moments where no name was spoken). Returns how many. */
export async function makeQuoteClips(db: AdminClient, interviewId: string): Promise<number> {
  const { data: cards } = await db
    .from("cards")
    .select("quote_segment_id")
    .eq("interview_id", interviewId)
    .not("quote_segment_id", "is", null);
  const ids = [...new Set((cards ?? []).map((c) => Number(c.quote_segment_id)))];
  if (ids.length === 0) return 0;
  const { data: segs } = await db
    .from("segments")
    .select("id, chunk_idx, start_ms, end_ms, redacted")
    .in("id", ids)
    .eq("redacted", false);
  const { data: chunks } = await db
    .from("audio_chunks")
    .select("idx, start_ms")
    .eq("interview_id", interviewId);
  const chunkStart = new Map((chunks ?? []).map((c) => [c.idx as number, c.start_ms as number]));
  const bucket = db.storage.from(BUCKET);
  const cache = new Map<number, ReturnType<typeof parseWav> | null>();
  let made = 0;
  for (const s of segs ?? []) {
    const idx = s.chunk_idx as number | null;
    if (idx == null || !chunkStart.has(idx)) continue;
    if (!cache.has(idx)) {
      const { data } = await bucket.download(chunkPath(interviewId, idx));
      cache.set(idx, data ? parseWav(new Uint8Array(await data.arrayBuffer())) : null);
    }
    const wav = cache.get(idx);
    if (!wav) continue;
    const clip = cutClip(wav, chunkStart.get(idx)!, s.start_ms as number, s.end_ms as number);
    if (!clip) continue;
    const up = await bucket.upload(clipPath(interviewId, Number(s.id)), clip, {
      contentType: "audio/wav",
      upsert: true,
    });
    if (!up.error) made++;
  }
  return made;
}

/** The samples of one moment, cut from its chunk; null when it is too short to be worth a clip. */
export function cutClip(
  wav: { sampleRate: number; samples: Float32Array },
  chunkStartMs: number,
  startMs: number,
  endMs: number,
): Uint8Array | null {
  const perMs = wav.sampleRate / 1000;
  const from = Math.max(0, Math.floor((startMs - chunkStartMs) * perMs));
  const to = Math.min(wav.samples.length, Math.ceil((endMs - chunkStartMs) * perMs));
  if (to - from < perMs * 300) return null; // under 0.3 s
  return encodeWav16(wav.samples.subarray(from, to), wav.sampleRate);
}

/** The chunk WAVs are a transient copy: remove them once the clips are cut (free storage, D39). */
export async function dropChunkWavs(db: AdminClient, interviewId: string) {
  const bucket = db.storage.from(BUCKET);
  const { data } = await bucket.list(`${interviewId}/chunks`, { limit: 1000 });
  const paths = (data ?? []).map((o) => `${interviewId}/chunks/${o.name}`);
  for (let i = 0; i < paths.length; i += 100) await bucket.remove(paths.slice(i, i + 100));
}
