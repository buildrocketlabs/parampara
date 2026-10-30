import { z } from "zod";
import type { Session } from "@/lib/auth/session";
import { InterviewTopic, MAX_QUESTIONS, type InterviewTopic as Topic } from "@/lib/domain/interview";
import { canImportFor, type MasterAccess } from "@/lib/import/access";
import { CHUNK_MAX_MS, CONSENT_TEXT_KN_V1, STORAGE_PART_MAX_BYTES } from "@/lib/import/create";
import type { RedactedPhrase } from "@/lib/import/types";
import type { AdminClient } from "@/lib/supabase/admin";
import { careFor, type Care } from "./care";

// One live interview (docs/BUILD.md M4.3), built turn by turn. The consent recording is part 0;
// every answer after it is one more part laid at the current end of the timeline, with its chunk
// plan, so the same pipeline (chunks → speech → redaction → segments → extraction) serves it.
//
// Each turn reserves one "slot" chunk index before its audio chunks. Hanate's question is stored
// there as an interviewer segment (and a typed answer's redacted lines after it), so segments
// stay in conversation order: idx = slot * 1000 + n, and audio chunk c holds idx c * 1000 + n.
// Nothing raw is stored: typed answers are redacted before they are written (Law 5). Only questions
// the server wrote are stored as Hanate's (lib/talk/sign.ts), and only after consent is on record.

export const SLOT_SIZE = 1000;
/** One answer is up to a few minutes; the recorder stops itself at this (lib/talk/client). */
export const MAX_TURN_MS = 6 * 60_000;
const TIMELINE_TOLERANCE_MS = 1_000;
/** The consent line takes a while to say; a shorter or silent clip is not consent. */
export const CONSENT_MIN_MS = 5_000;
/** Five seconds of compressed speech is well over this; an empty or token upload is under it. */
export const CONSENT_MIN_BYTES = 8_000;
/** One redaction call's worth of a typed answer, so the redactor's output never runs out. */
const REDACT_BATCH_CHARS = 1_200;
/** The consent part plus every question the session may ask. */
const MAX_PARTS = MAX_QUESTIONS + 1;

const FileMeta = z.object({
  name: z.string().trim().min(1).max(200),
  mime: z.string().trim().max(80),
  bytes: z.number().int().positive(),
});

const Audio = FileMeta.extend({
  durationMs: z.number().int().positive().max(MAX_TURN_MS),
  chunks: z
    .array(z.object({ startMs: z.number().int().min(0), endMs: z.number().int().positive(), silent: z.boolean() }))
    .min(1)
    .max(40),
});
export type TurnAudio = z.infer<typeof Audio>;

const Question = z.object({
  kn: z.string().trim().min(1).max(600),
  en: z.string().trim().min(1).max(500),
  topic: InterviewTopic,
  probe: z.boolean(),
  /** The server's signature from /turns/next; the guide's own lines need none. */
  sig: z.string().max(128).optional(),
});
export type TurnQuestion = z.infer<typeof Question>;

export const TurnBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("consent"), turnId: z.uuid(), masterId: z.uuid(), audio: Audio.nullable() }),
  z.object({ kind: z.literal("answer"), turnId: z.uuid(), question: Question, audio: Audio }),
  z.object({ kind: z.literal("typed"), turnId: z.uuid(), question: Question, text: z.string().trim().min(1).max(4_000) }),
  /** The master chose to skip this question: kept, so a reopened talk knows it was asked. */
  z.object({ kind: z.literal("skip"), turnId: z.uuid(), question: Question }),
]);
export type TurnBody = z.infer<typeof TurnBody>;

/** What each part of a live interview remembers about its turn (stored in interviews.parts). */
export type PartMeta = {
  path: string | null;
  name: string;
  mime: string;
  bytes: number;
  start_ms: number;
  duration_ms: number;
  storable: boolean;
  stored: boolean;
  kind: "consent" | "answer" | "typed" | "skip";
  /** When the part was added: a reopened talk counts the time spent talking, not the breaks. */
  at?: string;
  turn_id: string;
  slot: number;
  chunk_from: number;
  chunk_to: number;
  topic?: Topic;
  probe?: boolean;
  question_kn?: string;
  question_en?: string;
  /** The answer spoke of a child in danger, or of the master's own despair (lib/talk/care). */
  care?: Care;
};

