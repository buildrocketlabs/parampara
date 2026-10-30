import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { memoryRecordingStore, type Recording } from "@/ai/evals/recording";
import { ANSWERER_PROMPT_VERSION } from "@/ai/prompts/answerer";
import { CARD_EXTRACTOR_PROMPT_VERSION } from "@/ai/prompts/card_extractor";
import { JUDGE_PROMPT_VERSION } from "@/ai/prompts/grounding_judge";
import { RETRIEVER_PROMPT_VERSION } from "@/ai/prompts/retriever";
import { SAFETY_PROMPT_VERSION } from "@/ai/prompts/safety";
import { TRIAGE_PROMPT_VERSION } from "@/ai/prompts/triage";
import { buildAnswerRequest, finalizeAnswer } from "@/ai/roles/answerer";
import { buildExtractorRequest } from "@/ai/roles/card_extractor";
import { buildJudgeRequest } from "@/ai/roles/grounding_judge";
import { buildRankRequest, indexRefs } from "@/ai/roles/retriever";
import { buildSafetyRequest } from "@/ai/roles/safety";
import { NAME_CHECK_PROMPT_VERSION } from "@/ai/prompts/name_check";
import { buildNameCheckRequest } from "@/ai/roles/name_check";
import { buildTriageRequest, finalizeTriage } from "@/ai/roles/triage";
import { modelIdFor } from "@/ai/router";
import { recordingKeyFor } from "@/ai/run";
import { findUnsafe } from "@/ai/safety/patterns";
import { AnswerCase, cardsById, CHAIN_MIN_SUPPORTED, finalAnswerText, INDEX, JudgeCase, LIBRARY, RankCase, SafetyCase, TriageCase, type ChainCall } from "./ask_lib";
import { computeGates, maxQuantile, NOT_MEASURED, percentile, renderMarkdown, sameReport, type EvalReport } from "./gates";
import { ExtractorCase, loadJsonl } from "./lib";
import { writeReport } from "./reporter";

// The gate report (docs/evals/latest.json) never invents a number: with no recordings every gate
// says so, and with recordings the numbers follow from them. Zero cost: a memory store, no model.

const LAT: Record<string, number> = { triage: 800, name_check: 500, retriever: 700, answerer: 6_000, grounding_judge: 1_000, safety: 900, card_extractor: 30_000 };
const COST: Record<string, number> = { triage: 0.0005, name_check: 0.0001, retriever: 0.0004, answerer: 0.012, grounding_judge: 0.0006, safety: 0.001, card_extractor: 0.05 };

function rec(call: ChainCall, output: unknown): Recording {
  return {
    key: recordingKeyFor(call),
    role: call.role,
    model: modelIdFor(call.role),
    promptVersion: call.promptVersion,
    itemId: call.itemId,
    recordedAt: "2026-10-24T00:00:00.000Z",
    attempts: 1,
    usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 },
    costUsd: COST[call.role]!,
    latencyMs: LAT[call.role],
    outcome: "ok",
    output,
  };
}

