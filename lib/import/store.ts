import type { AdminClient } from "@/lib/supabase/admin";
import type {
  ChunkStatus,
  ExtractedCard,
  ImportStore,
  InterviewStatus,
  JobRow,
  SegmentForExtraction,
} from "./types";

// The ImportStore on Supabase, through the service role. Callers have already checked who the
// person is and whether they may touch this interview (lib/import/access.ts).

const CHUNK_STATUSES: ChunkStatus[] = ["pending", "transcribed", "silent", "failed"];
const JOB_STATUSES: JobRow["status"][] = ["queued", "running", "done", "failed"];

function fail(what: string, error: { code?: string; message?: string } | null): never {
  throw new Error(`${what} failed${error?.code ? ` (${error.code})` : ""}`);
}

function countBy<K extends string>(rows: Array<{ status: string }>, keys: K[]): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const r of rows) if (r.status in out) out[r.status as K] += 1;
  return out;
}

/** Where a consent only first part ends (create.ts marks it `consent_only`), or null. */
export function consentOnlyEndMs(parts: unknown): number | null {
  if (!Array.isArray(parts)) return null;
  const first = parts[0] as { consent_only?: unknown; start_ms?: unknown; duration_ms?: unknown };
  if (!first || first.consent_only !== true) return null;
  const end = Number(first.start_ms ?? 0) + Number(first.duration_ms);
  return Number.isFinite(end) && end > 0 ? end : null;
}

