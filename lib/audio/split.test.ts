import { describe, expect, it } from "vitest";
import { planChunks, type PlannedChunk } from "./split";
import { synth, talk } from "./test-audio";

const RATE = 16_000;
const MAX = 29 * RATE;

function expectContiguous(chunks: PlannedChunk[], length: number) {
  expect(chunks[0]?.startSample).toBe(0);
  expect(chunks.at(-1)?.endSample).toBe(length);
  chunks.forEach((c, i) => {
    expect(c.idx).toBe(i);
    if (i > 0) expect(c.startSample).toBe(chunks[i - 1]!.endSample);
  });
  expect(chunks.reduce((sum, c) => sum + (c.endSample - c.startSample), 0)).toBe(length);
}

describe("planChunks on five minutes of talk", () => {
  const { samples, silences } = synth(talk(5 * 60_000));
  const chunks = planChunks(samples, RATE);

  it("covers every sample once, in order, with no gap", () => {
    expectContiguous(chunks, samples.length);
  });

  it("never exceeds the hard max and only the last chunk is under the min", () => {
    for (const c of chunks) expect(c.endSample - c.startSample).toBeLessThanOrEqual(MAX);
    for (const c of chunks.slice(0, -1))
      expect(c.endSample - c.startSample).toBeGreaterThanOrEqual(12 * RATE);
  });

  it("cuts inside pauses, clear of the words on either side", () => {
    const margin = 0.01 * RATE;
    for (const c of chunks.slice(1)) {
      const pause = silences.find(
        ([from, to]) => c.startSample >= from + margin && c.startSample <= to - margin,
      );
      expect(pause, `cut at ${c.startMs} ms`).toBeDefined();
    }
  });

  it("gives exact millisecond offsets, whole numbers at every cut", () => {
    for (const c of chunks) {
      expect(c.startMs).toBe((c.startSample * 1000) / RATE);
      expect(c.endMs).toBe((c.endSample * 1000) / RATE);
      expect(Number.isInteger(c.startMs)).toBe(true);
    }
  });

  it("is deterministic and flags none of it silent", () => {
    expect(planChunks(samples, RATE)).toEqual(chunks);
    expect(chunks.some((c) => c.silent)).toBe(false);
  });
});

describe("planChunks", () => {
  it("prefers the pause nearest the target when two are equally quiet", () => {
    const { samples, silences } = synth([
      { voiceMs: 13_000 },
      { silenceMs: 500 },
      { voiceMs: 10_500 },
      { silenceMs: 600 },
      { voiceMs: 20_000 },
    ]);
    const [, second] = planChunks(samples, RATE);
    const [from, to] = silences[1]!;
    expect(second!.startSample).toBeGreaterThan(from);
    expect(second!.startSample).toBeLessThan(to);
  });

  it("still never exceeds the max when there is no pause at all", () => {
    const { samples } = synth([{ voiceMs: 70_000 }]);
    const chunks = planChunks(samples, RATE);
    expectContiguous(chunks, samples.length);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const c of chunks) expect(c.endSample - c.startSample).toBeLessThanOrEqual(MAX);
  });

  it("flags chunks that are only hiss as silent, and never a chunk with voice", () => {
    const { samples } = synth([{ voiceMs: 20_000 }, { silenceMs: 70_000 }, { voiceMs: 20_000 }]);
    const chunks = planChunks(samples, RATE);
    expect(chunks.filter((c) => c.silent).length).toBeGreaterThanOrEqual(2);
    for (const c of chunks) {
      const hasVoice = c.startMs < 20_000 || c.endMs > 90_000;
      expect(c.silent, `${c.startMs} to ${c.endMs}`).toBe(!hasVoice);
      expect(c.rms).toBeGreaterThan(0);
    }
  });

  it("keeps a single quiet word (the server must hear it) but calls a click silent", () => {
    const word = synth([
      { silenceMs: 20_000 },
      { voiceMs: 300, amplitude: 0.03 },
      { silenceMs: 5_000 },
    ]);
    expect(planChunks(word.samples, RATE).map((c) => c.silent)).toEqual([false]);

    const click = synth([
      { silenceMs: 20_000 },
      { voiceMs: 40, amplitude: 0.5 },
      { silenceMs: 5_000 },
    ]);
    expect(planChunks(click.samples, RATE).map((c) => c.silent)).toEqual([true]);
  });

  it("handles digital silence, short and empty input", () => {
    const zeros = planChunks(new Float32Array(60 * RATE), RATE);
    expectContiguous(zeros, 60 * RATE);
    expect(zeros.every((c) => c.silent && c.endSample - c.startSample <= MAX)).toBe(true);

    const short = planChunks(synth([{ voiceMs: 4_000 }]).samples, RATE);
    expect(short).toHaveLength(1);
    expect(short[0]).toMatchObject({ startMs: 0, endMs: 4_000, silent: false });

    expect(planChunks(new Float32Array(0), RATE)).toEqual([]);
  });

  it("honours a custom max and rejects impossible options", () => {
    const { samples } = synth(talk(60_000));
    const chunks = planChunks(samples, RATE, { minMs: 4_000, targetMs: 8_000, maxMs: 10_000 });
    for (const c of chunks) expect(c.endMs - c.startMs).toBeLessThanOrEqual(10_000);
    expect(() => planChunks(samples, RATE, { minMs: 20_000, maxMs: 10_000 })).toThrow(RangeError);
  });
});
