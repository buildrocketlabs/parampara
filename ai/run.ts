import { createHash } from "node:crypto";
import { generateText, NoObjectGeneratedError, Output, streamText, type LanguageModel } from "ai";
import type { z } from "zod";
import { checkBudget, costUsd, readCaps, type Usage } from "./budget";
import {
  fileRecordingStore,
  recordingKey,
  type Recording,
  type RecordingStore,
} from "./evals/recording";
import { logAiCall, type AiCallStatus, type CallLogger } from "./log";
import {
  MAX_ATTEMPTS,
  modelFor,
  modelForKey,
  modelIdFor,
  MODELS,
  ROLES,
  type ModelKey,
  type Role,
} from "./router";
import type { Span } from "./span";
import { loadSpend, noteSpend, type SpendSource } from "./spend";

// The one structured runner every role uses (Law 3, docs/AI.md §2 and §8).
//   budget check → up to 3 attempts (each retry carries the schema or validation problems) →
//   needs_human. One ai_calls row per attempt. Never throws at a caller for a model problem.
//
// Modes (DECISIONS D-ai-1):
//   replay  no ANTHROPIC_API_KEY, or AI_REPLAY=1: serve evals/recordings/<key>.json, re-validated;
//           a miss is needs_human `no_recording`.
//   record  LIVE_EVALS=1 or AI_RECORD=1 (with a key): replay what is already recorded and passes,
//           otherwise call live and save the final outcome, but
//           only for calls that carry an eval `itemId`, so real interview text is never written.
//   live    everything else: call live, nothing saved.

export type NeedsHumanReason =
  "budget" | "rate_limited" | "no_recording" | "invalid_output" | "model_error" | "timeout";

export type RunOk<T> = {
  status: "ok";
  output: T;
  attempts: number;
  replayed: boolean;
  span: Span;
};

export type NeedsHuman = {
  status: "needs_human";
  reason: NeedsHumanReason;
  attempts: number;
  /** Our own validator and schema messages, for the trace. Never logged. */
  problems: string[];
  span: Span;
};

export type RunResult<T> = RunOk<T> | NeedsHuman;

export type RunInput<S extends z.ZodType> = {
  role: Role;
  promptVersion: string;
  system: string;
  prompt: string;
  schema: S;
  traceId?: string;
  /** Deterministic semantic checks; each returned string is fed back to the model on retry. */
  validate?: (out: z.output<S>) => string[];
  /** Eval case id. Only calls with one are ever recorded. */
  itemId?: string;
  /** Wall clock for all attempts together (the 300 s function limit, D40). */
  timeBudgetMs?: number;
  /** No retry starts with less than this left of `timeBudgetMs`. Default MIN_RETRY_MS. */
  minRetryMs?: number;
  /**
   * Images sent with the prompt as file parts (vision roles, "Show me"). Never logged or recorded;
   * only their sha256 enters the recording key, so a replay matches the very same image.
   */
  images?: Array<{ data: Uint8Array; mediaType: "image/jpeg" | "image/png" }>;
  /**
   * Near the budget cap, a call with no recording to replay is skipped (reason "budget") instead
   * of spending live credits. For calls that can never replay, such as a teacher's photo.
   */
  skipNearCap?: boolean;
  /**
   * Live calls only (Track B, D86): the output is streamed and each partial object is passed here
   * as it grows, with the attempt it belongs to. Nothing in it is validated yet: a caller may only
   * start work it can drop (the pipeline judges finished steps early and keeps a judgment only for
   * a step the validated output repeats exactly). Replays and recordings never stream.
   * AI_STREAM=0 turns streaming off without a deploy.
   */
  onPartial?: (partial: unknown, attempt: number) => void;
};

export type RunDeps = {
  model?: LanguageModel;
  env?: Record<string, string | undefined>;
  store?: RecordingStore;
  log?: CallLogger;
  spend?: SpendSource;
  now?: () => number;
  /**
   * Run the role on another model than ai/router.ts gives it. Set only by the eval harness to
   * compare models (evals/answerer-compare.eval.ts); the app never sets it.
   */
  modelOverride?: ModelKey;
};

export type AiMode = "live" | "record" | "replay";

/** No retry starts with less than this left of the time budget: it would only be cut off. */
export const MIN_RETRY_MS = 60_000;

export function aiMode(env: Record<string, string | undefined> = process.env): AiMode {
  if (env.AI_REPLAY === "1" || !env.ANTHROPIC_API_KEY) return "replay";
  if (env.LIVE_EVALS === "1" || env.AI_RECORD === "1") return "record";
  return "live";
}