export class TurnError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 413 | 503,
  ) {
    super(code);
    this.name = "TurnError";
  }
}

// ── Pure helpers (unit tested) ──────────────────────────────────────────────

/** The turn's own chunk plan: contiguous from 0, each under the speech limit, covering the audio. */
export function checkTurnChunks(audio: TurnAudio): string | null {
  let cursor = 0;
  for (const c of audio.chunks) {
    if (Math.abs(c.startMs - cursor) > 1) return "chunk_gap";
    if (c.endMs <= c.startMs || c.endMs - c.startMs > CHUNK_MAX_MS) return "chunk_length";
    cursor = c.endMs;
  }
  if (Math.abs(cursor - audio.durationMs) > TIMELINE_TOLERANCE_MS) return "timeline_mismatch";
  return null;
}

export type SlotPlan = {
  slot: number;
  startMs: number;
  chunkRows: Array<{ idx: number; start_ms: number; end_ms: number; status: "pending" | "silent" }>;
  nextChunkCount: number;
  nextDurationMs: number;
};

/**
 * Where a turn goes: its slot is the next chunk index, its audio chunks follow, all shifted to the
 * current end of the timeline. Without speech to text, chunks are stored as silent so extraction
 * is not held up; the audio itself is still kept.
 */
export function planSlot(current: { durationMs: number; chunkCount: number }, audio: TurnAudio | null, speechReady: boolean): SlotPlan {
  const slot = current.chunkCount;
  const startMs = current.durationMs;
  const chunkRows = (audio?.chunks ?? []).map((c, k) => ({
    idx: slot + 1 + k,
    start_ms: startMs + c.startMs,
    end_ms: startMs + c.endMs,
    status: (c.silent || !speechReady ? "silent" : "pending") as "pending" | "silent",
  }));
  return {
    slot,
    startMs,
    chunkRows,
    nextChunkCount: slot + 1 + chunkRows.length,
    nextDurationMs: startMs + (audio?.durationMs ?? 0),
  };
}

/**
 * A typed answer as phrases for the redactor: whole sentences joined up to 400 characters, a longer
 * sentence split, so every word of a 4,000 character answer is kept (at most about 20 phrases).
 */
export function typedPhrases(text: string, atMs: number): Array<{ startMs: number; endMs: number; text: string }> {
  const sentences = text
    .split(/\n+/)
    .flatMap((line) => line.match(/[^.!?।]+[.!?।]*/gu) ?? [])
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
  const out: string[] = [];
  let current = "";
  for (const s of sentences) {
    for (let i = 0; i < s.length; i += PHRASE_CHARS) {
      const piece = s.slice(i, i + PHRASE_CHARS);
      if (current && current.length + 1 + piece.length > PHRASE_CHARS) {
        out.push(current);
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
  }
  if (current) out.push(current);
  return out.map((t) => ({ startMs: atMs, endMs: atMs, text: t }));
}
const PHRASE_CHARS = 400;

function extension(name: string, mime: string): string {
  const fromName = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg") || mime.includes("opus")) return "ogg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("wav")) return "wav";
  return "bin";
}

export function partFor(
  interviewId: string,
  n: number,
  body: TurnBody,
  plan: SlotPlan,
): PartMeta {
  const audio = body.kind === "typed" || body.kind === "skip" ? null : body.audio;
  const question = body.kind === "consent" ? undefined : body.question;
  return {
    path: audio ? `${interviewId}/part-${n}.${extension(audio.name, audio.mime)}` : null,
    name: audio?.name ?? `${body.kind}-${n}`,
    mime: audio?.mime || (audio ? "application/octet-stream" : "text/plain"),
    bytes: audio?.bytes ?? 0,
    start_ms: plan.startMs,
    duration_ms: audio?.durationMs ?? 0,
    storable: Boolean(audio && audio.bytes <= STORAGE_PART_MAX_BYTES),
    stored: false,
    kind: body.kind,
    turn_id: body.turnId,
    slot: plan.slot,
    chunk_from: plan.slot + 1,
    chunk_to: plan.nextChunkCount,
    ...(question ? { topic: question.topic, probe: question.probe, question_kn: question.kn, question_en: question.en } : {}),
  };
}

// ── Database ────────────────────────────────────────────────────────────────

export type LiveInterview = {
  id: string;
  masterId: string;
  status: string;
  isSample: boolean;
  startedAt: string | null;
  durationMs: number;
  chunkCount: number;
  parts: PartMeta[];
};

export async function readLive(db: AdminClient, id: string): Promise<LiveInterview | null> {
  const { data, error } = await db
    .from("interviews")
    .select("id, master_id, status, is_sample, started_at, duration_ms, chunk_count, parts, source")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`read interview failed (${error.code})`);
  if (!data || data.source !== "live") return null;
  return {
    id: data.id,
    masterId: data.master_id,
    status: data.status,
    isSample: data.is_sample,
    startedAt: data.started_at,
    durationMs: data.duration_ms ?? 0,
    chunkCount: data.chunk_count ?? 0,
    parts: (data.parts as PartMeta[] | null) ?? [],
  };
}

