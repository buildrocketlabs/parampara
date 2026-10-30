import type { Bi } from "@/lib/domain/interview";
import type { Trace } from "@/lib/ask/types";
import type { AdminClient } from "@/lib/supabase/admin";
import { DEMO_ACCOUNTS } from "@/lib/auth/roles";

// The answer /how shows to a signed out judge: one real, already shipped answer, read from the
// database. Only ever the seeded Sample demo teacher's own question (never anyone who joined by
// invite, safety audit re check, 24 Oct), so no field teacher's question is ever shown (Law 6).
// First choice: his question answered from Mahesh Bedavatti's approved field card on lines and
// circles (the film's question, D102). Each cited card carries its master's credit as they chose
// it and the seconds of the recording behind each step, never the transcript.

export type ShowcaseCard = {
  id: string;
  title: Bi;
  /** The master's name as they chose to be credited (v_master_credit); null when anonymous. */
  master: Bi | null;
  isSample: boolean;
  /** Where each card step sits in the recording, in seconds from the interview's start. */
  spans: Array<{ step: number; from: number; to: number }>;
};

export type Showcase = {
  trace: Trace;
  cards: ShowcaseCard[];
  /** True when every cited card is an approved Koppal field test card. */
  field: boolean;
};

/** The film's card (D102): his practice of lines and circles before letters. */
const LEAD_CARD_TITLE = "%lines and circles%";

export async function loadShowcase(db: AdminClient): Promise<Showcase | null> {
  const { data: demo } = await db
    .from("profiles")
    .select("id")
    .eq("role", "teacher")
    .eq("is_sample", true)
    .eq("display_name", DEMO_ACCOUNTS.teacher.displayName)
    .maybeSingle();
  if (!demo) return null;

  const { data: lead } = await db
    .from("cards")
    .select("id")
    .eq("is_sample", false)
    .eq("status", "approved")
    .ilike("title_en", LEAD_CARD_TITLE)
    .limit(1)
    .maybeSingle();

  const shipped = () =>
    db
      .from("answers")
      .select("trace, card_ids, questions!inner(teacher_id)")
      .eq("questions.teacher_id", demo.id)
      .eq("is_sample", true)
      .eq("status", "answered")
      .eq("replayed", false)
      .order("created_at", { ascending: false })
      .limit(1);
  const fromLead = lead ? await shipped().contains("card_ids", [lead.id]).maybeSingle() : null;
  const row = fromLead?.data ?? (await shipped().maybeSingle()).data;
  const trace = row?.trace as Trace | undefined;
  if (!row || !trace || !Array.isArray(trace.steps) || trace.steps.length === 0) return null;

  const cards = await citedCards(db, (row.card_ids as string[] | null) ?? []);
  return { trace, cards, field: cards.length > 0 && cards.every((c) => !c.isSample) };
}

async function citedCards(db: AdminClient, ids: string[]): Promise<ShowcaseCard[]> {
  if (ids.length === 0) return [];
  const { data: cards } = await db
    .from("cards")
    .select("id, title_kn, title_en, steps, is_sample, master_id")
    .in("id", ids)
    .eq("status", "approved");
  if (!cards || cards.length === 0) return [];
  const masterIds = [...new Set(cards.map((c) => c.master_id as string))];
  const { data: credits } = await db
    .from("v_master_credit")
    .select("master_id, display_name")
    .in("master_id", masterIds);
  const credit = new Map((credits ?? []).map((m) => [m.master_id as string, m.display_name]));

  const stepSegments = (steps: unknown): number[][] =>
    (Array.isArray(steps) ? steps : []).map((s) =>
      Array.isArray((s as { evidence_segment_ids?: unknown }).evidence_segment_ids)
        ? (s as { evidence_segment_ids: unknown[] }).evidence_segment_ids.map(Number)
        : [],
    );
  const segIds = [...new Set(cards.flatMap((c) => stepSegments(c.steps).flat()))];
  const { data: segs } = segIds.length
    ? await db.from("segments").select("id, start_ms, end_ms").in("id", segIds)
    : { data: [] };
  const seg = new Map((segs ?? []).map((s) => [Number(s.id), s]));

  return ids
    .map((id) => cards.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      id: c.id as string,
      title: { kn: c.title_kn as string, en: c.title_en as string },
      master: bilingualName(credit.get(c.master_id as string) as string | null | undefined),
      isSample: Boolean(c.is_sample),
      spans: stepSegments(c.steps).flatMap((list, i) => {
        const found = list.map((n) => seg.get(n)).filter((s) => s !== undefined);
        if (found.length === 0) return [];
        const from = Math.min(...found.map((s) => Number(s.start_ms))) / 1000;
        const to = Math.max(...found.map((s) => Number(s.end_ms))) / 1000;
        return [{ step: i + 1, from, to }];
      }),
    }));
}

/** "Mahesh Bedavatti / ಮಹೇಶ ಬೆದವಟ್ಟಿ" (D101) reads as each language's own spelling. */
export function bilingualName(name: string | null | undefined): Bi | null {
  if (!name) return null;
  const parts = name.split(" / ").map((p) => p.trim());
  if (parts.length !== 2) return { kn: name, en: name };
  const kannada = (t: string) => /[\u0C80-\u0CFF]/.test(t);
  const kn = parts.find(kannada) ?? parts[1]!;
  const en = parts.find((t) => !kannada(t)) ?? parts[0]!;
  return { kn, en };
}

/** 35.2 → "0:35"; the seconds a teacher would hear, as the deck and the answer page write them. */
export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