export function recordingKeyFor(input: {
  role: Role;
  promptVersion: string;
  system: string;
  prompt: string;
  itemId?: string;
  images?: RunInput<z.ZodType>["images"];
  /** Another model than the role's (eval comparisons only): its own recordings, never mixed. */
  modelKey?: ModelKey;
}): string {
  const cfg = ROLES[input.role];
  const images = (input.images ?? [])
    .map((i) => createHash("sha256").update(i.data).digest("hex"))
    .join(",");
  return recordingKey({
    role: input.role,
    model: input.modelKey ? MODELS[input.modelKey].id : modelIdFor(input.role),
    promptVersion: input.promptVersion,
    settings: { maxOutputTokens: cfg.maxOutputTokens, effort: cfg.effort },
    itemId: input.itemId ?? "",
    renderedPrompt: `${input.system}\n\n${input.prompt}${images ? `\n\n[images ${images}]` : ""}`,
  });
}

/** Rough and deliberately high: Kannada script costs more tokens per character than English. */
function estimateInputTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

/** A 1280 px photo is about 1,600 vision tokens on Claude; budget a little above that. */
const IMAGE_TOKENS = 2_000;

function toUsage(
  u:
    | {
        inputTokens?: number;
        outputTokens?: number;
        inputTokenDetails?: {
          noCacheTokens?: number;
          cacheReadTokens?: number;
          cacheWriteTokens?: number;
        };
      }
    | undefined,
): Required<Pick<Usage, "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens">> &
  Usage {
  return {
    inputTokens: u?.inputTokens ?? 0,
    outputTokens: u?.outputTokens ?? 0,
    noCacheInputTokens: u?.inputTokenDetails?.noCacheTokens,
    cacheReadTokens: u?.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWriteTokens: u?.inputTokenDetails?.cacheWriteTokens ?? 0,
  };
}

function issuesOf(
  err: unknown,
  depth = 0,
): Array<{ path?: PropertyKey[]; message?: string }> | null {
  if (!err || typeof err !== "object" || depth > 4) return null;
  const e = err as { issues?: unknown; cause?: unknown };
  if (Array.isArray(e.issues)) return e.issues as Array<{ path?: PropertyKey[]; message?: string }>;
  if (Array.isArray(err)) return err as Array<{ path?: PropertyKey[]; message?: string }>;
  return issuesOf(e.cause, depth + 1);
}

function formatIssues(issues: Array<{ path?: PropertyKey[]; message?: string }>): string[] {
  return issues.slice(0, 12).map((i) => {
    const path = (i.path ?? []).map(String).join(".") || "(root)";
    return `${path}: ${i.message ?? "invalid"}`;
  });
}

/** What went wrong, in words for the retry prompt. Never echoes the model's raw text. */
export function describeSchemaFailure(err: NoObjectGeneratedError): string[] {
  if (err.finishReason === "length") {
    return [
      "Your answer was cut off before it finished. Return fewer items and keep every field shorter.",
    ];
  }
  const issues = issuesOf(err.cause);
  if (issues && issues.length > 0) {
    return ["Your answer did not match the required structure:", ...formatIssues(issues)];
  }
  return ["Your answer was not valid JSON in the required structure."];
}

export function withFeedback(prompt: string, problems: string[]): string {
  return [
    prompt,
    "",
    "<previous_attempt_problems>",
    "Your previous answer could not be used:",
    ...problems.map((p) => `- ${p}`),
    "Answer again from the same input, fixing every problem above, in the same structure.",
    "</previous_attempt_problems>",
  ].join("\n");
}

/** Text only, or text with images as file parts in one user message. */
function promptOf(input: Pick<RunInput<z.ZodType>, "images">, text: string) {
  if (!input.images?.length) return { prompt: text };
  return {
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text },
          ...input.images.map((i) => ({
            type: "file" as const,
            mediaType: i.mediaType,
            data: i.data,
          })),
        ],
      },
    ],
  };
}

function runValidate<T>(validate: ((out: T) => string[]) | undefined, out: T): string[] {
  if (!validate) return [];
  try {
    return validate(out);
  } catch {
    return ["internal validator error"];
  }
}

/**
 * streamText under generateText's contract, for the loop below (D86): each partial output goes to
 * `onPartial` as it grows, the first stream error is thrown as generateText would throw it, and
 * an output that does not fit the schema throws NoObjectGeneratedError when it is awaited.
 */
