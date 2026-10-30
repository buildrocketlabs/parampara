#!/usr/bin/env node
// Where the real field data stands (D100), read only: field masters and their consent, field cards
// by status, and the chips a field teacher sees under the mic, picked by the app's own loader
// (lib/ask/field-chips.ts), so this is exactly what a Talakal teacher's screen shows.
//
//   pnpm field:status
//
// Prints names, titles and counts only, never an invite code, a link, a question or a key.
import { createClient } from "@supabase/supabase-js";
import { loadFieldChips } from "../lib/ask/field-chips.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const [{ data: masters }, { data: credit }, { data: cards }, chips, { data: invites }, questions] =
  await Promise.all([
    db.from("masters").select("id, school, years, consented_at").eq("is_sample", false),
    db.from("v_master_credit").select("master_id"),
    db.from("cards").select("id, master_id, status, topic, title_en").eq("is_sample", false),
    loadFieldChips(db),
    db
      .from("invites")
      .select("role, label, used_by, max_uses, expires_at")
      .eq("is_sample", false)
      .is("revoked_at", null),
    db.from("questions").select("id", { count: "exact", head: true }).eq("is_sample", false),
  ]);

const consented = new Set((credit ?? []).map((c) => c.master_id));
const nameOf = new Map(
  (masters ?? []).map((m) => [m.id, `${m.school ?? "(no school)"}, ${m.years ?? "?"} years`]),
);
console.log(`Field masters: ${masters?.length ?? 0}`);
for (const m of masters ?? [])
  console.log(
    `  ${m.id.slice(0, 8)} · ${nameOf.get(m.id)} · consent ${consented.has(m.id) ? "on record" : "MISSING"}`,
  );

const byStatus = {};
for (const c of cards ?? []) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
console.log(`Field cards: ${JSON.stringify(byStatus)}`);

console.log(`Chips a field teacher sees: ${chips.length}`);
for (const chip of chips) {
  const card = (cards ?? []).find((c) => c.id === chip.cardId);
  console.log(`  ${chip.title.en} · ${card?.topic ?? "?"} · ${nameOf.get(card?.master_id) ?? "?"}`);
}

for (const i of invites ?? [])
  console.log(
    `Open field invite: ${i.role} · ${i.label ?? ""} · ${
      i.max_uses ? `group of ${i.max_uses}` : i.used_by ? "used" : "unused"
    } · ${i.expires_at ? `until ${i.expires_at}` : "no expiry"}`,
  );
console.log(`Field questions: ${questions.count ?? 0}`);
