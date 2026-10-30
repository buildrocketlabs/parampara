import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileRecordingStore, liveEvalsAllowed, type Recording } from "@/ai/evals/recording";
import { MODELS, type ModelKey } from "@/ai/router";
import { recordingKeyFor } from "@/ai/run";
import { ANSWERER_PROMPT_VERSION } from "@/ai/prompts/answerer";
import { buildAnswerRequest } from "@/ai/roles/answerer";
import {
  AnswerCase,
  cardsById,
  runAnswerChain,
  type ChainCall,
  type ChainOutcome,
} from "./ask_lib";
import { evalEnv, isRecorded, loadJsonl } from "./lib";

// Sonnet or Haiku for the answerer is the founder's call, on Kannada quality (24 Oct). This
// suite answers every answer case on a second model, through the same judges and final safety
// reading, and writes docs/evals/answerer-compare.md: both answers side by side in Kannada and
// English, with grounding, kept and removed steps, latency and cost. The second model is set only
// here, by AI_ANSWERER_MODEL (haiku by default), and reaches the runner as RunDeps.modelOverride:
// the app never reads it. Without recordings it is a todo and spends nothing; to record:
//   AI_ANSWERER_MODEL=haiku pnpm evals:live answerer-compare

const OTHER: ModelKey = process.env.AI_ANSWERER_MODEL === "sonnet" ? "sonnet" : "haiku";
const BASE: ModelKey = OTHER === "haiku" ? "sonnet" : "haiku";
const OUT = join(process.cwd(), "docs", "evals", "answerer-compare.md");
const cases = loadJsonl("answerer.jsonl", AnswerCase);
const store = fileRecordingStore();

type Side = { model: ModelKey; out: ChainOutcome };

function rec(call: ChainCall): Recording | null {
  return store.get(recordingKeyFor(call));
}

/** Latency of the answer, then of checking (the slowest judge or the safety reading), and the cost. */
function measure(out: ChainOutcome) {
  if (out.kind === "not_recorded" || out.kind === "incomplete") return null;
  const answer = rec(out.calls[0]!);
  const checks = out.calls.slice(1).map(rec);
  const lat = (r: Recording | null) => (typeof r?.latencyMs === "number" ? r.latencyMs : null);
  const checkTimes = checks.map(lat).filter((x): x is number => x !== null);
  return {
    answerMs: lat(answer),
    checkingMs: checkTimes.length ? Math.max(...checkTimes) : null,
    costUsd: [answer, ...checks].reduce((n, r) => n + (r?.costUsd ?? 0), 0),
  };
}

const secs = (ms: number | null) => (ms === null ? "n/a" : `${(ms / 1000).toFixed(1)} s`);
const cell = (s: string) => s.replace(/\|/g, "/").replace(/\n/g, " ");

function sideMarkdown(label: string, side: Side): string[] {
  const out = side.out;
  if (out.kind === "not_recorded" || out.kind === "incomplete" || !out.draft) {
    return [
      `**${label}**: ${out.kind === "incomplete" ? "partly recorded" : out.kind === "not_recorded" ? "not recorded" : `no draft (${out.reason})`}`,
      "",
    ];
  }
  const m = measure(out)!;
  const verdictWord = {
    kept: "kept",
    uncited: "removed: no given card",
    unsafe: "removed: unsafe words",
    unsupported: "removed: not supported",
  } as const;
  return [
    `**${label}** (${MODELS[side.model].id}): ${out.kind === "shipped" ? "shipped" : `not shipped (${out.kind}${out.reason ? `, ${out.reason}` : ""})`}; ${out.kept} of ${out.drafted} steps kept; answer ${secs(m.answerMs)}, checking ${secs(m.checkingMs)}; cost $${m.costUsd.toFixed(5)}`,
    "",
    `- ಶೀರ್ಷಿಕೆ / Title: ${cell(out.draft.title.kn)} / ${cell(out.draft.title.en)}`,
    ...out.draft.steps.map(
      (s, i) =>
        `- ${i + 1}. ${cell(s.kn)}  \n  ${cell(s.en)}  \n  _${verdictWord[out.verdicts?.[i] ?? "kept"]}, card ${s.cardId}_`,
    ),
    ...(out.draft.why
      ? [`- ಏಕೆ / Why: ${cell(out.draft.why.kn)} / ${cell(out.draft.why.en)}`]
      : []),
    "",
  ];
}

const recorded = (s: Side) => s.out.kind !== "not_recorded" && s.out.kind !== "incomplete";