async function streamed(
  args: Parameters<typeof generateText>[0],
  onPartial: (partial: unknown) => void,
): Promise<{ output: unknown; usage: Parameters<typeof toUsage>[0] }> {
  let failure: unknown;
  const result = streamText({
    ...(args as Parameters<typeof streamText>[0]),
    onError: ({ error }) => {
      failure ??= error;
    },
  });
  for await (const partial of result.partialOutputStream) {
    try {
      onPartial(partial);
    } catch {
      // A caller's early work never breaks the call.
    }
  }
  if (failure) throw failure;
  const output = await result.output;
  const usage = await result.usage;
  return { output, usage };
}

function isAbort(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  return name === "AbortError" || name === "TimeoutError";
}

export async function runStructured<S extends z.ZodType>(
  input: RunInput<S>,
  deps: RunDeps = {},
): Promise<RunResult<z.output<S>>> {
  type T = z.output<S>;
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? logAiCall;
  const store = deps.store ?? fileRecordingStore();
  const cfg = ROLES[input.role];
  // The eval harness may compare a role on another model (AI_ANSWERER_MODEL, evals only): the
  // model, its price, its ai_calls rows and its recordings all follow the override.
  const modelKey: ModelKey = deps.modelOverride ?? cfg.model;
  const modelId = MODELS[modelKey].id;
  const key = recordingKeyFor({ ...input, modelKey: deps.modelOverride });
  const mode = aiMode(env);
  const started = now();
  const row = {
    role: input.role,
    model: modelId,
    promptVersion: input.promptVersion,
    traceId: input.traceId,
  };
  const zero = { tokensIn: 0, tokensOut: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };

  const total = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  let spent = 0;
  const span = (attempts: number, replayed = false): Span => ({
    role: input.role,
    model: modelId,
    promptVersion: input.promptVersion,
    latencyMs: now() - started,
    tokensIn: total.inputTokens,
    tokensOut: total.outputTokens,
    cacheReadTokens: total.cacheReadTokens,
    costUsd: Math.round(spent * 1e6) / 1e6,
    attempts,
    replayed,
  });

  const fallback = async (reason: NeedsHumanReason, attempts: number, problems: string[] = []) => {
    if (attempts === 0) {
      await log({ ...row, ...zero, latencyMs: now() - started, status: "fallback", error: reason });
    }
    return {
      status: "needs_human",
      reason,
      attempts,
      problems,
      span: span(attempts),
    } satisfies NeedsHuman;
  };

  const replay = async (): Promise<RunResult<T> | null> => {
    const rec = store.get(key);
    if (!rec) return null;
    if (rec.outcome === "needs_human") {
      return {
        status: "needs_human",
        reason: rec.reason as NeedsHumanReason,
        attempts: 0,
        problems: rec.problems,
        span: span(0, true),
      };
    }
    const parsed = input.schema.safeParse(rec.output);
    const problems = parsed.success
      ? runValidate(input.validate, parsed.data as T)
      : formatIssues(parsed.error.issues);
    if (!parsed.success || problems.length > 0) {
      return {
        status: "needs_human",
        reason: "invalid_output",
        attempts: 0,
        problems,
        span: span(0, true),
      };
    }
    await log({ ...row, ...zero, latencyMs: now() - started, status: "replayed" });
    return {
      status: "ok",
      output: parsed.data as T,
      attempts: 0,
      replayed: true,
      span: span(0, true),
    };
  };

  if (mode === "replay") return (await replay()) ?? fallback("no_recording", 0);
  // Recording an eval run records only what is missing or no longer passes: a call whose prompt,
  // model and input are unchanged replays what is already recorded, so a re-run after one prompt
  // changed spends only on that prompt's cases.
  if (mode === "record" && input.itemId) {
    const kept = await replay();
    if (kept?.status === "ok") return kept;
  }

  const spend = await (deps.spend ?? loadSpend)();
  const estimate = costUsd(modelKey, {
    inputTokens:
      estimateInputTokens(input.system + input.prompt) + (input.images?.length ?? 0) * IMAGE_TOKENS,
    outputTokens: cfg.maxOutputTokens,
  });
  const decision = checkBudget({ ...spend, sessionQuestionsLastHour: 0 }, readCaps(env), estimate);
  if (decision.mode === "rate_limited") return fallback("rate_limited", 0);
  if (decision.mode === "replay_only" || decision.mode === "prefer_replay") {
    const replayed = await replay();
    if (replayed?.status === "ok") return replayed;
    if (decision.mode === "replay_only" || input.skipNearCap) return fallback("budget", 0);
  }

  let problems: string[] = [];
  const streaming = Boolean(input.onPartial) && mode === "live" && env.AI_STREAM !== "0";
  /** Problems of the attempts that were refused and retried (recorded, never logged). */
  const retriedFor: string[] = [];
  const save = (
    rec: Pick<Recording, "attempts"> &
      (
        | { outcome: "ok"; output: unknown; retriedFor?: string[] }
        | { outcome: "needs_human"; reason: string; problems: string[] }
      ),
  ) => {
    if (mode !== "record" || !input.itemId) return;
    store.put({
      key,
      role: input.role,
      model: modelId,
      promptVersion: input.promptVersion,
      itemId: input.itemId,
      recordedAt: new Date(now()).toISOString(),
      usage: { ...total },
      costUsd: Math.round(spent * 1e6) / 1e6,
      latencyMs: now() - started,
      ...rec,
    } as Recording);
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let abortSignal: AbortSignal | undefined;
    if (input.timeBudgetMs) {
      const left = input.timeBudgetMs - (now() - started);
      if (attempt > 1 && left < (input.minRetryMs ?? MIN_RETRY_MS)) {
        save({ outcome: "needs_human", reason: "timeout", problems, attempts: attempt - 1 });
        return fallback("timeout", attempt - 1, problems);
      }
      abortSignal = AbortSignal.timeout(Math.max(1_000, left));
    }
    const isLast = attempt === MAX_ATTEMPTS;
    const t0 = now();
    const account = async (
      usageIn: Parameters<typeof toUsage>[0],
      status: AiCallStatus,
      error?: string,
    ) => {
      const usage = toUsage(usageIn);
      const usd = costUsd(modelKey, usage);
      spent += usd;
      total.inputTokens += usage.inputTokens;
      total.outputTokens += usage.outputTokens;
      total.cacheReadTokens += usage.cacheReadTokens;
      total.cacheWriteTokens += usage.cacheWriteTokens;
      noteSpend(usd);
      await log({
        ...row,
        tokensIn: usage.inputTokens,
        tokensOut: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        costUsd: usd,
        latencyMs: now() - t0,
        status,
        error,
      });
    };

    try {
      const args = {
        model:
          deps.model ??
          (deps.modelOverride ? modelForKey(deps.modelOverride) : modelFor(input.role)),
        instructions: {
          role: "system" as const,
          content: input.system,
          providerOptions: { anthropic: { cacheControl: { type: "ephemeral" as const } } },
        },
        ...promptOf(input, attempt === 1 ? input.prompt : withFeedback(input.prompt, problems)),
        output: Output.object({ schema: input.schema }),
        maxOutputTokens: cfg.maxOutputTokens,
        // Network retries only; validation retries are ours. Set so the two never multiply.
        maxRetries: 1,
        providerOptions: { anthropic: { effort: cfg.effort } },
        abortSignal,
      };
      const result = streaming
        ? await streamed(args, (partial) => input.onPartial?.(partial, attempt))
        : await generateText(args);
      const output = result.output as T;
      problems = runValidate(input.validate, output);
      if (problems.length === 0) {
        await account(result.usage, "ok");
        save({
          outcome: "ok",
          output,
          attempts: attempt,
          ...(retriedFor.length ? { retriedFor } : {}),
        });
        return { status: "ok", output, attempts: attempt, replayed: false, span: span(attempt) };
      }
      await account(result.usage, isLast ? "invalid" : "retry", "validation");
      retriedFor.push(...problems);
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        problems = describeSchemaFailure(err);
        await account(
          err.usage,
          isLast ? "invalid" : "retry",
          err.finishReason === "length" ? "truncated" : "schema",
        );
        retriedFor.push(...problems);
        continue;
      }
      const timedOut = isAbort(err);
      await account(undefined, "error", timedOut ? "timeout" : errorCode(err));
      const reason: NeedsHumanReason = timedOut ? "timeout" : "model_error";
      save({ outcome: "needs_human", reason, problems: [], attempts: attempt });
      return fallback(reason, attempt);
    }
  }
  save({ outcome: "needs_human", reason: "invalid_output", problems, attempts: MAX_ATTEMPTS });
  return fallback("invalid_output", MAX_ATTEMPTS, problems);
}

function errorCode(err: unknown): string {
  const e = err as { statusCode?: number; name?: string };
  if (typeof e?.statusCode === "number") return `http_${e.statusCode}`;
  return (e?.name ?? "unknown").slice(0, 40);
}
