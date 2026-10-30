// pnpm ai:calls [--minutes 60] [--role insights_digest]
// Read only: recent rows of ai_calls (role, model, prompt version, status, cost, latency, the error
// code) and the spend per role, so the team can watch the budget during the field week (Law 10).
// Prints no keys, no question text and no ids; an error is cut to its first 100 characters.
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: { minutes: { type: "string", default: "60" }, role: { type: "string" } },
});
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("  ✗ Supabase keys are missing (live mode only)");
  process.exit(1);
}
const minutes = Math.min(60 * 24 * 7, Math.max(1, Number(values.minutes) || 60));
const since = new Date(Date.now() - minutes * 60_000).toISOString();
const db = createClient(url, key, { auth: { persistSession: false } });

let q = db
  .from("ai_calls")
  .select(
    "created_at, role, model, prompt_version, status, cost_usd, latency_ms, error, tokens_in, cache_read_tokens, cache_write_tokens",
  )
  .gte("created_at", since)
  .order("created_at", { ascending: false })
  .limit(200);
if (values.role) q = q.eq("role", values.role);
const { data, error } = await q;
if (error) {
  console.error(`  ✗ could not read ai_calls: ${error.message}`);
  process.exit(1);
}

const time = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
for (const r of data.slice(0, 40)) {
  const err = r.error ? `  ${String(r.error).replace(/\s+/g, " ").slice(0, 100)}` : "";
  console.log(
    `  ${time(r.created_at)}  ${r.role.padEnd(16)} ${String(r.prompt_version ?? "").padEnd(20)} ${r.status.padEnd(8)} $${Number(r.cost_usd).toFixed(4)}  ${r.latency_ms ?? "-"} ms${err}`,
  );
}
const byRole = new Map();
for (const r of data) {
  const t = byRole.get(r.role) ?? {
    calls: 0,
    usd: 0,
    tokensIn: 0,
    cacheRead: 0,
    cacheWrite: 0,
    ms: [],
  };
  t.calls += 1;
  t.usd += Number(r.cost_usd);
  t.tokensIn += Number(r.tokens_in) || 0;
  t.cacheRead += Number(r.cache_read_tokens) || 0;
  t.cacheWrite += Number(r.cache_write_tokens) || 0;
  if (r.status === "ok" && r.latency_ms != null) t.ms.push(Number(r.latency_ms));
  byRole.set(r.role, t);
}
console.log(
  `\n  last ${minutes} min: ${data.length} calls${data.length === 200 ? " (first 200)" : ""}`,
);
// Prompt caching (docs/AI.md §3): how much of each role's input was read from the cache, and its
// median latency, so a cache breakpoint that never hits shows up as 0%.
const median = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
};
for (const [role, t] of byRole) {
  const share = t.tokensIn > 0 ? `${Math.round((100 * t.cacheRead) / t.tokensIn)}%` : "n/a";
  const p50 = median(t.ms);
  console.log(
    `  ${role.padEnd(16)} ${String(t.calls).padStart(4)} calls  $${t.usd.toFixed(4)}  cache read ${share} of input (${t.cacheRead} read, ${t.cacheWrite} written)  p50 ${p50 ?? "-"} ms`,
  );
}
