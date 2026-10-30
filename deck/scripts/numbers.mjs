// Every number the deck shows, read from the file that owns it, never typed from memory.
// Each entry is { value, source }. build.mjs fills {{key}} in the slides from here and fails on a
// key that is not defined, and writes deck/out/numbers.md so a reader can trace every figure.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, "utf8");
const json = (p) => JSON.parse(read(p));

const n = {};
const set = (key, value, source) => {
  if (value === undefined || value === null || value === "")
    throw new Error(`numbers: ${key} is empty (${source})`);
  n[key] = { value: String(value), source };
};
const grouped = (x) => Math.round(x).toLocaleString("en-IN");
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// ── video/numbers.json: field rows only. Re-read from the database first (pnpm field:numbers),
// so every field statement on the slides is as of this build; without database keys the build
// uses the last read and says so.
if (process.env.DECK_NO_DB !== "1") {
  const r = spawnSync(
    "node",
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--env-file-if-exists=.env.local",
      "scripts/field-numbers.mjs",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (r.status === 0) console.log(r.stdout.trim());
  else
    console.warn("field numbers NOT refreshed from the database:", r.stderr.trim().split("\n")[0]);
}
const vn = json("video/numbers.json").numbers;
{
  const { fieldLines } = await import(ROOT + "scripts/field-lines.mjs");
  const lines = fieldLines(vn);
  const src = `scripts/field-lines.mjs from video/numbers.json (${vn.teachers.source.split("; ").pop()})`;
  set("field_joined_line", lines.joined, src);
  set("field_asked_line", lines.asked, src);
  set("field_claim", lines.claim, src);
  set("field_limit", lines.limit, src);
  set(
    "field_first_join",
    vn.first_join_day.value,
    `video/numbers.json first_join_day: ${vn.first_join_day.source}`,
  );
}
for (const key of ["voice_notes", "masters", "cards", "teachers"]) {
  set(`field_${key}`, vn[key].value, `video/numbers.json ${key}: ${vn[key].source}`);
}
{
  const s = vn.voice_seconds.value;
  set(
    "field_voice_len",
    `${Math.floor(s / 60)} min ${s % 60} s`,
    `video/numbers.json voice_seconds (${s} s)`,
  );
}

// His seven notes, measured from the files themselves; they must add up to the interview's length.
{
  const dir = "video/public/audio/mahesh-notes/";
  const order = ["intro", "1", "2", "3", "4", "5", "6"];
  let total = 0;
  order.forEach((name, i) => {
    const d = Number(
      execFileSync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        `${ROOT}${dir}${name}.mp3`,
      ])
        .toString()
        .trim(),
    );
    total += d;
    set(`note_${i}`, mmss(d), `ffprobe ${dir}${name}.mp3 (${d.toFixed(1)} s)`);
  });
  if (Math.abs(total - vn.voice_seconds.value) > 1)
    throw new Error(`notes add up to ${total} s, numbers.json says ${vn.voice_seconds.value}`);
}
// The cited moment of his first card's first step: 1.mp3 2.75 to 11.06 s, and 1.mp3 starts at
// 32.433 s of the interview (video/craft/ASSETS.md, cut #943, transcribed back on 29 Oct).
{
  const assets = read("video/craft/ASSETS.md");
  const start = Number(/1\.mp3 at ([\d.]+) s/.exec(assets)[1]);
  const [a, b] = /mahesh-hear\.mp3 \| 1\.mp3 ([\d.]+)–([\d.]+)/.exec(assets).slice(1).map(Number);
  set(
    "card1_from",
    mmss(start + a),
    `video/craft/ASSETS.md: 1.mp3 at ${start} s + ${a} s (segment #943)`,
  );
  set(
    "card1_to",
    mmss(start + b),
    `video/craft/ASSETS.md: 1.mp3 at ${start} s + ${b} s (segment #943)`,
  );
}

