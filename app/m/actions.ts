"use server";

import { getSessionFor } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// The master opened their room: their thank you notes are delivered (0005 mark_my_thanks_read).
export async function markThanksRead(): Promise<number> {
  const session = await getSessionFor("master");
  if (!session || isFixtureMode()) return 0;
  const db = await createClient();
  if (!db) return 0;
  const { data } = await db.rpc("mark_my_thanks_read");
  return typeof data === "number" ? data : 0;
}