/** Every eval case "recorded" with its own hand written reference, and each answer's chain. */
function seededStore() {
  const recs: Recording[] = [];
  for (const c of loadJsonl("triage.jsonl", TriageCase)) {
    recs.push(rec({ role: "triage", promptVersion: TRIAGE_PROMPT_VERSION, ...buildTriageRequest(c.input), itemId: c.id }, c.reference));
    // Its second name reader, on the redacted words triage hands on.
    const redacted = finalizeTriage(c.input, c.reference).redactedText;
    recs.push(
      rec(
        { role: "name_check", promptVersion: NAME_CHECK_PROMPT_VERSION, ...buildNameCheckRequest({ phrases: [{ textKn: redacted, textEn: "" }] }), itemId: `${c.id}:name_check:0` },
        { flagged: [] },
      ),
    );
  }
  for (const c of loadJsonl("retriever.jsonl", RankCase)) {
    const index = c.input.indexIds.map((id) => INDEX.get(id)!);
    const { refOf } = indexRefs(index);
    const output = { picks: c.reference.picks.map((p) => ({ ref: refOf.get(p.cardId)!, reason: p.reason })), noneFit: c.reference.noneFit };
    recs.push(rec({ role: "retriever", promptVersion: RETRIEVER_PROMPT_VERSION, ...buildRankRequest({ triage: c.input.triage, index }), itemId: c.id }, output));
  }
  for (const c of loadJsonl("grounding_judge.jsonl", JudgeCase)) {
    const card = LIBRARY.get(c.input.cardId)!;
    recs.push(rec({ role: "grounding_judge", promptVersion: JUDGE_PROMPT_VERSION, ...buildJudgeRequest({ step: c.input.step, card }), itemId: c.id }, c.reference));
  }
  for (const c of loadJsonl("safety.jsonl", SafetyCase)) {
    recs.push(rec({ role: "safety", promptVersion: SAFETY_PROMPT_VERSION, ...buildSafetyRequest(c.input), itemId: c.id }, c.reference));
  }
  for (const c of loadJsonl("card_extractor.jsonl", ExtractorCase)) {
    recs.push(rec({ role: "card_extractor", promptVersion: CARD_EXTRACTOR_PROMPT_VERSION, ...buildExtractorRequest(c.input), itemId: c.id }, c.reference));
  }
  let shipped = 0;
  for (const c of loadJsonl("answerer.jsonl", AnswerCase)) {
    const cards = cardsById(c.input.cardIds);
    const req = buildAnswerRequest({ ...c.input, cards });
    recs.push(rec({ role: "answerer", promptVersion: ANSWERER_PROMPT_VERSION, system: req.system, prompt: req.prompt, itemId: c.id }, c.reference));
    const draft = finalizeAnswer({ lang: c.input.lang, byRef: req.byRef }, c.reference);
    const kept = draft.steps.filter((s) => cards.some((k) => k.id === s.cardId) && !findUnsafe(`${s.kn} ${s.en} ${s.hi ?? ""}`).length);
    for (const [i, step] of draft.steps.entries()) {
      const card = cards.find((k) => k.id === step.cardId);
      if (!card) continue;
      const judge = { verdict: "supported", cardQuote: card.steps.find((s) => s.en.length >= 12)?.en ?? card.steps[0]!.en, reason: "The card says so." };
      recs.push(rec({ role: "grounding_judge", promptVersion: JUDGE_PROMPT_VERSION, ...buildJudgeRequest({ step, card }), itemId: `${c.id}:step${i + 1}` }, judge));
    }
    const answerText = finalAnswerText(draft, kept);
    const ok = { ok: true, categories: [], escalate: false, reason: "Fine." };
    recs.push(rec({ role: "safety", promptVersion: SAFETY_PROMPT_VERSION, ...buildSafetyRequest({ question: c.input.question, answerText }), itemId: `${c.id}:final` }, ok));
    if (kept.length >= CHAIN_MIN_SUPPORTED) shipped++;
  }
  return { store: memoryRecordingStore(recs), shipped };
}

const report = (gates: Awaited<ReturnType<typeof computeGates>>): EvalReport => ({ date: "2026-10-24", suites: null, ...gates });

describe("eval gates with no recordings", () => {
  it("say not measured yet and carry no number, while the guardrail cases are listed apart", async () => {
    const r = await computeGates(memoryRecordingStore());
    expect(r.gates.map((g) => g.id)).toEqual([
      "grounding",
      "unsafe_advice",
      "safety_recall",
      "retrieval_hit_at_3",
      "evidence_resolvability",
      "needs_human_rate",
      "latency",
      "cost_per_question",
    ]);
    for (const g of r.gates) {
      expect(g.basis).not.toBe("recorded");
      expect(g).toMatchObject({ value: null, display: NOT_MEASURED, cases: 0, pass: null });
    }
    const guarded = r.gates.filter((g) => g.guardrails);
    expect(guarded.length).toBe(5);
    // Refusing bad outputs must always hold; the safety floor is what the patterns alone escalate,
    // and the indirect disclosures in the set are there precisely because the patterns miss them.
    for (const g of guarded) {
      if (g.id === "safety_recall") expect(g.guardrails!.held).toBeLessThan(g.guardrails!.cases);
      else expect(g.guardrails!.held).toBe(g.guardrails!.cases);
    }
    expect(r.recordings.every((x) => x.recorded === 0 && x.cases > 0)).toBe(true);
  });

  it("the written table shows no figure for a gate that is not measured", async () => {
    const md = renderMarkdown(report(await computeGates(memoryRecordingStore())));
    const gateRows = md.split("\n").filter((l) => l.startsWith("| ") && l.includes(NOT_MEASURED));
    expect(gateRows).toHaveLength(8);
    for (const row of gateRows) expect(row.split("|")[4]!.trim()).toBe("0");
  });
});

