// Small audio helpers for the speech client: read a WAV header, join WAV parts by their PCM, and
// join MP3 parts frame to frame. No dependencies; inputs come from Sarvam or our own browser
// pipeline (16 kHz mono 16 bit WAV, D34).

export type WavFormat = {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  byteRate: number;
  blockAlign: number;
};

export type ParsedWav = { format: WavFormat; data: Uint8Array };

function ascii(bytes: Uint8Array, at: number, len: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + len));
}

export function parseWav(bytes: Uint8Array): ParsedWav | null {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format: WavFormat | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    let size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && body + 16 <= bytes.length) {
      format = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        byteRate: view.getUint32(body + 8, true),
        blockAlign: view.getUint16(body + 12, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      // Streaming encoders write 0 or 0xFFFFFFFF when they do not know the length yet.
      if (size === 0 || size === 0xffffffff || body + size > bytes.length) size = bytes.length - body;
      return format ? { format, data: bytes.subarray(body, body + size) } : null;
    }
    offset = body + size + (size % 2);
  }
  return null;
}

export function wavDurationMs(bytes: Uint8Array): number | null {
  const wav = parseWav(bytes);
  if (!wav || wav.format.byteRate === 0) return null;
  return Math.round((wav.data.length / wav.format.byteRate) * 1000);
}

export function encodeWav(format: WavFormat, pcm: Uint8Array): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const view = new DataView(out.buffer);
  const write = (at: number, s: string) => [...s].forEach((c, i) => (out[at + i] = c.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format.audioFormat, true);
  view.setUint16(22, format.channels, true);
  view.setUint32(24, format.sampleRate, true);
  view.setUint32(28, format.byteRate, true);
  view.setUint16(32, format.blockAlign, true);
  view.setUint16(34, format.bitsPerSample, true);
  write(36, "data");
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** One WAV from several: one header, the PCM of every part in order. Formats must match. */
export function concatWav(parts: Uint8Array[]): Uint8Array {
  const parsed = parts.map(parseWav);
  const first = parsed[0];
  if (!first || parsed.some((p) => !p)) throw new Error("not a wav");
  for (const p of parsed) {
    const f = p!.format;
    if (
      f.sampleRate !== first.format.sampleRate ||
      f.channels !== first.format.channels ||
      f.bitsPerSample !== first.format.bitsPerSample
    ) {
      throw new Error("wav parts differ in format");
    }
  }
  return encodeWav(first.format, concatBytes(parsed.map((p) => p!.data)));
}

// ── MP3 ─────────────────────────────────────────────────────────────────────
// Joining MP3 files is joining their frames, except for two preludes: an ID3v2 tag, and a
// Xing/Info/VBRI frame that states the length of that one part. Left in, players can stop at the
// first part's stated length, so every part's prelude is removed.

const L3_KBPS_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const L3_KBPS_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

type Mp3Frame = { length: number; sideInfo: number };

export function mp3FrameAt(bytes: Uint8Array, at: number): Mp3Frame | null {
  if (at + 4 > bytes.length) return null;
  const [b0, b1, b2, b3] = [bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!];
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;
  const version = (b1 >> 3) & 3; // 3 MPEG1, 2 MPEG2, 0 MPEG2.5
  const layer = (b1 >> 1) & 3; // 1 Layer III
  if (version === 1 || layer !== 1) return null;
  const kbps = (version === 3 ? L3_KBPS_V1 : L3_KBPS_V2)[(b2 >> 4) & 0xf];
  const rate = RATES[version]?.[(b2 >> 2) & 3];
  if (!kbps || !rate) return null;
  const padding = (b2 >> 1) & 1;
  const mono = ((b3 >> 6) & 3) === 3;
  const length = Math.floor(((version === 3 ? 144_000 : 72_000) * kbps) / rate) + padding;
  const sideInfo = version === 3 ? (mono ? 17 : 32) : mono ? 9 : 17;
  return { length, sideInfo };
}

function id3Length(bytes: Uint8Array): number {
  if (bytes.length < 10 || ascii(bytes, 0, 3) !== "ID3") return 0;
  const size = ((bytes[6]! & 0x7f) << 21) | ((bytes[7]! & 0x7f) << 14) | ((bytes[8]! & 0x7f) << 7) | (bytes[9]! & 0x7f);
  const footer = bytes[5]! & 0x10 ? 10 : 0;
  return Math.min(bytes.length, 10 + size + footer);
}

/** The part without its ID3v2 tag and without a leading Xing/Info/VBRI frame. */
export function stripMp3Prelude(bytes: Uint8Array): Uint8Array {
  let at = id3Length(bytes);
  const frame = mp3FrameAt(bytes, at);
  if (frame) {
    const tag = ascii(bytes, at + 4 + frame.sideInfo, 4);
    const vbri = ascii(bytes, at + 36, 4);
    if (tag === "Xing" || tag === "Info" || vbri === "VBRI") at += frame.length;
  }
  return bytes.subarray(at);
}

export function concatMp3(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0]!;
  return concatBytes(parts.map(stripMp3Prelude));
}
