#!/usr/bin/env node
// Founder only, in your own Terminal (it needs the keys):
//   pnpm add:change --feedback <row id> --said-en "her words in English" \
//     --changed-kn "..." --changed-en "..." [--before shot.png] [--after shot.png] [--date 2026-10-30]
// Turns one feedback row into an entry of docs/field/changes.json ("You said, we changed" on /how,
// D67, D82). Only a field row (not Sample) whose writer ticked "you may quote my words", and only
// under her role word, never a name. Her words are taken from the row exactly as redacted; the
// other language (--said-en for Kannada words, --said-kn for English ones) is your rendering.
// Screenshots are copied to public/field/changes/. Check the diff, run pnpm test, then commit.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { appendChange, buildChange, wordsLang } = await import("../lib/field/change-schema.ts");

const { values } = parseArgs({
  options: {
    feedback: { type: "string" },
    before: { type: "string" },
    after: { type: "string" },
    "changed-kn": { type: "string" },
    "changed-en": { type: "string" },
    "said-en": { type: "string" },
    "said-kn": { type: "string" },
    date: { type: "string" },
  },
});

const fail = (line) => {
  console.error(`  ✗ ${line}`);
  process.exit(1);
};
if (!/^[0-9a-f-]{36}$/i.test(values.feedback ?? ""))
  fail("--feedback must be the feedback row's id (a uuid)");
if (!values["changed-kn"] || !values["changed-en"])
  fail("--changed-kn and --changed-en are both needed");
for (const shot of [values.before, values.after]) {
  if (shot && !existsSync(shot)) fail(`no such screenshot: ${shot}`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("Supabase keys missing (run the keys script in your Terminal)");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: row, error } = await db
  .from("feedback")
  .select("id, text_redacted, quote_ok, role_word, is_sample, created_at")
  .eq("id", values.feedback)
  .maybeSingle();
if (error) {
  fail(
    ["42703", "PGRST204"].includes(error.code)
      ? "the database has no quotable feedback yet: apply 0007 first (ALLOW_DB_PUSH=1 pnpm db:push)"
      : `could not read the feedback row (${error.code})`,
  );
}
if (!row) fail("no feedback row with that id");

const text = row.text_redacted ?? "";
const ext = (p) => (p ? extname(p).slice(1).toLowerCase().replace("jpeg", "jpg") : null);
const built = buildChange({
  feedback: {
    id: row.id,
    text,
    quoteOk: row.quote_ok,
    roleWord: row.role_word,
    isSample: row.is_sample,
    createdAt: row.created_at,
  },
  saidOther: text && wordsLang(text) === "kn" ? values["said-en"] : values["said-kn"],
  changedKn: values["changed-kn"],
  changedEn: values["changed-en"],
  beforeExt: ext(values.before),
  afterExt: ext(values.after),
  date: values.date,
});
const WHY = {
  not_quotable: "she did not tick 'you may quote my words', so these words stay with the team",
  sample: "this is a Sample row; changes.json holds only what was said in the field",
  no_words: "the row has no kept words to quote",
  no_role: "the row has no role word (made before 0007), so it cannot be credited",
  needs_other_language:
    text && wordsLang(text) === "kn"
      ? "her words are Kannada: add --said-en with your English rendering"
      : "her words are English: add --said-kn with your Kannada rendering",
  bad_shot: "screenshots must be .png, .jpg or .webp",
  invalid: "the entry is not valid (each line 1 to 400 letters)",
};
if (!built.ok) fail(WHY[built.error]);

const file = "docs/field/changes.json";
const added = appendChange(JSON.parse(readFileSync(file, "utf8")), built.entry);
if (!added.ok)
  fail(
    added.error === "duplicate" ? "these words are in the file already" : `${file} is not valid`,
  );

mkdirSync("public/field/changes", { recursive: true });
if (values.before) copyFileSync(values.before, `public${built.entry.before}`);
if (values.after) copyFileSync(values.after, `public${built.entry.after}`);
writeFileSync(file, `${JSON.stringify(added.file, null, 2)}\n`);
console.log(`  ✓ added to ${file} (${built.entry.date}, ${built.entry.who})`);
console.log(
  "    Check the diff and the screenshots (no faces, no names), run pnpm test, then commit.",
);
