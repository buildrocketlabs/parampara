#!/usr/bin/env node
// pnpm seed:demo: creates or updates the four demo accounts jurors enter with one tap (D33, D38).
// Idempotent: run it as often as you like. Every row it writes is is_sample. Reads .env.local via
// node --env-file; prints only ✓ / ✗ lines, never a key. Never seeds real people (D19).
import { createClient } from "@supabase/supabase-js";

// lib/auth/roles.ts is import free on purpose, so Node 22.18+ loads it directly (type stripping)
// and the demo accounts have one source. The package has no "type" field, so Node warns that it
// reparsed the file as ESM; that one warning is noise here and is dropped.
const emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const code = typeof rest[0] === "object" ? rest[0]?.code : rest[1];
  if (code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  return emitWarning.call(this, warning, ...rest);
};
const { APP_ROLES, DEMO_ACCOUNTS } = await import("../lib/auth/roles.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("  ✗ Supabase keys missing. Run ./scripts/keys.sh in your Terminal, then pnpm seed:demo.");
  console.error("    Nothing was written.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let failures = 0;
const ok = (line) => console.log(`  ✓ ${line}`);
const bad = (line, error) => {
  failures += 1;
  console.error(`  ✗ ${line} (${error?.code ?? error?.status ?? "error"})`);
};

/** The admin API has no lookup by email, so page through users (a handful in this project). */
async function findUser(email) {
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function seedAccount(role) {
  const account = DEMO_ACCOUNTS[role];
  let user = await findUser(account.email);
  if (user) {
    const { error } = await db.auth.admin.updateUserById(user.id, {
      password: account.password,
      email_confirm: true,
    });
    if (error) throw error;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      app_metadata: { source: "demo" },
    });
    if (error) throw error;
    user = data.user;
  }

  const now = new Date().toISOString();
  const { error: profileError } = await db.from("profiles").upsert(
    {
      id: user.id,
      role,
      display_name: account.displayName,
      district: account.district,
      lang: "kn",
      is_sample: true,
      consented_at: now,
      // Same versions as lib/consent.ts CONSENT_VERSION.
      consent_version: `${role}@v1`,
    },
    { onConflict: "id" },
  );
  if (profileError) throw profileError;

  if (role === "master") {
    const { error: masterError } = await db.from("masters").upsert(
      {
        profile_id: user.id,
        is_sample: true,
        consented_at: now,
        show_name: "first",
        voice_public: true,
        years: 32,
        school: "Sample school",
      },
      { onConflict: "profile_id" },
    );
    if (masterError) throw masterError;
  }
  return account.email;
}

for (const role of APP_ROLES) {
  try {
    const email = await seedAccount(role);
    ok(`${role} demo account ready: ${email}${role === "master" ? " (with its masters row)" : ""}`);
  } catch (error) {
    bad(`${role} demo account`, error);
  }
}

if (failures) {
  console.error(`  ✗ ${failures} of ${APP_ROLES.length} demo accounts failed; run it again once fixed.`);
  process.exit(1);
}
ok("all four demo accounts are Sample, consented and ready for one tap entry");
