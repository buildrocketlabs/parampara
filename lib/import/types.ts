// Shapes shared by the import pipeline (docs/BUILD.md M2). The AI functions are injected so the
// pipeline is tested without keys or a database; lib/import/deps.ts wires the real ones from @/ai.

export type Phrase = { startMs: number; endMs: number; text: string };

export type RedactedPhrase = {
  startMs: number;
  endMs: number;
  textKn: string;
  textEn: string | null;
  childNameRedacted: boolean;
  /** A parent's or another private person's name was removed. */
  otherNameRedacted?: boolean;
  speakerGuess: "master" | "interviewer" | "other" | null;
};

export type SegmentForExtraction = {
  id: number;
  startMs: number;
  endMs: number;
  textKn: string;
  textEn: string | null;
  speaker: string | null;
  /** A name was removed here: its audio is never played to teachers (Law 5). */
  redacted?: boolean;
};

export type Bilingual = { kn: string; en: string };

export type ExtractedCard = {
  titleKn: string;
  titleEn: string;
  problemKn: string;
  problemEn: string;
  gradeBand: string;
  subject: string;
  topic: string;
  steps: Array<{ kn: string; en: string; evidenceSegmentIds: number[] }>;
  materials: Bilingual[];
  whyKn: string;
  whyEn: string;
  evidenceSegmentIds: number[];
  quoteSegmentId: number | null;
  flags: string[];
};

export type NeedsHuman = { status: "needs_human"; reason: string };

export type MasterContext = { name: string | null; years: number | null; classes: string | null };

export type ImportAi = {
  transcribe(
    wav: Uint8Array,
    opts: { traceId: string },
  ): Promise<{ text: string; phrases: Phrase[] }>;
  redact(input: {
    phrases: Phrase[];
    masterName?: string;
    previousText?: string;
    traceId: string;
  }): Promise<{ status: "ok"; phrases: RedactedPhrase[] } | NeedsHuman>;
  extract(input: {
    master: MasterContext;
    segments: SegmentForExtraction[];
    traceId: string;
  }): Promise<
    | {
        status: "ok";
        cards: ExtractedCard[];
        dropped: Array<{ reason: string; summaryEn: string }>;
        /** Moments where the master mentions harm to a child: a human listens (Law 5). */
        welfareSegmentIds?: number[];
      }
    | NeedsHuman
  >;
  /** Splits a long interview into extraction windows (each one call under the 300 s limit, D40). */
  windows(segments: SegmentForExtraction[]): SegmentForExtraction[][];
  promptVersion: string;
};

export type ChunkStatus = "pending" | "transcribed" | "silent" | "failed";

export type ChunkRow = {
  interviewId: string;
  idx: number;
  startMs: number;
  endMs: number;
  status: ChunkStatus;
  attempts: number;
  error: string | null;
};

export type InterviewStatus =
  "consented" | "recording" | "transcribing" | "extracting" | "done" | "failed";

export type InterviewRow = {
  id: string;
  masterId: string;
  status: InterviewStatus;
  isSample: boolean;
  durationMs: number | null;
  error: string | null;
  /**
   * The first part is a consent note only (WhatsApp import, F-A1): segments that start before this
   * point on the timeline are never sent for card extraction. Null or absent: every segment is.
   */
  consentOnlyEndMs?: number | null;
};

export type JobRow = {
  id: string;
  kind: string;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
  payload: { window: number; segmentIds: number[] };
};

export type SegmentInsert = {
  interviewId: string;
  idx: number;
  chunkIdx: number;
  startMs: number;
  endMs: number;
  textKn: string;
  textEn: string | null;
  redacted: boolean;
  speaker: "master" | "interviewer" | "other" | null;
};

export type CardInsert = {
  masterId: string;
  interviewId: string;
  isSample: boolean;
  promptVersion: string;
  card: ExtractedCard;
};

export type ExistingCardEvidence = { id: string; evidenceSegmentIds: number[]; stepCount: number };

/** Everything the pipeline reads or writes. lib/import/store.ts is the Supabase version. */
export type ImportStore = {
  getInterview(id: string): Promise<InterviewRow | null>;
  getMasterContext(masterId: string): Promise<MasterContext>;
  getChunk(interviewId: string, idx: number): Promise<ChunkRow | null>;
  updateChunk(
    interviewId: string,
    idx: number,
    patch: Partial<Pick<ChunkRow, "status" | "attempts" | "error">>,
  ): Promise<void>;
  chunkCounts(interviewId: string): Promise<Record<ChunkStatus, number>>;
  lastSegmentTextBefore(interviewId: string, chunkIdx: number): Promise<string | null>;
  replaceChunkSegments(interviewId: string, chunkIdx: number, rows: SegmentInsert[]): Promise<void>;
  listSegments(interviewId: string): Promise<SegmentForExtraction[]>;
  setInterviewStatus(id: string, status: InterviewStatus, error?: string | null): Promise<void>;
  ensureWindowJobs(
    interviewId: string,
    windows: Array<{ window: number; segmentIds: number[] }>,
  ): Promise<void>;
  jobCounts(interviewId: string): Promise<Record<JobRow["status"], number>>;
  claimJob(interviewId: string): Promise<JobRow | null>;
  finishJob(id: string, result: Record<string, unknown>): Promise<void>;
  failJob(id: string, error: string, retry: boolean): Promise<void>;
  cardEvidence(interviewId: string): Promise<ExistingCardEvidence[]>;
  insertCards(rows: CardInsert[]): Promise<number>;
  deleteCards(ids: string[]): Promise<void>;
  countCards(interviewId: string): Promise<number>;
};
