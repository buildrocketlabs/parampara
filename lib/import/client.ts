"use client";

import { createUploadQueue, prepareAudio, UploadQueueError, type PreparedAudio } from "@/lib/audio";
import { getBrowserClient } from "@/lib/supabase/browser";
import { storableMime } from "./mime";
import type { Progress } from "./pipeline";
import { createBody, type ConsentMode } from "./plan";

// Drives an import from the page (docs/BUILD.md M2): prepare in the browser, start the interview,
// upload the original parts in the background, send chunks two at a time (D40), then run the
// extraction steps. Every stage reports honestly so the page can tell the founder exactly where
// a 40 minute recording stands. A reload resumes: choose the same files and it skips what is done.

export type ImportStage = "preparing" | "listening" | "reading" | "done" | "attention";

export type Line = { startMs: number; kn: string; en: string | null };

export type ImportEvents = {
  stage(stage: ImportStage, detail: { done: number; total: number }): void;
  lines(lines: Line[]): void;
  interview(id: string): void;
  partStored(part: number): void;
  /** How many moments mention a child's welfare, once extraction is done. */
  welfare?(count: number): void;
};

export class ImportError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ImportError";
  }
}

type Consent = { mode: ConsentMode; clip?: File };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ImportError(body.error ?? `http_${res.status}`);
  return body;
}

/**
 * Decodes the parts one at a time (only one decoded part is ever in memory, so seven voice notes
 * fit on a phone) and reports progress in parts: "note 3 of 7", never a count that changes unit.
 */
export async function prepare(files: File[], events: ImportEvents, maxTotalMs?: number) {
  const prepared = await prepareAudio(files, {
    maxTotalMs,
    onStage: (stage, done, total) => {
      if (stage === "decoding") events.stage("preparing", { done, total });
    },
  });
  events.stage("preparing", { done: files.length, total: files.length });
  return prepared;
}

export async function startImport(opts: {
  masterId: string;
  title?: string;
  files: File[];
  prepared: PreparedAudio;
  consent: Consent;
  events: ImportEvents;
  signal: AbortSignal;
}): Promise<string> {
  const { files, prepared, consent, events } = opts;
  const created = await api<{
    interviewId: string;
    uploads: Array<{ part: number; path: string; token: string } | null>;
    consentUpload: { path: string; token: string } | null;
  }>("/api/interviews", {
    method: "POST",
    body: JSON.stringify(
      createBody({ masterId: opts.masterId, title: opts.title, files, prepared, consent }),
    ),
  });
  events.interview(created.interviewId);

  // Originals upload in the background: transcription never waits for a 40 MB file on 3G.
  void uploadOriginals(created.interviewId, files, created.uploads, events);
  if (consent.clip && created.consentUpload) {
    // Consent counts only once the clip is verified in storage (the server checks it).
    void uploadOne(created.consentUpload.path, created.consentUpload.token, consent.clip)
      .then(() =>
        api(`/api/interviews/${created.interviewId}`, {
          method: "PATCH",
          body: JSON.stringify({ consentStored: true }),
        }),
      )
      .catch(() => {});
  }
  await continueImport({
    interviewId: created.interviewId,
    prepared,
    events,
    signal: opts.signal,
    originalsStarted: true,
  });
  return created.interviewId;
}

async function uploadOne(path: string, token: string, file: File) {
  const sb = getBrowserClient();
  if (!sb) throw new ImportError("not_configured");
  // The bucket accepts a fixed list of types; WhatsApp's .opus often comes with none (mime.ts).
  const { error } = await sb.storage.from("interviews").uploadToSignedUrl(path, token, file, {
    contentType: storableMime(file),
    upsert: true,
  });
  if (error) throw new ImportError("upload_failed");
}

async function uploadOriginals(
  interviewId: string,
  files: File[],
  uploads: Array<{ part: number; path: string; token: string } | null>,
  events: ImportEvents,
) {
  for (const u of uploads) {
    if (!u) continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await uploadOne(u.path, u.token, files[u.part]!);
        await api(`/api/interviews/${interviewId}`, {
          method: "PATCH",
          body: JSON.stringify({ storedPart: u.part }),
        });
        events.partStored(u.part);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 4_000 * (attempt + 1)));
      }
    }
  }
}

type Status = {
  progress: Progress;
  parts?: Array<{ n: number; storable: boolean; stored: boolean }>;
  welfare?: number[];
  chunks: Array<{ idx: number; status: string }>;
  recent: Array<{ startMs: number; kn: string; en: string | null }>;
};

