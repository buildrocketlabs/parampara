import type { SpeechModel } from "../router";

// What Sarvam charges for speech, so every transcribe and speak call logs its cost in ai_calls and
// counts against the same budget caps as Claude (Law 10). Pay as you go list prices, before GST,
// read on 24 Oct 2026 (docs/DECISIONS.md §Versions, with sources). Speech to text is billed per
// second of audio; text to speech per character (we count every character sent, spaces too).

/** RBI reference rate, 23 Oct 2026: ₹94.9432 per US dollar. */
export const INR_PER_USD = 94.9432;

export const SPEECH_PRICE_INR = {
  /** ₹0.49 a minute, billed per second. */
  "saaras:v4": { unit: "second", inr: 0.49 / 60 },
  /** ₹30 per 10,000 characters. */
  "bulbul:v3": { unit: "character", inr: 30 / 10_000 },
  /** ₹20 per 10,000 characters (a launch offer of ₹10 ends 12 Nov 2026; we log the list price). */
  "bulbul:v4-flash": { unit: "character", inr: 20 / 10_000 },
} as const satisfies Record<"saaras:v4" | SpeechModel, { unit: "second" | "character"; inr: number }>;

export type PricedSpeechModel = keyof typeof SPEECH_PRICE_INR;

/** US dollars for `units` (whole seconds of audio, or characters of text), rounded like Claude's. */
export function speechCostUsd(model: PricedSpeechModel, units: number): number {
  if (!(units > 0)) return 0;
  const usd = (units * SPEECH_PRICE_INR[model].inr) / INR_PER_USD;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
