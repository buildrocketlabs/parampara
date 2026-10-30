import type {
  ChunkRow,
  ExistingCardEvidence,
  ExtractedCard,
  ImportAi,
  ImportStore,
  InterviewRow,
  SegmentInsert,
} from "./types";

// The recording import pipeline (docs/BUILD.md M2, D34, D39, D40). The page drives it one small
// step at a time, so every request fits the 300 s function limit and a closed tab resumes later:
//   1. transcribeChunk: one chunk of under 30 s → speech to text → redaction → segments.
//      Nothing raw is stored: segments are written only after redaction (Law 5).
//   2. step: once every chunk is done, extraction runs one window per call as a claimed job and
//      lands draft cards for a human reviewer. Nothing reaches a teacher before approval (Law 4).

export const MAX_CHUNK_ATTEMPTS = 3;
export const MAX_JOB_ATTEMPTS = 3;
/** A chunk's WAV must match the planned duration; a mismatch means a different file on resume. */
export const CHUNK_DURATION_TOLERANCE_MS = 120;
/** Segment idx is chunk * this + phrase, so ordering and uniqueness need no extra query. */
export const PHRASES_PER_CHUNK_SLOT = 1000;

export class PipelineError extends Error {
  constructor(
    readonly kind: "not_found" | "mismatch" | "retry_later" | "gave_up" | "wrong_phase",
    message: string,
  ) {
    super(message);
  }
}

export type ChunkResult =
  | { status: "already_done"; chunk: ChunkRow }
  | { status: "silent" }
  | {
      status: "transcribed";
      segments: Array<Pick<SegmentInsert, "startMs" | "endMs" | "textKn" | "textEn">>;
    };

export async function transcribeChunk(
  ai: ImportAi,
  store: ImportStore,
  input: {
    interview: InterviewRow;
    idx: number;
    wav: Uint8Array;
    wavDurationMs: number;
    traceId: string;
  },
): Promise<ChunkResult> {
  const { interview, idx, wav, wavDurationMs, traceId } = input;
  const chunk = await store.getChunk(interview.id, idx);
  if (!chunk) throw new PipelineError("not_found", `chunk ${idx} is not part of this recording`);
  if (chunk.status === "transcribed" || chunk.status === "silent")
    return { status: "already_done", chunk };
  if (chunk.attempts >= MAX_CHUNK_ATTEMPTS && chunk.status === "failed") {
    throw new PipelineError("gave_up", `chunk ${idx} failed ${chunk.attempts} times`);
  }
  if (Math.abs(wavDurationMs - (chunk.endMs - chunk.startMs)) > CHUNK_DURATION_TOLERANCE_MS) {
    throw new PipelineError("mismatch", `chunk ${idx} audio does not match the planned length`);
  }

  const attempts = chunk.attempts + 1;
  let stt: Awaited<ReturnType<ImportAi["transcribe"]>>;
  try {
    stt = await ai.transcribe(wav, { traceId });
  } catch (err) {
    await store.updateChunk(interview.id, idx, {
      status: "failed",
      attempts,
      error: errorCode(err, "stt"),
    });
    throw err;
  }
  const phrases = stt.phrases.filter((p) => p.text.trim().length > 0);
  if (phrases.length === 0) {
    await store.replaceChunkSegments(interview.id, idx, []);
    await store.updateChunk(interview.id, idx, { status: "silent", attempts, error: null });
    return { status: "silent" };
  }

  const master = await store.getMasterContext(interview.masterId);
  const previousText = await store.lastSegmentTextBefore(interview.id, idx);
  const red = await ai.redact({
    phrases,
    masterName: master.name ?? undefined,
    previousText: previousText ?? undefined,
    traceId,
  });
  if (red.status !== "ok" || red.phrases.length !== phrases.length) {
    const reason = red.status === "ok" ? "redaction_count_mismatch" : `redaction_${red.reason}`;
    await store.updateChunk(interview.id, idx, { status: "failed", attempts, error: reason });
    throw new PipelineError("retry_later", reason);
  }

  const span = chunk.endMs - chunk.startMs;
  const rows: SegmentInsert[] = red.phrases.map((p, i) => {
    // Timings come from the speech service, never from the model; clamp them into the chunk.
    const source = phrases[i]!;
    const start = clamp(source.startMs, 0, span);
    const end = clamp(Math.max(source.endMs, source.startMs), start, span);
    return {
      interviewId: interview.id,
      idx: idx * PHRASES_PER_CHUNK_SLOT + i,
      chunkIdx: idx,
      startMs: chunk.startMs + start,
      endMs: chunk.startMs + end,
      textKn: p.textKn,
      textEn: p.textEn,
      redacted: p.childNameRedacted || Boolean(p.otherNameRedacted),
      speaker: p.speakerGuess,
    };
  });
  await store.replaceChunkSegments(interview.id, idx, rows);
  await store.updateChunk(interview.id, idx, { status: "transcribed", attempts, error: null });
  return {
    status: "transcribed",
    segments: rows.map(({ startMs, endMs, textKn, textEn }) => ({
      startMs,
      endMs,
      textKn,
      textEn,
    })),
  };
}

