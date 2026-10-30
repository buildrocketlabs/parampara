import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeToMono16k } from "./decode";
import { AudioPrepError } from "./errors";
import { demuxOggOpus, opusPacketSamples } from "./ogg-opus";

// Ogg pages built by hand (RFC 3533): the CRC is not checked by the reader, so it is left zero.
function page(opts: {
  serial?: number;
  continued?: boolean;
  bos?: boolean;
  granule: number;
  /** Packets that end on this page, plus an optional unfinished tail carried to the next page. */
  packets: Uint8Array[];
  tail?: Uint8Array;
}): Uint8Array {
  const lacing: number[] = [];
  const body: Uint8Array[] = [];
  for (const p of opts.packets) {
    let left = p.length;
    while (left >= 255) {
      lacing.push(255);
      left -= 255;
    }
    lacing.push(left);
    body.push(p);
  }
  if (opts.tail) {
    for (let i = 0; i < opts.tail.length / 255; i++) lacing.push(255);
    body.push(opts.tail);
  }
  const header = new Uint8Array(27 + lacing.length);
  header.set([0x4f, 0x67, 0x67, 0x53], 0);
  header[5] = (opts.continued ? 1 : 0) | (opts.bos ? 2 : 0);
  const view = new DataView(header.buffer);
  if (opts.granule < 0) {
    view.setUint32(6, 0xffffffff, true);
    view.setInt32(10, -1, true);
  } else {
    view.setUint32(6, opts.granule % 2 ** 32, true);
    view.setUint32(10, Math.floor(opts.granule / 2 ** 32), true);
  }
  view.setUint32(14, opts.serial ?? 7, true);
  header[26] = lacing.length;
  header.set(lacing, 27);
  return concat([header, ...body]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const text = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));

function opusHead(channels = 1, preSkip = 312): Uint8Array {
  const h = new Uint8Array(19);
  h.set(text("OpusHead"), 0);
  h[8] = 1;
  h[9] = channels;
  h[10] = preSkip & 0xff;
  h[11] = preSkip >> 8;
  new DataView(h.buffer).setUint32(12, 48_000, true);
  return h;
}

/** A 20 ms CELT packet (TOC config 31, one frame) of the given length, filled with `fill`. */
function packet20ms(length: number, fill = 1): Uint8Array {
  const p = new Uint8Array(length).fill(fill);
  p[0] = 31 << 3;
  return p;
}

/** A small mono voice note: 50 packets of 20 ms (one second), one of them across two pages. */
function voiceNote(): Uint8Array {
  const packets = Array.from({ length: 50 }, (_, i) => packet20ms(i === 10 ? 400 : 60, i + 1));
  const long = packets[10]!;
  return concat([
    page({ bos: true, granule: 0, packets: [opusHead()] }),
    page({ granule: 0, packets: [concat([text("OpusTags"), new Uint8Array(8)])] }),
    page({ granule: -1, packets: packets.slice(0, 10), tail: long.subarray(0, 255) }),
    page({
      continued: true,
      granule: 48_000, // 50 packets of 960, of which 312 are the pre skip
      packets: [long.subarray(255), ...packets.slice(11)],
    }),
    // Another logical stream (a second track) must be ignored.
    page({ serial: 99, bos: true, granule: 0, packets: [text("junk")] }),
  ]);
}

describe("demuxOggOpus", () => {
  it("reads the head, every packet in order (also across pages) and the real length", () => {
    const ogg = demuxOggOpus(voiceNote());
    expect(ogg.channels).toBe(1);
    expect(ogg.preSkip).toBe(312);
    expect(ogg.packets).toHaveLength(50);
    expect(ogg.packets[10]!.data.length).toBe(400);
    expect(ogg.packets[10]!.data[399]).toBe(11);
    expect(ogg.packets[49]!.data[1]).toBe(50);
    expect(ogg.packets.every((p) => p.samples === 960)).toBe(true);
    expect(ogg.totalSamples).toBe(48_000 - 312);
  });

  it("refuses what is not Ogg Opus", () => {
    expect(() => demuxOggOpus(text("not an ogg file at all, sorry"))).toThrow(AudioPrepError);
    const vorbis = page({ bos: true, granule: 0, packets: [text("\x01vorbis and so on....")] });
    expect(() => demuxOggOpus(vorbis)).toThrow(/does not hold Opus/);
  });

  it("stops cleanly at a cut off file", () => {
    const whole = voiceNote();
    const ogg = demuxOggOpus(whole.subarray(0, whole.length - 900));
    expect(ogg.packets.length).toBeGreaterThan(0);
    expect(ogg.packets.length).toBeLessThan(50);
  });
});

