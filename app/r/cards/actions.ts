"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFor } from "@/lib/auth/session";
import { revalidateOpenCards } from "@/lib/open/load";
import { createClient } from "@/lib/supabase/server";

// Reviewer decisions on a draft card. Writes go through the reviewer's own client, so RLS
// (cards_review: reviewers only, sample accounts only on sample cards, D38) and the 0004 consent
// trigger decide; this code never widens what the database allows.

export type ReviewResult =
  | { ok: true }
  | {
      ok: false;
      error: "sign_in_needed" | "not_allowed" | "consent_missing" | "invalid" | "failed";
    };

const Id = z.uuid();
const BiText = z.object({
  kn: z.string().trim().min(1).max(600),
  en: z.string().trim().min(1).max(600),
});

const EditSchema = z.object({
  title: BiText,
  problem: BiText,
  steps: z
    .array(BiText.extend({ evidenceSegmentIds: z.array(z.number().int().positive()).min(1) }))
    .min(1)
    .max(10),
  materials: z.array(BiText).max(12),
  why: BiText.nullable(),
  gradeBand: z.string().max(10).nullable(),
  topic: z.string().max(40).nullable(),
});
export type CardEdits = z.infer<typeof EditSchema>;

async function reviewer() {
  const session = await getSessionFor("reviewer");
  const db = await createClient();
  return session && db ? { session, db } : null;
}

function mapError(code: string | undefined, message: string | undefined): ReviewResult {
  if (code === "23514" && message?.includes("consent"))
    return { ok: false, error: "consent_missing" };
  return { ok: false, error: "failed" };
}

export async function approveCard(cardId: string): Promise<ReviewResult> {
  if (!Id.safeParse(cardId).success) return { ok: false, error: "invalid" };
  const r = await reviewer();
  if (!r) return { ok: false, error: "sign_in_needed" };
  const { data, error } = await r.db
    .from("cards")
    .update({
      status: "approved",
      reviewer_id: r.session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .select("id");
  if (error) return mapError(error.code, error.message);
  if (!data?.length) return { ok: false, error: "not_allowed" };
  revalidatePath("/r/cards");
  revalidateOpenCards();
  return { ok: true };
}

export async function rejectCard(cardId: string, reason: string): Promise<ReviewResult> {
  if (!Id.safeParse(cardId).success) return { ok: false, error: "invalid" };
  const r = await reviewer();
  if (!r) return { ok: false, error: "sign_in_needed" };
  const why =
    reason
      .trim()
      .slice(0, 40)
      .replace(/[^a-z_]/gi, "") || "other";
  const { data: current } = await r.db.from("cards").select("flags").eq("id", cardId).maybeSingle();
  const { data, error } = await r.db
    .from("cards")
    .update({
      status: "rejected",
      reviewer_id: r.session.userId,
      reviewed_at: new Date().toISOString(),
      flags: [...((current?.flags as string[] | null) ?? []), `rejected:${why}`],
    })
    .eq("id", cardId)
    .select("id");
  if (error) return mapError(error.code, error.message);
  if (!data?.length) return { ok: false, error: "not_allowed" };
  revalidatePath("/r/cards");
  revalidateOpenCards();
  return { ok: true };
}

/** Saves a reviewer's wording fixes. Evidence stays attached to every step (Law 4). */
export async function saveCardEdits(cardId: string, edits: CardEdits): Promise<ReviewResult> {
  if (!Id.safeParse(cardId).success) return { ok: false, error: "invalid" };
  const parsed = EditSchema.safeParse(edits);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const r = await reviewer();
  if (!r) return { ok: false, error: "sign_in_needed" };
  const e = parsed.data;
  const { data, error } = await r.db
    .from("cards")
    .update({
      title_kn: e.title.kn,
      title_en: e.title.en,
      problem_kn: e.problem.kn,
      problem_en: e.problem.en,
      steps: e.steps.map((s) => ({
        kn: s.kn,
        en: s.en,
        evidence_segment_ids: s.evidenceSegmentIds,
      })),
      materials: e.materials,
      why_kn: e.why?.kn ?? null,
      why_en: e.why?.en ?? null,
      grade_band: e.gradeBand,
      topic: e.topic,
      evidence_segment_ids: [...new Set(e.steps.flatMap((s) => s.evidenceSegmentIds))],
      edited_by_reviewer: true,
    })
    .eq("id", cardId)
    .eq("status", "draft")
    .select("id");
  if (error) return mapError(error.code, error.message);
  if (!data?.length) return { ok: false, error: "not_allowed" };
  revalidatePath(`/r/cards/${cardId}`);
  return { ok: true };
}
