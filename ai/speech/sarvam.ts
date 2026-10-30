import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { hasSarvam } from "@/lib/env";
import { checkBudget, readCaps } from "../budget";
import { logAiCall, type AiCallStatus } from "../log";
import { SPEECH, SPEECH_VOICES, type SpeechModel } from "../router";
import type { Span } from "../span";
import { loadSpend, noteSpend } from "../spend";
import { concatMp3, concatWav, wavDurationMs } from "./audio";
import { speechCostUsd, type PricedSpeechModel } from "./cost";

// Sarvam speech (DECISIONS D12, D25, D40): Saaras speech to text and Bulbul text to speech.
// The only file in the repo that talks to Sarvam. Every ai_calls row here carries what Sarvam
// charges (./cost.ts: per second of audio, per character of text) and `tokens_in` holds that unit,
// so speech counts against the same budget caps as Claude (Law 10). A call that would cross a cap
// is refused before it is made (SpeechFailed "budget"), and the page falls back to text.

const STT_URL = "https://api.sarvam.ai/speech-to-text";
const TTS_URL = "https://api.sarvam.ai/text-to-speech";
export const FIXTURES_DIR = join(process.cwd(), "ai", "speech", "fixtures");

export class SpeechNotConfigured extends Error {
  override name = "SpeechNotConfigured";
}

export class SpeechRateLimited extends Error {
  override name = "SpeechRateLimited";
  constructor(readonly retryAfterMs: number) {
    super(`speech rate limited; retry in ${retryAfterMs} ms`);
  }
}

export class SpeechFailed extends Error {
  override name = "SpeechFailed";
  constructor(readonly code: string) {
    super(`speech failed: ${code}`);
  }
}

export type Phrase = { startMs: number; endMs: number; text: string };
export type Transcript = {
  text: string;
  phrases: Phrase[];
  languageCode: string;
  requestId?: string;
  span: Span;
};

function speechSpan(
  role: "transcribe" | "speak",
  model: PricedSpeechModel,
  units: number,
  t0: number,
  attempts: number,
  replayed: boolean,
): Span {
  return {
    role,
    model,
    promptVersion: "none",
    latencyMs: Date.now() - t0,
    tokensIn: units,
    tokensOut: 0,
    cacheReadTokens: 0,
    // A fixture replay is free; a live call costs what Sarvam bills for its units.
    costUsd: replayed ? 0 : speechCostUsd(model, units),
    attempts,
    replayed,
  };
}

/** Refuse a call that would cross the total or daily cap (Law 10), as Claude calls are refused. */
async function assertBudget(model: PricedSpeechModel, units: number) {
  const spend = await loadSpend();
  const decision = checkBudget(
    { ...spend, sessionQuestionsLastHour: 0 },
    readCaps(),
    speechCostUsd(model, units),
  );
  if (decision.mode === "replay_only") throw new SpeechFailed("budget");
}

// Sarvam calls them words, but each entry is a phrase. Every field is checked: a missing or
// mismatched timestamps block becomes one phrase spanning the chunk rather than an error.
const SttResponse = z.object({
  request_id: z.string().nullish(),
  transcript: z.string(),
  language_code: z.string().nullish(),
  timestamps: z
    .object({
      words: z.array(z.string()),
      start_time_seconds: z.array(z.number()),
      end_time_seconds: z.array(z.number()),
    })
    .nullish(),
});
type SttResponse = z.infer<typeof SttResponse>;

const Fixture = z.object({ sample: z.literal(true), response: SttResponse });

const TtsResponse = z.object({
  request_id: z.string().nullish(),
  audios: z.array(z.string()).min(1),
});

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isAbort(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  return name === "AbortError" || name === "TimeoutError";
}

function retryAfterMs(res: Response): number {
  const header = Number(res.headers.get("retry-after"));
  return Number.isFinite(header) && header > 0 ? Math.min(60_000, header * 1000) : 2_000;
}

