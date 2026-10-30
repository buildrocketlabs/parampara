"use client";

import { createUploadQueue, prepareAudio, UploadQueueError } from "@/lib/audio";
import type { InterviewTopic } from "@/lib/domain/interview";
import { continueImport, type ImportEvents } from "@/lib/import/client";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { Care } from "./care";
import type { ScriptedQuestion } from "./script";

// Drives one live interview from the master's phone (docs/BUILD.md M4.3): each answer becomes a
// part of one interview (consent first), its original voice is kept, its chunks go through the
// same speech and redaction route as an import, then Hanate's next question is fetched and said.
// Every failure keeps the master's words on the device and says what to do next. Consent is sent
// first and must be safely stored before the first question is asked.

export class TalkError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TalkError";
  }
}

export type Question = ScriptedQuestion & {
  source?: "model" | "script";
  /** The server's signature: only a question it wrote is stored as Hanate's. */
  sig?: string | null;
  /** Lets the voice route say this exact line. */
  sayToken?: string | null;
  /** The answer before this question spoke of a child in danger, or of despair. */
  care?: Care | null;
};
export type Line = { kn: string; en: string | null };
export type TurnSent = {
  part: number;
  chunks: Array<{ idx: number; status: "pending" | "silent" }>;
  lines: Line[];
  nameRedacted?: boolean;
  care?: Care | null;
};
export type AnswerSent = { lines: Line[]; nameRedacted: boolean; care: Care | null };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  } catch {
    throw new TalkError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "network");
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new TalkError(body.error ?? `http_${res.status}`);
  return body;
}

function newId(): string {
  return crypto.randomUUID();
}

export function newInterviewId(): string {
  return newId();
}

type Prepared = Awaited<ReturnType<typeof prepareAudio>>;

async function audioMeta(blob: Blob, name: string) {
  const prepared = await prepareAudio([blob]);
  return {
    prepared,
    meta: {
      name,
      mime: blob.type || "audio/webm",
      bytes: blob.size,
      durationMs: prepared.durationMs,
      chunks: prepared.chunks.map(({ startMs, endMs, silent }) => ({ startMs, endMs, silent })),
    },
  };
}

async function upload(path: string, token: string, blob: Blob): Promise<boolean> {
  const sb = getBrowserClient();
  if (!sb) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await sb.storage
      .from("interviews")
      .uploadToSignedUrl(path, token, blob, { contentType: blob.type || "audio/webm", upsert: true });
    if (!error) return true;
    await new Promise((r) => setTimeout(r, 3_000 * (attempt + 1)));
  }
  return false;
}

/** Keeps the original voice of an answer, then tells the server, which checks storage itself. */
async function keepOriginal(interviewId: string, part: number, target: { path: string; token: string } | null, blob: Blob): Promise<boolean> {
  if (!target || !(await upload(target.path, target.token, blob))) return false;
  try {
    await api(`/api/interviews/${interviewId}/turns/stored`, { method: "POST", body: JSON.stringify({ part }) });
    return true;
  } catch {
    return false;
  }
}

