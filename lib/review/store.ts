import { z } from "zod";
import type { Session } from "@/lib/auth/session";
import type { AdminClient } from "@/lib/supabase/admin";
import type { ServerClient } from "@/lib/supabase/server";
import type { DraftSummary, ReviewCard, ReviewSegment } from "./types";

// Reviewer reads go through the reviewer's own client, so RLS decides what is visible
// (0001 cards_select, segments_select). A sample (demo) reviewer is shown sample work only (D38).

const BiSchema = z.object({ kn: z.string(), en: z.string() });
const StepSchema = BiSchema.extend({
  evidence_segment_ids: z.array(z.coerce.number()).default([]),
});

const CardRow = z.object({
  id: z.string(),
  status: z.enum(["draft", "approved", "rejected"]),
  is_sample: z.boolean(),
  title_kn: z.string(),
  title_en: z.string(),
  problem_kn: z.string(),
  problem_en: z.string(),
  steps: z.array(StepSchema),
  materials: z.array(BiSchema).default([]),
  why_kn: z.string().nullable(),
  why_en: z.string().nullable(),
  grade_band: z.string().nullable(),
  subject: z.string().nullable(),
  topic: z.string().nullable(),
  flags: z.array(z.string()).default([]),
  evidence_segment_ids: z.array(z.coerce.number()).default([]),
  quote_segment_id: z.coerce.number().nullable().default(null),
  created_at: z.string(),
  interview_id: z.string().nullable(),
  master_id: z.string(),
});

const CARD_COLUMNS =
  "id, status, is_sample, title_kn, title_en, problem_kn, problem_en, steps, materials, why_kn, why_en, grade_band, subject, topic, flags, evidence_segment_ids, quote_segment_id, created_at, interview_id, master_id";

/** Context around the evidence, so the reviewer reads what came before and after. */
const CONTEXT_MS = 90_000;

export async function listDrafts(
  db: ServerClient,
  admin: AdminClient,
  session: Session,
): Promise<DraftSummary[]> {
  let q = db
    .from("cards")
    .select(
      "id, title_kn, title_en, topic, grade_band, steps, flags, is_sample, created_at, master_id",
    )
    .eq("status", "draft")
    .order("created_at", { ascending: true })
    .limit(200);
  if (session.isSample) q = q.eq("is_sample", true);
  const { data, error } = await q;
  if (error) throw new Error(`list drafts failed (${error.code})`);
  const names = await masterNames(admin, [
    ...new Set((data ?? []).map((c) => c.master_id as string)),
  ]);
  return (data ?? []).map((c) => ({
    id: c.id,
    title: { kn: c.title_kn, en: c.title_en },
    topic: c.topic,
    gradeBand: c.grade_band,
    steps: Array.isArray(c.steps) ? c.steps.length : 0,
    flags: c.flags ?? [],
    isSample: c.is_sample,
    masterName: names.get(c.master_id) ?? null,
    createdAt: c.created_at,
  }));
}

/** Reviewers are accountable for whose words a card carries, so they see the master's own name and
 * district (teachers see only what the master chose, through v_master_credit). Server only. */
async function masterNames(admin: AdminClient, ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const { data } = await admin.from("masters").select("id, profiles!masters_profile_id_fkey(display_name)").in("id", ids);
  return new Map(
    (data ?? []).map((m) => {
      const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as
        { display_name: string | null } | undefined;
      return [m.id as string, p?.display_name ?? null];
    }),
  );
}

async function masterDetail(admin: AdminClient, id: string) {
  const { data } = await admin
    .from("masters")
    .select("id, years, consented_at, voice_public, profiles!masters_profile_id_fkey(display_name, district)")
    .eq("id", id)
    .maybeSingle();
  const p = (Array.isArray(data?.profiles) ? data?.profiles[0] : data?.profiles) as
    { display_name: string | null; district: string | null } | undefined;
  return {
    name: p?.display_name ?? null,
    district: p?.district ?? null,
    years: (data?.years as number | null) ?? null,
    consented: Boolean(data?.consented_at),
    voicePublic: Boolean(data?.voice_public),
  };
}

export async function getReviewCard(
  db: ServerClient,
  admin: AdminClient,
  session: Session,
  id: string,
): Promise<{ card: ReviewCard; segments: ReviewSegment[] } | null> {
  const { data, error } = await db.from("cards").select(CARD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`read card failed (${error.code})`);
  const row = CardRow.safeParse(data);
  if (!row.success) return null;
  const c = row.data;
  if (session.isSample && !c.is_sample) return null;

  const master = await masterDetail(admin, c.master_id);

  let segments: ReviewSegment[] = [];
  if (c.interview_id) {
    const { data: ev } = await db
      .from("segments")
      .select("start_ms, end_ms")
      .in("id", c.evidence_segment_ids.length ? c.evidence_segment_ids : [-1]);
    const from = Math.max(
      0,
      Math.min(...(ev ?? []).map((s) => s.start_ms), Number.MAX_SAFE_INTEGER) - CONTEXT_MS,
    );
    const to = Math.max(...(ev ?? []).map((s) => s.end_ms), 0) + CONTEXT_MS;
    const { data: segs } = await db
      .from("segments")
      .select("id, start_ms, end_ms, text_kn, text_en, speaker, redacted")
      .eq("interview_id", c.interview_id)
      .gte("end_ms", from)
      .lte("start_ms", to)
      .order("start_ms")
      .limit(400);
    segments = (segs ?? []).map((s) => ({
      id: Number(s.id),
      startMs: s.start_ms,
      endMs: s.end_ms,
      kn: s.text_kn,
      en: s.text_en,
      speaker: s.speaker,
      redacted: s.redacted,
    }));
  }

  return {
    card: {
      id: c.id,
      status: c.status,
      isSample: c.is_sample,
      title: { kn: c.title_kn, en: c.title_en },
      problem: { kn: c.problem_kn, en: c.problem_en },
      steps: c.steps.map((s) => ({
        kn: s.kn,
        en: s.en,
        evidenceSegmentIds: s.evidence_segment_ids,
      })),
      materials: c.materials,
      why: c.why_kn && c.why_en ? { kn: c.why_kn, en: c.why_en } : null,
      gradeBand: c.grade_band,
      subject: c.subject,
      topic: c.topic,
      flags: c.flags,
      evidenceSegmentIds: c.evidence_segment_ids,
      quoteSegmentId: c.quote_segment_id,
      createdAt: c.created_at,
      interviewId: c.interview_id,
      master: { id: c.master_id, ...master },
    },
    segments,
  };
}
