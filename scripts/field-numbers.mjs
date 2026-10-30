#!/usr/bin/env node
// The Koppal field test, read from the database and written where the submission shows it:
// video/numbers.json (the film's and the deck's numbers), README.md and docs/SUBMISSION.md (the
// blocks between <!-- field:start --> and <!-- field:end -->). Field rows only (is_sample = false),
// through the same loader as /how (lib/field/summary.ts), so a count about fewer than 5 different
// teachers stays private here exactly as it does there.
//
//   pnpm field:numbers
//
// Writes counts, days and his record only, never a question, a name of a teacher, a code or a key.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { FIELD_MIN_TEACHERS, loadFieldSummary } from "../lib/field/summary.ts";
import { day, fieldLines } from "./field-lines.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const summary = await loadFieldSummary(db);
if (!summary) throw new Error("the field summary could not be read");

const [questions, answers, queue, firstJoin, masters] = await Promise.all([
  db.from("questions").select("id, teacher_id, created_at").eq("is_sample", false).limit(50000),
  db.from("answers").select("question_id, status").eq("is_sample", false).limit(50000),
  db.from("human_queue").select("question_id").eq("is_sample", false).limit(50000),
  db
    .from("profiles")
    .select("consented_at")
    .eq("is_sample", false)
    .eq("role", "teacher")
    .not("consented_at", "is", null)
    .order("consented_at", { ascending: true })
    .limit(1),
  db.from("masters").select("years, school").eq("is_sample", false).not("consented_at", "is", null),
]);
for (const r of [questions, answers, queue, firstJoin, masters]) if (r.error) throw r.error;

// Answered from his cards, or sent to a person: private with the question count, by the same rule
// as lib/field/summary.ts (1 to 4 different teachers behind it).
const answeredIds = new Set(
  answers.data.filter((a) => a.status === "answered").map((a) => a.question_id),
);
const toPersonIds = new Set([
  ...queue.data.map((h) => h.question_id),
  ...answers.data
    .filter((a) => a.status === "needs_human" || a.status === "escalated")
    .map((a) => a.question_id),
]);
const answeredCount = questions.data.filter((q) => answeredIds.has(q.id)).length;
const toPersonCount = questions.data.filter(
  (q) => !answeredIds.has(q.id) && toPersonIds.has(q.id),
).length;
const askerCount = new Set(questions.data.map((q) => q.teacher_id)).size;
const privateSplit = askerCount >= 1 && askerCount < FIELD_MIN_TEACHERS;

const now = new Date();
const at = `read ${now.toISOString().slice(0, 16)}Z by scripts/field-numbers.mjs`;
const firstQuestion = questions.data.map((q) => q.created_at).sort()[0] ?? null;
const his = masters.data[0];

const file = ROOT + "video/numbers.json";
const nj = JSON.parse(readFileSync(file, "utf8"));
const put = (k, count, source) => {
  nj.numbers[k] = {
    ...(nj.numbers[k] ?? {}),
    value: count.hidden ? null : count.n,
    source: `${source}; ${at}`,
    hidden: count.hidden,
  };
};
const plain = (n) => ({ n, hidden: false });
put(
  "masters",
  plain(summary.masters),
  "lib/field/summary.ts masters: field master teachers with consent on record, as /how 'From the field' shows",
);
put(
  "cards",
  plain(summary.approvedCards),
  "lib/field/summary.ts approvedCards: approved field cards, as /how 'From the field' shows",
);
put(
  "teachers",
  plain(summary.teachers),
  "lib/field/summary.ts teachers: field teachers who joined and agreed, as /how 'From the field' shows",
);
put(
  "questions",
  summary.questions,
  "lib/field/summary.ts questions: field questions, private while fewer than 5 different teachers asked",
);
put(
  "tried",
  summary.tried,
  "lib/field/summary.ts tried: field 'tried' reports, private while fewer than 5 different teachers reported",
);
put(
  "worked",
  summary.worked,
  "lib/field/summary.ts worked: field 'it worked' taps, private while fewer than 5 different teachers tried",
);
put(
  "answered_from_cards",
  privateSplit ? { n: null, hidden: true } : plain(answeredCount),
  "field questions with an answer from approved field cards (answers.status = answered), private with the question count",
);
put(
  "sent_to_person",
  privateSplit ? { n: null, hidden: true } : plain(toPersonCount),
  "field questions sent to a person (human_queue, or needs_human / escalated), private with the question count",
);
nj.numbers.first_join_day = {
  value: firstJoin.data[0] ? day(firstJoin.data[0].consented_at) : null,
  source: `the first field teacher's consent (profiles.consented_at, IST day); ${at}`,
  hidden: false,
};
nj.numbers.first_question_day = {
  value: firstQuestion ? day(firstQuestion) : null,
  source: `the first field question (questions.created_at, IST day); ${at}`,
  hidden: false,
};
nj.numbers.master_years = {
  value: his?.years ?? null,
  source: `masters.years of the consented field master (his record, D101); ${at}`,
  hidden: false,
};
writeFileSync(file, JSON.stringify(nj, null, 2) + "\n");

