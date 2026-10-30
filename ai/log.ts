import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";

// One ai_calls row per model or speech attempt (Law 10, docs/AI.md). Never carries prompt text,
// transcript text or model output: only counts, ids and a short error code.

export type AiCallStatus = "ok" | "retry" | "invalid" | "error" | "fallback" | "replayed";

export type AiCallRow = {
  role: string;
  model: string;
  promptVersion: string | null;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  latencyMs: number;
  status: AiCallStatus;
  traceId?: string;
  /** A short machine code such as `schema` or `http_429`. Never free text from a model. */
  error?: string | null;
};

export type CallLogger = (row: AiCallRow) => Promise<void>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let admin: AdminClient | null | undefined;
function client(): AdminClient | null {
  if (admin === undefined) admin = createAdminClient();
  return admin;
}

function int(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export function toDbRow(row: AiCallRow) {
  return {
    role: row.role,
    model: row.model,
    prompt_version: row.promptVersion,
    tokens_in: int(row.tokensIn),
    tokens_out: int(row.tokensOut),
    cache_read_tokens: int(row.cacheReadTokens),
    cache_write_tokens: int(row.cacheWriteTokens),
    cost_usd: Number.isFinite(row.costUsd) ? row.costUsd : 0,
    latency_ms: int(row.latencyMs),
    status: row.status,
    // The column is a uuid; anything else would make the insert fail, so it is dropped.
    trace_id: row.traceId && UUID_RE.test(row.traceId) ? row.traceId : null,
    error: row.error ? row.error.slice(0, 120) : null,
  };
}

/** Logging must never break an answer: failures are swallowed with a content free warning. */
export const logAiCall: CallLogger = async (row) => {
  const db = client();
  if (!db) return;
  try {
    const { error } = await db.from("ai_calls").insert(toDbRow(row));
    if (error) console.warn(`[ai_calls] insert failed for role ${row.role}: ${error.code ?? "unknown"}`);
  } catch {
    console.warn(`[ai_calls] insert threw for role ${row.role}`);
  }
};
