import { AudioPrepError } from "./errors";

// WhatsApp voice notes are Opus in an Ogg container. Chrome and Firefox decode them with Web Audio;
// Safari did not before 18.4 and is still uneven after (WebKit bug 293310). When decodeAudioData
// refuses an Ogg file we read the Ogg pages ourselves (RFC 3533, RFC 7845) and hand the Opus
// packets to the browser's own decoder through WebCodecs (Safari 26, Chrome 94). No dependency.

const OPUS_RATE = 48_000;

export type OggOpus = {
  /** The OpusHead packet, given to the decoder as its description. */
  head: Uint8Array;
  channels: number;
  preSkip: number;
  /** Audio packets in order, each with its duration in 48 kHz samples. */
  packets: Array<{ data: Uint8Array; samples: number }>;
  /** Samples of real audio at 48 kHz (last granule position minus pre skip), when known. */
  totalSamples: number | null;
};

/** Splits an Ogg Opus file into its packets. Throws AudioPrepError("decode_failed") if it is not one. */
export function demuxOggOpus(bytes: Uint8Array): OggOpus {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const packets: Uint8Array[] = [];
  let serial: number | null = null;
  let pending: Uint8Array[] = [];
  let lastGranule = -1;
  let at = 0;

  while (at + 27 <= bytes.length) {
    if (
      bytes[at] !== 0x4f ||
      bytes[at + 1] !== 0x67 ||
      bytes[at + 2] !== 0x67 ||
      bytes[at + 3] !== 0x53
    )
      break; // "OggS" lost: stop at what we have rather than read garbage
    const headerType = bytes[at + 5]!;
    const granuleLo = view.getUint32(at + 6, true);
    const granuleHi = view.getInt32(at + 10, true);
    const pageSerial = view.getUint32(at + 14, true);
    const segments = bytes[at + 26]!;
    const lacingAt = at + 27;
    let dataAt = lacingAt + segments;
    if (dataAt > bytes.length) break;
    serial ??= pageSerial;
    const ours = pageSerial === serial;
    if (ours && !(headerType & 0x01)) pending = []; // a page that does not continue a packet
    for (let s = 0; s < segments; s++) {
      const len = bytes[lacingAt + s]!;
      if (dataAt + len > bytes.length) break;
      if (ours) pending.push(bytes.subarray(dataAt, dataAt + len));
      dataAt += len;
      if (ours && len < 255) {
        packets.push(join(pending));
        pending = [];
      }
    }
    // -1 (all bits set) means no packet ends on this page; it fails the sign test.
    if (ours && granuleHi >= 0) {
      lastGranule = granuleHi * 2 ** 32 + granuleLo;
    }
    at = dataAt;
  }

  const head = packets[0];
  if (!head || head.length < 19 || ascii(head, 0, 8) !== "OpusHead") {
    throw new AudioPrepError("decode_failed", "this Ogg file does not hold Opus audio");
  }
  const channels = head[9]!;
  const preSkip = head[10]! | (head[11]! << 8);
  if (channels < 1) throw new AudioPrepError("decode_failed", "the Opus header has no channels");
  // packets[1] is OpusTags; audio starts after it.
  const audio = packets.slice(2).filter((p) => p.length > 0);
  if (audio.length === 0) throw new AudioPrepError("empty", "the recording has no audio");
  return {
    head,
    channels,
    preSkip,
    packets: audio.map((data) => ({ data, samples: opusPacketSamples(data) })),
    totalSamples: lastGranule > preSkip ? lastGranule - preSkip : null,
  };
}

/** Samples at 48 kHz in one Opus packet, from its TOC byte (RFC 6716 §3.1). */
export function opusPacketSamples(packet: Uint8Array): number {
  const toc = packet[0] ?? 0;
  const config = toc >> 3;
  const frame =
    config < 12
      ? [480, 960, 1920, 2880][config % 4]!
      : config < 16
        ? [480, 960][config % 2]!
        : [120, 240, 480, 960][config % 4]!;
  const code = toc & 0x03;
  const frames = code === 0 ? 1 : code < 3 ? 2 : (packet[1] ?? 0) & 0x3f;
  return frame * frames;
}