export function getStatus(interviewId: string) {
  return api<Status>(`/api/interviews/${interviewId}`);
}

/** Sends the chunks the server does not have yet, then runs extraction to the end. */
export async function continueImport(opts: {
  interviewId: string;
  prepared: PreparedAudio | null;
  events: ImportEvents;
  signal: AbortSignal;
  /** The same files again on resume: original parts not stored yet are uploaded now. */
  files?: File[];
  /** startImport already began uploading the originals. */
  originalsStarted?: boolean;
}) {
  const { interviewId, prepared, events, signal } = opts;
  const status = await getStatus(interviewId);
  events.lines(status.recent);
  for (const p of status.parts ?? []) if (p.stored) events.partStored(p.n);
  const files = opts.files;
  if (!opts.originalsStarted && files && status.parts?.some((p) => p.storable && !p.stored)) {
    // A reload lost the background upload. The consent note is part 0: until it is stored the
    // master's consent does not count (D53), so finish what was started, with fresh tokens.
    void api<{ uploads: Array<{ part: number; path: string; token: string } | null> }>(
      `/api/interviews/${interviewId}`,
      { method: "PATCH", body: JSON.stringify({ uploadTokens: true }) },
    )
      .then((r) => uploadOriginals(interviewId, files, r.uploads, events))
      .catch(() => {});
  }
  const remaining = status.chunks
    .filter((c) => c.status === "pending" || c.status === "failed")
    .map((c) => c.idx);
  const total = status.chunks.length;
  const alreadyDone = status.chunks.filter((c) => !remaining.includes(c.idx)).map((c) => c.idx);

  if (remaining.length > 0) {
    if (!prepared) throw new ImportError("files_needed");
    if (prepared.chunks.length !== total) throw new ImportError("files_differ");
    events.stage("listening", { done: alreadyDone.length, total });
    const queue = createUploadQueue({
      items: status.chunks.map((c) => c.idx),
      alreadyDone,
      concurrency: 2,
      maxRetries: 6,
      onProgress: (done) => events.stage("listening", { done, total }),
      upload: async (idx, chunkSignal) => {
        const chunk = prepared.chunks[idx]!;
        const res = await fetch(`/api/interviews/${interviewId}/chunks/${idx}`, {
          method: "PUT",
          body: chunk.wav,
          headers: { "content-type": "audio/wav" },
          signal: chunkSignal,
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          retryAfterMs?: number;
          segments?: Array<{ startMs: number; textKn: string; textEn: string | null }>;
        };
        if (res.ok) {
          // The server has it now; let the browser drop the audio (35 minutes is ~67 MB of WAV).
          chunk.wav = new Uint8Array(0);
          if (body.segments?.length) {
            events.lines(
              body.segments.map((s) => ({ startMs: s.startMs, kn: s.textKn, en: s.textEn })),
            );
          }
          return;
        }
        if (res.status === 429 && body.retryAfterMs)
          await new Promise((r) => setTimeout(r, body.retryAfterMs));
        const fatal = [
          "ai_not_ready",
          "speech_not_configured",
          "not_allowed",
          "sign_in_needed",
          "mismatch",
          "gave_up",
        ];
        throw Object.assign(new ImportError(body.error ?? `http_${res.status}`), {
          retryable: !fatal.includes(body.error ?? ""),
        });
      },
    });
    signal.addEventListener("abort", () => queue.abort(), { once: true });
    try {
      await queue.start();
    } catch (err) {
      if (err instanceof UploadQueueError && err.kind === "gave_up") {
        events.stage("attention", { done: total - err.failed.length, total });
        throw new ImportError("some_chunks_failed");
      }
      throw err;
    }
  }

  // Extraction: one window per request until done. The server says what phase it is in.
  for (let guard = 0; guard < 200 && !signal.aborted; guard++) {
    const p = await api<Progress>(`/api/interviews/${interviewId}/step`, { method: "POST" });
    if (p.phase === "transcribing") throw new ImportError("some_chunks_failed");
    if (p.phase === "done") {
      const final = await getStatus(interviewId).catch(() => null);
      if (final?.welfare?.length) events.welfare?.(final.welfare.length);
      events.stage("done", { done: p.cards, total: p.cards });
      return p;
    }
    if (p.phase === "needs_attention") {
      events.stage("attention", { done: p.windows.done, total: p.windows.total });
      return p;
    }
    events.stage("reading", { done: p.windows.done, total: p.windows.total });
  }
  return null;
}
