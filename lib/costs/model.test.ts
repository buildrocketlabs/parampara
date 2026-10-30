import { describe, expect, it } from "vitest";
import { INR_PER_USD, SPEECH_PRICE_INR } from "@/ai/speech/cost";
import report from "@/docs/evals/latest.json";
import library from "@/evals/library.json";
import type { EvalReport } from "@/evals/gates";
import { about, ASSUMED, costModel, HOSTING, rupees } from "./model";

const R = report as unknown as EvalReport;

describe("what it costs", () => {
  it("is worked out from the measured eval cost, the D63 speech prices and the D63 rate", () => {
    const m = costModel(R);
    const gate = R.gates.find((g) => g.id === "cost_per_question")!;
    if (gate.basis !== "recorded") {
      expect(m).toBeNull();
      return;
    }
    expect(m).not.toBeNull();
    expect(m!.rate).toBe(INR_PER_USD);
    expect(m!.perQuestion.modelUsd).toBe(gate.value);
    expect(m!.perQuestion.modelInr).toBeCloseTo(gate.value! * INR_PER_USD, 10);
    expect(m!.perQuestion.listenInr).toBeCloseTo(15 * (0.49 / 60), 10);
    expect(m!.perQuestion.speakInr).toBeCloseTo(
      400 * SPEECH_PRICE_INR[m!.models.speak as keyof typeof SPEECH_PRICE_INR].inr,
      10,
    );
    const total = m!.perQuestion.modelInr + m!.perQuestion.listenInr + m!.perQuestion.speakInr;
    expect(m!.perQuestion.totalInr).toBeCloseTo(total, 10);
    expect(m!.perTeacherMonthInr).toBeCloseTo(total * ASSUMED.questionsPerTeacherMonth, 10);
    expect(m!.atScaleMonthInr).toBeCloseTo(m!.perTeacherMonthInr * 1000, 6);
    expect(m!.hostingNextUsd).toBe(45);
    expect(m!.hostingPerTeacherInr).toBeCloseTo((45 * INR_PER_USD) / 1000, 10);
    expect(m!.evalDate).toBe(R.date);
  });

  it("shows nothing per teacher until the model cost is measured", () => {
    const unmeasured = {
      ...R,
      gates: R.gates.map((g) =>
        g.id === "cost_per_question" ? { ...g, basis: "none" as const, value: null } : g,
      ),
    };
    expect(costModel(unmeasured)).toBeNull();
  });

  it("keeps the stated answer length honest: no Sample answer read aloud is longer", () => {
    const longest = Math.max(
      ...library.cards.map((c) => c.title.kn.length + c.steps.reduce((n, s) => n + s.kn.length, 0)),
    );
    expect(longest).toBeLessThanOrEqual(ASSUMED.answerCharacters);
  });

  it("hosting today is free; the next tier is the sum of the listed plans", () => {
    expect(HOSTING.today.usdMonth).toBe(0);
    expect(HOSTING.next.map((h) => h.plan)).toEqual(["Vercel Pro", "Supabase Pro"]);
  });

  it("writes rupees plainly, and rounds what rests on an assumption", () => {
    expect(rupees(2.7051)).toBe("₹2.71");
    expect(rupees(32461.4)).toBe("₹32,461");
    expect(rupees(about(32.53, 1))).toBe("₹33");
    expect(rupees(about(32531, 100))).toBe("₹32,500");
    expect(rupees(about(4.27, 1))).toBe("₹4");
  });
});
