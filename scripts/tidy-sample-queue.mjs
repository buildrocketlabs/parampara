#!/usr/bin/env node
// Closes the copies jurors' taps left in the reviewer queue (D98). Every tap of the Sample safety
// chip on the one tap demo teacher adds an open, urgent Sample row with the same words. The queue
// already shows them as one item; this marks the older copies handled, so the database agrees.
//
//   node --env-file=.env.local scripts/tidy-sample-queue.mjs --dry-run       counts only
//   node --env-file=.env.local scripts/tidy-sample-queue.mjs                 close the copies
//   node --env-file=.env.local scripts/tidy-sample-queue.mjs --also-no-card  the "no card" chip too
//
// Rules: only rows with is_sample = true (every read and every write filters on it), only open
// rows, only reason "safety" (plus "no_card" with --also-no-card). Within each group of the same
// reason and the same redacted words, the newest row is kept open and every other copy older than
// an hour is closed with a note. Field rows are never read or touched. Prints counts only, never a
// question, an id or a key.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const dry = process.argv.includes("--dry-run");
const reasons = process.argv.includes("--also-no-card") ? ["safety", "no_card"] : ["safety"];
const HOUR = 3_600_000;
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** The same words, however they were spaced or cased (as lib/review/queue-groups.ts). */
const sameWords = (text) =>
  text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

async function openSampleRows() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("human_queue")
      .select("id, question_id, reason, created_at")
      .eq("is_sample", true)
      .neq("status", "resolved")
      .in("reason", reasons)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(`read queue failed (${error.code})`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function wordsOf(questionIds) {
  const words = new Map();
  for (let i = 0; i < questionIds.length; i += 200) {
    const { data, error } = await db
      .from("questions")
      .select("id, text_redacted")
      .eq("is_sample", true)
      .in("id", questionIds.slice(i, i + 200));
    if (error) throw new Error(`read questions failed (${error.code})`);
    for (const q of data) words.set(q.id, sameWords(q.text_redacted ?? ""));
  }
  return words;
}

const rows = await openSampleRows();
const words = await wordsOf([...new Set(rows.map((r) => r.question_id))]);
const groups = new Map();
for (const r of rows) {
  const w = words.get(r.question_id);
  if (!w) continue; // words we cannot read are never treated as a copy
  const k = `${r.reason}|${w}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

const now = Date.now();
const close = [];
let repeated = 0;
for (const members of groups.values()) {
  if (members.length < 2) continue;
  repeated += 1;
  members.sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const r of members.slice(1)) {
    if (now - new Date(r.created_at).getTime() > HOUR) close.push(r.id);
  }
}

console.log(`Open Sample rows (${reasons.join(", ")}): ${rows.length}`);
console.log(`Questions asked more than once: ${repeated}`);
console.log(`Copies older than an hour to close (the newest of each is kept): ${close.length}`);
if (dry) {
  console.log("Dry run: nothing changed.");
  process.exit(0);
}

let closed = 0;
for (let i = 0; i < close.length; i += 200) {
  const { data, error } = await db
    .from("human_queue")
    .update({
      status: "resolved",
      resolution_note: "A copy of the same Sample question, closed by tidy-sample-queue (D98).",
      resolved_at: new Date().toISOString(),
    })
    .in("id", close.slice(i, i + 200))
    .eq("is_sample", true)
    .neq("status", "resolved")
    .select("id");
  if (error) throw new Error(`close failed (${error.code})`);
  closed += data.length;
}
console.log(`Closed: ${closed}`);