export function renderCompare(all: Array<{ c: AnswerCase; base: Side; other: Side }>): string {
  // Only cases answered on both models are compared, so the two summaries count the same cases.
  const rows = all.filter((r) => recorded(r.base) && recorded(r.other));
  const waiting = all.filter((r) => !(recorded(r.base) && recorded(r.other)));
  const summary = (pick: (r: { c: AnswerCase; base: Side; other: Side }) => Side) => {
    const sides = rows.map(pick);
    const kept = sides.reduce((n, s) => n + ("kept" in s.out ? s.out.kept : 0), 0);
    const drafted = sides.reduce((n, s) => n + ("drafted" in s.out ? s.out.drafted : 0), 0);
    const shipped = sides.filter((s) => s.out.kind === "shipped").length;
    const ms = sides.map((s) => measure(s.out)).filter(Boolean) as Array<
      NonNullable<ReturnType<typeof measure>>
    >;
    const answerMs = ms
      .map((x) => x.answerMs)
      .filter((x): x is number => x !== null)
      .sort((a, b) => a - b);
    const median = answerMs.length ? answerMs[Math.floor((answerMs.length - 1) / 2)]! : null;
    const cost = ms.reduce((n, x) => n + x.costUsd, 0) / Math.max(1, ms.length);
    return `${shipped} of ${sides.length} shipped, ${kept} of ${drafted} drafted steps kept by the judge, answer median ${secs(median)}, mean cost $${cost.toFixed(5)} per question`;
  };
  return [
    "# Answerer: Sonnet or Haiku",
    "",
    `The same ${rows.length} answer cases (evals/answerer.jsonl, all Sample) answered by ${MODELS[BASE].id} and ${MODELS[OTHER].id}, each checked by the same grounding judges and final safety reading, from recordings (no new calls when this page is rewritten). Grounding is guaranteed either way: only steps the judge supports ship. What differs is how many steps survive, how the Kannada reads, the time and the cost. The founder reads the Kannada and decides.`,
    "",
    `- ${MODELS[BASE].id}: ${summary((r) => r.base)}`,
    `- ${MODELS[OTHER].id}: ${summary((r) => r.other)}`,
    "",
    ...rows.flatMap(({ c, base, other }) => [
      `## ${c.id}`,
      "",
      `Question (${c.input.lang}): ${cell(c.input.question)}`,
      "",
      ...sideMarkdown(base.model === "sonnet" ? "Sonnet" : "Haiku", base),
      ...sideMarkdown(other.model === "sonnet" ? "Sonnet" : "Haiku", other),
    ]),
    ...(waiting.length
      ? [
          `Not compared yet (not recorded on both models): ${waiting.map((r) => r.c.id).join(", ")}.`,
          "",
        ]
      : []),
  ].join("\n");
}

describe("answerer on another model, side by side", () => {
  const live = liveEvalsAllowed();
  const anyRecorded = cases.some((c) => {
    const { system, prompt } = buildAnswerRequest({
      ...c.input,
      cards: cardsById(c.input.cardIds),
    });
    return isRecorded({
      role: "answerer",
      promptVersion: ANSWERER_PROMPT_VERSION,
      system,
      prompt,
      itemId: c.id,
      modelKey: OTHER,
    });
  });
  if (!live && !anyRecorded) {
    it.todo(
      `answers on ${OTHER}: not yet recorded; AI_ANSWERER_MODEL=${OTHER} pnpm evals:live answerer-compare`,
    );
    return;
  }

  it(
    live
      ? `answers every case on ${OTHER} and writes answerer-compare.md`
      : "rewrites answerer-compare.md from the recordings",
    async () => {
      const rows: Array<{ c: AnswerCase; base: Side; other: Side }> = [];
      for (const c of cases) {
        // The base answers are the recorded ones and are never paid for again; a live run may
        // record their judges and final check when one of those prompts has changed.
        const base = await runAnswerChain(c, {
          deps: { env: evalEnv() },
          isRecorded: (call) => (live && call.role !== "answerer") || isRecorded(call),
        });
        const other = await runAnswerChain(c, {
          deps: { env: evalEnv() },
          isRecorded: (call) => live || isRecorded(call),
          answererModel: OTHER,
        });
        rows.push({ c, base: { model: BASE, out: base }, other: { model: OTHER, out: other } });
      }
      const otherDone = rows.filter(
        (r) => r.other.out.kind !== "not_recorded" && r.other.out.kind !== "incomplete",
      ).length;
      if (live) expect(otherDone, `${OTHER} answers recorded`).toBe(cases.length);
      const md = renderCompare(rows);
      const old = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
      if (old !== md) writeFileSync(OUT, md);
      expect(md).toContain("## ");
    },
    600_000,
  );
});

describe("the comparison page", () => {
  it("shows both answers in Kannada and English with what became of each step, and never invents a time", () => {
    const c = cases[0]!;
    const draft = {
      title: { kn: "ಮರಳಲ್ಲಿ ಅಕ್ಷರ", en: "Letters in sand" },
      steps: [
        { kn: "ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ.", en: "One letter a day.", cardId: "sample-card-01" },
        { kn: "ಬೇರೆ ಹಂತ.", en: "Another step.", cardId: "sample-card-09" },
      ],
      materials: [],
      why: null,
    };
    const shipped: ChainOutcome = {
      kind: "shipped",
      reason: null,
      drafted: 2,
      kept: 1,
      keptCitingGiven: 1,
      removed: { uncited: 1, unsafe: 0, unsupported: 0 },
      answerText: "x",
      calls: [
        { role: "answerer", promptVersion: "none", system: "", prompt: "", itemId: "unrecorded" },
      ],
      draft,
      verdicts: ["kept", "uncited"],
    };
    const md = renderCompare([
      { c, base: { model: "sonnet", out: shipped }, other: { model: "haiku", out: shipped } },
      {
        c: cases[1]!,
        base: { model: "sonnet", out: shipped },
        other: { model: "haiku", out: { kind: "not_recorded" } },
      },
    ]);
    expect(md).toContain("ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ.");
    expect(md).toContain("One letter a day.");
    expect(md).toContain("removed: no given card");
    expect(md).toContain("1 of 2 steps kept");
    expect(md).toContain("answer n/a");
    expect(md).toContain(`**Haiku** (${MODELS.haiku.id}): shipped`);
    // A case recorded on one model only is listed, never counted in either summary.
    expect(md).toContain(`Not compared yet (not recorded on both models): ${cases[1]!.id}.`);
    expect(md).toContain("1 of 1 shipped");
  });
});
