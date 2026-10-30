#!/usr/bin/env node
// pnpm seed:pulse → a labelled Sample fortnight for the officer and master doors (Law 7, D66, D88).
// 120 Sample teachers (no name, no password) in seven districts ask about 360 questions over the
// last 14 days, mostly on weekday evenings, modelled on the redacted eval set; answers cite the
// approved Sample library cards; most teachers later say whether it worked, and some send one of
// the app's own thank you lines. Questions no approved card fits wait in the reviewer queue.
// Then /i, /i/lamps and the master's /m show numbers the database computes, with small groups
// suppressed as for real teachers. Plan: lib/seed/pulse-plan.ts. Spends nothing on AI: answers are
// written as rows (replayed, no cache keys), never generated.
//
// Idempotent: each run replaces only the questions of its own Sample teachers (answers, tried,
// thanks and queue rows go with them) and dates the fortnight back from now. Its own accounts are
// sample-pulse-tNNN@demo.parampara.invalid; older ones it no longer plans (the 24 Oct t01 to t18)
// are removed. Never touches a field row, and refuses an account of its own that is not a Sample
// teacher. Run after pnpm seed:library. Prints marks only, never a key or an id.
//
//   pnpm seed:pulse                  write the fortnight
//   pnpm seed:pulse --dry-run        print the plan and what /i, /i/lamps and /m will show; no keys
//   pnpm seed:pulse --reset-sample   remove every sample-pulse account and its rows, then stop
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  adminClientOrExit,
  DRY_RUN,
  fail,
  loadLibraryPlan,
  library,
  pulse,
  RESET,
  tally,
  usersByEmail,
  world,
} from "./sample-world.mjs";

const {
  buildPulseRows,
  previewPulse,
  PULSE_EMAIL_RE,
  PULSE_QUESTIONS,
  PULSE_TEACHERS,
  pulseEmail,
} = pulse;
const plan = loadLibraryPlan();
const needed = [...new Set(Object.values(PULSE_QUESTIONS).flatMap((q) => q.cards))];
const district = Object.fromEntries(PULSE_TEACHERS.map((t) => [t.key, t.district]));

function report(rows, teacherDistrict, masterOfCard, approvedOf) {
  const p = previewPulse(rows, teacherDistrict, masterOfCard, approvedOf);
  const said = p.outcomes;
  const shown = (n) => (n === null ? "fewer than 5 teachers" : n);
  console.log(
    `  ✓ ${PULSE_TEACHERS.length} Sample teachers (no names): ${tally(PULSE_TEACHERS.map((t) => t.district))}`,
  );
  console.log(
    `  ✓ ${rows.questions.length} Sample questions over the last 14 days, ${rows.queue.length} waiting for a master`,
  );
  console.log(
    `  ✓ ${rows.tried.length} tried: ${said.worked} worked, ${said.partly} partly, ${said.didnt} didn't; ${rows.thanks.length} thank you notes`,
  );
  console.log(
    `  · /i Sample week ${p.week.since.slice(0, 10)} to ${p.week.until.slice(0, 10)}: ${p.week.asked} asked by ${p.week.teachers} teachers, ${p.week.answered} answered, ${p.week.tried} tried, ${p.week.worked} worked`,
  );
  console.log(`  · /i topics: ${p.topics.map((t) => `${t.topic} ${t.shielded ? "kept private" : shown(t.asked)}`).join(", ")}`);
  console.log(
    `  · /i districts: ${p.districts.map((d) => `${d.district} ${shown(d.asked)}`).join(", ")}`,
  );
  console.log(`  · /i/lamps: ${p.lamps.map((l) => `${l.district} ${shown(l.helped)}`).join(", ")}`);
  console.log(
    `  · practices with a number: ${p.practicesShown}; kept private (fewer than 5 teachers): ${p.practicesPrivate}`,
  );
  const few = (n) => (n === null ? "a few" : n);
  console.log(
    `  · /m reach: ${p.masters.map((m) => `${m.master} ${few(m.reached)} (worked ${few(m.worked)}, thanks ${m.thanks})`).join(", ")}`,
  );
}

if (DRY_RUN) {
  console.log("  · dry run: nothing is read or written, no keys needed");
  const cards = {};
  const masterOfCard = {};
  const approvedOf = {};
  for (const c of plan.cards.filter((c) => c.status === "approved")) {
    cards[c.libraryId] = {
      id: c.dbId,
      master_id: c.masterKey,
      title_kn: c.title.kn,
      title_en: c.title.en,
      steps: c.steps,
      materials: c.materials,
      why_kn: c.why?.kn ?? null,
      why_en: c.why?.en ?? null,
    };
    masterOfCard[c.dbId] = c.masterKey;
    approvedOf[c.masterKey] = (approvedOf[c.masterKey] ?? 0) + 1;
  }
  const missing = needed.filter((id) => !cards[id]);
  if (missing.length) fail(`the plan cites cards that are not approved: ${missing.join(", ")}`);
  const teacherIds = Object.fromEntries(PULSE_TEACHERS.map((t) => [t.key, t.key]));
  const rows = buildPulseRows({
  now: new Date(),
  teacherIds,
  cards,
  cardDistricts: library.cardDistricts(plan),
  uuid: randomUUID,
});
  report(rows, district, masterOfCard, approvedOf);
  console.log("  ✓ $0 of AI credits: every answer is written as a row, never generated");
  process.exit(0);
}

const db = adminClientOrExit(createClient, "seed:pulse");
const users = await usersByEmail(db);

