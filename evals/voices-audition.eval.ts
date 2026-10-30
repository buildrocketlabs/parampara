import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { liveEvalsAllowed } from "@/ai/evals/recording";
import { SPEECH, SPEECH_VOICES } from "@/ai/router";
import { hasChildNamePattern } from "@/ai/safety/names";
import { INR_PER_USD, SPEECH_PRICE_INR } from "@/ai/speech/cost";
import { speak } from "@/ai/speech/sarvam";
import { CONSENT_TEXT_KN_V1 } from "@/lib/import/create";
import { LIBRARY } from "./ask_lib";

// Hanate's voice audition (jury review, 24 Oct): one real Sample answer and the consent line, in
// every Bulbul v3 voice that speaks Kannada, at pace 1.0 and 0.9, for the founder to hear side by
// side and pick. Never part of a normal run: it speaks only with LIVE_EVALS=1 and this file's
// filter, and the founder runs it:
//   AUDITION_PACE=1.0 pnpm evals:live voices
//   AUDITION_PACE=0.9 pnpm evals:live voices
// It prints the expected cost from ai/speech/cost.ts first and refuses above ₹5. Both paces in one
// run come to about ₹9.5, so each pace is its own run of about ₹4.7. Every call is logged to
// ai_calls like any other speak call (one trace for the run). Files go to field-private/voices/
// (gitignored) with an index.html that plays them side by side and keeps notes on this computer.
//
// After the pick, the voice is one line in ai/router.ts (SPEECH.speak.speaker, and pace). That
// changes SPEAK_VOICE_ID, so Hanate's talk lines are made again in the new voice on first use.
// Answers already voiced keep their stored file (answers.audio_path) until it is cleared.

export const MAX_INR = 5;
const OUT_DIR = join(process.cwd(), "field-private", "voices");
const MODEL = "bulbul:v3" as const;
const VOICES = SPEECH_VOICES[MODEL];
const PACES = [1, 0.9] as const;
/** A real answer is a card's own words: the first card's title and steps, to about 180 characters. */
const ANSWER_MAX_CHARS = 180;

function sampleAnswer(): string {
  const card = LIBRARY.get("sample-card-01")!;
  let text = `${card.title.kn}.`;
  for (const step of card.steps) {
    const next = `${text} ${step.kn}`;
    if (next.length > ANSWER_MAX_CHARS) break;
    text = next;
  }
  return text;
}

export const ANSWER = sampleAnswer();
export const CONSENT = CONSENT_TEXT_KN_V1;
/** One file per voice and pace: the answer, then the consent line. */
export const SCRIPT = `${ANSWER} ${CONSENT}`;

const paceLabel = (pace: number) => pace.toFixed(1);

export function auditionPlan(paces: readonly number[]) {
  const combos = VOICES.flatMap((voice) => paces.map((pace) => ({ voice, pace, file: `${voice}-${paceLabel(pace)}.mp3` })));
  const chars = combos.length * SCRIPT.length;
  const inr = chars * SPEECH_PRICE_INR[MODEL].inr;
  return { combos, chars, inr, usd: inr / INR_PER_USD };
}