// ── docs/evals/latest.json (the file docs/evals/latest.md is written from) ────────────────────
const ev = json("docs/evals/latest.json");
const gate = (id) => {
  const g = ev.gates.find((x) => x.id === id);
  if (!g) throw new Error(`no gate ${id}`);
  return g;
};
const evSrc = (id) => `docs/evals/latest.json (${ev.date}, ${ev.mode}) gate ${id}`;
const evDate = new Date(ev.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
set("eval_date", evDate, "docs/evals/latest.json date");
set("eval_checks", ev.suites.passed, "docs/evals/latest.json suites.passed");
set("gate_count", ev.gates.length, "docs/evals/latest.json gates");
set("eval_failed", ev.suites.failed, "docs/evals/latest.json suites.failed");
{
  const g = gate("grounding");
  set("gate_grounding", g.display, evSrc("grounding"));
  set("gate_grounding_cases", g.cases, evSrc("grounding"));
  const [, steps, , removed, drafted] =
    /(\d+) steps in (\d+) shipped answers; (\d+) of (\d+) drafted steps removed/.exec(g.detail);
  set("gate_steps_shipped", steps, evSrc("grounding") + " detail");
  set("gate_steps_removed", removed, evSrc("grounding") + " detail");
  set("gate_steps_drafted", drafted, evSrc("grounding") + " detail");
}
set("gate_unsafe", gate("unsafe_advice").display, evSrc("unsafe_advice"));
{
  const g = gate("safety_recall");
  const [, a, b] = /(\d+) of (\d+) recorded cases escalated/.exec(g.detail);
  set("gate_safety", `${a} of ${b}`, evSrc("safety_recall") + " detail");
}
{
  const g = gate("retrieval_hit_at_3");
  const [, a, b, c, d] =
    /(\d+) of (\d+) questions with a right card; (\d+) of (\d+) with no fitting card/.exec(
      g.detail,
    );
  set("gate_retrieval", `${a} of ${b}`, evSrc("retrieval_hit_at_3") + " detail");
  set("gate_retrieval_empty", `${c} of ${d}`, evSrc("retrieval_hit_at_3") + " detail");
}
set("gate_evidence", gate("evidence_resolvability").display, evSrc("evidence_resolvability"));
{
  const g = gate("latency");
  const [, p50, p95] = /p50 ([\d.]+ s) · p95 ([\d.]+ s)/.exec(g.display);
  set("gate_latency_p50", p50, evSrc("latency"));
  set("gate_latency_p95", p95, evSrc("latency"));
  // Where the time goes: each stage's recorded p50.
  for (const [key, label] of [
    ["understand", "understanding"],
    ["find", "finding"],
    ["draft", "drafting"],
    ["check", "checking"],
  ]) {
    const m = new RegExp(`${label} p50 ([\\d.]+ s)`).exec(g.detail);
    if (!m) throw new Error(`latency detail has no ${label}`);
    set(`stage_${key}`, m[1], evSrc("latency") + " detail");
  }
}
set("cost_q_usd", gate("cost_per_question").display, evSrc("cost_per_question"));
for (const [role, v] of Object.entries(ev.promptVersions))
  set(`v_${role}`, v, "docs/evals/latest.json promptVersions");
set("v_patterns", ev.safetyPatterns, "docs/evals/latest.json safetyPatterns");
for (const [key, id] of Object.entries({ sonnet: "answerer", haiku: "triage" })) {
  set(`model_${key}`, ev.models[id], "docs/evals/latest.json models");
}

// ── lib/costs/model.ts, the same function /how calls (jiti runs the TypeScript as it is) ──────
{
  const require = createRequire(ROOT + "node_modules/.pnpm/node_modules/");
  const { createJiti } = require("jiti");
  const jiti = createJiti(import.meta.url, { alias: { "@": ROOT.slice(0, -1) } });
  const cost = await jiti.import(ROOT + "lib/costs/model.ts");
  const m = cost.costModel();
  if (!m) throw new Error("costModel() is not measured");
  const src = `lib/costs/model.ts costModel() (eval of ${m.evalDate}, ${m.evalCases} recorded calls, ₹${m.rate} per US$)`;
  // Rounded exactly as /how rounds them (components/how/CostBlock.tsx).
  set(
    "cost_teacher_month",
    cost.rupees(cost.about(m.perTeacherMonthInr, 1)),
    src + " perTeacherMonthInr, about(n, 1)",
  );
  set(
    "cost_at_scale",
    cost.rupees(cost.about(m.atScaleMonthInr, 100)),
    src + " atScaleMonthInr, about(n, 100)",
  );
  set("cost_q_inr", cost.rupees(m.perQuestion.totalInr), src + " perQuestion.totalInr");
  set("cost_q_model_inr", cost.rupees(m.perQuestion.modelInr), src + " perQuestion.modelInr");
  set("cost_q_listen_inr", cost.rupees(m.perQuestion.listenInr), src + " perQuestion.listenInr");
  set("cost_q_speak_inr", cost.rupees(m.perQuestion.speakInr), src + " perQuestion.speakInr");
  set(
    "cost_hosting_teacher",
    cost.rupees(cost.about(m.hostingPerTeacherInr, 1)),
    src + " hostingPerTeacherInr",
  );
  set(
    "cost_q_per_month",
    cost.ASSUMED.questionsPerTeacherMonth,
    "lib/costs/model.ts ASSUMED.questionsPerTeacherMonth",
  );
  set(
    "cost_teachers_at_scale",
    grouped(cost.ASSUMED.teachersAtScale),
    "lib/costs/model.ts ASSUMED.teachersAtScale",
  );
  set("cost_q_seconds", cost.ASSUMED.questionSeconds, "lib/costs/model.ts ASSUMED.questionSeconds");
  set(
    "cost_answer_chars",
    cost.ASSUMED.answerCharacters,
    "lib/costs/model.ts ASSUMED.answerCharacters",
  );
}

// ── docs/evals/network.md: Chrome's own Slow 3G and Fast 3G presets, on the live site ────────
{
  const md = read("docs/evals/network.md");
  const date = /Run on (\d{4}-\d{2}-\d{2})/.exec(md)[1];
  const rows = md
    .split("\n")
    .filter((l) => /^\| .+ \| (Slow 3G|Fast 3G|offline) \|/.test(l))
    .map((l) => l.split("|").map((c) => c.trim()))
    .map((c) => ({ check: c[1], preset: c[2], mode: c[3], result: c[4], pass: c[5] === "yes" }));
  const src = `docs/evals/network.md (run ${date})`;
  const find = (check, preset, mode) => {
    const r = rows.find((x) => x.check === check && x.preset === preset && x.mode === mode);
    if (!r) throw new Error(`network.md: no row ${check} ${preset} ${mode}`);
    return r.result;
  };
  set(
    "net_date",
    new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    src,
  );
  set(
    "net_pass",
    `${rows.filter((r) => r.pass).length} of ${rows.length}`,
    src + ": rows marked pass",
  );
  const off = rows.filter((r) => r.preset === "offline");
  set(
    "net_offline_pass",
    `${off.filter((r) => r.pass).length} of ${off.length}`,
    src + ": offline rows marked pass",
  );
  set("net_slow_fcp_cold", find("/t first contentful paint", "Slow 3G", "cold"), src);
  set("net_slow_tti_cold", find("/t interactive", "Slow 3G", "cold"), src);
  set("net_slow_fcp_warm", find("/t first contentful paint", "Slow 3G", "warm"), src);
  set("net_slow_answer", find("warm chip tap to first step readable", "Slow 3G", "warm"), src);
  set("net_fast_answer", find("warm chip tap to first step readable", "Fast 3G", "warm"), src);
  set(
    "net_reconnect",
    find("the queued question sends on reconnect and its answer opens", "offline", "warm").replace(
      /^yes, /,
      "",
    ),
    src,
  );
  const fresh = /fresh answer\s+text p50 ([\d.]+ s)/.exec(md.replace(/\n\s*/g, " "));
  set("live_fresh_p50", fresh[1], src + " 'Measured elsewhere' (docs/evals/latency.md)");
  const chips = /warm sample chips about ([\d.]+ s)/.exec(md.replace(/\n\s*/g, " "));
  set("live_chip", chips[1], src + " 'Measured elsewhere' (docs/evals/latency.md)");
}

// ── Release checks recorded in docs/SUBMISSION.md, and the unit tests run now ────────────────
{
  const sub = read("docs/SUBMISSION.md");
  const [, a, b, day] = /judge path (\d+) of (\d+) on (\d+ \w+)/.exec(sub);
  set("judge_path", `${a} of ${b}`, `docs/SUBMISSION.md: judge path on live, ${day}`);
  set("judge_day", day, "docs/SUBMISSION.md");
}
{
  const file = ROOT + "deck/out/unit-tests.json";
  if (!existsSync(file) || process.env.DECK_FRESH_TESTS === "1") {
    spawnSync("pnpm", ["exec", "vitest", "run", "--reporter=json", `--outputFile=${file}`], {
      cwd: ROOT,
      stdio: "ignore",
    });
  }
  const r = JSON.parse(readFileSync(file, "utf8"));
  if (r.numFailedTests !== 0) throw new Error(`unit tests: ${r.numFailedTests} failed`);
  set(
    "unit_tests",
    grouped(r.numPassedTests),
    `pnpm test (vitest json, ${new Date(r.startTime).toISOString().slice(0, 16)}Z): passed, 0 failed`,
  );
}

// ── Facts from docs/story/STORY.md §1; each must appear there word for word ─────────────────
{
  const story = read("docs/story/STORY.md");
  const fact = (key, value, needle, source) => {
    if (!story.includes(needle)) throw new Error(`STORY.md no longer says "${needle}"`);
    set(key, value, `docs/story/STORY.md: ${source}`);
  };
  fact(
    "f_one_teacher",
    "8,042",
    "**8,042** Karnataka schools have **one teacher**",
    "UDISE+ 2025-26 via Deccan Herald",
  );
  fact(
    "f_reading",
    "15.4%",
    "Only **15.4%** of Class 3 children in Karnataka government schools",
    "ASER 2024",
  );
  fact("f_retire", "60", "retire at **60** (KCSR Rule 95)", "KCSR Rule 95");
  fact("f_phones", "98%", "**98%** of teachers have a smartphone", "CSF EdTech BaSE 2025");
  fact("f_coaching", "0.49 SD", "by **0.49 SD**", "Kraft, Blazar, Hogan 2018; Popova et al. 2022");
  fact("f_years", "32", "32 years in government schools", "his years, D101");
}

// ── The teacher path's safety audit (docs/handoff/2026-10-24-night.md) ───────────────────────
{
  const h = read("docs/handoff/2026-10-24-night.md");
  const [, found] =
    /(\d+) confirmed findings, all fixed except the per hour count race \(accepted\)/.exec(h);
  set("audit_found", found, "docs/handoff/2026-10-24-night.md: safety audit of the teacher path");
  set(
    "audit_fixed",
    Number(found) - 1,
    "docs/handoff/2026-10-24-night.md: all fixed except one, accepted",
  );
}

export const NUMBERS = n;
