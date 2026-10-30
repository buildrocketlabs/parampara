import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NETWORK_MEASURED } from "./network";

const report = readFileSync(join(process.cwd(), "docs/evals/network.md"), "utf8");

function result(check: string, mode: "cold" | "warm"): string | undefined {
  const row = report
    .split("\n")
    .map((l) => l.split("|").map((c) => c.trim()))
    .find((c) => c[1] === check && c[2] === "Slow 3G" && c[3] === mode);
  return row?.[4];
}

describe("/how network numbers", () => {
  it("match docs/evals/network.md", () => {
    expect(report).toContain(`Run on ${NETWORK_MEASURED.date}`);
    expect(result("/ first contentful paint", "cold")).toBe(NETWORK_MEASURED.coldFirstPaint);
    expect(result("/ first contentful paint", "warm")).toBe(NETWORK_MEASURED.warmFirstPaint);
    expect(result("warm chip tap to answer page", "warm")).toBe(NETWORK_MEASURED.sampleAnswer);
  });
});