export type TurnResult = {
  interviewId: string;
  part: number;
  upload: { path: string; token: string } | null;
  chunks: Array<{ idx: number; startMs: number; endMs: number; status: "pending" | "silent" }>;
  lines: Array<{ kn: string; en: string | null }>;
  /** A child's name was taken out of a typed answer: Hanate starts the next question with the reminder. */
  nameRedacted: boolean;
  care: Care | null;
};

async function signedUpload(db: AdminClient, part: PartMeta) {
  if (!part.path || !part.storable) return null;
  const { data } = await db.storage.from("interviews").createSignedUploadUrl(part.path, { upsert: true });
  return data ? { path: part.path, token: data.token } : null;
}

function resultFor(
  interviewId: string,
  n: number,
  rows: SlotPlan["chunkRows"],
  upload: TurnResult["upload"],
  extra: Partial<Pick<TurnResult, "lines" | "nameRedacted" | "care">> = {},
): TurnResult {
  return {
    interviewId,
    part: n,
    upload,
    chunks: rows.map((r) => ({ idx: r.idx, startMs: r.start_ms, endMs: r.end_ms, status: r.status })),
    lines: extra.lines ?? [],
    nameRedacted: extra.nameRedacted ?? false,
    care: extra.care ?? null,
  };
}

/** A consent clip that is too short, or all silence, is not consent (M4 safety audit). */
export function checkConsentAudio(audio: TurnAudio): string | null {
  if (audio.durationMs < CONSENT_MIN_MS) return "consent_short";
  if (audio.chunks.every((c) => c.silent)) return "consent_silent";
  return null;
}

/**
 * The consent turn creates the interview under the id the page chose, so a retry is harmless. The
 * master's consent goes on record only once the clip is really in storage (markStored), never here.
 */
export async function startLiveInterview(
  db: AdminClient,
  session: Session,
  master: MasterAccess & { consentOnRecord: boolean },
  id: string,
  body: Extract<TurnBody, { kind: "consent" }>,
  speechReady: boolean,
): Promise<TurnResult> {
  if (!canImportFor(session, master)) throw new TurnError("not_allowed", 403);
  if (!body.audio && !master.consentOnRecord) throw new TurnError("consent_missing", 409);
  if (body.audio) {
    const bad = checkTurnChunks(body.audio) ?? checkConsentAudio(body.audio);
    if (bad) throw new TurnError(bad, 400);
  }
  const existing = await readLive(db, id);
  if (existing) {
    if (existing.masterId !== master.id) throw new TurnError("mismatch", 409);
    return replay(db, existing, body.turnId);
  }

  const plan = planSlot({ durationMs: 0, chunkCount: 0 }, body.audio, speechReady);
  const part = { ...partFor(id, 0, body, plan), at: new Date().toISOString() };
  const parts = body.audio ? [part] : [];
  const { error } = await db.from("interviews").insert({
    id,
    master_id: master.id,
    status: "recording",
    source: "live",
    title: null,
    parts,
    duration_ms: plan.nextDurationMs,
    chunk_count: plan.nextChunkCount,
    created_by: session.source === "supabase" ? session.userId : null,
    is_sample: master.isSample,
    started_at: new Date().toISOString(),
  });
  if (error) {
    // Two taps raced: the other one created it.
    const again = await readLive(db, id);
    if (again && again.masterId === master.id) return replay(db, again, body.turnId);
    throw new Error(`create live interview failed (${error.code})`);
  }
  if (plan.chunkRows.length) {
    const { error: chErr } = await db.from("audio_chunks").insert(plan.chunkRows.map((r) => ({ interview_id: id, ...r })));
    if (chErr) {
      await db.from("interviews").delete().eq("id", id);
      throw new Error(`create chunks failed (${chErr.code})`);
    }
  }
  return resultFor(id, 0, plan.chunkRows, body.audio ? await signedUpload(db, part) : null);
}

