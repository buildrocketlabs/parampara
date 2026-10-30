"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "@/lib/env";

// Browser client for the few things that must happen client side (direct uploads to signed URLs).
// Reads go through server components; this client never holds more than the publishable key.
let client: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserClient() {
  const cfg = supabasePublicConfig();
  if (!cfg) return null;
  client ??= createBrowserClient(cfg.url, cfg.anonKey);
  return client;
}
