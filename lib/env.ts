// Which outside services this deployment can reach. A missing key never crashes a page: until the
// founder's keys exist the app runs on labelled Sample fixtures (docs/BUILD.md §1, Law 7).
// NEXT_PUBLIC_ values are read with literal names so Next can inline them into client bundles.

export type SupabasePublicConfig = { url: string; anonKey: string };

export function supabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/** Server only: the database, auth and storage are all reachable. */
export function hasSupabase(): boolean {
  return supabasePublicConfig() !== null && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function hasSarvam(): boolean {
  return Boolean(process.env.SARVAM_API_KEY);
}

/** The judged deployment: sample chips warmed, cached answers preferred (docs/AI.md §7). */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** Fixture mode: no database yet, so pages read the bundled Sample data and the demo role cookie. */
export function isFixtureMode(): boolean {
  return !hasSupabase();
}
