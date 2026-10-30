import { connection } from "next/server";
import { hasAnthropic, hasSarvam, hasSupabase } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Liveness for the daily Vercel cron (DECISIONS D32): one trivial read keeps the free Supabase
// project from pausing before judging ends on 18 Nov. Reports only booleans, never a key.
export async function GET() {
  await connection();
  const services = { anthropic: hasAnthropic(), sarvam: hasSarvam(), supabase: hasSupabase() };
  const admin = createAdminClient();
  if (!admin) {
    return Response.json(
      { ok: true, db: "not_configured", mode: "fixtures", services },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const started = Date.now();
  const { error } = await admin.from("v_library_counts").select("approved_cards").limit(1);
  return Response.json(
    { ok: !error, db: error ? "error" : "ok", dbMs: Date.now() - started, mode: "live", services },
    { status: error ? 503 : 200, headers: { "cache-control": "no-store" } },
  );
}