/** Remove a sample-pulse account and its Sample rows, after checking it is a Sample teacher. */
async function removeAccount(id) {
  const { data: profile } = await db
    .from("profiles")
    .select("role, is_sample")
    .eq("id", id)
    .maybeSingle();
  if (profile && (profile.role !== "teacher" || profile.is_sample !== true)) {
    fail("a sample-pulse account is not a Sample teacher; nothing was changed for it");
  }
  const { error: qErr } = await db
    .from("questions")
    .delete()
    .eq("teacher_id", id)
    .eq("is_sample", true);
  if (qErr) fail("remove an old Sample teacher's questions", qErr);
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) fail("remove an old Sample teacher", error);
}

const planned = new Set(PULSE_TEACHERS.map((t) => pulseEmail(t.key)));
const own = [...users].filter(([email]) => PULSE_EMAIL_RE.test(email));
const stale = own.filter(([email]) => RESET || !planned.has(email));
for (const [, id] of stale) await removeAccount(id);
if (RESET) {
  console.log(
    `  ✓ removed ${stale.length} sample-pulse accounts and their Sample questions, answers, tried, thanks and queue rows; field rows untouched`,
  );
  process.exit(0);
}
if (stale.length) console.log(`  ✓ removed ${stale.length} older sample-pulse accounts`);

// ── The approved Sample library cards, by their stable ids (seed:library) ──────────────────────
const { data: cardRows, error: cardErr } = await db
  .from("cards")
  .select("id, master_id, title_kn, title_en, steps, materials, why_kn, why_en")
  .eq("is_sample", true)
  .eq("status", "approved")
  .eq("prompt_version", world.SAMPLE_LIBRARY_TAG);
if (cardErr) fail("read the Sample library", cardErr);
const byId = new Map(cardRows.map((c) => [c.id, c]));
const cards = {};
for (const c of plan.cards) {
  const row = byId.get(c.dbId);
  if (row) cards[c.libraryId] = { ...row, steps: row.steps ?? [], materials: row.materials ?? [] };
}
const missing = needed.filter((id) => !cards[id]);
if (missing.length) {
  fail(`${missing.length} approved Sample cards missing: run pnpm seed:library first`);
}

// ── Sample teacher accounts (no password, a domain that never receives mail, no name) ─────────
const teacherIds = {};
const toCreate = PULSE_TEACHERS.filter((t) => !users.has(pulseEmail(t.key)));
for (let i = 0; i < toCreate.length; i += 10) {
  await Promise.all(
    toCreate.slice(i, i + 10).map(async (t) => {
      const { data, error } = await db.auth.admin.createUser({
        email: pulseEmail(t.key),
        email_confirm: true,
        app_metadata: { source: "sample-pulse" },
      });
      if (error) fail("create a Sample teacher", error);
      users.set(pulseEmail(t.key), data.user.id);
    }),
  );
}
for (const t of PULSE_TEACHERS) teacherIds[t.key] = users.get(pulseEmail(t.key));
const ids = Object.values(teacherIds);
// An existing account must already be a Sample teacher: never overwrite anyone else.
const { data: existing, error: exErr } = await db
  .from("profiles")
  .select("id, role, is_sample")
  .in("id", ids);
if (exErr) fail("read Sample teacher profiles", exErr);
if (existing.some((p) => p.role !== "teacher" || p.is_sample !== true)) {
  fail("a sample-pulse account is not a Sample teacher; nothing was changed");
}
const consentedAt = new Date().toISOString();
const { error: pErr } = await db.from("profiles").upsert(
  PULSE_TEACHERS.map((t) => ({
    id: teacherIds[t.key],
    role: "teacher",
    display_name: null,
    district: t.district,
    lang: "kn",
    is_sample: true,
    consented_at: consentedAt,
    consent_version: "teacher@sample",
  })),
  { onConflict: "id" },
);
if (pErr) fail("Sample teacher profiles", pErr);

// ── Replace this script's own Sample fortnight ─────────────────────────────────────────────────
// Answers, tried, thanks and queue rows cascade from their question.
const { error: delErr } = await db
  .from("questions")
  .delete()
  .in("teacher_id", ids)
  .eq("is_sample", true);
if (delErr) fail("clear the last Sample fortnight", delErr);

const rows = buildPulseRows({
  now: new Date(),
  teacherIds,
  cards,
  cardDistricts: library.cardDistricts(plan),
  uuid: randomUUID,
});
for (const [table, list] of [
  ["questions", rows.questions],
  ["answers", rows.answers],
  ["tried", rows.tried],
  ["thanks", rows.thanks],
  ["human_queue", rows.queue],
]) {
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await db.from(table).insert(list.slice(i, i + 500));
    if (error) fail(`write Sample ${table}`, error);
  }
}

// The report names masters by their plan key (sharanappa, ...), never by a database id.
const keyOfCard = Object.fromEntries(plan.cards.map((c) => [c.dbId, c.masterKey]));
const masterOfCard = Object.fromEntries(cardRows.map((c) => [c.id, keyOfCard[c.id] ?? "other"]));
const approvedOf = cardRows.reduce((o, c) => {
  const k = keyOfCard[c.id] ?? "other";
  o[k] = (o[k] ?? 0) + 1;
  return o;
}, {});
const teacherDistrict = Object.fromEntries(
  PULSE_TEACHERS.map((t) => [teacherIds[t.key], t.district]),
);
report(rows, teacherDistrict, masterOfCard, approvedOf);
console.log(
  "  ✓ all labelled Sample; field rows untouched; $0 of AI credits. Open /i, /i/lamps and /m.",
);