/** The same turn sent twice (a retry on a bad network) gets the same slot back, not a new one. */
async function replay(db: AdminClient, live: LiveInterview, turnId: string): Promise<TurnResult> {
  const n = live.parts.findIndex((p) => p.turn_id === turnId);
  if (n < 0) {
    if (live.parts.length === 0) return resultFor(live.id, -1, [], null);
    throw new TurnError("already_started", 409);
  }
  const part = live.parts[n]!;
  const { data } = await db
    .from("audio_chunks")
    .select("idx, start_ms, end_ms, status")
    .eq("interview_id", live.id)
    .gte("idx", part.chunk_from)
    .lt("idx", part.chunk_to)
    .order("idx");
  const rows = (data ?? []).map((r) => ({ idx: r.idx, start_ms: r.start_ms, end_ms: r.end_ms, status: r.status as "pending" | "silent" }));
  return resultFor(live.id, n, rows, await signedUpload(db, part), { care: part.care ?? null });
}

/**
 * A part's original audio finished uploading. Checked in storage before it is believed, then marked
 * with the same optimistic guard appendTurn uses, so a slow upload can never overwrite a newer turn.
 * For the consent part, this is when the master's consent goes on record.
 */
export async function markStored(db: AdminClient, id: string, n: number): Promise<{ consented: boolean }> {
  let live = await readLive(db, id);
  const part = live?.parts[n];
  if (!live || !part?.path) throw new TurnError("not_found", 404);
  const size = await storedSize(db, part.path);
  // The very file the page declared, not any object under that name (M4 safety re-check).
  if (size === null || size !== part.bytes || (part.kind === "consent" && size < CONSENT_MIN_BYTES)) {
    throw new TurnError("not_uploaded", 409);
  }

  for (let attempt = 0; attempt < 4 && live; attempt++) {
    if (live.parts[n]?.stored) break;
    const parts = live.parts.map((p, i) => (i === n ? { ...p, stored: true } : p));
    const { data: done, error } = await db
      .from("interviews")
      .update({ parts })
      .eq("id", id)
      .eq("chunk_count", live.chunkCount)
      .select("id");
    if (error) throw new Error(`mark stored failed (${error.code})`);
    if (done?.length) break;
    live = await readLive(db, id);
  }

  if (part.kind !== "consent") return { consented: false };
  const { data: m } = await db.from("masters").select("consented_at").eq("id", live?.masterId ?? "").maybeSingle();
  if (m && !m.consented_at) {
    const { error } = await db
      .from("masters")
      .update({ consented_at: new Date().toISOString(), consent_audio_path: part.path, consent_text_kn: CONSENT_TEXT_KN_V1 })
      .eq("id", live!.masterId)
      .is("consented_at", null);
    if (error) throw new Error(`record consent failed (${error.code})`);
  }
  return { consented: true };
}

async function storedSize(db: AdminClient, path: string): Promise<number | null> {
  const dir = path.slice(0, path.lastIndexOf("/"));
  const file = path.slice(path.lastIndexOf("/") + 1);
  const { data } = await db.storage.from("interviews").list(dir, { search: file });
  const found = data?.find((o) => o.name === file);
  if (!found) return null;
  const size = Number((found.metadata as { size?: unknown } | null)?.size);
  return Number.isFinite(size) ? size : null;
}

