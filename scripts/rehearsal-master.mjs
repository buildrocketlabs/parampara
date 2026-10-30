#!/usr/bin/env node
// One Sample master for rehearsing the WhatsApp import on live (F-A1), so a 30 minute rehearsal
// lands as Sample (Law 7) and starts without consent, like the real headmaster will (D53).
//
//   node --env-file=.env.local scripts/rehearsal-master.mjs          create or reset it
//   node --env-file=.env.local scripts/rehearsal-master.mjs --clean  remove its interviews, cards
//                                                                    and audio, keep the master
//
// Why a script: a field reviewer may import more than ten minutes but creates field masters; the
// Sample reviewer creates Sample masters but is capped at ten minutes. This master is Sample and
// is chosen from the founder's own reviewer account. It touches only its own rows: a hidden
// account sample-rehearsal-master@demo.parampara.invalid, its profile, masters row, interviews,
// cards and files under interviews/<id>/. Prints marks only, never a key or an id.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const EMAIL = "sample-rehearsal-master@demo.parampara.invalid";
const clean = process.argv.includes("--clean");

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

let user = await findUser(EMAIL);
if (!user) {
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL,
    email_confirm: true,
    app_metadata: { source: "rehearsal" },
  });
  if (error) throw error;
  user = data.user;
}

const { error: pErr } = await db.from("profiles").upsert(
  {
    id: user.id,
    role: "master",
    display_name: "ಪೂರ್ವಾಭ್ಯಾಸ ಹಿರಿಯ ಶಿಕ್ಷಕ (Rehearsal)",
    district: "Koppal",
    lang: "kn",
    is_sample: true,
  },
  { onConflict: "id" },
);
if (pErr) throw pErr;

const { data: master, error: mErr } = await db
  .from("masters")
  .upsert(
    {
      profile_id: user.id,
      is_sample: true,
      years: 30,
      school: "Sample school",
      show_name: "first",
      voice_public: true,
    },
    { onConflict: "profile_id" },
  )
  .select("id")
  .single();
if (mErr) throw mErr;

if (clean) {
  const { data: interviews } = await db.from("interviews").select("id").eq("master_id", master.id);
  for (const iv of interviews ?? []) {
    const bucket = db.storage.from("interviews");
    const { data: files } = await bucket.list(iv.id, { limit: 1000 });
    const { data: clips } = await bucket.list(`${iv.id}/clips`, { limit: 1000 });
    const paths = [
      ...(files ?? []).filter((f) => f.id).map((f) => `${iv.id}/${f.name}`),
      ...(clips ?? []).map((f) => `${iv.id}/clips/${f.name}`),
    ];
    if (paths.length) await bucket.remove(paths);
  }
  await db.from("cards").delete().eq("master_id", master.id);
  await db.from("interviews").delete().eq("master_id", master.id);
  console.log(
    `  ✓ removed ${interviews?.length ?? 0} rehearsal interview(s) with their cards and audio`,
  );
}

// Always start without consent: the rehearsal must show it counting only once stored (D53).
const { error: cErr } = await db
  .from("masters")
  .update({ consented_at: null, consent_audio_path: null, consent_text_kn: null })
  .eq("id", master.id);
if (cErr) throw cErr;
console.log("  ✓ Sample master ready, without consent: ಪೂರ್ವಾಭ್ಯಾಸ ಹಿರಿಯ ಶಿಕ್ಷಕ (Rehearsal)");
