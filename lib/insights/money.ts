// Costs are summed in US dollars in the database (ai_calls, answers.cost_usd). Rupees are shown at
// one stated rate so an officer can read them; the page prints the rate beside them (Law 7).
// One rate for the whole app: the RBI reference rate in ai/speech/cost.ts (D63), so the Pulse,
// /how and speech costs never disagree.
export { INR_PER_USD } from "@/ai/speech/cost";
import { INR_PER_USD } from "@/ai/speech/cost";

export function usd(n: number): string {
  if (n === 0) return "$0";
  return n < 0.1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
}

export function inr(nUsd: number): string {
  const r = nUsd * INR_PER_USD;
  if (r === 0) return "₹0";
  return r < 10 ? `₹${r.toFixed(2)}` : `₹${Math.round(r).toLocaleString("en-IN")}`;
}
