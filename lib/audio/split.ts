// Splits audio into chunks the speech API accepts (D25: at most 30 s per request), cutting in
// pauses so no word is split. Pure and deterministic.

export type ChunkOptions = {
  /** Preferred chunk length; a pause near it wins over an equally quiet one further away. */
  targetMs?: number;
  /** No cut earlier than this (only the last chunk may be shorter). */
  minMs?: number;
  /** Hard ceiling, never exceeded. */
  maxMs?: number;
  /** A chunk with less voice than this is flagged silent and the server skips it. */
  minVoicedMs?: number;
};

export type PlannedChunk = {
  idx: number;
  startSample: number;
  /** Exclusive. */
  endSample: number;
  /** Exact: sample * 1000 / sampleRate. At 16 kHz every cut is a whole millisecond. */
  startMs: number;
  endMs: number;
  silent: boolean;
  rms: number;
};

export const CHUNK_DEFAULTS = {
  targetMs: 25_000,
  minMs: 12_000,
  maxMs: 29_000,
  minVoicedMs: 200,
} as const satisfies Required<ChunkOptions>;

/** Cuts sit on a 5 ms grid; each candidate is judged by the 30 ms frame centred on it. */
const HOP_MS = 5;
const HALF_FRAME_HOPS = 3;
/** Within 3 dB of the quietest frame in the window counts as equally quiet. */
const QUIET_RATIO = 10 ** (3 / 20);
const DIGITAL_SILENCE_RMS = 10 ** (-90 / 20);
const NOISE_FLOOR_PERCENTILE = 0.1;
const VOICE_ABOVE_NOISE_DB = 10;
/**
 * The silence threshold follows the recording's noise floor but stays in this band: the floor
 * keeps hiss from counting as voice, the ceiling keeps a quiet speaker from being skipped.
 * Wrongly skipping speech loses words; wrongly sending silence costs one cheap request.
 */
const SILENCE_DB_MIN = -55;
const SILENCE_DB_MAX = -35;

export function planChunks(
  samples: Float32Array,
  sampleRate: number,
  opts: ChunkOptions = {},
): PlannedChunk[] {
  const o = {
    targetMs: opts.targetMs ?? CHUNK_DEFAULTS.targetMs,
    minMs: opts.minMs ?? CHUNK_DEFAULTS.minMs,
    maxMs: opts.maxMs ?? CHUNK_DEFAULTS.maxMs,
    minVoicedMs: opts.minVoicedMs ?? CHUNK_DEFAULTS.minVoicedMs,
  };
  const n = samples.length;
  const hop = Math.max(1, Math.round((sampleRate * HOP_MS) / 1000));
  const minSamples = Math.floor((o.minMs * sampleRate) / 1000);
  const maxSamples = Math.floor((o.maxMs * sampleRate) / 1000);
  const targetSamples = Math.round((o.targetMs * sampleRate) / 1000);
  if (!(sampleRate > 0)) throw new RangeError("sampleRate must be positive");
  if (!(o.minMs > 0 && o.minMs <= o.targetMs && o.targetMs <= o.maxMs)) {
    throw new RangeError("chunk options need 0 < minMs <= targetMs <= maxMs");
  }
  if (maxSamples - minSamples < hop) throw new RangeError("maxMs - minMs must be at least 5 ms");
  if (n === 0) return [];

  const hopEnergy = hopEnergies(samples, hop);
  const frameRms = boundaryRms(hopEnergy, n, hop);
  const silenceRms = silenceThreshold(frameRms);

  const cuts: number[] = [0];
  let start = 0;
  while (n - start > maxSamples) {
    const lo = Math.ceil((start + minSamples) / hop);
    const hi = Math.floor((start + maxSamples) / hop);
    const target = Math.min(hi, Math.max(lo, Math.round((start + targetSamples) / hop)));
    start = quietestBoundary(frameRms, lo, hi, target) * hop;
    cuts.push(start);
  }
  cuts.push(n);

  const chunks: PlannedChunk[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const startSample = cuts[i]!;
    const endSample = cuts[i + 1]!;
    const firstHop = startSample / hop; // every cut is on the hop grid
    const endHop = Math.ceil(endSample / hop);
    let energy = 0;
    let voicedBoundaries = 0;
    for (let h = firstHop; h < endHop; h++) {
      energy += hopEnergy[h]!;
      if (frameRms[h]! > silenceRms) voicedBoundaries++;
    }
    const voicedMs = (voicedBoundaries * hop * 1000) / sampleRate;
    chunks.push({
      idx: i,
      startSample,
      endSample,
      startMs: (startSample * 1000) / sampleRate,
      endMs: (endSample * 1000) / sampleRate,
      silent: voicedMs < o.minVoicedMs,
      rms: Math.sqrt(energy / (endSample - startSample)),
    });
  }
  return chunks;
}

