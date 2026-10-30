import { FIXTURE_ANSWER } from "@/lib/tried/fixture";
import { FIXTURE_CARD_ID } from "@/lib/answers/fixture";
import type { AdminClient } from "@/lib/supabase/admin";

// The approved cards a reviewer may answer a waiting question with (D83), per pool (D64): a field
// question only from real cards of consented masters, a Sample question from either.

export type CardChoice = { id: string; title: { kn: string; en: string }; isSample: boolean };

/** Fixture mode: the one approved Sample card the Sample answer comes from. */
export function fixtureCardChoices(): CardChoice[] {
  return [{ id: FIXTURE_CARD_ID, title: FIXTURE_ANSWER.title, isSample: true }];
}

export async function loadCardChoices(
  db: AdminClient,
): Promise<{ field: CardChoice[]; all: CardChoice[] }> {
  const [{ data: cards }, { data: credited }] = await Promise.all([
    db
      .from("cards")
      .select("id, master_id, is_sample, title_kn, title_en")
      .eq("status", "approved")
      .order("title_en")
      .limit(300),
    db.from("v_master_credit").select("master_id"),
  ]);
  const consented = new Set((credited ?? []).map((m) => m.master_id as string));
  const all = (cards ?? [])
    .filter((c) => consented.has(c.master_id as string))
    .map((c) => ({
      id: c.id as string,
      title: { kn: (c.title_kn as string) ?? "", en: (c.title_en as string) ?? "" },
      isSample: c.is_sample as boolean,
    }));
  return { field: all.filter((c) => !c.isSample), all };
}