/**
 * Is this master's consent really on record? A real master needs the consent clip itself in storage
 * (a consent date alone can be written by an import before any upload). Sample masters are made up
 * for the demo and labelled Sample everywhere (Law 7), so their seeded consent stands.
 */
export async function consentOnRecord(db: AdminClient, masterId: string): Promise<boolean> {
  const { data: m } = await db.from("masters").select("consented_at, consent_audio_path, is_sample").eq("id", masterId).maybeSingle();
  if (!m?.consented_at) return false;
  if (m.is_sample) return true;
  if (!m.consent_audio_path) return false;
  return ((await storedSize(db, m.consent_audio_path)) ?? 0) >= CONSENT_MIN_BYTES;
}

/** Phrases in groups small enough for one redaction call each. */
export function redactBatches<T extends { text: string }>(phrases: T[], maxChars = REDACT_BATCH_CHARS): T[][] {
  const out: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const p of phrases) {
    if (current.length && size + p.text.length > maxChars) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(p);
    size += p.text.length;
  }
  if (current.length) out.push(current);
  return out;
}

export type TalkRedact = (input: {
  phrases: Array<{ startMs: number; endMs: number; text: string }>;
  masterName?: string;
  traceId: string;
}) => Promise<{ status: "ok"; phrases: RedactedPhrase[] } | { status: "needs_human"; reason: string }>;

export type AppendOptions = {
  speechReady: boolean;
  redact: TalkRedact;
  masterName: string | null;
  traceId: string;
  /** The master's consent is on record (consentOnRecord). */
  consented: boolean;
  /** Is this question one the server wrote (lib/talk/sign questionTrusted)? */
  trustQuestion: (q: TurnQuestion) => boolean;
  /** The session's audio limit, the same as an import's (lib/import/access maxImportMs). */
  maxMs: number;
};

/** One more answer: claim the next slot (optimistically), then write its question and chunks. */
export async function appendTurn(
  db: AdminClient,
  live: LiveInterview,
  body: Extract<TurnBody, { kind: "answer" | "typed" | "skip" }>,
  opts: AppendOptions,
): Promise<TurnResult> {
  if (live.status !== "recording") throw new TurnError("interview_closed", 409);
  if (live.parts.some((p) => p.turn_id === body.turnId)) return replay(db, live, body.turnId);
  if (!opts.consented) throw new TurnError("consent_missing", 409);
  if (!opts.trustQuestion(body.question)) throw new TurnError("question_untrusted", 400);
  const audio = body.kind === "answer" ? body.audio : null;
  if (audio) {
    const bad = checkTurnChunks(audio);
    if (bad) throw new TurnError(bad, 400);
  }
  if (live.parts.length >= MAX_PARTS) throw new TurnError("too_many_turns", 413);
  if (live.durationMs + (audio?.durationMs ?? 0) > opts.maxMs) throw new TurnError("too_long", 413);

  // A typed answer is redacted before anything is written (Law 5).
  const typed: RedactedPhrase[] = [];
  let care: Care | null = null;
  if (body.kind === "typed") {
    const phrases = typedPhrases(body.text, live.durationMs);
    if (phrases.length === 0) throw new TurnError("empty_answer", 400);
    care = careFor(body.text);
    for (const batch of redactBatches(phrases)) {
      const red = await opts.redact({ phrases: batch, masterName: opts.masterName ?? undefined, traceId: opts.traceId });
      if (red.status !== "ok") throw new TurnError(red.reason === "budget" ? "budget" : "redaction_unavailable", 503);
      typed.push(...red.phrases);
    }
  }

  let current = live;
  for (let attempt = 0; attempt < 4; attempt++) {
    const n = current.parts.length;
    const plan = planSlot(current, audio, opts.speechReady);
    const part = { ...partFor(current.id, n, body, plan), at: new Date().toISOString(), ...(care ? { care } : {}) };
    const { data: claimed, error } = await db
      .from("interviews")
      .update({ parts: [...current.parts, part], duration_ms: plan.nextDurationMs, chunk_count: plan.nextChunkCount })
      .eq("id", current.id)
      .eq("chunk_count", current.chunkCount)
      .eq("status", "recording")
      .select("id");
    if (error) throw new Error(`append turn failed (${error.code})`);
    if (!claimed?.length) {
      const fresh = await readLive(db, current.id);
      if (!fresh || fresh.status !== "recording") throw new TurnError("interview_closed", 409);
      if (fresh.parts.some((p) => p.turn_id === body.turnId)) return replay(db, fresh, body.turnId);
      current = fresh;
      continue;
    }

    try {
      // A skipped question keeps its place and its words in `parts`, and adds nothing to the transcript.
      if (body.kind !== "skip") await writeTurnRows(db, current.id, plan, body.question, typed);
    } catch (err) {
      // Give the slot back, so the same turn sent again starts clean instead of replaying an empty one.
      await undoClaim(db, current, plan);
      throw err;
    }
    return resultFor(current.id, n, plan.chunkRows, audio ? await signedUpload(db, part) : null, {
      lines: typed.map((p) => ({ kn: p.textKn, en: p.textEn })),
      nameRedacted: typed.some((p) => p.childNameRedacted),
      care,
    });
  }
  throw new TurnError("busy", 409);
}

