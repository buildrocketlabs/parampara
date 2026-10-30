import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AudioPrepError } from "./errors";
import { buildWav, seededRandom, sine } from "./test-audio";
import { encodeWav16, parseWav, wavDurationMs } from "./wav";

const LSB = 1 / 32768;

describe("server safety", () => {
  // The server route imports wav.ts and split.ts, so they must not touch browser only APIs.
  const BROWSER_ONLY =
    /\b(window|document|navigator|AudioContext|OfflineAudioContext|MediaRecorder|requestAnimationFrame|AudioBuffer)\b/;

  it.each(["wav.ts", "split.ts", "errors.ts"])("%s imports only pure modules", (file) => {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports.every((path) => path === "./errors")).toBe(true);
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(BROWSER_ONLY);
  });
});

function ascii(bytes: Uint8Array, at: number, length = 4): string {
  return String.fromCharCode(...bytes.subarray(at, at + length));
}

describe("encodeWav16", () => {
  it("writes a canonical 44 byte mono 16-bit header", () => {
    const bytes = encodeWav16(new Float32Array(10), 16_000);
    const view = new DataView(bytes.buffer);
    expect(bytes.length).toBe(44 + 20);
    expect(ascii(bytes, 0)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(36 + 20);
    expect(ascii(bytes, 8)).toBe("WAVE");
    expect(ascii(bytes, 12)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(28, true)).toBe(32_000); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(bytes, 36)).toBe("data");
    expect(view.getUint32(40, true)).toBe(20);
  });

  it("round trips within 1 LSB, including both full scale ends, and clamps overs", () => {
    const random = seededRandom(3);
    const input = Float32Array.from({ length: 5_000 }, () => random() * 2 - 1);
    input.set([1, -1, 0, 1.7, -3], 0);
    const { samples, sampleRate, channels } = parseWav(encodeWav16(input, 16_000));

    expect(sampleRate).toBe(16_000);
    expect(channels).toBe(1);
    expect(samples.length).toBe(input.length);
    for (let i = 5; i < input.length; i++) {
      expect(Math.abs(samples[i]! - input[i]!)).toBeLessThanOrEqual(LSB);
    }
    expect(samples[0]).toBeCloseTo(1, 4);
    expect(samples[1]).toBe(-1);
    expect(samples[2]).toBe(0);
    expect(samples[3]).toBe(32767 / 32768); // clamped, not wrapped
    expect(samples[4]).toBe(-1);
  });
});

describe("wavDurationMs", () => {
  it("reads the exact duration from the header", () => {
    expect(wavDurationMs(encodeWav16(new Float32Array(40_000), 16_000))).toBe(2_500);
    expect(wavDurationMs(encodeWav16(new Float32Array(441), 44_100))).toBe(10);
  });
});

describe("parseWav", () => {
  it("averages stereo to mono", () => {
    const left = sine(440, 50, 44_100, 0.5);
    const right = new Float32Array(left.length);
    const { samples, channels, sampleRate } = parseWav(
      buildWav({ sampleRate: 44_100, channels: [left, right] }),
    );
    expect(channels).toBe(2);
    expect(sampleRate).toBe(44_100);
    for (let i = 0; i < left.length; i++) expect(samples[i]).toBeCloseTo(left[i]! / 2, 4);
  });

  it("reads 24-bit and float WAV, skipping odd sized chunks before the data", () => {
    const tone = sine(300, 20, 48_000, 0.8);
    const extraChunk = { id: "LIST", body: new Uint8Array([1, 2, 3]) }; // odd: padded to 4
    for (const encoding of ["pcm24", "float32"] as const) {
      const { samples } = parseWav(
        buildWav({ sampleRate: 48_000, channels: [tone], encoding, extraChunk }),
      );
      expect(samples.length).toBe(tone.length);
      for (let i = 0; i < tone.length; i++) expect(samples[i]).toBeCloseTo(tone[i]!, 5);
    }
  });

  it("reads a view into a larger buffer (Node Buffer slices) and a streaming size", () => {
    const wav = encodeWav16(sine(200, 10, 16_000), 16_000);
    new DataView(wav.buffer).setUint32(40, 0xffffffff, true); // writer never filled in the size
    const pool = new Uint8Array(wav.length + 7);
    pool.set(wav, 7);
    const { samples } = parseWav(pool.subarray(7));
    expect(samples.length).toBe(160);
  });

  it("names what it cannot read", () => {
    const kindOf = (bytes: Uint8Array) => {
      try {
        parseWav(bytes);
      } catch (err) {
        return err instanceof AudioPrepError ? err.kind : "other";
      }
      return "parsed";
    };
    expect(kindOf(new TextEncoder().encode("ID3 definitely an mp3 file"))).toBe(
      "unsupported_format",
    );

    const adpcm = encodeWav16(new Float32Array(8), 8_000);
    new DataView(adpcm.buffer).setUint16(20, 0x11, true);
    expect(kindOf(adpcm)).toBe("unsupported_format");

    expect(kindOf(encodeWav16(new Float32Array(8), 8_000).subarray(0, 36))).toBe("decode_failed");
  });
});
