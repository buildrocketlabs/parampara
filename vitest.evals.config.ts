import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `pnpm evals` replays the recording cache and spends nothing.
// `LIVE_EVALS=1` allows real calls (human approval only). See docs/AI.md §6.
// After a full run, evals/reporter.ts writes the gates to docs/evals/latest.{json,md}.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["evals/**/*.eval.ts"],
    environment: "node",
    testTimeout: 120_000,
    reporters: ["default", "./evals/reporter.ts"],
  },
});