async function writeTurnRows(db: AdminClient, id: string, plan: SlotPlan, question: TurnQuestion, typed: RedactedPhrase[]) {
  const segments = [
    {
      interview_id: id,
      idx: plan.slot * SLOT_SIZE,
      chunk_idx: plan.slot,
      start_ms: plan.startMs,
      end_ms: plan.startMs,
      text_kn: question.kn,
      text_en: question.en,
      redacted: false,
      speaker: "interviewer",
    },
    ...typed.map((p, i) => ({
      interview_id: id,
      idx: plan.slot * SLOT_SIZE + 1 + i,
      chunk_idx: plan.slot,
      start_ms: plan.startMs,
      end_ms: plan.startMs,
      text_kn: p.textKn,
      text_en: p.textEn,
      redacted: p.childNameRedacted || Boolean(p.otherNameRedacted),
      speaker: "master",
    })),
  ];
  const { error: segErr } = await db.from("segments").insert(segments);
  if (segErr) throw new Error(`insert turn segments failed (${segErr.code})`);
  if (plan.chunkRows.length) {
    const { error: chErr } = await db.from("audio_chunks").insert(plan.chunkRows.map((r) => ({ interview_id: id, ...r })));
    if (chErr) throw new Error(`insert turn chunks failed (${chErr.code})`);
  }
}

async function undoClaim(db: AdminClient, before: LiveInterview, plan: SlotPlan) {
  await db
    .from("segments")
    .delete()
    .eq("interview_id", before.id)
    .gte("idx", plan.slot * SLOT_SIZE)
    .lt("idx", (plan.slot + 1) * SLOT_SIZE);
  if (plan.chunkRows.length) {
    await db.from("audio_chunks").delete().eq("interview_id", before.id).gte("idx", plan.slot + 1).lt("idx", plan.nextChunkCount);
  }
  await db
    .from("interviews")
    .update({ parts: before.parts, duration_ms: before.durationMs, chunk_count: before.chunkCount })
    .eq("id", before.id)
    .eq("chunk_count", plan.nextChunkCount);
}

export type TurnView = {
  n: number;
  kind: PartMeta["kind"];
  topic: Topic | null;
  probe: boolean;
  question: { kn: string; en: string } | null;
  lines: Array<{ kn: string; en: string | null }>;
  /** Chunks of this turn still waiting for speech to text. */
  pending: number;
  nameRedacted: boolean;
  care: Care | null;
};

