#!/usr/bin/env node
// pnpm seed:library → the labelled Sample practice library for the judged demo (Law 7, D7, D88).
// Twelve Sample masters in six districts, each with a synthetic Sample interview whose segments
// their cards cite, so the whole chain (card → evidence → transcript) is real in shape and honestly
// marked Sample. 68 cards are approved (the eval library's five, ids and words unchanged, plus the
// 63 Sample world cards, 8 of them added after the typed question probe, D99); three stay drafts
// for the reviewer. Plan: lib/seed/library-plan.ts.
//
// Idempotent: every card and interview has a stable id (lib/seed/sample-world.ts sampleUuid), so a
// re run updates the same rows in place; it removes only Sample rows this seed made (cards tagged
// sample-library@v1, interviews with its title) that are no longer in the plan. It never touches a
// row with is_sample = false, and refuses an account of its own that is not a Sample master.
// Spends nothing on AI. Run after pnpm seed:demo, then run pnpm seed:pulse. Prints marks only.
//
//   pnpm seed:library               write the library
//   pnpm seed:library --dry-run     print the plan; no database, no keys
//   pnpm seed:library --reset-sample   remove what this seed made (its cards, interviews and the
//                                   Sample master accounts it created), then stop
import { createClient } from "@supabase/supabase-js";
import {
  adminClientOrExit,
  DRY_RUN,
  fail,
  library,
  loadLibraryPlan,
  RESET,
  tally,
  usersByEmail,
  world,
} from "./sample-world.mjs";

const { SAMPLE_INTERVIEW_TITLE, SAMPLE_LIBRARY_TAG } = world;
const plan = loadLibraryPlan();
const counts = library.libraryCounts(plan);

if (DRY_RUN) {
  console.log("  · dry run: nothing is read or written, no keys needed");
  console.log(
    `  ✓ ${counts.masters} Sample masters: ${tally(plan.masters.map((m) => m.district))}`,
  );
  console.log(
    `  ✓ ${counts.approved} approved Sample cards, ${counts.drafts} drafts for the reviewer (${[...plan.cards.filter((c) => c.status === "draft").map((c) => c.libraryId)].join(", ")})`,
  );
  console.log(
    `  ✓ approved by topic: ${tally(plan.cards.filter((c) => c.status === "approved").map((c) => c.topic))}`,
  );
  console.log(
    `  ✓ approved by master: ${tally(plan.cards.filter((c) => c.status === "approved").map((c) => c.masterKey))}`,
  );
  console.log(`  ✓ never seeded (adversarial eval cards): ${counts.skipped.join(", ") || "none"}`);
  console.log(
    `  ✓ ${plan.cards.length} cards, ${plan.masters.length} interviews, $0 of AI credits`,
  );
  process.exit(0);
}

const db = adminClientOrExit(createClient, "seed:library");
const users = await usersByEmail(db);
const now = new Date().toISOString();

/** The masters row of a Sample master account, after checking the account is one. */
async function masterRowOf(userId, name) {
  const { data: profile } = await db
    .from("profiles")
    .select("role, is_sample")
    .eq("id", userId)
    .maybeSingle();
  if (profile && (profile.role !== "master" || profile.is_sample !== true)) {
    fail(`${name}: this account is not a Sample master; nothing was changed for it`);
  }
  const { data } = await db
    .from("masters")
    .select("id, is_sample")
    .eq("profile_id", userId)
    .maybeSingle();
  if (data && data.is_sample !== true) fail(`${name}: a field master row; nothing was changed`);
  return data?.id ?? null;
}

async function removeOwnRows(masterId, keepCards, keepInterview) {
  let cards = db
    .from("cards")
    .delete()
    .eq("master_id", masterId)
    .eq("is_sample", true)
    .eq("prompt_version", SAMPLE_LIBRARY_TAG);
  if (keepCards.length) cards = cards.not("id", "in", `(${keepCards.join(",")})`);
  const { error: cErr } = await cards;
  if (cErr) fail("remove old Sample cards", cErr);
  let interviews = db
    .from("interviews")
    .delete()
    .eq("master_id", masterId)
    .eq("is_sample", true)
    .eq("title", SAMPLE_INTERVIEW_TITLE);
  if (keepInterview) interviews = interviews.neq("id", keepInterview);
  const { error: iErr } = await interviews;
  if (iErr) fail("remove old Sample interviews", iErr);
}

