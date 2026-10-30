import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, MODELS, modelIdFor, ROLES, type Role } from "./router";

const ROOT = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  const skip = new Set(["node_modules", ".next", ".git", ".claude", "docs", "playwright-report", "test-results"]);
  return readdirSync(dir).flatMap((name) => {
    if (skip.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

describe("ai/router", () => {
  it("maps every role to a product model (no Opus in the product, D10)", () => {
    for (const role of Object.keys(ROLES) as Role[]) {
      expect(modelIdFor(role)).toMatch(/^claude-(sonnet|haiku)-5-5$/);
    }
  });

  it("puts reasoning roles on Sonnet and fast roles on Haiku (AI.md §2)", () => {
    for (const r of ["interviewer", "card_extractor", "answerer", "insights_digest"] as const) {
      expect(ROLES[r].model).toBe("sonnet");
    }
    for (const r of ["triage", "retriever", "grounding_judge", "safety"] as const) {
      expect(ROLES[r].model).toBe("haiku");
    }
  });

  it("retries at most twice (Law 3)", () => {
    expect(MAX_ATTEMPTS).toBe(3);
  });

  it("is the only place that names a model or imports a provider (Law 3)", () => {
    const modelId = new RegExp(["claude", "(sonnet|haiku|opus)"].join("-"));
    const provider = new RegExp(["@ai-sdk", "/"].join(""));
    const offenders = sourceFiles(ROOT)
      .map((f) => relative(ROOT, f))
      // eslint.config.mjs names the provider only to fence it out.
      .filter((f) => !f.startsWith("ai/") && f !== "eslint.config.mjs")
      .filter((f) => {
        const text = readFileSync(join(ROOT, f), "utf8");
        return modelId.test(text) || provider.test(text);
      });
    expect(offenders).toEqual([]);
  });

  it("prices are per million tokens and output costs more than input", () => {
    for (const m of Object.values(MODELS)) {
      expect(m.price.output).toBeGreaterThan(m.price.input);
      expect(m.price.cacheRead).toBeLessThan(m.price.input);
    }
  });
});
