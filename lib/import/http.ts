import { getSessionFor, type Session } from "@/lib/auth/session";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import { canImportFor, type MasterAccess } from "./access";
import { createSupabaseStore } from "./store";
import type { ImportStore, InterviewRow } from "./types";

// Shared guards for the import routes. Every response is JSON with a short `error` code the page
// maps to kind copy; nothing raw reaches the screen (BRIEF §7.6).

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export type ImportContext = { session: Session; db: AdminClient; store: ImportStore };

export async function importContext(): Promise<ImportContext | Response> {
  const db = createAdminClient();
  if (!db) return json({ error: "not_configured" }, 503);
  const session = await getSessionFor("reviewer", "master");
  if (!session) return json({ error: "sign_in_needed" }, 401);
  return { session, db, store: createSupabaseStore(db) };
}

export async function interviewFor(
  ctx: ImportContext,
  id: string,
): Promise<{ interview: InterviewRow; master: MasterAccess } | Response> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "not_found" }, 404);
  const interview = await ctx.store.getInterview(id);
  if (!interview) return json({ error: "not_found" }, 404);
  const { data } = await ctx.db
    .from("masters")
    .select("id, profile_id, is_sample")
    .eq("id", interview.masterId)
    .maybeSingle();
  if (!data) return json({ error: "not_found" }, 404);
  const master = { id: data.id, profileId: data.profile_id, isSample: data.is_sample };
  if (!canImportFor(ctx.session, master) || (ctx.session.isSample && !interview.isSample)) {
    return json({ error: "not_allowed" }, 403);
  }
  return { interview, master };
}

export function traceIdFor(interviewId: string): string {
  // One trace per interview groups every speech and model call of the import in ai_calls.
  return interviewId;
}
