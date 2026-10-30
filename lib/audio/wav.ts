import { AudioPrepError } from "./errors";

// Isomorphic (no DOM): the browser encodes upload chunks with it, the server parses them.

const HEADER_BYTES = 44;
const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;
const FORMAT_EXTENSIBLE = 0xfffe;

/** Mono 16-bit PCM WAV. Samples outside [-1, 1] are clamped. */
export function encodeWav16(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * 2;
  const bytes = new Uint8Array(HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);

  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, FORMAT_PCM, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, dataBytes, true);

  // One scale (32768) both ways keeps a round trip within 1 LSB, including full scale.
  for (let i = 0, o = HEADER_BYTES; i < samples.length; i++, o += 2) {
    const v = Math.round((samples[i] ?? 0) * 32768);
    view.setInt16(o, v > 32767 ? 32767 : v < -32768 ? -32768 : v, true);
  }
  return bytes;
}

export type ParsedWav = {
  sampleRate: number;
  /** Channel count in the file. */
  channels: number;
  /** Mono: when the file has several channels they are averaged. */
  samples: Float32Array;
};

/** Reads PCM 8, 16, 24 and 32-bit and float 32 or 64, including WAVE_FORMAT_EXTENSIBLE. */
export function parseWav(bytes: Uint8Array): ParsedWav {
  const info = readWavInfo(bytes);
  const { channels, frames, bitsPerSample, format, dataOffset, blockAlign } = info;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readSample = sampleReader(view, format, bitsPerSample);
  const bytesPerSample = bitsPerSample / 8;
  const samples = new Float32Array(frames);

  for (let f = 0; f < frames; f++) {
    const frameOffset = dataOffset + f * blockAlign;
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += readSample(frameOffset + c * bytesPerSample);
    samples[f] = sum / channels;
  }
  return { sampleRate: info.sampleRate, channels, samples };
}

/** Duration from the header alone, exact: frames * 1000 / sampleRate. */
export function wavDurationMs(bytes: Uint8Array): number {
  const info = readWavInfo(bytes);
  return (info.frames * 1000) / info.sampleRate;
}

type WavInfo = {
  format: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  blockAlign: number;
  dataOffset: number;
  frames: number;
};

function readWavInfo(bytes: Uint8Array): WavInfo {
  if (bytes.length < 12 || readAscii(bytes, 0) !== "RIFF" || readAscii(bytes, 8) !== "WAVE") {
    throw new AudioPrepError("unsupported_format", "not a RIFF WAVE file");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fmt: Omit<WavInfo, "dataOffset" | "frames"> | undefined;
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const id = readAscii(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (id === "fmt ") {
      if (size < 16 || body + 16 > bytes.length) {
        throw new AudioPrepError("decode_failed", "WAV fmt chunk is truncated");
      }
      let format = view.getUint16(body, true);
      if (format === FORMAT_EXTENSIBLE && size >= 40 && body + 26 <= bytes.length) {
        // The first two bytes of the SubFormat GUID are the real format code.
        format = view.getUint16(body + 24, true);
      }
      fmt = {
        format,
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        blockAlign: view.getUint16(body + 12, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      if (!fmt) throw new AudioPrepError("decode_failed", "WAV data chunk before fmt chunk");
      checkFormat(fmt);
      // Streaming writers leave the size as 0 or 0xFFFFFFFF; trust the bytes we actually have.
      const available = bytes.length - body;
      const dataBytes = size === 0 || size > available ? available : size;
      return { ...fmt, dataOffset: body, frames: Math.floor(dataBytes / fmt.blockAlign) };
    }
    offset = body + size + (size % 2); // chunks are padded to an even length
  }
  throw new AudioPrepError("decode_failed", fmt ? "WAV has no data chunk" : "WAV has no fmt chunk");
}

function checkFormat(fmt: Omit<WavInfo, "dataOffset" | "frames">): void {
  const { format, channels, sampleRate, bitsPerSample, blockAlign } = fmt;
  const pcm = format === FORMAT_PCM && [8, 16, 24, 32].includes(bitsPerSample);
  const float = format === FORMAT_FLOAT && (bitsPerSample === 32 || bitsPerSample === 64);
  if (!pcm && !float) {
    throw new AudioPrepError(
      "unsupported_format",
      `WAV encoding ${format} at ${bitsPerSample} bits is not supported`,
    );
  }
  if (channels < 1 || sampleRate < 1 || blockAlign !== (channels * bitsPerSample) / 8) {
    throw new AudioPrepError("decode_failed", "WAV fmt chunk is inconsistent");
  }
}

function sampleReader(view: DataView, format: number, bits: number): (at: number) => number {
  if (format === FORMAT_FLOAT) {
    return bits === 64 ? (at) => view.getFloat64(at, true) : (at) => view.getFloat32(at, true);
  }
  switch (bits) {
    case 8:
      return (at) => (view.getUint8(at) - 128) / 128; // 8-bit WAV is unsigned
    case 16:
      return (at) => view.getInt16(at, true) / 32768;
    case 24:
      return (at) => {
        const v = view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getInt8(at + 2) << 16);
        return v / 8388608;
      };
    default:
      return (at) => view.getInt32(at, true) / 2147483648;
  }
}

function writeAscii(bytes: Uint8Array, at: number, text: string): void {
  for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i);
}

function readAscii(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(
    bytes[at] ?? 0,
    bytes[at + 1] ?? 0,
    bytes[at + 2] ?? 0,
    bytes[at + 3] ?? 0,
  );
}