type WebCodecs = {
  AudioDecoder: typeof AudioDecoder;
  EncodedAudioChunk: typeof EncodedAudioChunk;
};

function webCodecs(): WebCodecs | null {
  const g = globalThis as Partial<WebCodecs>;
  return g.AudioDecoder && g.EncodedAudioChunk
    ? { AudioDecoder: g.AudioDecoder, EncodedAudioChunk: g.EncodedAudioChunk }
    : null;
}

/** Whether this browser can decode Opus packets itself (the Safari fallback). */
export async function canDecodeOpusPackets(channels = 1): Promise<boolean> {
  const wc = webCodecs();
  if (!wc) return false;
  try {
    const support = await wc.AudioDecoder.isConfigSupported({
      codec: "opus",
      sampleRate: OPUS_RATE,
      numberOfChannels: channels,
    });
    return support.supported === true;
  } catch {
    return false;
  }
}

/**
 * Decodes an Ogg Opus file to mono at 48 kHz with WebCodecs. The caller checks the length first
 * (`demuxOggOpus(...).totalSamples`) so a three hour file is refused before it is decoded.
 */
export async function decodeOggOpusMono48k(ogg: OggOpus): Promise<Float32Array> {
  const wc = webCodecs();
  if (!wc) throw new AudioPrepError("unsupported_format", "this browser has no Opus decoder");
  const estimate = ogg.packets.reduce((n, p) => n + p.samples, 0);
  let out = new Float32Array(Math.max(estimate, ogg.totalSamples ?? 0) + OPUS_RATE);
  let written = 0;
  let failure: unknown = null;

  const decoder = new wc.AudioDecoder({
    output: (data) => {
      try {
        const frames = data.numberOfFrames;
        if (written + frames > out.length) {
          const bigger = new Float32Array((written + frames) * 2);
          bigger.set(out.subarray(0, written));
          out = bigger;
        }
        const target = out.subarray(written, written + frames);
        const planes = data.numberOfChannels;
        if (planes === 1) {
          data.copyTo(target, { planeIndex: 0, format: "f32-planar" });
        } else {
          const plane = new Float32Array(frames);
          for (let c = 0; c < planes; c++) {
            data.copyTo(plane, { planeIndex: c, format: "f32-planar" });
            for (let i = 0; i < frames; i++) target[i]! += plane[i]! / planes;
          }
        }
        written += frames;
      } catch (err) {
        failure = err;
      } finally {
        data.close();
      }
    },
    error: (err) => {
      failure = err;
    },
  });

  try {
    decoder.configure({
      codec: "opus",
      sampleRate: OPUS_RATE,
      numberOfChannels: ogg.channels,
      description: ogg.head,
    });
    let timestamp = 0;
    for (const p of ogg.packets) {
      if (failure) break;
      decoder.decode(new wc.EncodedAudioChunk({ type: "key", timestamp, data: p.data }));
      timestamp += Math.round((p.samples * 1_000_000) / OPUS_RATE);
      // Let output callbacks run so the queue does not hold the whole file at once.
      if (decoder.decodeQueueSize > 64) await new Promise((r) => setTimeout(r, 0));
    }
    await decoder.flush();
  } catch (err) {
    failure ??= err;
  } finally {
    if (decoder.state !== "closed") decoder.close();
  }
  if (failure || written === 0) {
    throw new AudioPrepError("decode_failed", "the voice note could not be decoded", {
      cause: failure,
    });
  }

  // Pre skip is the encoder's warm up; the last granule says where the real audio ends.
  const start = Math.min(ogg.preSkip, written);
  const end = ogg.totalSamples !== null ? Math.min(written, start + ogg.totalSamples) : written;
  return out.subarray(start, end);
}

export const OGG_OPUS_RATE = OPUS_RATE;

function join(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0]!;
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function ascii(bytes: Uint8Array, from: number, len: number): string {
  return String.fromCharCode(...bytes.subarray(from, from + len));
}