if (RESET) {
  let removedAccounts = 0;
  for (const m of plan.masters) {
    const userId = users.get(m.email);
    if (!userId) continue;
    const masterId = await masterRowOf(userId, m.nameEn);
    if (masterId) await removeOwnRows(masterId, [], null);
    // The demo master account belongs to seed:demo; the others were made here.
    if (m.email !== "master@demo.parampara.invalid") {
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) fail(`remove ${m.nameEn}`, error);
      removedAccounts++;
    }
  }
  console.log(
    `  ✓ removed this seed's Sample cards and interviews, and ${removedAccounts} Sample master accounts it made; field rows untouched`,
  );
  console.log("  · run pnpm seed:pulse --reset-sample too, or pnpm seed:library to rebuild");
  process.exit(0);
}

const reviewerId = users.get("reviewer@demo.parampara.invalid");
if (!reviewerId) fail("demo reviewer missing: run pnpm seed:demo first");
if (!users.get("master@demo.parampara.invalid"))
  fail("demo master missing: run pnpm seed:demo first");

let approved = 0;
let drafts = 0;
for (const m of plan.masters) {
  let userId = users.get(m.email);
  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email: m.email,
      email_confirm: true,
      app_metadata: { source: "sample-library" },
    });
    if (error) fail(`create ${m.nameEn}`, error);
    userId = data.user.id;
  }
  let masterId = await masterRowOf(userId, m.nameEn);
  const { error: pErr } = await db.from("profiles").upsert(
    {
      id: userId,
      role: "master",
      display_name: m.nameEn,
      district: m.district,
      lang: "kn",
      is_sample: true,
      consented_at: now,
      consent_version: "master@sample",
    },
    { onConflict: "id" },
  );
  if (pErr) fail(`profile ${m.nameEn}`, pErr);
  const masterRow = {
    profile_id: userId,
    years: m.years,
    school: m.school,
    classes: m.classes,
    show_name: "first",
    voice_public: false,
    show_photo: false,
    is_sample: true,
    consented_at: now,
    consent_text_kn: "ಮಾದರಿ ಡೇಟಾ: ಡೆಮೊಗಾಗಿ ರಚಿಸಿದ್ದು, ನಿಜವಾದ ವ್ಯಕ್ತಿಯಲ್ಲ.",
  };
  if (masterId) {
    const { error } = await db.from("masters").update(masterRow).eq("id", masterId);
    if (error) fail(`master ${m.nameEn}`, error);
  } else {
    const { data, error } = await db.from("masters").insert(masterRow).select("id").single();
    if (error) fail(`master ${m.nameEn}`, error);
    masterId = data.id;
  }

  const mine = plan.cards.filter((c) => c.masterKey === m.key);
  const interviewId = library.interviewIdFor(m.key);
  await removeOwnRows(
    masterId,
    mine.map((c) => c.dbId),
    mine.length ? interviewId : null,
  );
  if (mine.length === 0) continue;

  const { error: ivErr } = await db.from("interviews").upsert(
    {
      id: interviewId,
      master_id: masterId,
      status: "done",
      source: "import",
      title: SAMPLE_INTERVIEW_TITLE,
      parts: [],
      is_sample: true,
    },
    { onConflict: "id" },
  );
  if (ivErr) fail("interview", ivErr);
  // A fresh synthetic transcript each run; the cards are then pointed at its segments.
  const { error: sDel } = await db.from("segments").delete().eq("interview_id", interviewId);
  if (sDel) fail("clear old segments", sDel);
  const segments = library.buildSegments(interviewId, mine);
  const { data: segs, error: segErr } = await db
    .from("segments")
    .insert(segments.map(library.segmentInsertRow))
    .select("id, idx");
  if (segErr) fail("segments", segErr);
  const idOf = new Map(segs.map((s) => [s.idx, Number(s.id)]));
  const segmentId = (libraryId, kind) =>
    idOf.get(segments.find((r) => r.card === libraryId && r.kind === kind).idx);

  const rows = mine.map((c) =>
    library.cardRow(c, { masterId, interviewId, reviewerId, now, segmentId }),
  );
  const { error: cErr } = await db.from("cards").upsert(rows, { onConflict: "id" });
  if (cErr) fail(`cards of ${m.nameEn}`, cErr);
  approved += mine.filter((c) => c.status === "approved").length;
  drafts += mine.filter((c) => c.status === "draft").length;
}

console.log(
  `  ✓ ${plan.masters.length} Sample masters: ${tally(plan.masters.map((m) => m.district))}`,
);
console.log(
  `  ✓ Sample library ready: ${approved} approved cards, ${drafts} drafts for the reviewer (all labelled Sample, $0 of AI credits)`,
);
console.log(
  "  · now run pnpm seed:pulse; the sample chip answers are cached under the old library version, so rewarm them",
);
