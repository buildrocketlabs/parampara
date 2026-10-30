import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Reporter, TestModule } from "vitest/node";
import { computeGates, renderMarkdown, sameReport, type EvalReport } from "./gates";

// After `pnpm evals`, writes docs/evals/latest.json (read by /how at build time) and
// docs/evals/latest.md. Only after a full run, so a single suite run never overwrites the report
// with partial counts. The gates replay the recording cache (evals/gates.ts): nothing is spent.

const OUT_DIR = join(process.cwd(), "docs", "evals");
const EVALS_DIR = join(process.cwd(), "evals");

function suiteCounts(modules: ReadonlyArray<TestModule>): NonNullable<EvalReport["suites"]> {
  const counts = { files: modules.length, passed: 0, failed: 0, todo: 0, skipped: 0 };
  for (const m of modules) {
    for (const t of m.children.allTests()) {
      const state = t.result().state;
      if (state === "passed") counts.passed++;
      else if (state === "failed") counts.failed++;
      else if (t.options.mode === "todo") counts.todo++;
      else counts.skipped++;
    }
  }
  return counts;
}

export async function writeReport(report: EvalReport, dir = OUT_DIR): Promise<boolean> {
  const jsonPath = join(dir, "latest.json");
  if (existsSync(jsonPath)) {
    try {
      const old = JSON.parse(readFileSync(jsonPath, "utf8")) as EvalReport;
      if (sameReport(old, report)) return false;
    } catch {
      // An unreadable report is replaced.
    }
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(dir, "latest.md"), renderMarkdown(report));
  return true;
}

export default class EvalGatesReporter implements Reporter {
  async onTestRunEnd(modules: ReadonlyArray<TestModule>) {
    const all = readdirSync(EVALS_DIR).filter((f) => f.endsWith(".eval.ts")).length;
    if (modules.length < all) {
      console.log(`\nEval gates: a partial run (${modules.length} of ${all} suites), docs/evals/latest.json left as it was.`);
      return;
    }
    const gates = await computeGates();
    const report: EvalReport = { date: new Date().toISOString().slice(0, 10), suites: suiteCounts(modules), ...gates };
    const written = await writeReport(report);
    const measured = report.gates.filter((g) => g.basis === "recorded").length;
    console.log(
      `\nEval gates: ${measured} of ${report.gates.length} measured from recordings; ${
        written ? "docs/evals/latest.{json,md} written" : "unchanged since the last run"
      }.`,
    );
  }
}