export function createSupabaseStore(db: AdminClient): ImportStore {
  return {
    async getInterview(id) {
      const { data, error } = await db
        .from("interviews")
        .select("id, master_id, status, is_sample, duration_ms, error, parts")
        .eq("id", id)
        .maybeSingle();
      if (error) fail("read interview", error);
      if (!data) return null;
      return {
        id: data.id,
        masterId: data.master_id,
        status: data.status as InterviewStatus,
        isSample: data.is_sample,
        durationMs: data.duration_ms,
        error: data.error,
        consentOnlyEndMs: consentOnlyEndMs(data.parts),
      };
    },

    async getMasterContext(masterId) {
      const { data } = await db
        .from("masters")
        .select("years, classes, profiles!masters_profile_id_fkey(display_name)")
        .eq("id", masterId)
        .maybeSingle();
      const profile = data?.profiles as { display_name: string | null } | null | undefined;
      return {
        name: profile?.display_name ?? null,
        years: data?.years ?? null,
        classes: data?.classes ?? null,
      };
    },

    async getChunk(interviewId, idx) {
      const { data, error } = await db
        .from("audio_chunks")
        .select("idx, start_ms, end_ms, status, attempts, error")
        .eq("interview_id", interviewId)
        .eq("idx", idx)
        .maybeSingle();
      if (error) fail("read chunk", error);
      if (!data) return null;
      return {
        interviewId,
        idx: data.idx,
        startMs: data.start_ms,
        endMs: data.end_ms,
        status: data.status as ChunkStatus,
        attempts: data.attempts,
        error: data.error,
      };
    },

    async updateChunk(interviewId, idx, patch) {
      const { error } = await db
        .from("audio_chunks")
        .update(patch)
        .eq("interview_id", interviewId)
        .eq("idx", idx);
      if (error) fail("update chunk", error);
    },

    async chunkCounts(interviewId) {
      const { data, error } = await db
        .from("audio_chunks")
        .select("status")
        .eq("interview_id", interviewId);
      if (error) fail("count chunks", error);
      return countBy(data ?? [], CHUNK_STATUSES);
    },

    async lastSegmentTextBefore(interviewId, chunkIdx) {
      const { data } = await db
        .from("segments")
        .select("text_kn")
        .eq("interview_id", interviewId)
        .lt("chunk_idx", chunkIdx)
        .order("idx", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.text_kn ?? null;
    },

    async replaceChunkSegments(interviewId, chunkIdx, rows) {
      const del = await db
        .from("segments")
        .delete()
        .eq("interview_id", interviewId)
        .eq("chunk_idx", chunkIdx);
      if (del.error) fail("clear chunk segments", del.error);
      if (rows.length === 0) return;
      const { error } = await db.from("segments").insert(
        rows.map((r) => ({
          interview_id: r.interviewId,
          idx: r.idx,
          chunk_idx: r.chunkIdx,
          start_ms: r.startMs,
          end_ms: r.endMs,
          text_kn: r.textKn,
          text_en: r.textEn,
          redacted: r.redacted,
          speaker: r.speaker,
        })),
      );
      if (error) fail("insert segments", error);
    },

    async listSegments(interviewId): Promise<SegmentForExtraction[]> {
      const { data, error } = await db
        .from("segments")
        .select("id, start_ms, end_ms, text_kn, text_en, speaker, redacted")
        .eq("interview_id", interviewId)
        .order("start_ms")
        .order("idx")
        .limit(5000);
      if (error) fail("list segments", error);
      return (data ?? []).map((s) => ({
        id: Number(s.id),
        startMs: s.start_ms,
        endMs: s.end_ms,
        textKn: s.text_kn,
        textEn: s.text_en,
        speaker: s.speaker,
        redacted: s.redacted,
      }));
    },

    async setInterviewStatus(id, status, error = null) {
      const res = await db.from("interviews").update({ status, error }).eq("id", id);
      if (res.error) fail("update interview", res.error);
    },

    async ensureWindowJobs(interviewId, windows) {
      // One row at a time: a duplicate window (two tabs at once) is a unique violation we ignore.
      for (const w of windows) {
        const { error } = await db.from("jobs").insert({
          kind: "extract_window",
          interview_id: interviewId,
          payload: { window: String(w.window), segmentIds: w.segmentIds },
        });
        if (error && error.code !== "23505") fail("create extraction job", error);
      }
    },

    async jobCounts(interviewId) {
      const { data, error } = await db
        .from("jobs")
        .select("status")
        .eq("interview_id", interviewId)
        .eq("kind", "extract_window");
      if (error) fail("count jobs", error);
      return countBy(data ?? [], JOB_STATUSES);
    },

    async claimJob(interviewId) {
      const { data, error } = await db.rpc("claim_job", {
        p_interview: interviewId,
        p_kinds: ["extract_window"],
      });
      if (error) fail("claim job", error);
      const row = (data as Array<Record<string, unknown>> | null)?.[0];
      if (!row) return null;
      const payload = row.payload as { window: string | number; segmentIds: number[] };
      return {
        id: String(row.id),
        kind: String(row.kind),
        status: row.status as JobRow["status"],
        attempts: Number(row.attempts),
        payload: { window: Number(payload.window), segmentIds: payload.segmentIds.map(Number) },
      };
    },

    async finishJob(id, result) {
      const { error } = await db
        .from("jobs")
        .update({ status: "done", result, error: null, locked_until: null })
        .eq("id", id);
      if (error) fail("finish job", error);
    },

    async failJob(id, reason, retry) {
      const { error } = await db
        .from("jobs")
        .update({ status: retry ? "queued" : "failed", error: reason, locked_until: null })
        .eq("id", id);
      if (error) fail("fail job", error);
    },

    async cardEvidence(interviewId) {
      const { data, error } = await db
        .from("cards")
        .select("id, evidence_segment_ids, steps")
        .eq("interview_id", interviewId)
        .eq("status", "draft");
      if (error) fail("read card evidence", error);
      return (data ?? []).map((c) => ({
        id: c.id,
        evidenceSegmentIds: (c.evidence_segment_ids ?? []).map(Number),
        stepCount: Array.isArray(c.steps) ? c.steps.length : 0,
      }));
    },

    async insertCards(rows) {
      if (rows.length === 0) return 0;
      const { error } = await db.from("cards").insert(
        rows.map(({ masterId, interviewId, isSample, promptVersion, card }) =>
          cardRow(card, {
            master_id: masterId,
            interview_id: interviewId,
            is_sample: isSample,
            prompt_version: promptVersion,
          }),
        ),
      );
      if (error) fail("insert cards", error);
      return rows.length;
    },

    async deleteCards(ids) {
      if (ids.length === 0) return;
      const { error } = await db.from("cards").delete().in("id", ids).eq("status", "draft");
      if (error) fail("delete duplicate cards", error);
    },

    async countCards(interviewId) {
      const { count, error } = await db
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("interview_id", interviewId);
      if (error) fail("count cards", error);
      return count ?? 0;
    },
  };
}

function cardRow(card: ExtractedCard, base: Record<string, unknown>) {
  return {
    ...base,
    status: "draft",
    title_kn: card.titleKn,
    title_en: card.titleEn,
    problem_kn: card.problemKn,
    problem_en: card.problemEn,
    steps: card.steps.map((s) => ({
      kn: s.kn,
      en: s.en,
      evidence_segment_ids: s.evidenceSegmentIds,
    })),
    materials: card.materials,
    why_kn: card.whyKn,
    why_en: card.whyEn,
    grade_band: card.gradeBand,
    subject: card.subject,
    topic: card.topic,
    evidence_segment_ids: card.evidenceSegmentIds,
    quote_segment_id: card.quoteSegmentId,
    flags: card.flags,
  };
}
