import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeToMono16k, downmix, resampleLinear, sniffContainer } from "./decode";
import { AudioPrepError } from "./errors";
import { buildWav, sine } from "./test-audio";

function rms(samples: Float32Array, from = 0, to = samples.length): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / (to - from));
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "decoded";
  } catch (err) {
    return err instanceof AudioPrepError ? err.kind : String(err);
  }
}

describe("downmix", () => {
  it("averages channels and hands back a single channel untouched", () => {
    const mono = downmix([Float32Array.of(1, 0.5, -1), Float32Array.of(0, 0.5, 1)]);
    expect(Array.from(mono)).toEqual([0.5, 0.5, 0]);
    const only = Float32Array.of(0.25);
    expect(downmix([only])).toBe(only);
    expect(downmix([]).length).toBe(0);
  });
});

describe("resampleLinear", () => {
  it("produces round(n * to / from) samples", () => {
    expect(resampleLinear(new Float32Array(44_100), 44_100, 16_000).length).toBe(16_000);
    expect(resampleLinear(new Float32Array(48_001), 48_000, 16_000).length).toBe(16_000);
    expect(resampleLinear(new Float32Array(8_000), 8_000, 16_000).length).toBe(16_000);
    const same = new Float32Array(10);
    expect(resampleLinear(same, 16_000, 16_000)).toBe(same);
  });

  it("keeps a 200 Hz tone in shape and in time when going down and up", () => {
    const ideal = sine(200, 1_000, 16_000);
    for (const fromRate of [44_100, 48_000, 8_000]) {
      const out = resampleLinear(sine(200, 1_000, fromRate), fromRate, 16_000);
      let worst = 0;
      for (let i = 100; i < out.length - 100; i++)
        worst = Math.max(worst, Math.abs(out[i]! - ideal[i]!));
      expect(worst, `from ${fromRate}`).toBeLessThan(0.01);
    }
  });

  it("damps a 15 kHz tone that would otherwise alias into the speech band", () => {
    const out = resampleLinear(sine(15_000, 500, 44_100), 44_100, 16_000);
    expect(rms(out, 100, out.length - 100)).toBeLessThan(0.05 * (0.5 / Math.SQRT2));
  });
});

describe("sniffContainer", () => {
  const head = (...parts: Array<string | number[]>) =>
    Uint8Array.from(
      parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)),
    );

  it("recognises the formats phones and WhatsApp produce", () => {
    expect(sniffContainer(head("RIFF", [0, 0, 0, 0], "WAVE"))).toBe("wav");
    expect(sniffContainer(head([0, 0, 0, 0x20], "ftypM4A "))).toBe("mp4");
    expect(sniffContainer(head([0, 0, 0, 0x18], "ftyp3gp4"))).toBe("3gp");
    expect(sniffContainer(head("OggS", [0, 2]))).toBe("ogg");
    expect(sniffContainer(head([0x1a, 0x45, 0xdf, 0xa3]))).toBe("webm");
    expect(sniffContainer(head("ID3", [4, 0]))).toBe("mp3");
    expect(sniffContainer(head([0xff, 0xfb, 0x90]))).toBe("mp3");
    expect(sniffContainer(head([0xff, 0xf1, 0x50]))).toBe("aac");
    expect(sniffContainer(head("#!AMR\n"))).toBe("amr");
    expect(sniffContainer(head("hello"))).toBeNull();
  });
});

describe("decodeToMono16k without Web Audio (WAV only)", () => {
  it("decodes a 44.1 kHz stereo WAV to 16 kHz mono", async () => {
    const left = sine(200, 2_000, 44_100);
    const wav = buildWav({ sampleRate: 44_100, channels: [left, new Float32Array(left.length)] });
    const mono = await decodeToMono16k(new Blob([wav]));
    expect(mono.length).toBe(32_000);
    expect(rms(mono, 100, mono.length - 100)).toBeCloseTo(0.25 / Math.SQRT2, 2);
  });

  it("reports empty, unsupported and too long input by kind", async () => {
    expect(await kindOf(decodeToMono16k(new ArrayBuffer(0)))).toBe("empty");
    expect(await kindOf(decodeToMono16k(new Blob(["not audio at all"])))).toBe(
      "unsupported_format",
    );
    const tenSeconds = buildWav({ sampleRate: 16_000, channels: [new Float32Array(160_000)] });
    expect(await kindOf(decodeToMono16k(tenSeconds.buffer, { maxMs: 5_000 }))).toBe("too_long");
    const noFrames = buildWav({ sampleRate: 16_000, channels: [new Float32Array(0)] });
    expect(await kindOf(decodeToMono16k(noFrames.buffer))).toBe("empty");
  });
});

describe("decodeToMono16k with Web Audio", () => {
  afterEach(() => vi.unstubAllGlobals());

  type FakeBuffer = {
    length: number;
    sampleRate: number;
    numberOfChannels: number;
    getChannelData(c: number): Float32Array;
  };

  function stubContext(decode: (rate: number) => FakeBuffer | Error, refuse16k = false) {
    const rates: number[] = [];
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        sampleRate: number;
        constructor(_channels: number, _length: number, sampleRate: number) {
          if (refuse16k && sampleRate === 16_000)
            throw new DOMException("rate", "NotSupportedError");
          this.sampleRate = sampleRate;
          rates.push(sampleRate);
        }
        decodeAudioData() {
          const result = decode(this.sampleRate);
          return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
        }
      },
    );
    return rates;
  }

  function fakeBuffer(channels: Float32Array[], sampleRate: number): FakeBuffer {
    return {
      length: channels[0]!.length,
      sampleRate,
      numberOfChannels: channels.length,
      getChannelData: (c) => channels[c]!,
    };
  }

  it("lets the browser resample to 16 kHz and mixes stereo into channel 0's storage", async () => {
    const left = Float32Array.of(1, 1, 1, 1);
    const right = Float32Array.of(0, 0, 0, 1);
    const rates = stubContext(() => fakeBuffer([left, right], 16_000));
    const mono = await decodeToMono16k(new Blob(["OggS...."]));
    expect(rates).toEqual([16_000]);
    expect(mono).toBe(left); // no extra full length copy
    expect(Array.from(mono)).toEqual([0.5, 0.5, 0.5, 1]);
  });

  it("falls back to a 48 kHz context and resamples itself when 16 kHz is refused", async () => {
    const rates = stubContext((rate) => fakeBuffer([sine(200, 1_000, rate)], rate), true);
    const mono = await decodeToMono16k(new Blob(["OggS...."]));
    expect(rates).toEqual([48_000]);
    expect(mono.length).toBe(16_000);
  });

  it("calls a known container that fails 'decode_failed' and an unknown one 'unsupported_format'", async () => {
    stubContext(() => new DOMException("bad", "EncodingError"));
    const m4a = Uint8Array.from([0, 0, 0, 0x20, ...[..."ftypM4A "].map((c) => c.charCodeAt(0))]);
    expect(await kindOf(decodeToMono16k(new Blob([m4a])))).toBe("decode_failed");
    expect(await kindOf(decodeToMono16k(new Blob(["#!AMR\n...."])))).toBe("unsupported_format");
    expect(await kindOf(decodeToMono16k(new Blob(["mystery bytes"])))).toBe("unsupported_format");
  });

  it("refuses a recording over the limit before mixing it", async () => {
    stubContext(() => fakeBuffer([new Float32Array(16_000 * 61)], 16_000));
    expect(await kindOf(decodeToMono16k(new Blob(["OggS"]), { maxMs: 60_000 }))).toBe("too_long");
  });
});