/** Every turn with its redacted words, for the chapters on screen and for the interviewer. */
export async function listTurns(db: AdminClient, live: LiveInterview): Promise<TurnView[]> {
  const [{ data: segs }, { data: chunks }] = await Promise.all([
    db.from("segments").select("chunk_idx, text_kn, text_en, speaker, redacted").eq("interview_id", live.id).order("start_ms").order("idx").limit(5000),
    db.from("audio_chunks").select("idx, status").eq("interview_id", live.id),
  ]);
  return live.parts.map((p, n) => {
    const mine = (segs ?? []).filter((s) => s.chunk_idx !== null && s.chunk_idx >= p.slot && s.chunk_idx < p.chunk_to && s.speaker !== "interviewer");
    return {
      n,
      kind: p.kind,
      topic: p.topic ?? null,
      probe: Boolean(p.probe),
      question: p.question_kn ? { kn: p.question_kn, en: p.question_en ?? "" } : null,
      lines: mine.map((s) => ({ kn: s.text_kn, en: s.text_en })),
      pending: (chunks ?? []).filter((c) => c.idx >= p.chunk_from && c.idx < p.chunk_to && c.status === "pending").length,
      nameRedacted: mine.some((s) => s.redacted),
      care: p.care ?? careFor(mine.map((s) => `${s.text_kn}\n${s.text_en ?? ""}`).join("\n")),
    };
  });
}

// ── Coming back to a talk (a reloaded tab, a locked phone) ──────────────────

/** A pause longer than this is a break, not talk: it does not count towards the session's time. */
export const MAX_GAP_MS = 10 * 60_000;
/** A talk touched within this long can be continued; an older one is left for a reviewer. */
export const RESUME_WINDOW_MS = 6 * 60 * 60_000;

/** Time spent talking: from the start, through each part, to now, with every gap capped. */
export function activeElapsedMs(live: Pick<LiveInterview, "startedAt" | "parts">, now: number): number {
  if (!live.startedAt) return 0;
  const times = [Date.parse(live.startedAt), ...live.parts.flatMap((p) => (p.at ? [Date.parse(p.at)] : [])), now].filter(Number.isFinite);
  let total = 0;
  for (let i = 1; i < times.length; i++) total += Math.min(MAX_GAP_MS, Math.max(0, times[i]! - times[i - 1]!));
  return total;
}

export type ResumeOffer = {
  interviewId: string;
  masterId: string;
  answered: number;
  skipped: number;
  /** The last question the master answered or skipped. */
  lastQuestion: { kn: string; en: string } | null;
  updatedAt: string;
};

export function resumeOffer(live: LiveInterview, updatedAt: string): ResumeOffer {
  const asked = live.parts.filter((p) => p.kind !== "consent");
  const last = asked[asked.length - 1];
  return {
    interviewId: live.id,
    masterId: live.masterId,
    answered: asked.filter((p) => p.kind !== "skip").length,
    skipped: asked.filter((p) => p.kind === "skip").length,
    lastQuestion: last?.question_kn ? { kn: last.question_kn, en: last.question_en ?? "" } : null,
    updatedAt,
  };
}

/**
 * Each master's most recent live talk that is still open and was touched in the last six hours.
 * The caller has already limited `masterIds` to masters this session may talk for.
 */
export async function findResumable(db: AdminClient, masterIds: string[], now = Date.now()): Promise<Record<string, ResumeOffer>> {
  if (masterIds.length === 0) return {};
  const { data, error } = await db
    .from("interviews")
    .select("id, master_id, status, is_sample, started_at, duration_ms, chunk_count, parts, source, updated_at")
    .eq("source", "live")
    .eq("status", "recording")
    .in("master_id", masterIds)
    .gte("updated_at", new Date(now - RESUME_WINDOW_MS).toISOString())
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error || !data) return {};
  const out: Record<string, ResumeOffer> = {};
  for (const row of data) {
    if (out[row.master_id]) continue;
    const live: LiveInterview = {
      id: row.id,
      masterId: row.master_id,
      status: row.status,
      isSample: row.is_sample,
      startedAt: row.started_at,
      durationMs: row.duration_ms ?? 0,
      chunkCount: row.chunk_count ?? 0,
      parts: (row.parts as PartMeta[] | null) ?? [],
    };
    // A talk with only its consent has nothing to come back to.
    if (live.parts.every((p) => p.kind === "consent")) continue;
    out[row.master_id] = resumeOffer(live, row.updated_at);
  }
  return out;
}
