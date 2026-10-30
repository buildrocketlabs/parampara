import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Session } from "@/lib/auth/session";
import type { AdminClient } from "@/lib/supabase/admin";
import { canImportFor, maxImportMs, type MasterAccess } from "./access";

// Starts an import: the browser has already decoded and cut the recording (lib/audio) and sends the
// plan. We store the plan (interview, parts, chunks) and hand back signed upload tokens for the
// original parts so "Hear it from the master" can play the real voice later (D39).

/** Supabase Free stops any single upload at 50 MB (D39). */
export const STORAGE_PART_MAX_BYTES = 50 * 1024 * 1024;
/** Sarvam REST takes 30 s per request; the browser cuts at 29 s at most (D25, lib/audio/split). */
export const CHUNK_MAX_MS = 29_500;
const TIMELINE_TOLERANCE_MS = 1_000;

export const CONSENT_TEXT_KN_V1 =
  "ಪರಂಪರೆಯ ತಂಡವು ನನ್ನ ಬೋಧನಾ ಅನುಭವಗಳನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡಲು ಮತ್ತು ನನ್ನ ಹೆಸರಿನೊಂದಿಗೆ ಇತರ ಶಿಕ್ಷಕರ ಜೊತೆ ಹಂಚಿಕೊಳ್ಳಲು ನಾನು ಒಪ್ಪಿಗೆ ನೀಡುತ್ತೇನೆ. ಮಕ್ಕಳ ಹೆಸರುಗಳನ್ನು ನಾನು ಹೇಳುವುದಿಲ್ಲ. ಯಾವಾಗ ಬೇಕಾದರೂ ನಾನು ಈ ಒಪ್ಪಿಗೆಯನ್ನು ಹಿಂಪಡೆಯಬಹುದು ಎಂದು ನನಗೆ ತಿಳಿದಿದೆ.";

const FileMeta = z.object({
  name: z.string().trim().min(1).max(200),
  mime: z.string().trim().max(80),
  bytes: z.number().int().positive(),
});

export const CreateInterviewSchema = z.object({
  masterId: z.uuid(),
  title: z.string().trim().max(120).optional(),
  consent: z.object({
    // first_note: the first part is a WhatsApp note holding only the consent (F-A1). It is stored
    // and counts as consent like in_recording (D53), and it is kept out of card extraction.
    mode: z.enum(["in_recording", "first_note", "separate_clip", "recorded_earlier"]),
    clip: FileMeta.optional(),
  }),
  parts: z
    .array(FileMeta.extend({ durationMs: z.number().int().positive() }))
    .min(1)
    .max(40),
  chunks: z
    .array(
      z.object({
        idx: z.number().int().min(0),
        startMs: z.number().int().min(0),
        endMs: z.number().int().positive(),
        silent: z.boolean(),
      }),
    )
    .min(1)
    .max(2000),
});
export type CreateInterviewInput = z.infer<typeof CreateInterviewSchema>;

export type CreateResult =
  | {
      ok: true;
      interviewId: string;
      uploads: Array<{ part: number; path: string; token: string } | null>;
      consentUpload: { path: string; token: string } | null;
    }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

/** The chunk plan must cover the parts exactly: contiguous, in order, each under the speech limit. */
export function checkPlan(input: CreateInterviewInput, maxMs: number): string | null {
  const total = input.parts.reduce((a, p) => a + p.durationMs, 0);
  if (total > maxMs) return "too_long";
  let cursor = 0;
  for (const [i, c] of input.chunks.entries()) {
    if (c.idx !== i) return "chunk_order";
    if (Math.abs(c.startMs - cursor) > 1) return "chunk_gap";
    if (c.endMs <= c.startMs || c.endMs - c.startMs > CHUNK_MAX_MS) return "chunk_length";
    cursor = c.endMs;
  }
  if (Math.abs(cursor - total) > TIMELINE_TOLERANCE_MS) return "timeline_mismatch";
  if (input.chunks.every((c) => c.silent)) return "no_speech";
  if (input.consent.mode === "first_note") {
    // A consent note alone has nothing to learn from, and a silent one holds no consent.
    if (input.parts.length < 2) return "first_note_alone";
    const consentEnd = input.parts[0]!.durationMs;
    const consentChunks = input.chunks.filter((c) => c.startMs < consentEnd);
    if (consentChunks.every((c) => c.silent)) return "consent_silent";
    if (input.chunks.filter((c) => c.startMs >= consentEnd).every((c) => c.silent))
      return "no_speech";
  }
  return null;
}

function extension(name: string, mime: string): string {
  const fromName = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("ogg") || mime.includes("opus")) return "ogg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("wav")) return "wav";
  return "bin";
}

