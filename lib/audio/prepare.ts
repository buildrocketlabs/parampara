import { decodeToMono16k, DEFAULT_MAX_MS, TARGET_SAMPLE_RATE } from "./decode";
import { AudioPrepError } from "./errors";
import { planChunks, type ChunkOptions } from "./split";
import { encodeWav16 } from "./wav";

export type PrepareStage = "decoding" | "splitting" | "encoding";

export type PrepareOptions = {
  /**
   * decoding and splitting count parts. encoding counts chunks; its total is the chunks planned
   * so far, so with several parts it grows as each part is split (exact with one part).
   */
  onStage?: (stage: PrepareStage, done: number, total: number) => void;
  /** Across all parts. Default 3 hours. */
  maxTotalMs?: number;
  chunking?: ChunkOptions;
};

export type PreparedChunk = {
  /** Continuous across parts: 0 .. chunks.length - 1. */
  idx: number;
  /** Which input part this chunk came from. */
  part: number;
  /** On the whole recording's timeline; whole milliseconds, exactly sample aligned. */
  startMs: number;
  endMs: number;
  silent: boolean;
  /** 16 kHz mono 16-bit PCM. */
  wav: Uint8Array<ArrayBuffer>;
};

export type PreparedAudio = {
  durationMs: number;
  sampleRate: typeof TARGET_SAMPLE_RATE;
  /** Where each input part sits on the timeline. */
  parts: Array<{ startMs: number; endMs: number }>;
  chunks: PreparedChunk[];
};

const SAMPLES_PER_MS = TARGET_SAMPLE_RATE / 1000;

/**
 * Turns one or more recordings into upload ready WAV chunks. Parts are laid end to end in order;
 * a part boundary is always a chunk boundary. One part is decoded at a time and its float samples
 * are dropped once encoded, so peak memory is about one decoded part plus the 16-bit output.
 */
export async function prepareAudio(
  parts: Blob[],
  opts: PrepareOptions = {},
): Promise<PreparedAudio> {
  const maxTotalMs = opts.maxTotalMs ?? DEFAULT_MAX_MS;
  const report = opts.onStage ?? (() => {});
  const chunks: PreparedChunk[] = [];
  const spans: PreparedAudio["parts"] = [];
  let offset = 0; // samples
  let planned = 0;

  for (let p = 0; p < parts.length; p++) {
    report("decoding", p, parts.length);
    await nextMacrotask();
    const remainingMs = maxTotalMs - offset / SAMPLES_PER_MS;
    const decoded = await decodePart(parts[p]!, p, remainingMs);
    // Drop the sub millisecond tail (under 16 samples) so every offset is a whole millisecond.
    const samples = decoded.subarray(0, decoded.length - (decoded.length % SAMPLES_PER_MS));
    if (samples.length === 0)
      throw new AudioPrepError("empty", "the recording has no audio", { part: p });

    report("splitting", p, parts.length);
    await nextMacrotask();
    const plan = planChunks(samples, TARGET_SAMPLE_RATE, opts.chunking);
    planned += plan.length;

    for (const c of plan) {
      report("encoding", chunks.length, planned);
      chunks.push({
        idx: chunks.length,
        part: p,
        startMs: (offset + c.startSample) / SAMPLES_PER_MS,
        endMs: (offset + c.endSample) / SAMPLES_PER_MS,
        silent: c.silent,
        wav: encodeWav16(samples.subarray(c.startSample, c.endSample), TARGET_SAMPLE_RATE),
      });
      await nextMacrotask();
    }
    spans.push({
      startMs: offset / SAMPLES_PER_MS,
      endMs: (offset + samples.length) / SAMPLES_PER_MS,
    });
    offset += samples.length;
  }

  if (offset === 0) throw new AudioPrepError("empty", "no recording was given");
  report("encoding", chunks.length, planned);
  return {
    durationMs: offset / SAMPLES_PER_MS,
    sampleRate: TARGET_SAMPLE_RATE,
    parts: spans,
    chunks,
  };
}

async function decodePart(part: Blob, index: number, maxMs: number): Promise<Float32Array> {
  try {
    return await decodeToMono16k(part, { maxMs });
  } catch (err) {
    if (err instanceof AudioPrepError) {
      throw new AudioPrepError(err.kind, err.message, { part: index, cause: err.cause });
    }
    throw new AudioPrepError("decode_failed", "the recording could not be read", {
      part: index,
      cause: err,
    });
  }
}

/** A real macrotask, so input and paint get a turn between chunks of a long file. */
function nextMacrotask(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === "function") return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
