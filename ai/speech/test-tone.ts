import { encodeWav } from "./audio";

/**
 * A deterministic 16 kHz mono 16 bit sawtooth, integer maths only, so its sha256 is the same on
 * every machine. Tests and the speech fixture in fixtures/ are keyed to it.
 */
export function testToneWav(ms: number): Uint8Array {
  const sampleRate = 16_000;
  const samples = Math.round((sampleRate * ms) / 1000);
  const pcm = new Uint8Array(samples * 2);
  const view = new DataView(pcm.buffer);
  for (let i = 0; i < samples; i++) view.setInt16(i * 2, (i % 80) * 100 - 4_000, true);
  return encodeWav(
    { audioFormat: 1, channels: 1, sampleRate, bitsPerSample: 16, byteRate: sampleRate * 2, blockAlign: 2 },
    pcm,
  );
}
