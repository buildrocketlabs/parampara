import { SPEECH } from "@/ai/router";
import { INR_PER_USD, SPEECH_PRICE_INR } from "@/ai/speech/cost";
import evalReport from "@/docs/evals/latest.json";
import type { EvalReport } from "@/evals/gates";

// What Parampara costs per teacher, for /how ("What it costs"). Every number is computed here, at
// build time, from files in the repo: the measured model cost per answered question
// (docs/evals/latest.json, written by `pnpm evals`), Sarvam's speech prices and the rupee rate
// (ai/speech/cost.ts, D63), and the hosting prices below. What we cannot measure yet (how often a
// teacher asks, how long she speaks) is a named assumption, and the page says so.

/** Assumptions, stated on the page as assumptions. Change them here. */
export const ASSUMED = {
  /** About three questions a week. Not measured yet: the Koppal field test will tell. */
  questionsPerTeacherMonth: 12,
  /** A spoken question of about 15 seconds (Saaras bills per second). */
  questionSeconds: 15,
  /** An answer read aloud of about 400 characters: the longest Sample answer is under this. */
  answerCharacters: 400,
  teachersAtScale: 1000,
} as const;

/**
 * Hosting list prices, read on 24 Oct 2026 from vercel.com/pricing, vercel.com/docs/plans/pro-plan,
 * supabase.com/pricing and supabase.com/docs/guides/platform/manage-your-usage/compute.
 */
export const HOSTING = {
  today: { usdMonth: 0, plans: "Vercel Hobby + Supabase Free" },
  next: [
    { plan: "Vercel Pro", usdMonth: 20, includes: "$20 usage credit" },
    { plan: "Supabase Pro", usdMonth: 25, includes: "$10 compute credit, 8 GB disk" },
  ],
} as const;

export type CostModel = {
  /** False until `pnpm evals` has measured the model cost from recorded outputs. */
  measured: boolean;
  evalDate: string;
  evalCases: number;
  rate: number;
  perQuestion: {
    modelInr: number;
    modelUsd: number;
    listenInr: number;
    speakInr: number;
    totalInr: number;
  };
  perTeacherMonthInr: number;
  atScaleMonthInr: number;
  hostingNextUsd: number;
  hostingNextInr: number;
  /** The next paid hosting tier spread across the teachers at scale. */
  hostingPerTeacherInr: number;
  models: { listen: string; speak: string };
};

export function costModel(
  report: EvalReport = evalReport as unknown as EvalReport,
): CostModel | null {
  const gate = report.gates.find((g) => g.id === "cost_per_question");
  const listen = SPEECH.transcribe.model as keyof typeof SPEECH_PRICE_INR;
  const speak = SPEECH.speak.model as keyof typeof SPEECH_PRICE_INR;
  if (!gate || gate.basis !== "recorded" || typeof gate.value !== "number") return null;
  const modelUsd = gate.value;
  const modelInr = modelUsd * INR_PER_USD;
  const listenInr = ASSUMED.questionSeconds * SPEECH_PRICE_INR[listen].inr;
  const speakInr = ASSUMED.answerCharacters * SPEECH_PRICE_INR[speak].inr;
  const totalInr = modelInr + listenInr + speakInr;
  const perTeacherMonthInr = totalInr * ASSUMED.questionsPerTeacherMonth;
  const hostingNextUsd = HOSTING.next.reduce((n, h) => n + h.usdMonth, 0);
  const hostingNextInr = hostingNextUsd * INR_PER_USD;
  return {
    measured: true,
    evalDate: report.date,
    evalCases: gate.cases,
    rate: INR_PER_USD,
    perQuestion: { modelInr, modelUsd, listenInr, speakInr, totalInr },
    perTeacherMonthInr,
    atScaleMonthInr: perTeacherMonthInr * ASSUMED.teachersAtScale,
    hostingNextUsd,
    hostingNextInr,
    hostingPerTeacherInr: hostingNextInr / ASSUMED.teachersAtScale,
    models: { listen, speak },
  };
}

/** A figure that rests on an assumption, rounded to `step` so it does not look more exact than it is. */
export function about(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** ₹ with two decimals under ₹100 (whole rupees when it is whole), Indian grouping above. */
export function rupees(n: number): string {
  if (n < 100 && !Number.isInteger(n)) return `₹${n.toFixed(2)}`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
