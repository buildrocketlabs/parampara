import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { z } from "zod";
import { isFixtureMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildOpenCards,
  OpenCardRow,
  sampleOpenCardRows,
  type OpenCard,
  type OpenCards,
} from "./cards";

// Open cards are public, but only through this route: public.open_cards() (0006) is callable by the
// server alone, so every card passes the safety backstop in buildOpenCards before anyone sees it.
// No cookies, no session, so the result is cached and shared (Cache Components, `use cache`), and
// tagged so a withdrawn card or consent can be taken down at once (revalidateOpenCards).

export const OPEN_CARDS_TAG = "open-cards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rows(card?: string): Promise<OpenCardRow[]> {
  const db = isFixtureMode() ? null : createAdminClient();
  if (!db) {
    const all = sampleOpenCardRows();
    return card ? all.filter((r) => r.id === card) : all;
  }
  if (card && !UUID.test(card)) return [];
  const { data, error } = await db.rpc("open_cards", card ? { p_card: card } : {});
  if (error) throw new Error(`open cards failed${error.code ? ` (${error.code})` : ""}`);
  return z.array(OpenCardRow).parse(data ?? []);
}

export async function loadOpenCards(): Promise<OpenCards> {
  "use cache";
  cacheLife("hours");
  cacheTag(OPEN_CARDS_TAG);
  return buildOpenCards(await rows());
}

/** One approved card for the Tomorrow card image, or null (not approved, not safe, not found). */
export async function loadOpenCard(id: string): Promise<OpenCard | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(OPEN_CARDS_TAG);
  return buildOpenCards(await rows(id)).cards[0] ?? null;
}

/**
 * Call after a card is approved, edited or withdrawn, or a master's consent or name choice
 * changes (server actions and route handlers only). The next request rebuilds the open library.
 */
export function revalidateOpenCards(): void {
  revalidateTag(OPEN_CARDS_TAG, { expire: 0 });
}
