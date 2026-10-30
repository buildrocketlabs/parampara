import { anthropic } from "@ai-sdk/anthropic";

// The only file that names a model (CLAUDE.md Law 3, docs/AI.md §1–2). Roles call `modelFor(role)`.
// Prices: USD per million tokens, platform.claude.com pricing, verified 17 Oct 2026 (DECISIONS §Versions).
export const MODELS = {
  sonnet: {
    id: "claude-sonnet-5-5",
    price: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  },
  // Haiku prices are for prompts up to 100k tokens; longer prompts use `priceLong`.
  haiku: {
    id: "claude-haiku-5-5",
    price: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
    priceLong: { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 },
  },
} as const;

export type ModelKey = keyof typeof MODELS;

export type RoleConfig = {
  model: ModelKey;
  /** Hard ceiling on output (thinking is billed as output, so this also protects the budget). */
  maxOutputTokens: number;
  /** Thinking effort we intend per role; wired to provider options when the role lands (T3, T5). */
  effort: "low" | "medium" | "high";
  /** Text answer in the teacher's critical path? Then it must stay fast. */
  latencySensitive: boolean;
};

export const ROLES = {
  interviewer: { model: "sonnet", maxOutputTokens: 1_200, effort: "low", latencySensitive: true },
  // One 10 minute window per call (D40): at most 6 cards in Kannada and English plus thinking.
  card_extractor: { model: "sonnet", maxOutputTokens: 12_000, effort: "medium", latencySensitive: false },
  // One chunk of under 30 s per call, before anything is stored (Law 5).
  redactor: { model: "haiku", maxOutputTokens: 4_000, effort: "low", latencySensitive: false },
  // Optional second reader of a redacted chunk (AI_NAME_CHECK=1): refs only, never a name.
  name_check: { model: "haiku", maxOutputTokens: 300, effort: "low", latencySensitive: false },
  // The teacher's question (M3). The ask route has 60 s for all of these together.
  // Triage restates the whole question (up to 1,200 characters, often Kannada) redacted.
  triage: { model: "haiku", maxOutputTokens: 1_500, effort: "low", latencySensitive: true },
  retriever: { model: "haiku", maxOutputTokens: 600, effort: "low", latencySensitive: true },
  // 2 to 5 steps in Kannada and English, and Hindi when the teacher asked in Hindi.
  answerer: { model: "sonnet", maxOutputTokens: 3_000, effort: "low", latencySensitive: true },
  grounding_judge: { model: "haiku", maxOutputTokens: 600, effort: "low", latencySensitive: true },
  safety: { model: "haiku", maxOutputTokens: 400, effort: "low", latencySensitive: true },
  // "Show me" (M5.3): one photo of a slate, notebook or blackboard, read before triage (vision).
  photo_reader: { model: "sonnet", maxOutputTokens: 800, effort: "low", latencySensitive: true },
  // Medium effort thinks before it writes, and the thinking counts against this: at 1,500 nearly
  // every first attempt was cut off and retried (live run, 24 Oct). The note itself stays short.
  insights_digest: { model: "sonnet", maxOutputTokens: 4_000, effort: "medium", latencySensitive: false },
} as const satisfies Record<string, RoleConfig>;

export type Role = keyof typeof ROLES;

/** Speech is Sarvam, not Claude (DECISIONS D12, D25). Called only from ai/speech/. */
export const SPEECH = {
  transcribe: {
    provider: "sarvam",
    model: "saaras:v4",
    languageCode: "kn-IN",
    /** Sarvam REST speech to text accepts at most 30 s per request (D25, D40). */
    maxChunkMs: 30_000,
    timeoutMs: 30_000,
  },
  speak: {
    provider: "sarvam",
    // Audition `bulbul:v4-flash` (persona ids below) against v3 before the freeze (D25).
    model: "bulbul:v3",
    languageCode: "kn-IN",
    speaker: "ishita",
    pace: 1,
    /** mp3 is about a tenth of the size of wav, which matters on 2G (Law 9). */
    codec: "mp3",
    sampleRate: 22_050,
    /** Sarvam's per request text limit; longer text is split at sentence ends. */
    maxChars: 2_500,
    timeoutMs: 30_000,
  },
} as const;

/** Kannada voices each TTS model accepts (Sarvam docs, 23 Oct 2026). */
export const SPEECH_VOICES = {
  "bulbul:v3": ["shubh", "ratan", "neha", "ishita"],
  "bulbul:v4-flash": [
    "chaitra_kn_conversation",
    "chaitra_kn_narration",
    "chetan_kn_conversation",
    "suchitra_kn_narration",
  ],
} as const;

export type SpeechModel = keyof typeof SPEECH_VOICES;

/** One attempt plus two retries with the validation error appended, then `needs_human` (Law 3). */
export const MAX_ATTEMPTS = 3;

export function modelIdFor(role: Role): string {
  return MODELS[ROLES[role].model].id;
}

/** The AI SDK model for a role. Created per call so importing this file never needs a key. */
export function modelFor(role: Role) {
  return anthropic(modelIdFor(role));
}

/** A model by its key, for the eval harness's model comparison (RunDeps.modelOverride) only. */
export function modelForKey(key: ModelKey) {
  return anthropic(MODELS[key].id);
}