export type Progress = {
  phase: "transcribing" | "extracting" | "done" | "needs_attention";
  chunks: { total: number; done: number; failed: number };
  windows: { total: number; done: number; failed: number };
  cards: number;
};

/** One unit of work after transcription. Safe to call from two tabs at once (claimed jobs). */
export async function step(
  ai: ImportAi,
  store: ImportStore,
  input: { interview: InterviewRow; traceId: string },
): Promise<Progress> {
  const { interview, traceId } = input;
  const chunks = await store.chunkCounts(interview.id);
  if (chunks.pending > 0 || chunks.failed > 0) return progress(store, interview.id, "transcribing");

  let jobs = await store.jobCounts(interview.id);
  if (total(jobs) === 0) {
    // A consent only first note (F-A1) stays on the timeline for listening, never in a card.
    const from = interview.consentOnlyEndMs ?? 0;
    const segments = (await store.listSegments(interview.id)).filter((s) => s.startMs >= from);
    if (segments.length === 0) {
      await store.setInterviewStatus(interview.id, "failed", "no_speech");
      return progress(store, interview.id, "needs_attention");
    }
    const windows = ai
      .windows(segments)
      .map((w, window) => ({ window, segmentIds: w.map((s) => s.id) }));
    await store.ensureWindowJobs(interview.id, windows);
    await store.setInterviewStatus(interview.id, "extracting");
    jobs = await store.jobCounts(interview.id);
  }

  const job = await store.claimJob(interview.id);
  if (job) await runWindow(ai, store, interview, job, traceId);

  jobs = await store.jobCounts(interview.id);
  if (jobs.queued === 0 && jobs.running === 0) {
    const phase = jobs.failed > 0 ? "needs_attention" : "done";
    await store.setInterviewStatus(
      interview.id,
      phase === "done" ? "done" : "failed",
      phase === "done" ? null : "some_windows_failed",
    );
    return progress(store, interview.id, phase);
  }
  return progress(store, interview.id, "extracting");
}

async function runWindow(
  ai: ImportAi,
  store: ImportStore,
  interview: InterviewRow,
  job: Awaited<ReturnType<ImportStore["claimJob"]>> & object,
  traceId: string,
) {
  const wanted = new Set(job.payload.segmentIds);
  const segments = (await store.listSegments(interview.id)).filter((s) => wanted.has(s.id));
  const master = await store.getMasterContext(interview.masterId);
  try {
    const out = await ai.extract({ master, segments, traceId });
    if (out.status !== "ok") {
      // Budget, a missing recording or invalid output after the role's own retries: try the job
      // again later unless it has used its attempts, then leave it for a human.
      await store.failJob(
        job.id,
        out.reason,
        job.attempts < MAX_JOB_ATTEMPTS && out.reason !== "budget",
      );
      return;
    }
    const existing = await store.cardEvidence(interview.id);
    const { keep, replace } = dedupeAgainst(existing, out.cards);
    if (replace.length) await store.deleteCards(replace);
    const inserted = await store.insertCards(
      keep.map((card) => ({
        masterId: interview.masterId,
        interviewId: interview.id,
        isSample: interview.isSample,
        promptVersion: ai.promptVersion,
        card,
      })),
    );
    await store.finishJob(job.id, {
      cards: inserted,
      dropped: out.dropped.length,
      welfareSegmentIds: out.welfareSegmentIds ?? [],
    });
  } catch (err) {
    await store.failJob(job.id, errorCode(err, "extract"), job.attempts < MAX_JOB_ATTEMPTS);
  }
}

/**
 * Windows overlap by a minute, so the same story can come back twice. A new card that shares at
 * least half its evidence with a card already saved is a duplicate: keep whichever has more steps.
 */
export function dedupeAgainst(existing: ExistingCardEvidence[], incoming: ExtractedCard[]) {
  const keep: ExtractedCard[] = [];
  const replace: string[] = [];
  for (const card of incoming) {
    const twin = existing.find(
      (e) => overlap(e.evidenceSegmentIds, card.evidenceSegmentIds) >= 0.5,
    );
    if (!twin) keep.push(card);
    else if (card.steps.length > twin.stepCount && !replace.includes(twin.id)) {
      replace.push(twin.id);
      keep.push(card);
    }
  }
  return { keep, replace };
}

export function overlap(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const shared = b.filter((x) => setA.has(x)).length;
  return shared / Math.min(setA.size, new Set(b).size);
}

export async function progress(
  store: ImportStore,
  interviewId: string,
  phase: Progress["phase"],
): Promise<Progress> {
  const [c, j, cards] = await Promise.all([
    store.chunkCounts(interviewId),
    store.jobCounts(interviewId),
    store.countCards(interviewId),
  ]);
  return {
    phase,
    chunks: { total: total(c), done: c.transcribed + c.silent, failed: c.failed },
    windows: { total: total(j), done: j.done, failed: j.failed },
    cards,
  };
}

function total(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function errorCode(err: unknown, prefix: string): string {
  const name = err instanceof Error ? err.name : "unknown";
  return `${prefix}_${name}`.slice(0, 80);
}
