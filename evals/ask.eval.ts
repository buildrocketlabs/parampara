import { describe, expect, it } from "vitest";
import { liveEvalsAllowed } from "@/ai/evals/recording";
import { ANSWERER_PROMPT_VERSION } from "@/ai/prompts/answerer";
import { JUDGE_PROMPT_VERSION } from "@/ai/prompts/grounding_judge";
import { RETRIEVER_PROMPT_VERSION } from "@/ai/prompts/retriever";
import { SAFETY_PROMPT_VERSION } from "@/ai/prompts/safety";
import { TRIAGE_PROMPT_VERSION } from "@/ai/prompts/triage";
import { answerQuestion, buildAnswerRequest, finalizeAnswer, validateAnswer } from "@/ai/roles/answerer";
import { buildJudgeRequest, finalizeJudgement, judgeStep, validateJudgement } from "@/ai/roles/grounding_judge";
import { buildRankRequest, indexRefs, rankCards, validateRanking } from "@/ai/roles/retriever";
import { buildSafetyRequest, checkSafety as runSafety, finalizeSafety } from "@/ai/roles/safety";
import { buildTriageRequest, finalizeTriage, triageQuestion, validateTriage } from "@/ai/roles/triage";
import type { Role } from "@/ai/router";
import { findDisclosures, findUnsafe } from "@/ai/safety/patterns";
import {
  AnswerCase,
  cardsById,
  checkAnswer,
  checkRank,
  checkSafety,
  checkTriage,
  INDEX,
  JudgeCase,
  LIBRARY,
  RankCase,
  runAnswerChain,
  SafetyCase,
  TriageCase,
} from "./ask_lib";
import { evalEnv, isRecorded, loadJsonl, TODO_NOT_RECORDED } from "./lib";

// The teacher's question roles (M3, docs/AI.md §6). Guardrails always run on hand written model
// outputs; model cases replay recordings, or are todos until the founder approves a live run.

const triage = loadJsonl("triage.jsonl", TriageCase);
const rank = loadJsonl("retriever.jsonl", RankCase);
const answer = loadJsonl("answerer.jsonl", AnswerCase);
const judge = loadJsonl("grounding_judge.jsonl", JudgeCase);
const safety = loadJsonl("safety.jsonl", SafetyCase);

function modelCases<C extends { id: string }>(
  cases: C[],
  role: Role,
  promptVersion: string,
  request: (c: C) => { system: string; prompt: string },
  run: (c: C) => Promise<void>,
) {
  for (const c of cases) {
    const { system, prompt } = request(c);
    if (!isRecorded({ role, promptVersion, system, prompt, itemId: c.id }) && !liveEvalsAllowed()) {
      it.todo(`${c.id}: ${TODO_NOT_RECORDED}`);
      continue;
    }
    it(c.id, () => run(c));
  }
}

