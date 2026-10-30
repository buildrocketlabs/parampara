import { createClient } from "@supabase/supabase-js";
import { supabasePublicConfig } from "@/lib/env";

// Service role client: bypasses RLS. Server code only (route handlers, server actions, scripts),
// and every caller checks the person's role first. The key never reaches a browser bundle because
// it has no NEXT_PUBLIC_ prefix; the guard below catches an accidental client import early.
export function createAdminClient() {
  if (typeof window !== "undefined") throw new Error("admin client imported in the browser");
  const cfg = supabasePublicConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cfg || !key) return null;
  return createClient(cfg.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