async function logSpeech(
  role: "transcribe" | "speak",
  model: PricedSpeechModel,
  units: number,
  t0: number,
  status: AiCallStatus,
  traceId?: string,
  error?: string,
) {
  // Sarvam bills a call that returned audio or text; a refused or failed one costs nothing.
  const cost = status === "ok" ? speechCostUsd(model, units) : 0;
  noteSpend(cost);
  await logAiCall({
    role,
    model,
    promptVersion: null,
    tokensIn: units,
    tokensOut: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: cost,
    latencyMs: Date.now() - t0,
    status,
    traceId,
    error,
  });
}

/** Phrase times relative to the chunk start, clamped inside it, empty phrases dropped. */
export function toTranscript(
  res: SttResponse,
  durationMs: number | null,
  languageCode: string,
): Omit<Transcript, "span"> {
  const text = res.transcript.trim();
  const ts = res.timestamps;
  const clamp = (ms: number) => Math.max(0, durationMs === null ? ms : Math.min(durationMs, ms));
  let phrases: Phrase[] = [];
  if (
    ts &&
    ts.words.length > 0 &&
    ts.words.length === ts.start_time_seconds.length &&
    ts.words.length === ts.end_time_seconds.length
  ) {
    phrases = ts.words
      .map((w, i) => {
        const startMs = clamp(Math.round(ts.start_time_seconds[i]! * 1000));
        const endMs = Math.max(startMs, clamp(Math.round(ts.end_time_seconds[i]! * 1000)));
        return { startMs, endMs, text: w.trim() };
      })
      .filter((p) => p.text.length > 0);
  } else if (text) {
    phrases = [{ startMs: 0, endMs: durationMs ?? 0, text }];
  }
  return {
    text,
    phrases,
    languageCode: res.language_code ?? languageCode,
    ...(res.request_id ? { requestId: res.request_id } : {}),
  };
}

function loadFixture(hash: string, dir: string): SttResponse | null {
  try {
    const parsed = Fixture.safeParse(JSON.parse(readFileSync(join(dir, `${hash}.json`), "utf8")));
    return parsed.success ? parsed.data.response : null;
  } catch {
    return null;
  }
}

/**
 * One chunk of under 30 s (16 kHz mono WAV from the browser pipeline, D34) to Kannada text with
 * phrase timings. Without SARVAM_API_KEY it serves a recorded fixture whose audio hash matches,
 * so tests and the demo run without a key; any other audio throws SpeechNotConfigured.
 */
