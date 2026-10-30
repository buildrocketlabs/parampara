import { AudioPrepError } from "./errors";
import {
  canDecodeOpusPackets,
  decodeOggOpusMono48k,
  demuxOggOpus,
  OGG_OPUS_RATE,
  type OggOpus,
} from "./ogg-opus";
import { parseWav } from "./wav";

export const TARGET_SAMPLE_RATE = 16_000;
export const DEFAULT_MAX_MS = 3 * 60 * 60 * 1000;

/** Some older WebKit builds refuse a 16 kHz context; we then decode here and resample ourselves. */
const FALLBACK_CONTEXT_RATE = 48_000;

export type Container = "wav" | "mp3" | "aac" | "mp4" | "3gp" | "ogg" | "webm" | "flac" | "amr";

/** Containers a browser may fail on for codec reasons; a failure there is "unsupported", not "broken". */
const RARELY_DECODABLE: ReadonlySet<Container> = new Set(["3gp", "amr"]);

/**
 * Decodes any browser decodable audio to 16 kHz mono float samples.
 *
 * An ArrayBuffer input is handed to the decoder and detached (saves a full copy on long files);
 * pass a copy if you still need it. Without Web Audio (Node, tests) only WAV is decoded.
 */
export async function decodeToMono16k(
  input: Blob | ArrayBuffer,
  opts: { maxMs?: number } = {},
): Promise<Float32Array> {
  const maxMs = opts.maxMs ?? DEFAULT_MAX_MS;
  const bytes = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  if (bytes.byteLength === 0) throw new AudioPrepError("empty", "the file is empty");

  const container = sniffContainer(new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength)));
  const OfflineContext = offlineContextConstructor();
  const mono = OfflineContext
    ? await decodeWithWebAudio(OfflineContext, bytes, container, maxMs)
    : decodeWavFallback(bytes, container, maxMs);

  if (mono.length === 0) throw new AudioPrepError("empty", "the recording has no audio");
  return mono;
}

/** Averages channels into one. A single channel is returned as is (not copied). */
export function downmix(channels: Float32Array[]): Float32Array {
  const first = channels[0];
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first;
  const length = Math.min(...channels.map((c) => c.length));
  const out = new Float32Array(length);
  mixInto(out, channels, length);
  return out;
}

/**
 * Linear interpolation resampler, used only when the browser cannot resample for us. Before
 * decimation a centred triangular low pass (two box passes, zero phase so timing is kept) damps
 * what would otherwise fold back as aliasing. Equal rates return the input as is.
 */
export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (!(fromRate > 0) || !(toRate > 0)) throw new RangeError("sample rates must be positive");
  if (fromRate === toRate || samples.length === 0) return samples;

  const n = samples.length;
  const ratio = fromRate / toRate;
  const halfBox = ratio > 1 ? Math.floor(ratio / 2) : 0; // box width 2 * halfBox + 1, always odd
  const lowpassed =
    halfBox === 0 ? (k: number) => samples[k] ?? 0 : triangleFilter(samples, halfBox);

  const out = new Float32Array(Math.round((n * toRate) / fromRate));
  for (let i = 0; i < out.length; i++) {
    const pos = (i * fromRate) / toRate;
    const k = Math.floor(pos);
    const frac = pos - k;
    const a = lowpassed(Math.min(k, n - 1));
    const b = lowpassed(Math.min(k + 1, n - 1));
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** Recognises a container from its first bytes. Unknown returns null. */
export function sniffContainer(head: Uint8Array): Container | null {
  const ascii = (at: number, len: number) =>
    String.fromCharCode(...Array.from(head.subarray(at, at + len)));
  const b0 = head[0] ?? 0;
  const b1 = head[1] ?? 0;

  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "wav";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(0, 4) === "fLaC") return "flac";
  if (ascii(0, 5) === "#!AMR") return "amr";
  if (b0 === 0x1a && b1 === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "webm";
  if (ascii(4, 4) === "ftyp") return ascii(8, 3).startsWith("3g") ? "3gp" : "mp4";
  if (ascii(0, 3) === "ID3") return "mp3";
  if (b0 === 0xff && (b1 & 0xe0) === 0xe0) return (b1 & 0x06) === 0 ? "aac" : "mp3"; // frame sync
  return null;
}

type OfflineContextConstructor = new (
  channels: number,
  length: number,
  sampleRate: number,
) => BaseAudioContext;

function offlineContextConstructor(): OfflineContextConstructor | undefined {
  const g = globalThis as {
    OfflineAudioContext?: OfflineContextConstructor;
    webkitOfflineAudioContext?: OfflineContextConstructor;
  };
  return g.OfflineAudioContext ?? g.webkitOfflineAudioContext;
}

async function decodeWithWebAudio(
  OfflineContext: OfflineContextConstructor,
  bytes: ArrayBuffer,
  container: Container | null,
  maxMs: number,
): Promise<Float32Array> {
  let buffer: AudioBuffer;
  // decodeAudioData detaches the buffer even when it fails; keep the (small, compressed) Ogg bytes
  // for the WebCodecs fallback that Safari needs for WhatsApp notes (ogg-opus.ts).
  const oggCopy = container === "ogg" ? bytes.slice(0) : null;
  try {
    buffer = await decodeAudioDataCompat(createContext(OfflineContext), bytes);
  } catch (cause) {
    if (oggCopy) return decodeOggOpusFallback(oggCopy, maxMs, cause);
    const unsupported = container === null || RARELY_DECODABLE.has(container);
    throw unsupported
      ? new AudioPrepError("unsupported_format", "this browser cannot read this file type", {
          cause,
        })
      : new AudioPrepError("decode_failed", `the ${container} file could not be decoded`, {
          cause,
        });
  }

  if (buffer.length === 0) throw new AudioPrepError("empty", "the recording has no audio");
  checkDuration(buffer.length, buffer.sampleRate, maxMs);

  // Mix into channel 0's own storage instead of allocating another full length array.
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c),
  );
  const mono = channels[0]!;
  if (channels.length > 1) mixInto(mono, channels, mono.length);
  return buffer.sampleRate === TARGET_SAMPLE_RATE
    ? mono
    : resampleLinear(mono, buffer.sampleRate, TARGET_SAMPLE_RATE);
}

