// One step of "How this answer was made" (the TraceDrawer, docs/AI.md §3 Output). Every role and
// speech call returns one, ok or not, summed over its attempts. Counts only, never text.
export type Span = {
  role: string;
  model: string;
  /** The prompt version for Claude roles; `none` for speech, which has no prompt. */
  promptVersion: string;
  latencyMs: number;
  /** Claude: input tokens. Speech: the unit Sarvam bills (audio seconds or characters). */
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  costUsd: number;
  attempts: number;
  replayed: boolean;
};

/** The span of a call that never happened (empty input): honest zeros for the trace. */
export function blankSpan(role: string, model: string, promptVersion: string): Span {
  return {
    role,
    model,
    promptVersion,
    latencyMs: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    attempts: 0,
    replayed: false,
  };
}

/** One step made of several calls (a redaction and its second check): summed, slowest role first. */
export function sumSpans(first: Span, ...rest: Span[]): Span {
  return rest.reduce(
    (a, b) => ({
      ...a,
      latencyMs: a.latencyMs + b.latencyMs,
      tokensIn: a.tokensIn + b.tokensIn,
      tokensOut: a.tokensOut + b.tokensOut,
      cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
      costUsd: Math.round((a.costUsd + b.costUsd) * 1e6) / 1e6,
      attempts: a.attempts + b.attempts,
      replayed: a.replayed && b.replayed,
    }),
    first,
  );
}