export async function createInterview(
  db: AdminClient,
  session: Session,
  master: MasterAccess & { consentedAt: string | null },
  input: CreateInterviewInput,
): Promise<CreateResult> {
  if (!canImportFor(session, master)) return { ok: false, status: 403, error: "not_allowed" };
  const planError = checkPlan(input, maxImportMs(session));
  if (planError) return { ok: false, status: 400, error: planError };
  if (input.consent.mode === "recorded_earlier" && !master.consentedAt) {
    return { ok: false, status: 409, error: "consent_missing" };
  }
  if (input.consent.mode === "separate_clip" && !input.consent.clip) {
    return { ok: false, status: 400, error: "consent_clip_missing" };
  }
  // Consent in the recording is only kept if that part can be stored (50 MB, D39).
  const consentInFirstPart =
    input.consent.mode === "in_recording" || input.consent.mode === "first_note";
  if (consentInFirstPart && !master.consentedAt && input.parts[0]!.bytes > STORAGE_PART_MAX_BYTES) {
    return { ok: false, status: 400, error: "consent_part_too_large" };
  }

  const id = randomUUID();
  let start = 0;
  const parts = input.parts.map((p, n) => {
    const row = {
      path: `${id}/part-${n}.${extension(p.name, p.mime)}`,
      name: p.name,
      mime: p.mime || "application/octet-stream",
      bytes: p.bytes,
      start_ms: start,
      duration_ms: p.durationMs,
      storable: p.bytes <= STORAGE_PART_MAX_BYTES,
      stored: false,
      // Kept out of card extraction (consentOnlyEndMs in store.ts); its words stay on the timeline.
      ...(n === 0 && input.consent.mode === "first_note" ? { consent_only: true } : {}),
    };
    start += p.durationMs;
    return row;
  });

  const { error: ivErr } = await db.from("interviews").insert({
    id,
    master_id: master.id,
    status: "transcribing",
    source: "import",
    title: input.title ?? null,
    parts,
    duration_ms: start,
    chunk_count: input.chunks.length,
    created_by: session.source === "supabase" ? session.userId : null,
    is_sample: master.isSample,
    started_at: new Date().toISOString(),
  });
  if (ivErr) throw new Error(`create interview failed (${ivErr.code})`);

  const { error: chErr } = await db.from("audio_chunks").insert(
    input.chunks.map((c) => ({
      interview_id: id,
      idx: c.idx,
      start_ms: c.startMs,
      end_ms: c.endMs,
      status: c.silent ? "silent" : "pending",
    })),
  );
  if (chErr) {
    await db.from("interviews").delete().eq("id", id);
    throw new Error(`create chunks failed (${chErr.code})`);
  }

  const bucket = db.storage.from("interviews");
  const uploads = await Promise.all(
    parts.map(async (p, n) => {
      if (!p.storable) return null;
      const { data } = await bucket.createSignedUploadUrl(p.path, { upsert: true });
      return data ? { part: n, path: p.path, token: data.token } : null;
    }),
  );

  let consentUpload: { path: string; token: string } | null = null;
  let consentPath: string | null = null;
  if (input.consent.mode === "separate_clip" && input.consent.clip) {
    consentPath = `${id}/consent.${extension(input.consent.clip.name, input.consent.clip.mime)}`;
    const { data } = await bucket.createSignedUploadUrl(consentPath, { upsert: true });
    if (data) consentUpload = { path: consentPath, token: data.token };
  } else if (consentInFirstPart) {
    consentPath = parts[0]!.path;
  }
  if (consentPath && !master.consentedAt) {
    // Where the consent will be heard. It counts as consent (consented_at) only once that audio is
    // verified in storage (markConsentIfStored), never on the promise of an upload (M4 audit).
    await db
      .from("masters")
      .update({ consent_audio_path: consentPath, consent_text_kn: CONSENT_TEXT_KN_V1 })
      .eq("id", master.id);
  }

  return { ok: true, interviewId: id, uploads, consentUpload };
}

/**
 * Records a master's consent once the audio that holds it is really in storage: the part with the
 * consent line, or the separate consent clip. Returns whether consent is now on record.
 */
export async function markConsentIfStored(
  db: AdminClient,
  masterId: string,
  storedPath: string,
): Promise<boolean> {
  const { data: m } = await db
    .from("masters")
    .select("consented_at, consent_audio_path")
    .eq("id", masterId)
    .maybeSingle();
  if (!m) return false;
  if (m.consented_at) return true;
  if (m.consent_audio_path !== storedPath) return false;
  const dir = storedPath.slice(0, storedPath.lastIndexOf("/"));
  const file = storedPath.slice(storedPath.lastIndexOf("/") + 1);
  const { data: listed } = await db.storage.from("interviews").list(dir, { search: file });
  if (!listed?.some((o) => o.name === file)) return false;
  await db
    .from("masters")
    .update({ consented_at: new Date().toISOString() })
    .eq("id", masterId)
    .is("consented_at", null);
  return true;
}