describe("M3 eval sets", () => {
  it.each([
    // Grown with honest near misses for the M6 jury review (24 Oct); never shrink them.
    ["triage", triage, 25],
    ["rank", rank, 20],
    // "Grounded or silent" rests on these two; grown for the jury's review (24 Oct).
    ["answer", answer, 15],
    ["judge", judge, 20],
    ["safety", safety, 20],
  ] as const)("%s has enough synthetic cases, some adversarial", (_name, cases, min) => {
    expect(cases.length).toBeGreaterThanOrEqual(min);
    expect(cases.every((c) => c.sample)).toBe(true);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  it("triage, rank, answer and safety each include adversarial cases", () => {
    for (const cases of [triage, rank, answer, safety]) expect(cases.some((c) => c.adversarial)).toBe(true);
  });
});

// ── Triage ─────────────────────────────────────────────────────────────────
describe.each(triage)("triage guardrails: $id", (c) => {
  it("accepts the reference and the result meets the expectations", () => {
    expect(validateTriage(c.input, c.reference)).toEqual([]);
    expect(checkTriage(c, finalizeTriage(c.input, c.reference))).toEqual([]);
  });

  it(c.expect.disclosure ? "the disclosure patterns fire on the raw words" : "the disclosure patterns stay quiet", () => {
    expect(findDisclosures(c.input.text).length > 0).toBe(c.expect.disclosure);
  });

  if (c.expect.backstop) {
    it("refuses the unredacted question as redactedText", () => {
      expect(validateTriage(c.input, { ...c.reference, redactedText: c.input.text }).length).toBeGreaterThan(0);
    });
  }
});

describe("triage with the model (replayed)", () => {
  modelCases(triage, "triage", TRIAGE_PROMPT_VERSION, (c) => buildTriageRequest(c.input), async (c) => {
    const res = await triageQuestion({ ...c.input, itemId: c.id }, { env: evalEnv() });
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(checkTriage(c, res.triage)).toEqual([]);
  });
});

// ── Retriever ──────────────────────────────────────────────────────────────
const indexFor = (c: RankCase) => c.input.indexIds.map((id) => INDEX.get(id)!);

describe.each(rank)("rank guardrails: $id", (c) => {
  const { idOf, refOf } = indexRefs(indexFor(c));
  const refOutput = {
    picks: c.reference.picks.map((p) => ({ ref: refOf.get(p.cardId)!, reason: p.reason })),
    noneFit: c.reference.noneFit,
  };

  it("accepts the reference and the picks meet the expectations", () => {
    expect(validateRanking(idOf, refOutput)).toEqual([]);
    const ids = refOutput.noneFit ? [] : refOutput.picks.map((p) => idOf.get(p.ref)!);
    expect(checkRank(c, ids)).toEqual([]);
  });

  for (const f of c.faulty) {
    it(`refuses: ${f.why}`, () => {
      expect(validateRanking(idOf, f.output).length).toBeGreaterThan(0);
    });
  }
});

describe("rank with the model (replayed)", () => {
  modelCases(rank, "retriever", RETRIEVER_PROMPT_VERSION, (c) => buildRankRequest({ triage: c.input.triage, index: indexFor(c) }), async (c) => {
    const res = await rankCards({ triage: c.input.triage, index: indexFor(c), itemId: c.id }, { env: evalEnv() });
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(checkRank(c, res.cardIds)).toEqual([]);
  });
});

// ── Answerer ───────────────────────────────────────────────────────────────
describe.each(answer)("answer guardrails: $id", (c) => {
  const cards = cardsById(c.input.cardIds);
  const { byRef } = buildAnswerRequest({ ...c.input, cards });
  const ctx = { lang: c.input.lang, byRef };

  it("accepts the reference and the answer meets the expectations", () => {
    expect(validateAnswer(ctx, c.reference)).toEqual([]);
    expect(checkAnswer(c, finalizeAnswer(ctx, c.reference))).toEqual([]);
  });

  for (const f of c.faulty) {
    it(`refuses: ${f.why}`, () => {
      expect(validateAnswer(ctx, f.output).length).toBeGreaterThan(0);
    });
  }
});

describe("answer with the model (replayed)", () => {
  modelCases(answer, "answerer", ANSWERER_PROMPT_VERSION, (c) => buildAnswerRequest({ ...c.input, cards: cardsById(c.input.cardIds) }), async (c) => {
    const res = await answerQuestion({ ...c.input, cards: cardsById(c.input.cardIds), itemId: c.id }, { env: evalEnv() });
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(checkAnswer(c, res.answer)).toEqual([]);
  });
});

// The whole question after retrieval: the answer, a judge per step, the final safety reading.
// A live run records every call of the chain; a replay then measures the gates (evals/gates.ts).
describe("answer, judge and final check together (replayed)", () => {
  for (const c of answer) {
    const { system, prompt } = buildAnswerRequest({ ...c.input, cards: cardsById(c.input.cardIds) });
    if (!isRecorded({ role: "answerer", promptVersion: ANSWERER_PROMPT_VERSION, system, prompt, itemId: c.id }) && !liveEvalsAllowed()) {
      it.todo(`${c.id} chain: ${TODO_NOT_RECORDED}`);
      continue;
    }
    it(`${c.id} chain`, async (ctx) => {
      const out = await runAnswerChain(c, {
        deps: { env: evalEnv() },
        isRecorded: (call) => liveEvalsAllowed() || isRecorded(call),
      });
      // A prompt later in the chain changed (a new safety version, say): its calls wait for the
      // next live run, like any unrecorded case. A live run must record every one.
      if (out.kind === "incomplete" && !liveEvalsAllowed()) ctx.skip(`not recorded yet: ${out.missing.join(", ")}`);
      expect(out.kind, out.kind === "incomplete" ? `not recorded: ${out.missing.join(", ")}` : "").not.toBe("incomplete");
      if (out.kind === "shipped") expect(findUnsafe(out.answerText ?? "")).toEqual([]);
    });
  }
});

// ── Grounding judge ────────────────────────────────────────────────────────
describe.each(judge)("judge guardrails: $id", (c) => {
  const card = LIBRARY.get(c.input.cardId)!;

  it(c.deterministic ? "overrules a lenient model with the card's own numbers" : "accepts the reference verdict", () => {
    expect(validateJudgement(card, c.reference)).toEqual([]);
    expect(c.expect.verdicts).toContain(finalizeJudgement(c.input.step, card, c.reference).verdict);
  });

  for (const f of c.faulty) {
    it(`refuses: ${f.why}`, () => {
      expect(validateJudgement(card, f.output).length).toBeGreaterThan(0);
    });
  }
});

describe("judge with the model (replayed)", () => {
  modelCases(judge, "grounding_judge", JUDGE_PROMPT_VERSION, (c) => buildJudgeRequest({ step: c.input.step, card: LIBRARY.get(c.input.cardId)! }), async (c) => {
    const res = await judgeStep({ step: c.input.step, card: LIBRARY.get(c.input.cardId)!, itemId: c.id }, { env: evalEnv() });
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(c.expect.verdicts).toContain(res.verdict);
  });
});

// ── Safety ─────────────────────────────────────────────────────────────────
describe.each(safety)("safety guardrails: $id", (c) => {
  it("the reference reading meets the expectations", () => {
    expect(checkSafety(c, finalizeSafety(c.input, c.reference))).toEqual([]);
  });

  if (c.deterministic) {
    it("the patterns alone reach the expectation, even if the model says all is well", () => {
      const lenient = { ok: true, categories: [], escalate: false, reason: "looks fine" };
      expect(checkSafety(c, finalizeSafety(c.input, lenient))).toEqual([]);
    });
  }
});

describe("safety with the model (replayed)", () => {
  modelCases(safety, "safety", SAFETY_PROMPT_VERSION, (c) => buildSafetyRequest(c.input), async (c) => {
    const res = await runSafety({ ...c.input, itemId: c.id }, { env: evalEnv() });
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(checkSafety(c, res.safety)).toEqual([]);
  });
});
