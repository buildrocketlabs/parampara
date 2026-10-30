import type { Session } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadFieldChips, type FieldChip } from "./field-chips";

/**
 * Which chips this teacher sees under the mic (server only): null keeps the warmed Sample
 * questions for a Sample (demo) account; a field teacher gets field chips only, which in fixture
 * mode (no database, so no field cards) is none at all (D64, D83).
 */
export async function chipsFor(session: Pick<Session, "isSample">): Promise<FieldChip[] | null> {
  if (session.isSample) return null;
  if (isFixtureMode()) return [];
  const db = createAdminClient();
  if (!db) return [];
  return loadFieldChips(db).catch(() => []);
}
