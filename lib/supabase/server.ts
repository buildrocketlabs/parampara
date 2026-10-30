import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/lib/env";

// The signed in person's client: every read goes through RLS. Reading cookies makes the caller
// dynamic, so with Cache Components it must sit inside <Suspense> (DECISIONS D22).
// Returns null in fixture mode (no keys yet).
export async function createClient() {
  const cfg = supabasePublicConfig();
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read only; proxy.ts refreshes them.
        }
      },
    },
  });
}

export type ServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;