function pacesFromEnv(env: Record<string, string | undefined> = process.env): number[] {
  const raw = env.AUDITION_PACE?.trim();
  if (!raw) return [...PACES];
  const pace = Number(raw);
  if (!PACES.includes(pace as (typeof PACES)[number])) throw new Error("AUDITION_PACE must be 1.0 or 0.9");
  return [pace];
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The listening page: every voice side by side, both paces, notes and a pick kept in this browser. */
export function renderIndex(files: string[], today: string): string {
  const columns = VOICES.map((voice) => {
    const players = PACES.map((pace) => {
      const file = `${voice}-${paceLabel(pace)}.mp3`;
      return files.includes(file)
        ? `<figure><figcaption>pace ${paceLabel(pace)}</figcaption><audio controls preload="none" src="${file}"></audio></figure>`
        : `<p class="missing">pace ${paceLabel(pace)}: not made yet</p>`;
    }).join("");
    return `<section><h2>${voice}${voice === SPEECH.speak.speaker ? ' <span class="now">in use now</span>' : ""}</h2>${players}
<label>Notes<textarea data-note="${voice}" rows="5" placeholder="Warmth, clarity, Kannada pronunciation, pace for an elder"></textarea></label>
<label class="pick"><input type="radio" name="pick" value="${voice}"> My pick</label></section>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hanate voice audition</title>
<style>
  :root { color-scheme: light; --ink: #1f2a24; --muted: #5b665f; --paper: #fffdf7; --clay: #b5482d; --line: #e6dccb; }
  body { margin: 0; font: 16px/1.5 system-ui, sans-serif; color: var(--ink); background: #f6efe2; }
  main { max-width: 1200px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { margin: 0 0 4px; font-size: 26px; }
  .lead { color: var(--muted); margin: 0 0 16px; }
  blockquote { margin: 8px 0 20px; padding: 12px 16px; background: var(--paper); border-left: 4px solid #f2b84b; border-radius: 8px; }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  section { background: var(--paper); border: 1px solid var(--line); border-radius: 16px; padding: 16px; }
  h2 { margin: 0 0 8px; font-size: 20px; text-transform: capitalize; }
  .now { font-size: 13px; color: var(--clay); text-transform: none; }
  figure { margin: 0 0 10px; } figcaption { font-size: 14px; color: var(--muted); }
  audio { width: 100%; }
  label { display: block; margin-top: 10px; font-size: 14px; color: var(--muted); }
  textarea { width: 100%; box-sizing: border-box; margin-top: 4px; font: inherit; color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 8px; }
  .pick { font-weight: 600; color: var(--ink); }
  .missing { color: var(--muted); font-size: 14px; }
</style>
</head>
<body>
<main>
<h1>Hanate voice audition</h1>
<p class="lead">Bulbul v3, Kannada, made ${escapeHtml(today)}. The same words in every voice: a Sample answer, then the consent line. Notes and your pick stay in this browser only.</p>
<blockquote lang="kn">${escapeHtml(ANSWER)}<br><br>${escapeHtml(CONSENT)}</blockquote>
<div class="grid">
${columns}
</div>
</main>
<script>
  const key = "parampara.voice-audition.v1";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
  const save = () => { try { localStorage.setItem(key, JSON.stringify(saved)); } catch {} };
  document.querySelectorAll("textarea[data-note]").forEach((t) => {
    t.value = (saved.notes || {})[t.dataset.note] || "";
    t.addEventListener("input", () => { saved.notes = { ...(saved.notes || {}), [t.dataset.note]: t.value }; save(); });
  });
  document.querySelectorAll('input[name="pick"]').forEach((r) => {
    r.checked = saved.pick === r.value;
    r.addEventListener("change", () => { saved.pick = r.value; save(); });
  });
</script>
</body>
</html>
`;
}

function isGitIgnored(path: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

afterEach(() => vi.unstubAllEnvs());

describe("voice audition: the plan", () => {
  it("one pace at a time stays under ₹5; both paces at once are refused", () => {
    for (const pace of PACES) expect(auditionPlan([pace]).inr).toBeLessThan(MAX_INR);
    expect(auditionPlan(PACES).inr).toBeGreaterThan(MAX_INR);
    expect(auditionPlan([1]).combos).toHaveLength(VOICES.length);
  });

  it("speaks a real Sample answer of about 180 characters and the consent line, with no names", () => {
    expect(ANSWER.length).toBeGreaterThan(120);
    expect(ANSWER.length).toBeLessThanOrEqual(ANSWER_MAX_CHARS);
    expect(hasChildNamePattern(SCRIPT)).toBe(false);
    const card = LIBRARY.get("sample-card-01")!;
    if (card.masterName) expect(SCRIPT).not.toContain(card.masterName);
  });

  it("writes only where git ignores it", () => {
    expect(isGitIgnored(join(OUT_DIR, "ishita-1.0.mp3"))).toBe(true);
    expect(isGitIgnored(join(OUT_DIR, "index.html"))).toBe(true);
  });

  it("the listening page plays what exists, names every voice and keeps notes", () => {
    const html = renderIndex(["ishita-1.0.mp3", "shubh-0.9.mp3"], "2026-10-24");
    for (const voice of VOICES) expect(html).toContain(`data-note="${voice}"`);
    expect(html).toContain('src="ishita-1.0.mp3"');
    expect(html).toContain('src="shubh-0.9.mp3"');
    expect(html).toContain("not made yet");
    expect(html).not.toMatch(/api[-_]?key|subscription/i);
  });
});

describe("voice audition with Sarvam", () => {
  if (!liveEvalsAllowed()) {
    it.todo("the founder runs it: AUDITION_PACE=1.0 pnpm evals:live voices, then AUDITION_PACE=0.9");
    return;
  }
  it("speaks every Kannada voice at the chosen pace, under ₹5, into field-private/voices", async () => {
    // Speech only: no Claude call can happen in this run.
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const plan = auditionPlan(pacesFromEnv());
    console.log(
      `  Plan: ${plan.combos.length} files (${VOICES.join(", ")} at pace ${[...new Set(plan.combos.map((c) => paceLabel(c.pace)))].join(" and ")}), ${plan.chars} characters, expected ₹${plan.inr.toFixed(2)} ($${plan.usd.toFixed(4)})`,
    );
    if (plan.inr > MAX_INR) {
      throw new Error(`Refused: expected ₹${plan.inr.toFixed(2)} is above ₹${MAX_INR}. Run one pace at a time: AUDITION_PACE=1.0 or AUDITION_PACE=0.9.`);
    }
    expect(isGitIgnored(join(OUT_DIR, "index.html")), "field-private/voices must be gitignored").toBe(true);
    mkdirSync(OUT_DIR, { recursive: true });

    const traceId = crypto.randomUUID();
    let spent = 0;
    for (const c of plan.combos) {
      const out = await speak(SCRIPT, { model: MODEL, voice: c.voice, pace: c.pace, codec: "mp3", traceId });
      writeFileSync(join(OUT_DIR, c.file), out.audio);
      spent += out.span.costUsd;
      console.log(`  ✓ ${c.file}  $${out.span.costUsd.toFixed(6)} (₹${(out.span.costUsd * INR_PER_USD).toFixed(3)})`);
    }
    const made = VOICES.flatMap((v) => PACES.map((p) => `${v}-${paceLabel(p)}.mp3`)).filter((f) => existsSync(join(OUT_DIR, f)));
    writeFileSync(join(OUT_DIR, "index.html"), renderIndex(made, new Date().toISOString().slice(0, 10)));
    console.log(`  ✓ field-private/voices/index.html lists ${made.length} files`);
    console.log(`  Spent $${spent.toFixed(6)} (₹${(spent * INR_PER_USD).toFixed(2)}), logged to ai_calls under one trace`);
    expect(spent * INR_PER_USD).toBeLessThan(MAX_INR);
  }, 300_000);
});
