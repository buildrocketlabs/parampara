import { MockLanguageModelV4 } from "ai/test";
import { memoryRecordingStore } from "./evals/recording";
import type { AiCallRow } from "./log";
import type { RunDeps } from "./run";

// Test only: a model that answers with the given objects in turn, and deps that never touch the
// network, the database or the recordings folder.
export function scriptedDeps(outputs: unknown[]) {
  const prompts: string[] = [];
  const rows: AiCallRow[] = [];
  let i = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (opts) => {
      prompts.push(JSON.stringify(opts.prompt));
      const out = outputs[Math.min(i++, outputs.length - 1)];
      return {
        content: [{ type: "text", text: JSON.stringify(out) }],
        finishReason: { unified: "stop", raw: "end_turn" },
        usage: {
          inputTokens: { total: 2_000, noCache: 2_000, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 500, text: 500, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
  const deps: RunDeps = {
    model,
    env: { ANTHROPIC_API_KEY: "test" },
    store: memoryRecordingStore(),
    log: async (r) => void rows.push(r),
    spend: async () => ({ totalUsd: 0, todayUsd: 0 }),
  };
  return { deps, prompts, rows, calls: () => i };
}