/** Sum of squares per hop; the last hop may be short. */
function hopEnergies(samples: Float32Array, hop: number): Float64Array {
  const out = new Float64Array(Math.ceil(samples.length / hop));
  for (let h = 0, i = 0; h < out.length; h++) {
    const end = Math.min(i + hop, samples.length);
    let sum = 0;
    for (; i < end; i++) sum += samples[i]! * samples[i]!;
    out[h] = sum;
  }
  return out;
}

/** RMS of the 30 ms frame centred on each hop boundary b (sample b * hop), b = 0 .. hops. */
function boundaryRms(hopEnergy: Float64Array, n: number, hop: number): Float32Array {
  const hops = hopEnergy.length;
  const out = new Float32Array(hops + 1);
  for (let b = 0; b <= hops; b++) {
    const from = Math.max(0, b - HALF_FRAME_HOPS);
    const to = Math.min(hops, b + HALF_FRAME_HOPS);
    let sum = 0;
    for (let h = from; h < to; h++) sum += hopEnergy[h]!;
    const count = Math.min(n, to * hop) - from * hop;
    out[b] = count > 0 ? Math.sqrt(sum / count) : 0;
  }
  return out;
}

function silenceThreshold(frameRms: Float32Array): number {
  // 1 dB histogram from -120 to 0 dBFS: a percentile without sorting a long array.
  const bins = new Uint32Array(121);
  for (const rms of frameRms) bins[Math.min(120, Math.max(0, Math.floor(toDb(rms) + 120)))]!++;
  const wanted = frameRms.length * NOISE_FLOOR_PERCENTILE;
  let seen = 0;
  let floorDb = 0;
  for (let bin = 0; bin < bins.length; bin++) {
    seen += bins[bin]!;
    if (seen >= wanted) {
      floorDb = bin - 120;
      break;
    }
  }
  const db = Math.min(SILENCE_DB_MAX, Math.max(SILENCE_DB_MIN, floorDb + VOICE_ABOVE_NOISE_DB));
  return 10 ** (db / 20);
}

/**
 * The quietest boundary in [lo, hi]; among equally quiet ones the one nearest the target, then
 * moved to the middle of its pause so neither neighbouring word is clipped.
 */
function quietestBoundary(frameRms: Float32Array, lo: number, hi: number, target: number): number {
  let quietest = Infinity;
  for (let b = lo; b <= hi; b++) quietest = Math.min(quietest, frameRms[b]!);
  const limit = Math.max(quietest, DIGITAL_SILENCE_RMS) * QUIET_RATIO;

  let best = lo;
  let bestDistance = Infinity;
  for (let b = lo; b <= hi; b++) {
    const distance = Math.abs(b - target);
    if (frameRms[b]! <= limit && distance < bestDistance) {
      best = b;
      bestDistance = distance;
    }
  }
  let left = best;
  let right = best;
  while (left > lo && frameRms[left - 1]! <= limit) left--;
  while (right < hi && frameRms[right + 1]! <= limit) right++;
  return Math.floor((left + right) / 2);
}

function toDb(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-6));
}
