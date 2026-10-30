import { describe, expect, it } from "vitest";
import { INR_PER_USD, SPEECH_PRICE_INR, speechCostUsd } from "./cost";

describe("Sarvam speech cost (Law 10)", () => {
  it("prices speech to text per second at ₹0.49 a minute", () => {
    // One 29 s chunk: 29 × 0.49 / 60 = ₹0.23683 → about $0.002494.
    expect(speechCostUsd("saaras:v4", 29)).toBeCloseTo((29 * 0.49) / 60 / INR_PER_USD, 6);
    expect(speechCostUsd("saaras:v4", 29)).toBe(0.002494);
    // A 40 minute talk: ₹19.60, about 21 US cents.
    expect(speechCostUsd("saaras:v4", 40 * 60)).toBeCloseTo(19.6 / INR_PER_USD, 5);
  });

  it("prices text to speech per character at ₹30 per 10,000 (v3) and ₹20 (v4 flash)", () => {
    expect(speechCostUsd("bulbul:v3", 10_000)).toBeCloseTo(30 / INR_PER_USD, 6);
    // One full request of 2,500 characters: ₹7.50, about 7.9 US cents.
    expect(speechCostUsd("bulbul:v3", 2_500)).toBe(0.078995);
    expect(speechCostUsd("bulbul:v4-flash", 10_000)).toBeCloseTo(20 / INR_PER_USD, 6);
  });

  it("costs nothing for nothing, and never goes negative", () => {
    expect(speechCostUsd("saaras:v4", 0)).toBe(0);
    expect(speechCostUsd("bulbul:v3", -5)).toBe(0);
    expect(speechCostUsd("bulbul:v3", Number.NaN)).toBe(0);
  });

  it("uses a documented rate and positive prices for every model", () => {
    expect(INR_PER_USD).toBeGreaterThan(80);
    for (const p of Object.values(SPEECH_PRICE_INR)) expect(p.inr).toBeGreaterThan(0);
  });
});
