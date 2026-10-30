#!/usr/bin/env node
// pnpm smoke: checks the live Supabase project after keys and migrations (architect R13).
// Reads .env.local through node --env-file; prints only ✓ / ✗ / ! lines, never a value.
import { createClient } from "@supabase/supabase-js";

const results = [];
const ok = (m) => results.push(["✓", m]);
const bad = (m) => results.push(["✗", m]);
const warn = (m) => results.push(["!", m]);
function expect(cond, good, poor, onFail = bad) {
  if (cond) ok(good);
  else onFail(poor);
}

const env = process.env;
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
  "SARVAM_API_KEY",
]) {
  expect(
    Boolean(env[name]),
    `${name} is set`,
    `${name} missing (run the keys script in your Terminal)`,
  );
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = env.SUPABASE_SERVICE_ROLE_KEY;

if (url && anonKey && secret) {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, secret, opts);
  const anon = createClient(url, anonKey, opts);

  const TABLES = [
    "profiles",
    "masters",
    "interviews",
    "segments",
    "cards",
    "questions",
    "answers",
    "tried",
    "thanks",
    "human_queue",
    "ai_calls",
    "jobs",
    "invites",
    "audio_chunks",
  ];
  const unreachable = [];
  for (const t of TABLES) {
    // A real read: HEAD requests do not report a missing table.
    const { error } = await admin.from(t).select("*").limit(1);
    if (error) unreachable.push(t);
  }
  expect(
    unreachable.length === 0,
    `all ${TABLES.length} tables exist (migrations 0001 to 0003 applied)`,
    `tables not reachable: ${unreachable.join(", ")} (run ALLOW_DB_PUSH=1 pnpm db:push)`,
  );

  const { error: colErr } = await admin.from("invites").select("use_count, is_sample").limit(1);
  expect(
    !colErr,
    "0003 columns present",
    "0003 columns missing on invites (run ALLOW_DB_PUSH=1 pnpm db:push)",
  );

  const { error: c4 } = await admin.from("cards").select("quote_segment_id").limit(1);
  const { error: a4 } = await admin.from("answers").select("cache_key, materials").limit(1);
  expect(
    !c4 && !a4,
    "0004 columns present (import jobs, answer cache, consent rule)",
    "0004 not applied (run ALLOW_DB_PUSH=1 pnpm db:push)",
  );

  // The hourly question cap leaves replays out through this embed (lib/ask/store.ts).
  const { error: rq } = await admin
    .from("answers")
    .select("id, questions!answers_question_id_fkey!inner(teacher_id)")
    .eq("replayed", true)
    .eq("questions.teacher_id", "00000000-0000-0000-0000-000000000000")
    .limit(1);
  expect(
    !rq,
    "hourly cap query reads answers with their question",
    `hourly cap query failed: ${rq?.message}`,
  );

  const { error: f5 } = await admin.from("feedback").select("id").limit(1);
  expect(
    !f5,
    "0005 applied (master impact, feedback)",
    "0005 not applied (run ALLOW_DB_PUSH=1 pnpm db:push)",
  );
  const { error: i6 } = await admin.rpc("insights_min_group");
  expect(
    !i6,
    "0006 applied (officer insights, open data)",
    "0006 not applied (run ALLOW_DB_PUSH=1 pnpm db:push)",
  );

  // RLS: the publishable key alone reads nothing private and writes nothing.
  const leaks = [];
  for (const t of [
    "profiles",
    "masters",
    "segments",
    "questions",
    "answers",
    "ai_calls",
    "jobs",
    "invites",
    "audio_chunks",
  ]) {
    const { data, error } = await anon.from(t).select("*").limit(1);
    if (!error && data && data.length > 0) leaks.push(t);
  }
  expect(
    leaks.length === 0,
    "RLS: an anonymous visitor reads no private table",
    `RLS: an anonymous visitor can read ${leaks.join(", ")}`,
  );
  const { error: insErr } = await anon
    .from("ai_calls")
    .insert({ role: "smoke", model: "smoke", status: "ok" });
  expect(
    Boolean(insErr),
    "RLS: an anonymous visitor cannot write",
    "RLS: an anonymous visitor wrote to ai_calls",
  );
  const { error: countErr } = await anon.from("v_library_counts").select("approved_cards");
  expect(
    !countErr,
    "landing page counts view readable",
    "library counts view not readable for the landing page",
  );

  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr || !buckets) bad("storage buckets not listable");
  else {
    const want = ["interviews", "questions", "answers", "thanks", "photos"];
    const missing = want.filter((id) => !buckets.some((b) => b.id === id));
    expect(
      missing.length === 0,
      "storage buckets exist (0002)",
      `storage buckets missing: ${missing.join(", ")}`,
    );
    const open = buckets.filter((b) => want.includes(b.id) && b.public).map((b) => b.id);
    expect(open.length === 0, "every bucket is private", `buckets are public: ${open.join(", ")}`);
  }

  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
    const s = await res.json();
    expect(Boolean(s?.external?.email), "email and password sign in is on", "email sign in is off");
    expect(
      !s?.external?.anonymous_users,
      "anonymous sign ins are off",
      "anonymous sign ins are on (harmless: no profile means no access)",
      warn,
    );
  } catch {
    bad("auth settings not reachable");
  }

  const { data: users, error: uErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (uErr) bad("auth admin API not reachable with the secret key");
  else {
    const demo = users.users.filter((u) => u.email?.endsWith("@demo.parampara.invalid")).length;
    expect(
      demo >= 4,
      "four demo accounts exist",
      `demo accounts: ${demo} of 4 (run pnpm seed:demo)`,
      warn,
    );
  }
}

for (const [mark, msg] of results) console.log(`  ${mark} ${msg}`);
process.exit(results.some(([m]) => m === "✗") ? 1 : 0);