export async function transcribeChunk(
  wav: Uint8Array,
  opts: { languageCode?: string; traceId?: string; fixturesDir?: string } = {},
): Promise<Transcript> {
  const cfg = SPEECH.transcribe;
  const languageCode = opts.languageCode ?? cfg.languageCode;
  // The browser pipeline always sends 16 kHz WAV (D34). Anything unreadable is refused rather than
  // sent unchecked past the 30 s limit.
  const durationMs = wavDurationMs(wav);
  if (durationMs === null) throw new SpeechFailed("not_wav");
  if (durationMs > cfg.maxChunkMs + 250) throw new SpeechFailed("chunk_too_long");
  const seconds = Math.ceil(durationMs / 1000);
  const t0 = Date.now();

  if (!hasSarvam()) {
    const fixture = loadFixture(sha256(wav), opts.fixturesDir ?? FIXTURES_DIR);
    if (!fixture) throw new SpeechNotConfigured("speech to text is not configured");
    await logSpeech("transcribe", cfg.model, seconds, t0, "replayed", opts.traceId);
    return {
      ...toTranscript(fixture, durationMs, languageCode),
      span: speechSpan("transcribe", cfg.model, seconds, t0, 0, true),
    };
  }

  await assertBudget(cfg.model, seconds);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "chunk.wav");
  form.append("model", cfg.model);
  form.append("language_code", languageCode);
  form.append("with_timestamps", "true");

  let res: Response;
  try {
    res = await fetch(STT_URL, {
      method: "POST",
      headers: { "api-subscription-key": process.env.SARVAM_API_KEY ?? "" },
      body: form,
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (err) {
    const code = isAbort(err) ? "timeout" : "network";
    await logSpeech("transcribe", cfg.model, seconds, t0, "error", opts.traceId, code);
    throw new SpeechFailed(code);
  }
  await throwForStatus(res, "transcribe", cfg.model, seconds, t0, opts.traceId);
  const parsed = SttResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    await logSpeech("transcribe", cfg.model, seconds, t0, "error", opts.traceId, "bad_response");
    throw new SpeechFailed("bad_response");
  }
  await logSpeech("transcribe", cfg.model, seconds, t0, "ok", opts.traceId);
  return {
    ...toTranscript(parsed.data, durationMs, languageCode),
    span: speechSpan("transcribe", cfg.model, seconds, t0, 1, false),
  };
}

async function throwForStatus(
  res: Response,
  role: "transcribe" | "speak",
  model: PricedSpeechModel,
  units: number,
  t0: number,
  traceId?: string,
) {
  if (res.ok) return;
  await logSpeech(role, model, units, t0, "error", traceId, `http_${res.status}`);
  if (res.status === 429) throw new SpeechRateLimited(retryAfterMs(res));
  // A rejected key will not fix itself on retry: the app falls back to text (D12).
  if (res.status === 401 || res.status === 403)
    throw new SpeechNotConfigured("speech key rejected");
  throw new SpeechFailed(`http_${res.status}`);
}

// ── Text to speech ──────────────────────────────────────────────────────────

const SENTENCE = /[^.!?।]+(?:[.!?।]+["'”’)\]]*|$)/gu;

function hardSplit(s: string, max: number): string[] {
  const out: string[] = [];
  let rest = s.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(window.lastIndexOf(","), window.lastIndexOf(" "));
    const at = cut > max / 2 ? cut + 1 : max;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Pieces of at most `max` characters, cut at sentence ends (., ?, !, ।, line breaks). */
export function splitForSpeech(text: string, max: number = SPEECH.speak.maxChars): string[] {
  const sentences = text
    .split(/\n+/)
    .flatMap((line) => line.replace(/\s+/g, " ").match(SENTENCE) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const pieces: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (s.length > max) {
      if (current) pieces.push(current);
      current = "";
      pieces.push(...hardSplit(s, max));
      continue;
    }
    const joined = current ? `${current} ${s}` : s;
    if (joined.length > max) {
      pieces.push(current);
      current = s;
    } else {
      current = joined;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

export type SpeakOptions = {
  voice?: string;
  pace?: number;
  codec?: "wav" | "mp3";
  model?: SpeechModel;
  traceId?: string;
  /** kn-IN by default; hi-IN and en-IN for answers in Hindi or English (Bulbul speaks all three). */
  languageCode?: string;
  /** 22,050 Hz by default; 16,000 for audio that goes on to speech to text (evals/speech.eval.ts). */
  sampleRate?: 8_000 | 16_000 | 22_050 | 24_000;
};

type VoiceSettings = {
  model: SpeechModel;
  voice: string;
  pace: number;
  codec: "wav" | "mp3";
  languageCode: string;
  sampleRate: number;
};

function voiceSettings(opts: SpeakOptions): VoiceSettings {
  const cfg = SPEECH.speak;
  if (!hasSarvam()) throw new SpeechNotConfigured("text to speech is not configured");
  const model: SpeechModel = opts.model ?? cfg.model;
  const voices: readonly string[] = SPEECH_VOICES[model];
  const voice = opts.voice ?? (voices.includes(cfg.speaker) ? cfg.speaker : voices[0]!);
  if (!voices.includes(voice)) throw new SpeechFailed("unknown_voice");
  return {
    model,
    voice,
    pace: Math.min(2, Math.max(0.5, opts.pace ?? cfg.pace)),
    codec: opts.codec ?? cfg.codec,
    languageCode: opts.languageCode ?? cfg.languageCode,
    sampleRate: opts.sampleRate ?? cfg.sampleRate,
  };
}

/** One Bulbul request for one piece of at most maxChars: its audio parts, in order. */
async function speakPiece(
  piece: string,
  v: VoiceSettings,
  traceId?: string,
): Promise<Uint8Array[]> {
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "api-subscription-key": process.env.SARVAM_API_KEY ?? "",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: piece,
        target_language_code: v.languageCode,
        model: v.model,
        speaker: v.voice,
        pace: v.pace,
        speech_sample_rate: v.sampleRate,
        output_audio_codec: v.codec,
      }),
      signal: AbortSignal.timeout(SPEECH.speak.timeoutMs),
    });
  } catch (err) {
    const code = isAbort(err) ? "timeout" : "network";
    await logSpeech("speak", v.model, piece.length, t0, "error", traceId, code);
    throw new SpeechFailed(code);
  }
  await throwForStatus(res, "speak", v.model, piece.length, t0, traceId);
  const parsed = TtsResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    await logSpeech("speak", v.model, piece.length, t0, "error", traceId, "bad_response");
    throw new SpeechFailed("bad_response");
  }
  await logSpeech("speak", v.model, piece.length, t0, "ok", traceId);
  return parsed.data.audios.map((b64) => new Uint8Array(Buffer.from(b64, "base64")));
}

function joinAudio(parts: Uint8Array[], codec: "wav" | "mp3"): Uint8Array {
  try {
    return codec === "wav" ? concatWav(parts) : concatMp3(parts);
  } catch {
    throw new SpeechFailed("bad_audio");
  }
}

/**
 * Kannada text to audio. Text over Sarvam's per request limit is split at sentence ends and the
 * parts joined: WAV by concatenating PCM under one header, MP3 frame to frame with each part's
 * ID3 tag and length frame removed (see audio.ts). MP3 is the default because it is far smaller
 * on a 2G connection.
 */
export async function speak(
  text: string,
  opts: SpeakOptions = {},
): Promise<{ audio: Uint8Array; mime: string; span: Span }> {
  const v = voiceSettings(opts);
  const pieces = splitForSpeech(text, SPEECH.speak.maxChars);
  if (pieces.length === 0) throw new SpeechFailed("empty_text");
  await assertBudget(
    v.model,
    pieces.reduce((n, p) => n + p.length, 0),
  );

  const parts: Uint8Array[] = [];
  const started = Date.now();
  for (const piece of pieces) parts.push(...(await speakPiece(piece, v, opts.traceId)));
  const chars = pieces.reduce((n, p) => n + p.length, 0);
  return {
    audio: joinAudio(parts, v.codec),
    mime: v.codec === "wav" ? "audio/wav" : "audio/mpeg",
    span: speechSpan("speak", v.model, chars, started, pieces.length, false),
  };
}

export type LineSpeaker = {
  /** Starts speaking this line now (once per distinct line); a failure waits for `build`. */
  start: (line: string) => void;
  /** The lines spoken in order as one file: lines already started are reused, the rest start now. */
  build: (lines: string[]) => Promise<{ audio: Uint8Array; mime: string; span: Span }>;
};

/**
 * Speech that starts before the whole text is known (Track B, D86): an answer's title and each
 * step are spoken as soon as they are final, side by side, and joined in order at the end, so the
 * voice is ready about when the text is. Each line is its own Bulbul request (split further only
 * past maxChars) and its own ai_calls row; a line asked for twice is spoken once.
 */
export function lineSpeaker(opts: SpeakOptions = {}): LineSpeaker {
  const v = voiceSettings(opts);
  const spoken = new Map<string, Promise<Uint8Array[]>>();
  const started = Date.now();
  const say = (line: string): Promise<Uint8Array[]> => {
    const text = line.trim();
    let p = spoken.get(text);
    if (!p) {
      p = (async () => {
        const pieces = splitForSpeech(text, SPEECH.speak.maxChars);
        if (pieces.length === 0) return [];
        await assertBudget(
          v.model,
          pieces.reduce((n, x) => n + x.length, 0),
        );
        const parts = await Promise.all(pieces.map((piece) => speakPiece(piece, v, opts.traceId)));
        return parts.flat();
      })();
      p.catch(() => {});
      spoken.set(text, p);
    }
    return p;
  };
  return {
    start: (line) => void say(line),
    build: async (lines) => {
      const wanted = lines.map((l) => l.trim()).filter(Boolean);
      if (wanted.length === 0) throw new SpeechFailed("empty_text");
      const parts = (await Promise.all(wanted.map(say))).flat();
      if (parts.length === 0) throw new SpeechFailed("empty_text");
      const chars = wanted.reduce((n, l) => n + l.length, 0);
      return {
        audio: joinAudio(parts, v.codec),
        mime: v.codec === "wav" ? "audio/wav" : "audio/mpeg",
        span: speechSpan("speak", v.model, chars, started, wanted.length, false),
      };
    },
  };
}
