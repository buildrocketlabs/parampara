// Test only: synthetic audio, so no real recording ever enters the repo. Not exported from index.

export type Piece = { voiceMs: number; amplitude?: number } | { silenceMs: number };

/** Seeded PRNG (mulberry32) so every test signal is identical on every run. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Voice is two harmonics with a 4 Hz syllable swell and 10 ms ramps; silence is room hiss at
 * about -65 dBFS, which also runs under the voice. Returns where each silence lies, in samples.
 */
export function synth(
  pieces: Piece[],
  { sampleRate = 16_000, noise = 0.001, seed = 7 } = {},
): { samples: Float32Array; silences: Array<[number, number]> } {
  const lengths = pieces.map((p) =>
    Math.round((("voiceMs" in p ? p.voiceMs : p.silenceMs) * sampleRate) / 1000),
  );
  const samples = new Float32Array(lengths.reduce((a, b) => a + b, 0));
  const silences: Array<[number, number]> = [];
  const random = seededRandom(seed);
  const ramp = Math.round(sampleRate * 0.01);
  let at = 0;

  pieces.forEach((piece, i) => {
    const length = lengths[i]!;
    if ("voiceMs" in piece) {
      const amplitude = piece.amplitude ?? 0.3;
      for (let k = 0; k < length; k++) {
        const t = k / sampleRate;
        const edge = Math.min(1, k / ramp, (length - 1 - k) / ramp);
        const swell = 0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t);
        const tone = 0.7 * Math.sin(2 * Math.PI * 180 * t) + 0.3 * Math.sin(2 * Math.PI * 900 * t);
        samples[at + k] = amplitude * edge * swell * tone;
      }
    } else {
      silences.push([at, at + length]);
    }
    at += length;
  });
  for (let k = 0; k < samples.length; k++) samples[k]! += (random() * 2 - 1) * noise;
  return { samples, silences };
}

/** Natural looking talk: words of 0.8 to 6 s with pauses of 0.15 to 1.2 s. */
export function talk(totalMs: number, seed = 11): Piece[] {
  const random = seededRandom(seed);
  const pieces: Piece[] = [];
  let ms = 0;
  while (ms < totalMs) {
    const voiceMs = Math.round(800 + random() * 5200);
    const silenceMs = Math.round(150 + random() * 1050);
    pieces.push({ voiceMs }, { silenceMs });
    ms += voiceMs + silenceMs;
  }
  return pieces;
}

export function sine(freq: number, ms: number, sampleRate: number, amplitude = 0.5): Float32Array {
  const out = new Float32Array(Math.round((ms * sampleRate) / 1000));
  for (let k = 0; k < out.length; k++)
    out[k] = amplitude * Math.sin((2 * Math.PI * freq * k) / sampleRate);
  return out;
}

/** Builds WAV bytes in layouts our own encoder never writes (stereo, 24-bit, float, extra chunks). */
export function buildWav({
  sampleRate,
  channels,
  encoding = "pcm16",
  extraChunk,
}: {
  sampleRate: number;
  channels: Float32Array[];
  encoding?: "pcm16" | "pcm24" | "float32";
  extraChunk?: { id: string; body: Uint8Array };
}): Uint8Array<ArrayBuffer> {
  const bytesPerSample = encoding === "pcm16" ? 2 : encoding === "pcm24" ? 3 : 4;
  const frames = channels[0]?.length ?? 0;
  const blockAlign = bytesPerSample * channels.length;
  const dataBytes = frames * blockAlign;
  const extra = extraChunk ? 8 + extraChunk.body.length + (extraChunk.body.length % 2) : 0;
  const bytes = new Uint8Array(44 + extra + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, s: string) =>
    [...s].forEach((c, i) => (bytes[at + i] = c.charCodeAt(0)));

  ascii(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, encoding === "float32" ? 3 : 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  let at = 36;
  if (extraChunk) {
    ascii(at, extraChunk.id);
    view.setUint32(at + 4, extraChunk.body.length, true);
    bytes.set(extraChunk.body, at + 8);
    at += extra;
  }
  ascii(at, "data");
  view.setUint32(at + 4, dataBytes, true);
  at += 8;
  for (let f = 0; f < frames; f++) {
    for (const channel of channels) {
      const v = channel[f] ?? 0;
      if (encoding === "float32") view.setFloat32(at, v, true);
      else if (encoding === "pcm16") view.setInt16(at, Math.round(v * 32767), true);
      else {
        const int = Math.round(v * 8388607);
        view.setUint8(at, int & 0xff);
        view.setUint8(at + 1, (int >> 8) & 0xff);
        view.setInt8(at + 2, int >> 16);
      }
      at += bytesPerSample;
    }
  }
  return bytes;
}