describe("eval gates from recordings", () => {
  const seeded = seededStore();

  it("are computed from the recorded outputs, with the cases they rest on", async () => {
    const r = await computeGates(seeded.store);
    const g = Object.fromEntries(r.gates.map((x) => [x.id, x]));
    for (const x of r.gates) expect(x.basis).toBe("recorded");

    expect(g.grounding).toMatchObject({ value: 1, pass: true, cases: seeded.shipped });
    expect(g.unsafe_advice).toMatchObject({ value: 0, pass: true, cases: seeded.shipped });
    expect(g.safety_recall!.value).toBeGreaterThan(0);
    expect(g.retrieval_hit_at_3).toMatchObject({ value: 1, pass: true });
    expect(g.evidence_resolvability).toMatchObject({ value: 1, pass: true });
    expect(g.needs_human_rate!.value).toBeGreaterThanOrEqual(0);
    expect(g.needs_human_rate!.pass).toBeNull();

    // Understanding (triage), then the name reader (0.5 s) and the ranker (0.7 s) side by side,
    // drafting, then checking, where the judges (1.0 s) and the final safety reading (0.9 s) run
    // at once: each time the slower one counts.
    expect(g.latency).toMatchObject({ value: 800 + 700 + 6_000 + 1_000, p95: 800 + 700 + 6_000 + 1_000, pass: true });
    expect(g.cost_per_question!.value).toBeGreaterThan(0.0005 + 0.0001 + 0.0004 + 0.012 + 0.001);
    expect(g.cost_per_question!.value).toBeLessThan(0.03);
    expect(r.recordings.every((x) => x.recorded === x.cases)).toBe(true);
  });

  it("a recording without its latency leaves latency not measured, never guessed", async () => {
    const stripped = memoryRecordingStore(seeded.store.all().map((x) => ({ ...x, latencyMs: undefined })));
    const r = await computeGates(stripped);
    expect(r.gates.find((x) => x.id === "latency")).toMatchObject({ value: null, display: NOT_MEASURED });
    expect(r.gates.find((x) => x.id === "cost_per_question")!.basis).toBe("recorded");
  });
});

describe("the report files", () => {
  const dir = mkdtempSync(join(tmpdir(), "parampara-evals-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("are rewritten only when a number changes, so a replay keeps the old date", async () => {
    const gates = await computeGates(memoryRecordingStore());
    const first = { ...report(gates), date: "2026-10-01" };
    expect(await writeReport(first, dir)).toBe(true);
    const t0 = statSync(join(dir, "latest.json")).mtimeMs;
    expect(sameReport(first, { ...first, date: "2026-10-24" })).toBe(true);
    expect(await writeReport({ ...first, date: "2026-10-24" }, dir)).toBe(false);
    expect(statSync(join(dir, "latest.json")).mtimeMs).toBe(t0);
    expect(JSON.parse(readFileSync(join(dir, "latest.json"), "utf8")).date).toBe("2026-10-01");
    expect(readFileSync(join(dir, "latest.md"), "utf8")).toContain(NOT_MEASURED);
  });

  it("the slower of two calls side by side is read from both calls' own times", () => {
    expect(maxQuantile([1, 1, 1, 1], [2, 2, 2, 2], 50)).toBe(2);
    // Both finished by 3 in 9 of 16 pairs; by 2 in only 4 of 16.
    expect(maxQuantile([1, 2, 3, 4], [1, 2, 3, 4], 50)).toBe(3);
    expect(maxQuantile([], [1], 50)).toBeNull();
  });

  it("percentiles use the nearest rank", () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([5, 1, 3], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
  });
});
