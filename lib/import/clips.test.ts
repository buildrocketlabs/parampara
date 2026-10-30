import { describe, expect, it } from "vitest";
import { wavDurationMs } from "@/lib/audio/wav";
import { cutClip } from "./clips";

describe("quote clips (safety audit, 24 Oct)", () => {
  const wav = { sampleRate: 16_000, samples: new Float32Array(16_000 * 25).fill(0.1) };

  it("cuts exactly the quoted seconds out of the chunk, on the interview timeline", () => {
    // Chunk starts at 50 s of the interview; the quote is 57.5 s to 61 s.
    const clip = cutClip(wav, 50_000, 57_500, 61_000)!;
    expect(wavDurationMs(clip)).toBe(3_500);
  });

  it("never reaches past the chunk and skips slivers", () => {
    expect(wavDurationMs(cutClip(wav, 0, 24_000, 40_000)!)).toBe(1_000);
    expect(cutClip(wav, 0, 1_000, 1_200)).toBeNull();
  });
});
