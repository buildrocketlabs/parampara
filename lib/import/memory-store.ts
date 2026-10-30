import type {
  CardInsert,
  ChunkRow,
  ChunkStatus,
  ImportStore,
  InterviewRow,
  JobRow,
  MasterContext,
  SegmentForExtraction,
  SegmentInsert,
} from "./types";

// In memory ImportStore for unit tests and fixture mode. Mirrors the Supabase store's semantics:
// claimed jobs are exclusive, window jobs are unique per window, segments replace per chunk.
export function createMemoryStore(seed: {
  interview: InterviewRow;
  master?: MasterContext;
  chunks: Array<Pick<ChunkRow, "idx" | "startMs" | "endMs"> & { status?: ChunkStatus }>;
}): ImportStore & {
  segments: Array<SegmentInsert & { id: number }>;
  cards: Array<CardInsert & { id: string }>;
  jobs: JobRow[];
  interview: InterviewRow;
} {
  const interview = { ...seed.interview };
  const chunks: ChunkRow[] = seed.chunks.map((c) => ({
    interviewId: interview.id,
    idx: c.idx,
    startMs: c.startMs,
    endMs: c.endMs,
    status: c.status ?? "pending",
    attempts: 0,
    error: null,
  }));
  const segments: Array<SegmentInsert & { id: number }> = [];
  const cards: Array<CardInsert & { id: string }> = [];
  const jobs: JobRow[] = [];
  let nextSegmentId = 1;
  let nextJobId = 1;
  let nextCardId = 1;

  const countBy = <K extends string>(items: Array<{ status: K }>, keys: K[]) =>
    Object.fromEntries(keys.map((k) => [k, items.filter((i) => i.status === k).length])) as Record<
      K,
      number
    >;

  return {
    interview,
    segments,
    cards,
    jobs,
    async getInterview(id) {
      return id === interview.id ? { ...interview } : null;
    },
    async getMasterContext() {
      return seed.master ?? { name: null, years: null, classes: null };
    },
    async getChunk(_id, idx) {
      const c = chunks.find((x) => x.idx === idx);
      return c ? { ...c } : null;
    },
    async updateChunk(_id, idx, patch) {
      const c = chunks.find((x) => x.idx === idx);
      if (c) Object.assign(c, patch);
    },
    async chunkCounts() {
      return countBy(chunks, ["pending", "transcribed", "silent", "failed"]);
    },
    async lastSegmentTextBefore(_id, chunkIdx) {
      const before = segments.filter((s) => s.chunkIdx < chunkIdx).sort((a, b) => b.idx - a.idx);
      return before[0]?.textKn ?? null;
    },
    async replaceChunkSegments(_id, chunkIdx, rows) {
      for (let i = segments.length - 1; i >= 0; i--)
        if (segments[i]!.chunkIdx === chunkIdx) segments.splice(i, 1);
      for (const r of rows) segments.push({ ...r, id: nextSegmentId++ });
    },
    async listSegments(): Promise<SegmentForExtraction[]> {
      return [...segments]
        .sort((a, b) => a.startMs - b.startMs)
        .map((s) => ({
          id: s.id,
          startMs: s.startMs,
          endMs: s.endMs,
          textKn: s.textKn,
          textEn: s.textEn,
          speaker: s.speaker,
          redacted: s.redacted,
        }));
    },
    async setInterviewStatus(_id, status, error = null) {
      interview.status = status;
      interview.error = error;
    },
    async ensureWindowJobs(_id, windows) {
      for (const w of windows) {
        if (jobs.some((j) => j.payload.window === w.window)) continue;
        jobs.push({
          id: `job-${nextJobId++}`,
          kind: "extract_window",
          status: "queued",
          attempts: 0,
          payload: w,
        });
      }
    },
    async jobCounts() {
      return countBy(jobs, ["queued", "running", "done", "failed"]);
    },
    async claimJob() {
      const j = jobs.find((x) => x.status === "queued");
      if (!j) return null;
      j.status = "running";
      j.attempts += 1;
      return { ...j, payload: { ...j.payload } };
    },
    async finishJob(id) {
      const j = jobs.find((x) => x.id === id);
      if (j) j.status = "done";
    },
    async failJob(id, _error, retry) {
      const j = jobs.find((x) => x.id === id);
      if (j) j.status = retry ? "queued" : "failed";
    },
    async cardEvidence() {
      return cards.map((c) => ({
        id: c.id,
        evidenceSegmentIds: c.card.evidenceSegmentIds,
        stepCount: c.card.steps.length,
      }));
    },
    async insertCards(rows) {
      for (const r of rows) cards.push({ ...r, id: `card-${nextCardId++}` });
      return rows.length;
    },
    async deleteCards(ids) {
      for (let i = cards.length - 1; i >= 0; i--)
        if (ids.includes(cards[i]!.id)) cards.splice(i, 1);
    },
    async countCards() {
      return cards.length;
    },
  };
}
