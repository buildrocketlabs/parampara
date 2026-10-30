import { describe, expect, it } from "vitest";
import { AudioPrepError } from "./errors";
import { prepareAudio, type PrepareStage } from "./prepare";
import { buildWav, synth, talk } from "./test-audio";
import { encodeWav16, parseWav, wavDurationMs } from "./wav";

function wavBlob(samples: Float32Array, sampleRate = 16_000): Blob {
  return new Blob([encodeWav16(samples, sampleRate)], { type: "audio/wav" });
}

async function failure(promise: Promise<unknown>): Promise<AudioPrepError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AudioPrepError) return err;
    throw err;
  }
  throw new Error("expected prepareAudio to fail");
}

describe("prepareAudio", () => {
  it("turns one recording into contiguous 16 kHz WAV chunks that rebuild it exactly", async () => {
    const source = encodeWav16(synth(talk(70_000)).samples, 16_000);
    const expected = parseWav(source).samples;
    const { durationMs, chunks, parts, sampleRate } = await prepareAudio([new Blob([source])]);

    expect(sampleRate).toBe(16_000);
    expect(durationMs).toBe(expected.length / 16);
    expect(parts).toEqual([{ startMs: 0, endMs: durationMs }]);
    expect(chunks[0]?.startMs).toBe(0);
    expect(chunks.at(-1)?.endMs).toBe(durationMs);

    const rebuilt = new Float32Array(expected.length);
    chunks.forEach((c, i) => {
      expect(c).toMatchObject({ idx: i, part: 0 });
      if (i > 0) expect(c.startMs).toBe(chunks[i - 1]!.endMs);
      expect(Number.isInteger(c.startMs) && Number.isInteger(c.endMs)).toBe(true);
      expect(wavDurationMs(c.wav)).toBe(c.endMs - c.startMs);
      expect(wavDurationMs(c.wav)).toBeLessThanOrEqual(29_000);
      const wav = parseWav(c.wav);
      expect(wav).toMatchObject({ sampleRate: 16_000, channels: 1 });
      rebuilt.set(wav.samples, c.startMs * 16);
    });
    let mismatches = 0;
    for (let i = 0; i < expected.length; i++) if (rebuilt[i] !== expected[i]) mismatches++;
    expect(mismatches).toBe(0);
  });

  it("lays parts end to end: offsets continue and a part boundary is a chunk boundary", async () => {
    const first = synth(talk(40_000, 1)).samples.subarray(0, 40_000 * 16 + 7); // 7 sample tail
    const second = synth(talk(20_000, 2)).samples.subarray(0, 20_000 * 16);
    const { durationMs, chunks, parts } = await prepareAudio([wavBlob(first), wavBlob(second)]);

    expect(parts).toEqual([
      { startMs: 0, endMs: 40_000 }, // the sub millisecond tail is dropped
      { startMs: 40_000, endMs: 60_000 },
    ]);
    expect(durationMs).toBe(60_000);
    expect(chunks.map((c) => c.idx)).toEqual(chunks.map((_, i) => i));
    const firstOfSecond = chunks.findIndex((c) => c.part === 1);
    expect(chunks[firstOfSecond]!.startMs).toBe(40_000);
    expect(chunks[firstOfSecond - 1]!.endMs).toBe(40_000);
    expect(chunks.at(-1)!.endMs).toBe(60_000);
  });

  it("resamples a part recorded at another rate onto the same 16 kHz timeline", async () => {
    const eightK = synth([{ voiceMs: 10_000 }], { sampleRate: 8_000 }).samples;
    const stereo = buildWav({ sampleRate: 8_000, channels: [eightK, eightK] });
    const { durationMs, chunks } = await prepareAudio([new Blob([stereo])]);
    expect(durationMs).toBe(10_000);
    expect(parseWav(chunks[0]!.wav).sampleRate).toBe(16_000);
  });

  it("reports stages in order and yields to the event loop while working", async () => {
    let timerRan = false;
    setTimeout(() => (timerRan = true), 0);
    const calls: Array<[PrepareStage, number, number]> = [];
    let timerRanBySplitting = false;
    const parts = [wavBlob(synth(talk(30_000)).samples), wavBlob(synth(talk(5_000)).samples)];
    const { chunks } = await prepareAudio(parts, {
      onStage: (stage, done, total) => {
        calls.push([stage, done, total]);
        if (stage === "splitting") timerRanBySplitting ||= timerRan;
      },
    });

    expect(timerRanBySplitting).toBe(true);
    expect(calls[0]).toEqual(["decoding", 0, 2]);
    expect(calls).toContainEqual(["splitting", 1, 2]);
    expect(calls.at(-1)).toEqual(["encoding", chunks.length, chunks.length]);
  });

  it("refuses too long, empty and unreadable input, naming the part", async () => {
    const twentySeconds = wavBlob(synth([{ voiceMs: 20_000 }]).samples);
    const long = await failure(
      prepareAudio([twentySeconds, twentySeconds], { maxTotalMs: 30_000 }),
    );
    expect(long).toMatchObject({ kind: "too_long", part: 1 });

    expect(await failure(prepareAudio([]))).toMatchObject({ kind: "empty" });
    expect(await failure(prepareAudio([twentySeconds, new Blob([])]))).toMatchObject({
      kind: "empty",
      part: 1,
    });
    expect(await failure(prepareAudio([new Blob(["voice note?"])]))).toMatchObject({
      kind: "unsupported_format",
      part: 0,
    });
  });
});