/** Sends a turn's chunks (two at a time, D40) through the import route; returns the redacted lines. */
async function sendChunks(interviewId: string, prepared: Prepared, rows: TurnSent["chunks"], signal: AbortSignal): Promise<Line[]> {
  const pending = rows.map((r, k) => ({ ...r, k })).filter((r) => r.status === "pending");
  const lines = new Map<number, Line[]>();
  if (pending.length === 0) return [];
  const queue = createUploadQueue({
    items: pending.map((p) => p.idx),
    alreadyDone: [],
    concurrency: 2,
    maxRetries: 4,
    upload: async (idx, chunkSignal) => {
      const p = pending.find((x) => x.idx === idx)!;
      const res = await fetch(`/api/interviews/${interviewId}/chunks/${idx}`, {
        method: "PUT",
        body: prepared.chunks[p.k]!.wav,
        headers: { "content-type": "audio/wav" },
        signal: chunkSignal,
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        retryAfterMs?: number;
        segments?: Array<{ textKn: string; textEn: string | null }>;
      };
      if (res.ok) {
        lines.set(idx, (body.segments ?? []).map((s) => ({ kn: s.textKn, en: s.textEn })));
        return;
      }
      if (res.status === 429 && body.retryAfterMs) await new Promise((r) => setTimeout(r, body.retryAfterMs));
      const fatal = ["speech_not_configured", "ai_not_ready", "not_allowed", "sign_in_needed", "mismatch", "gave_up"];
      throw Object.assign(new TalkError(body.error ?? `http_${res.status}`), { retryable: !fatal.includes(body.error ?? "") });
    },
  });
  signal.addEventListener("abort", () => queue.abort(), { once: true });
  try {
    await queue.start();
  } catch (err) {
    // The voice is kept either way; the words for a chunk that failed can come later.
    if (!(err instanceof UploadQueueError)) throw err;
  }
  return pending.flatMap((p) => lines.get(p.idx) ?? []);
}

/**
 * The consent recording creates the interview (part 0), and goes on record only once its clip is
 * safely stored. `blob` null: consent recorded earlier. The same ids on a retry change nothing.
 */
export async function sendConsent(opts: { interviewId: string; turnId: string; masterId: string; blob: Blob | null; signal: AbortSignal }) {
  const audio = opts.blob ? await audioMeta(opts.blob, "consent.webm") : null;
  const sent = await api<TurnSent & { upload: { path: string; token: string } | null }>(`/api/interviews/${opts.interviewId}/turns`, {
    method: "POST",
    body: JSON.stringify({ kind: "consent", turnId: opts.turnId, masterId: opts.masterId, audio: audio?.meta ?? null }),
  });
  if (opts.blob && audio) {
    if (!(await keepOriginal(opts.interviewId, sent.part, sent.upload, opts.blob))) throw new TalkError("consent_not_saved");
    await sendChunks(opts.interviewId, audio.prepared, sent.chunks, opts.signal);
  }
}

export type AskedQuestion = { kn: string; en: string; topic: InterviewTopic; probe: boolean; sig?: string | null };

function asked(q: AskedQuestion) {
  return { kn: q.kn, en: q.en, topic: q.topic, probe: q.probe, ...(q.sig ? { sig: q.sig } : {}) };
}

/** A spoken answer: kept as a part, its words through speech to text and redaction. */
export async function sendVoiceAnswer(opts: { interviewId: string; question: AskedQuestion; blob: Blob; turnId: string; signal: AbortSignal }): Promise<AnswerSent> {
  const { prepared, meta } = await audioMeta(opts.blob, `answer-${Date.now()}.webm`);
  const sent = await api<TurnSent & { upload: { path: string; token: string } | null }>(`/api/interviews/${opts.interviewId}/turns`, {
    method: "POST",
    body: JSON.stringify({ kind: "answer", turnId: opts.turnId, question: asked(opts.question), audio: meta }),
  });
  void keepOriginal(opts.interviewId, sent.part, sent.upload, opts.blob);
  const lines = await sendChunks(opts.interviewId, prepared, sent.chunks, opts.signal);
  return { lines, nameRedacted: false, care: null };
}

/** A typed answer (the helper writes what the master said): redacted on the server before it is kept. */
export async function sendTypedAnswer(opts: { interviewId: string; question: AskedQuestion; text: string; turnId: string }): Promise<AnswerSent> {
  const sent = await api<TurnSent>(`/api/interviews/${opts.interviewId}/turns`, {
    method: "POST",
    body: JSON.stringify({ kind: "typed", turnId: opts.turnId, question: asked(opts.question), text: opts.text }),
  });
  return { lines: sent.lines, nameRedacted: Boolean(sent.nameRedacted), care: sent.care ?? null };
}

/** The master skipped this question: kept on the server, so a reopened page does not ask it again. */
export async function sendSkip(opts: { interviewId: string; question: AskedQuestion; turnId: string }): Promise<void> {
  await api(`/api/interviews/${opts.interviewId}/turns`, {
    method: "POST",
    body: JSON.stringify({ kind: "skip", turnId: opts.turnId, question: asked(opts.question) }),
  });
}

export async function askNext(interviewId: string): Promise<Question> {
  const res = await api<{ question: ScriptedQuestion; source: "model" | "script"; care: Care | null; sig: string | null; sayToken: string | null }>(
    `/api/interviews/${interviewId}/turns/next`,
    { method: "POST", body: "{}" },
  );
  return { ...res.question, source: res.source, care: res.care, sig: res.sig, sayToken: res.sayToken };
}

export type SavedTurn = {
  kind: "consent" | "answer" | "typed" | "skip";
  topic: InterviewTopic | null;
  probe: boolean;
  question: { kn: string; en: string } | null;
  lines: Line[];
  pending: number;
};

/** A talk as the server keeps it: every turn, and the time spent talking so far. */
export async function loadTalk(interviewId: string): Promise<{ status: string; elapsedMs: number; turns: SavedTurn[] }> {
  return api(`/api/interviews/${interviewId}/turns`, { method: "GET" });
}

/** Extraction through the import route, one window per request, until the cards are drafted. */
export async function finishTalk(interviewId: string, events: Pick<ImportEvents, "stage" | "welfare">, signal: AbortSignal) {
  return continueImport({
    interviewId,
    prepared: null,
    events: { stage: events.stage, welfare: events.welfare, lines: () => {}, interview: () => {}, partStored: () => {} },
    signal,
  });
}

/** A signed link to Hanate saying this line, or null when the voice is not available. */
export async function voiceUrl(text: string, token?: string | null): Promise<string | null> {
  try {
    const res = await api<{ url: string }>("/api/voice/say", { method: "POST", body: JSON.stringify({ text, ...(token ? { token } : {}) }) });
    return res.url;
  } catch {
    return null;
  }
}