// ── README and SUBMISSION: the field blocks, written from the numbers just stored ─────────────
const n = nj.numbers;
const lines = fieldLines(n);
const show = (k) =>
  n[k].hidden ? "kept private (fewer than 5 teachers)" : String(n[k].value ?? 0);
const read = now.toLocaleString("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});
const school = (his?.school ?? "").split(" / ");
const table = `| Measure (field rows only) | Value |
|---|---|
| Master teachers with consent on record | ${show("masters")} |
| Practice cards approved from field interviews | ${show("cards")} (every step cites a second of his recording) |
| His interview | ${n.voice_notes.value} voice notes, ${Math.floor(n.voice_seconds.value / 60)} min ${n.voice_seconds.value % 60} s |
| Field teachers who joined and agreed in the app | ${show("teachers")} |
| Field questions asked | ${show("questions")} |
| Answered from his approved cards / sent to a person | ${n.answered_from_cards.hidden ? "kept private (fewer than 5 teachers)" : `${show("answered_from_cards")} / ${show("sent_to_person")}`} |
| Tried: worked / partly / didn't | ${n.tried.hidden ? "kept private (fewer than 5 teachers)" : n.tried.value ? `${show("worked")} of ${show("tried")} worked` : "none yet"} |`;

const readme = `<!-- field:start (written by pnpm field:numbers from the database; edits here are overwritten) -->
*Read from the database on ${read} IST (field rows only, \`is_sample = false\`; the same loader as \`/how\` "From the field", \`lib/field/summary.ts\`). Written by \`pnpm field:numbers\`; nothing here is typed by hand.*

- **First master teacher:** Headmaster Mahesh Bedavatti, ${school[0]}${school[1] ? ` (${school[1]})` : ""}, Koppal district, ${n.master_years.value} years in government schools. His interview is **${n.voice_notes.value} WhatsApp voice notes, ${Math.floor(n.voice_seconds.value / 60)} min ${n.voice_seconds.value % 60} s** in all (28 Oct), the first one his spoken consent ("ನನ್ನ ಹೆಸರು ಮತ್ತು ಧ್ವನಿಯೊಂದಿಗೆ": with his name and voice). Credited by full name, with clips of his own voice.
- **Talakal teachers:** ${lines.joined} ${lines.asked} The photos in the video are from 29 Oct (adults who agreed; no children's faces).

${table}

${lines.outcome} The numbers above update on \`/how\` as they change (counts about fewer than 5 teachers stay private there, by design).
<!-- field:end -->`;

const submission = `<!-- field:start (written by pnpm field:numbers from the database; edits here are overwritten) -->
## Field: Koppal field test (read ${read} IST)

${table}

${lines.joined} ${lines.asked} ${lines.outcome}
<!-- field:end -->`;

const swap = (path, block, after) => {
  const text = readFileSync(ROOT + path, "utf8");
  const re = /<!-- field:start[\s\S]*?<!-- field:end -->/;
  let next;
  if (re.test(text)) next = text.replace(re, block);
  else {
    if (!after.test(text)) throw new Error(`${path}: no place for the field block`);
    next = text.replace(after, (m) => `${m}${block}\n\n`);
  }
  writeFileSync(ROOT + path, next);
};
swap("README.md", readme, /## Field: Koppal district\n/);
swap("docs/SUBMISSION.md", submission, /(?=## Test credentials)/);

console.log(
  `Field: ${summary.masters} master, ${summary.approvedCards} cards, ${summary.teachers} teachers, questions ${
    summary.questions.hidden ? "private" : summary.questions.n
  }, tried ${summary.tried.hidden ? "private" : summary.tried.n}. Wrote video/numbers.json, README.md, docs/SUBMISSION.md.`,
);
