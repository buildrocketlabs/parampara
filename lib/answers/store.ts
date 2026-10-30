import { z } from "zod";
import type { Session } from "@/lib/auth/session";
import type { Trace } from "@/lib/ask/types";
import type { ServerClient } from "@/lib/supabase/server";

// One answer as the teacher who asked sees it. Read with her own client: RLS (answers_own) means a
// teacher only ever opens her own answers. Master credit comes from v_master_credit, so a master
// who chose "first name" or "anonymous" is shown exactly that way.

const Tri = z.object({ kn: z.string(), en: z.string(), hi: z.string().nullish() });
const StepRow = Tri.extend({ card_id: z.string(), verdict: z.string().optional() });

const AnswerRow = z.object({
  id: z.string(),
  status: z.enum(["pending", "answered", "needs_human", "escalated", "failed"]),
  outcome: z.string().nullable().default(null),
  lang: z.enum(["kn", "en", "hi"]).default("kn"),
  title_kn: z.string().nullable(),
  title_en: z.string().nullable(),
  title_hi: z.string().nullable().default(null),
  steps: z.array(StepRow).default([]),
  materials: z.array(Tri).default([]),
  why: Tri.nullable().default(null),
  card_ids: z.array(z.string()).default([]),
  trace: z.unknown(),
  replayed: z.boolean(),
  replayed_from: z.string().nullable().default(null),
  is_sample: z.boolean(),
  created_at: z.string(),
  question_id: z.string(),
});

export type AnswerView = {
  id: string;
  status: z.infer<typeof AnswerRow>["status"];
  /** What kind of answer: decides the care shown on a revisit (child safety, distress, …). */
  outcome: string | null;
  lang: "kn" | "en" | "hi";
  title: { kn: string; en: string; hi?: string };
  steps: Array<{ kn: string; en: string; hi?: string; cardId: string; masterName: string | null }>;
  materials: Array<{ kn: string; en: string; hi?: string }>;
  why: { kn: string; en: string; hi?: string } | null;
  master: { name: string | null; years: number | null; district: string | null; isSample: boolean };
  /** The moment of the first card's master speaking, if they allowed teachers to hear it. */
  quoteSegmentId: number | null;
  /** The answer's cards in order; the first is the one its Tomorrow card shares. */
  cardIds: string[];
  trace: Trace | null;
  replayed: boolean;
  firstAnsweredAt: string | null;
  isSample: boolean;
  createdAt: string;
  question: string | null;
  /** A gentle line under the steps, never a helpline: a child who comes hungry (D72). */
  note: "hunger" | null;
};

const clean = <T extends { hi?: string | null }>(t: T) => ({ ...t, hi: t.hi ?? undefined });

export async function getAnswerView(
  db: ServerClient,
  session: Session,
  id: string,
): Promise<AnswerView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from("answers").select("*").eq("id", id).maybeSingle();
  const parsed = AnswerRow.safeParse(data);
  if (!parsed.success) return null;
  const a = parsed.data;

  const [{ data: cards }, { data: q }, firstAt] = await Promise.all([
    a.card_ids.length
      ? db.from("cards").select("id, master_id, quote_segment_id").in("id", a.card_ids)
      : Promise.resolve({
          data: [] as Array<{ id: string; master_id: string; quote_segment_id: number | null }>,
        }),
    db.from("questions").select("text_redacted, safety_flags").eq("id", a.question_id).maybeSingle(),
    a.replayed_from
      ? db
          .from("answers")
          .select("created_at")
          .eq("id", a.replayed_from)
          .maybeSingle()
          .then((r) => r.data?.created_at ?? null)
      : Promise.resolve(null),
  ]);
  const masterIds = [...new Set((cards ?? []).map((c) => c.master_id as string))];
  const { data: credit } = masterIds.length
    ? await db
        .from("v_master_credit")
        .select("master_id, display_name, district, years, voice_public, is_sample")
        .in("master_id", masterIds)
    : { data: [] as Array<Record<string, unknown>> };
  const creditBy = new Map((credit ?? []).map((m) => [m.master_id as string, m]));
  const cardMaster = new Map((cards ?? []).map((c) => [c.id as string, c.master_id as string]));
  const nameOf = (cardId: string) =>
    (creditBy.get(cardMaster.get(cardId) ?? "")?.display_name as string | null) ?? null;

  const first = (cards ?? []).find((c) => c.id === a.steps[0]?.card_id) ?? (cards ?? [])[0];
  const lead = first ? creditBy.get(first.master_id as string) : undefined;
  const quote =
    first && lead?.voice_public && first.quote_segment_id != null
      ? Number(first.quote_segment_id)
      : null;

  return {
    id: a.id,
    status: a.status,
    outcome: a.outcome,
    lang: a.lang,
    title: { kn: a.title_kn ?? "", en: a.title_en ?? "", hi: a.title_hi ?? undefined },
    steps: a.steps.map((s) => ({ ...clean(s), cardId: s.card_id, masterName: nameOf(s.card_id) })),
    materials: a.materials.map(clean),
    why: a.why ? clean(a.why) : null,
    master: {
      name: (lead?.display_name as string | null) ?? null,
      years: (lead?.years as number | null) ?? null,
      district: (lead?.district as string | null) ?? null,
      isSample: Boolean(lead?.is_sample ?? a.is_sample),
    },
    quoteSegmentId: quote,
    cardIds: a.card_ids,
    trace: (a.trace as Trace | null) ?? null,
    replayed: a.replayed,
    firstAnsweredAt: firstAt,
    isSample: a.is_sample || session.isSample,
    createdAt: a.created_at,
    question: (q?.text_redacted as string | null) ?? null,
    // Only beside steps or the honest "no master yet": never with a helpline outcome.
    note:
      (a.status === "answered" || a.outcome === "no_card") &&
      ((q?.safety_flags as string[] | null) ?? []).includes("hunger")
        ? "hunger"
        : null,
  };
}