/**
 * Web Audio refused an Ogg file (Safari before 18.4, and some later builds): read the Opus packets
 * ourselves and decode them with WebCodecs. "unsupported_format" when this browser cannot do that
 * either, so the page can say plainly to open it in Chrome; "decode_failed" when the file is bad.
 */
async function decodeOggOpusFallback(
  bytes: ArrayBuffer,
  maxMs: number,
  cause: unknown,
): Promise<Float32Array> {
  let ogg: OggOpus;
  try {
    ogg = demuxOggOpus(new Uint8Array(bytes));
  } catch (err) {
    if (err instanceof AudioPrepError && err.kind === "empty") throw err;
    throw new AudioPrepError("decode_failed", "the ogg file could not be decoded", { cause });
  }
  if (ogg.totalSamples !== null) checkDuration(ogg.totalSamples, OGG_OPUS_RATE, maxMs);
  if (!(await canDecodeOpusPackets(ogg.channels))) {
    throw new AudioPrepError("unsupported_format", "this browser cannot read Ogg Opus", { cause });
  }
  const mono = await decodeOggOpusMono48k(ogg);
  if (mono.length === 0) throw new AudioPrepError("empty", "the recording has no audio");
  checkDuration(mono.length, OGG_OPUS_RATE, maxMs);
  return resampleLinear(mono, OGG_OPUS_RATE, TARGET_SAMPLE_RATE);
}

function createContext(OfflineContext: OfflineContextConstructor): BaseAudioContext {
  try {
    // The decoder resamples to the context's rate with proper filtering.
    return new OfflineContext(1, 1, TARGET_SAMPLE_RATE);
  } catch {
    return new OfflineContext(1, 1, FALLBACK_CONTEXT_RATE);
  }
}

/** Old WebKit only has the callback form; modern browsers return a promise too. */
function decodeAudioDataCompat(
  context: BaseAudioContext,
  bytes: ArrayBuffer,
): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const maybe = context.decodeAudioData(bytes, resolve, reject) as
      Promise<AudioBuffer> | undefined;
    maybe?.then(resolve, reject);
  });
}

function decodeWavFallback(
  bytes: ArrayBuffer,
  container: Container | null,
  maxMs: number,
): Float32Array {
  if (container !== "wav") {
    throw new AudioPrepError("unsupported_format", "only WAV can be decoded without Web Audio");
  }
  const wav = parseWav(new Uint8Array(bytes));
  checkDuration(wav.samples.length, wav.sampleRate, maxMs);
  return resampleLinear(wav.samples, wav.sampleRate, TARGET_SAMPLE_RATE);
}

function checkDuration(frames: number, sampleRate: number, maxMs: number): void {
  if ((frames * 1000) / sampleRate > maxMs) {
    throw new AudioPrepError(
      "too_long",
      `the recording is longer than ${Math.round(maxMs / 60_000)} minutes`,
    );
  }
}

/** `out` may be one of `channels`: each index is read before it is written. */
function mixInto(out: Float32Array, channels: Float32Array[], length: number): void {
  const scale = 1 / channels.length;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i] ?? 0;
    out[i] = sum * scale;
  }
}

/** Sample k of the input after a centred box filter of width 2h + 1 applied twice (edges held). */
function triangleFilter(samples: Float32Array, h: number): (k: number) => number {
  const n = samples.length;
  const width = 2 * h + 1;
  const norm = 1 / (width * width);
  return (k) => {
    let sum = 0;
    for (let j = -2 * h; j <= 2 * h; j++) {
      const idx = k + j < 0 ? 0 : k + j >= n ? n - 1 : k + j;
      sum += (width - Math.abs(j)) * (samples[idx] ?? 0);
    }
    return sum * norm;
  };
}
