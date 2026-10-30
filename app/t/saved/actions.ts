"use server";

import { z } from "zod";
import { getSessionFor } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Titles for the answers saved on this phone (ids live in localStorage). Her own client, so RLS
// returns only her answers; anything else simply does not come back.
const Ids = z.array(z.uuid()).max(100);

export type SavedBrief = { id: string; title: { kn: string; en: string }; createdAt: string };

export async function savedBriefs(input: unknown): Promise<SavedBrief[]> {
  const ids = Ids.safeParse(input);
  if (!ids.success || ids.data.length === 0 || isFixtureMode()) return [];
  const session = await getSessionFor("teacher");
  if (!session) return [];
  const db = await createClient();
  if (!db) return [];
  const { data } = await db
    .from("answers")
    .select("id, title_kn, title_en, created_at")
    .in("id", ids.data);
  return (data ?? []).map((a) => ({
    id: a.id as string,
    title: { kn: (a.title_kn as string | null) ?? "", en: (a.title_en as string | null) ?? "" },
    createdAt: a.created_at as string,
  }));
}
