import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Eval recording cache (docs/AI.md §6). A replay costs nothing; a miss fails unless LIVE_EVALS=1.
export type RecordingKeyInput = {
  role: string;
  model: string;
  promptVersion: string;
  settings: Record<string, unknown>;
  itemId: string;
  renderedPrompt: string;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function recordingKey(input: RecordingKeyInput): string {
  return createHash("sha256").update(stable(input)).digest("hex");
}

export function liveEvalsAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.LIVE_EVALS === "1";
}

/**
 * What one model call finally produced. The prompt itself is never stored: the key is its hash.
 * `output` is the raw model object, re-validated on every replay so guardrail changes are tested
 * against what the model really said.
 */
export type Recording = {
  key: string;
  role: string;
  model: string;
  promptVersion: string;
  itemId: string;
  recordedAt: string;
  attempts: number;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
  costUsd: number;
  /** Wall time of the live call, all attempts (docs/evals/latest.json latency). Older ones lack it. */
  latencyMs?: number;
} & (
  /** retriedFor: what the refused earlier attempts got wrong, so a retry can be explained later. */
  | { outcome: "ok"; output: unknown; retriedFor?: string[] }
  | { outcome: "needs_human"; reason: string; problems: string[] }
);

export type RecordingStore = {
  get(key: string): Recording | null;
  put(recording: Recording): void;
};

export const RECORDINGS_DIR = join(process.cwd(), "evals", "recordings");

const KEY_RE = /^[0-9a-f]{64}$/;

/** Recordings live in git as `evals/recordings/<key>.json` (synthetic eval items only). */
export function fileRecordingStore(dir: string = RECORDINGS_DIR): RecordingStore {
  return {
    get(key) {
      if (!KEY_RE.test(key)) return null;
      const path = join(dir, `${key}.json`);
      if (!existsSync(path)) return null;
      try {
        return JSON.parse(readFileSync(path, "utf8")) as Recording;
      } catch {
        return null;
      }
    },
    put(recording) {
      if (!KEY_RE.test(recording.key)) return;
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${recording.key}.json`), `${JSON.stringify(recording, null, 2)}\n`);
    },
  };
}

export function memoryRecordingStore(seed: Recording[] = []): RecordingStore & { all(): Recording[] } {
  const map = new Map(seed.map((r) => [r.key, r]));
  return {
    get: (key) => map.get(key) ?? null,
    put: (r) => void map.set(r.key, r),
    all: () => [...map.values()],
  };
}
