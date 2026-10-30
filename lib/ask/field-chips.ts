import type { AdminClient } from "@/lib/supabase/admin";

// The question chips a FIELD teacher sees under the mic (D64, D83): drawn only from real,
// approved cards of masters whose consent is on record, so a tap asks something a Koppal master
// has really answered. Never a Sample chip, and never padded: fewer than 3 field cards shows
// fewer chips (or none, with an honest line). Sample (demo) accounts keep the warmed Sample chips.

export const FIELD_CHIPS = 3;

export type FieldChip = {
  cardId: string;
  /** The chip's short label: the card's title. */
  title: { kn: string; en: string };
  /** What a tap asks: the card's problem, in her words' language. */
  ask: { kn: string; en: string };
};

export type ChipCard = {
  id: string;
  masterId: string;
  status: string;
  isSample: boolean;
  topic: string | null;
  titleKn: string;
  titleEn: string;
  problemKn: string;
  problemEn: string;
  updatedAt: string;
};

/** Newest first, one per topic while topics last, then the rest; only what really exists. */
export function pickFieldChips(
  cards: readonly ChipCard[],
  consentedMasters: ReadonlySet<string>,
  n: number = FIELD_CHIPS,
): FieldChip[] {
  const usable = cards
    .filter(
      (c) =>
        !c.isSample &&
        c.status === "approved" &&
        consentedMasters.has(c.masterId) &&
        c.titleKn.trim() &&
        c.titleEn.trim() &&
        c.problemKn.trim() &&
        c.problemEn.trim(),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  const topics = new Set<string>();
  const first: ChipCard[] = [];
  const rest: ChipCard[] = [];
  for (const c of usable) {
    const topic = c.topic ?? `card:${c.id}`;
    if (topics.has(topic)) rest.push(c);
    else {
      topics.add(topic);
      first.push(c);
    }
  }
  return [...first, ...rest].slice(0, Math.max(0, n)).map((c) => ({
    cardId: c.id,
    title: { kn: c.titleKn, en: c.titleEn },
    ask: { kn: c.problemKn, en: c.problemEn },
  }));
}

/** Live mode: the field chips from the database (service role; the caller is a field teacher). */
export async function loadFieldChips(db: AdminClient): Promise<FieldChip[]> {
  const [{ data: cards, error }, { data: credited }] = await Promise.all([
    db
      .from("cards")
      .select(
        "id, master_id, status, is_sample, topic, title_kn, title_en, problem_kn, problem_en, updated_at",
      )
      .eq("status", "approved")
      .eq("is_sample", false)
      .order("updated_at", { ascending: false })
      .limit(40),
    db.from("v_master_credit").select("master_id"),
  ]);
  if (error) return [];
  const consented = new Set((credited ?? []).map((m) => m.master_id as string));
  return pickFieldChips(
    (cards ?? []).map((c) => ({
      id: c.id as string,
      masterId: c.master_id as string,
      status: c.status as string,
      isSample: c.is_sample as boolean,
      topic: (c.topic as string | null) ?? null,
      titleKn: (c.title_kn as string | null) ?? "",
      titleEn: (c.title_en as string | null) ?? "",
      problemKn: (c.problem_kn as string | null) ?? "",
      problemEn: (c.problem_en as string | null) ?? "",
      updatedAt: (c.updated_at as string | null) ?? "",
    })),
    consented,
  );
}