// A real voice note shape from ffmpeg's libopus (as WhatsApp sends: mono, VoIP, 24 kb/s), when
// ffmpeg is on this machine. CI without ffmpeg skips it; the hand built pages above always run.
const ffmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!ffmpeg)("demuxOggOpus on a file libopus wrote", () => {
  it("finds every packet and the exact length of a 7.5 s note", () => {
    const dir = mkdtempSync(join(tmpdir(), "pp-ogg-"));
    const file = join(dir, "PTT-20261028-WA0003.opus");
    execFileSync("ffmpeg", [
      ...["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=7.5"],
      ...["-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "24k", "-application", "voip"],
      file,
    ]);
    const ogg = demuxOggOpus(new Uint8Array(readFileSync(file)));
    expect(ogg.channels).toBe(1);
    expect(ogg.totalSamples).toBe(7.5 * 48_000);
    const decodedSamples = ogg.packets.reduce((n, p) => n + p.samples, 0);
    expect(decodedSamples).toBeGreaterThanOrEqual(ogg.totalSamples! + ogg.preSkip);
    expect(decodedSamples - ogg.totalSamples! - ogg.preSkip).toBeLessThan(960 * 2);
  });
});

describe("opusPacketSamples", () => {
  it("reads frame size and count from the TOC byte", () => {
    expect(opusPacketSamples(Uint8Array.of(0 << 3))).toBe(480); // SILK 10 ms
    expect(opusPacketSamples(Uint8Array.of((3 << 3) | 1))).toBe(2 * 2880); // SILK 60 ms, two
    expect(opusPacketSamples(Uint8Array.of(13 << 3))).toBe(960); // hybrid 20 ms
    expect(opusPacketSamples(Uint8Array.of(16 << 3))).toBe(120); // CELT 2.5 ms
    expect(opusPacketSamples(Uint8Array.of((31 << 3) | 3, 3))).toBe(3 * 960); // code 3, 3 frames
  });
});

describe("decodeToMono16k falls back to WebCodecs when Web Audio refuses Ogg (Safari)", () => {
  afterEach(() => vi.unstubAllGlobals());

  function refuseWebAudio() {
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        decodeAudioData(buffer: ArrayBuffer) {
          // Like Chrome and Safari: the buffer is detached even though decoding fails.
          structuredClone(buffer, { transfer: [buffer] });
          return Promise.reject(new DOMException("no", "EncodingError"));
        }
      },
    );
  }

  function fakeWebCodecs(supported = true) {
    const seen: number[] = [];
    class FakeChunk {
      data: Uint8Array;
      constructor(init: { data: Uint8Array }) {
        this.data = init.data;
      }
    }
    class FakeDecoder {
      state = "unconfigured";
      decodeQueueSize = 0;
      constructor(private init: { output: (d: unknown) => void; error: (e: unknown) => void }) {}
      static async isConfigSupported() {
        return { supported };
      }
      configure(config: { description: Uint8Array }) {
        expect(new TextDecoder().decode(config.description.subarray(0, 8))).toBe("OpusHead");
        this.state = "configured";
      }
      decode(chunk: FakeChunk) {
        const frames = opusPacketSamples(chunk.data);
        seen.push(frames);
        this.init.output({
          numberOfFrames: frames,
          numberOfChannels: 1,
          copyTo: (dest: Float32Array) => dest.fill(0.25),
          close: () => {},
        });
      }
      async flush() {}
      close() {
        this.state = "closed";
      }
    }
    vi.stubGlobal("AudioDecoder", FakeDecoder);
    vi.stubGlobal("EncodedAudioChunk", FakeChunk);
    return seen;
  }

  it("decodes the packets, drops the pre skip and lands on 16 kHz", async () => {
    refuseWebAudio();
    const seen = fakeWebCodecs();
    const mono = await decodeToMono16k(new Blob([voiceNote() as BlobPart]));
    expect(seen).toHaveLength(50);
    expect(mono.length).toBe(Math.round((48_000 - 312) / 3)); // pre skip dropped, at 16 kHz
    expect(mono[8_000]).toBeCloseTo(0.25, 5);
  });

  it("says 'unsupported' when the browser has no Opus decoder, so the page can name Chrome", async () => {
    refuseWebAudio();
    fakeWebCodecs(false);
    await expect(decodeToMono16k(new Blob([voiceNote() as BlobPart]))).rejects.toMatchObject({
      kind: "unsupported_format",
    });
  });

  it("refuses a note over the limit before decoding it", async () => {
    refuseWebAudio();
    const seen = fakeWebCodecs();
    await expect(
      decodeToMono16k(new Blob([voiceNote() as BlobPart]), { maxMs: 500 }),
    ).rejects.toMatchObject({ kind: "too_long" });
    expect(seen).toHaveLength(0);
  });

  it("calls a broken Ogg file broken, not unsupported", async () => {
    refuseWebAudio();
    fakeWebCodecs();
    await expect(decodeToMono16k(new Blob(["OggS but nothing else"]))).rejects.toMatchObject({
      kind: "decode_failed",
    });
  });
});
