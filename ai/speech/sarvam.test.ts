import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCallRow } from "../log";
import {
  concatMp3,
  concatWav,
  mp3FrameAt,
  parseWav,
  stripMp3Prelude,
  wavDurationMs,
} from "./audio";
import { speechCostUsd } from "./cost";
import { lineSpeaker, speak, splitForSpeech, transcribeChunk, toTranscript } from "./sarvam";
import { testToneWav } from "./test-tone";

const rows: AiCallRow[] = [];
vi.mock("../log", () => ({ logAiCall: async (r: AiCallRow) => void rows.push(r) }));

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

function mockFetch(...responses: Array<() => Response>) {
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return responses[Math.min(i++, responses.length - 1)]!();
    }),
  );
}

const json =
  (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });

beforeEach(() => {
  rows.length = 0;
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("transcribeChunk without a key (fixture mode)", () => {
  beforeEach(() => vi.stubEnv("SARVAM_API_KEY", ""));

  it("serves the recorded fixture whose audio hash matches, clamped to the chunk", async () => {
    const out = await transcribeChunk(testToneWav(2000));
    expect(out.text).toBe("ನಮಸ್ಕಾರ. ಇದು ಪರಂಪರೆಯ ಪರೀಕ್ಷಾ ಧ್ವನಿ.");
    expect(out.phrases).toEqual([
      { startMs: 0, endMs: 700, text: "ನಮಸ್ಕಾರ." },
      { startMs: 800, endMs: 2000, text: "ಇದು ಪರಂಪರೆಯ ಪರೀಕ್ಷಾ ಧ್ವನಿ." },
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ role: "transcribe", status: "replayed", costUsd: 0 }),
    ]);
    expect(out.span).toMatchObject({
      role: "transcribe",
      model: "saaras:v4",
      tokensIn: 2,
      costUsd: 0,
      replayed: true,
    });
  });

  it("throws SpeechNotConfigured for any other audio", async () => {
    await expect(transcribeChunk(testToneWav(1000))).rejects.toMatchObject({
      name: "SpeechNotConfigured",
    });
  });
});

describe("transcribeChunk with a key", () => {
  beforeEach(() => vi.stubEnv("SARVAM_API_KEY", "test-key"));

  it("posts the chunk to Saaras v4 in Kannada with timestamps and returns phrases in ms", async () => {
    mockFetch(
      json({
        request_id: "r1",
        transcript: "ಒಂದು ಮಗು ಇತ್ತು. ಓದೋಕೆ ಬರ್ತಿರ್ಲಿಲ್ಲ.",
        language_code: "kn-IN",
        timestamps: {
          words: ["ಒಂದು ಮಗು ಇತ್ತು.", "ಓದೋಕೆ ಬರ್ತಿರ್ಲಿಲ್ಲ."],
          start_time_seconds: [0.12, 1.5],
          end_time_seconds: [1.4, 2.95],
        },
      }),
    );
    const out = await transcribeChunk(testToneWav(3000), {
      traceId: "00000000-0000-4000-8000-000000000001",
    });
    // Billed per second: 3 s at ₹0.49 a minute (ai/speech/cost.ts).
    expect(out.span).toMatchObject({
      role: "transcribe",
      model: "saaras:v4",
      tokensIn: 3,
      costUsd: speechCostUsd("saaras:v4", 3),
      attempts: 1,
    });
    expect(out.span.costUsd).toBeGreaterThan(0);
    expect({ ...out, span: undefined }).toEqual({
      span: undefined,
      text: "ಒಂದು ಮಗು ಇತ್ತು. ಓದೋಕೆ ಬರ್ತಿರ್ಲಿಲ್ಲ.",
      languageCode: "kn-IN",
      requestId: "r1",
      phrases: [
        { startMs: 120, endMs: 1400, text: "ಒಂದು ಮಗು ಇತ್ತು." },
        { startMs: 1500, endMs: 2950, text: "ಓದೋಕೆ ಬರ್ತಿರ್ಲಿಲ್ಲ." },
      ],
    });
    const { url, init } = calls[0]!;
    expect(url).toBe("https://api.sarvam.ai/speech-to-text");
    expect((init.headers as Record<string, string>)["api-subscription-key"]).toBe("test-key");
    const form = init.body as FormData;
    expect(form.get("model")).toBe("saaras:v4");
    expect(form.get("language_code")).toBe("kn-IN");
    expect(form.get("with_timestamps")).toBe("true");
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(rows).toEqual([
      expect.objectContaining({
        role: "transcribe",
        model: "saaras:v4",
        status: "ok",
        tokensIn: 3,
        costUsd: speechCostUsd("saaras:v4", 3),
      }),
    ]);
  });

  it("falls back to one phrase spanning the chunk when timestamps are missing or mismatched", async () => {
    mockFetch(
      json({ transcript: "ಹೌದು ಸರ್", language_code: "kn-IN" }),
      json({
        transcript: "ಹೌದು ಸರ್",
        timestamps: { words: ["ಹೌದು", "ಸರ್"], start_time_seconds: [0], end_time_seconds: [1, 2] },
      }),
    );
    for (let i = 0; i < 2; i++) {
      const out = await transcribeChunk(testToneWav(2500));
      expect(out.phrases).toEqual([{ startMs: 0, endMs: 2500, text: "ಹೌದು ಸರ್" }]);
    }
  });

  it("returns no phrases for silence", async () => {
    mockFetch(json({ transcript: "  ", timestamps: null }));
    expect((await transcribeChunk(testToneWav(1500))).phrases).toEqual([]);
  });

  it("refuses a chunk over the 30 s limit before calling Sarvam", async () => {
    mockFetch(json({ transcript: "x" }));
    await expect(transcribeChunk(testToneWav(31_000))).rejects.toMatchObject({
      name: "SpeechFailed",
      code: "chunk_too_long",
    });
    expect(calls).toHaveLength(0);
  });

  it("maps 429 to SpeechRateLimited with the server's retry delay", async () => {
    mockFetch(json({ error: "slow down" }, 429, { "retry-after": "3" }));
    await expect(transcribeChunk(testToneWav(1000))).rejects.toMatchObject({
      name: "SpeechRateLimited",
      retryAfterMs: 3000,
    });
    expect(rows[0]).toMatchObject({ status: "error", error: "http_429" });
  });

  it("maps a rejected key to SpeechNotConfigured and other failures to SpeechFailed", async () => {
    mockFetch(json({}, 403), json({}, 500), json({ unexpected: true }));
    await expect(transcribeChunk(testToneWav(1000))).rejects.toMatchObject({
      name: "SpeechNotConfigured",
    });
    await expect(transcribeChunk(testToneWav(1000))).rejects.toMatchObject({
      name: "SpeechFailed",
      code: "http_500",
    });
    await expect(transcribeChunk(testToneWav(1000))).rejects.toMatchObject({
      name: "SpeechFailed",
      code: "bad_response",
    });
  });

  it("maps a network failure to SpeechFailed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("fetch failed"))),
    );
    await expect(transcribeChunk(testToneWav(1000))).rejects.toMatchObject({
      name: "SpeechFailed",
      code: "network",
    });
  });
});

describe("toTranscript", () => {
  it("drops empty phrases and keeps end after start", () => {
    const out = toTranscript(
      {
        transcript: "a b",
        timestamps: {
          words: ["a", " ", "b"],
          start_time_seconds: [0, 1, 2],
          end_time_seconds: [0.5, 1.5, 1.9],
        },
      },
      null,
      "kn-IN",
    );
    expect(out.phrases).toEqual([
      { startMs: 0, endMs: 500, text: "a" },
      { startMs: 2000, endMs: 2000, text: "b" },
    ]);
  });
});

describe("splitForSpeech", () => {
  it("keeps short text whole and cuts long text at sentence ends", () => {
    expect(splitForSpeech("ಒಂದು. ಎರಡು.", 2500)).toEqual(["ಒಂದು. ಎರಡು."]);
    const s = "ಮಕ್ಕಳಿಗೆ ಒಂದೇ ಅಕ್ಷರ ತೋರಿಸಿ. ";
    const pieces = splitForSpeech(s.repeat(200), 2500);
    expect(pieces.length).toBeGreaterThan(1);
    for (const p of pieces) {
      expect(p.length).toBeLessThanOrEqual(2500);
      expect(p.endsWith(".")).toBe(true);
    }
    expect(pieces.join(" ").replace(/\s+/g, " ")).toBe(s.repeat(200).trim());
  });

  it("treats ।, ? and line breaks as sentence ends and hard splits a run on sentence", () => {
    expect(splitForSpeech("ಮೊದಲ ಹೆಜ್ಜೆ\nಎರಡನೇ ಹೆಜ್ಜೆ। ಸರಿನಾ?", 14)).toEqual([
      "ಮೊದಲ ಹೆಜ್ಜೆ",
      "ಎರಡನೇ ಹೆಜ್ಜೆ।",
      "ಸರಿನಾ?",
    ]);
    const pieces = splitForSpeech("ಪದ ".repeat(50), 20);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(20);
  });

  it("returns nothing for blank text", () => {
    expect(splitForSpeech("  \n ", 100)).toEqual([]);
  });
});

function b64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

// MPEG1 Layer III, 128 kbps, 44.1 kHz, stereo: 417 byte frames.
function mp3Frame(fill: number, xing = false) {
  const f = new Uint8Array(417).fill(fill);
  f.set([0xff, 0xfb, 0x90, 0x00], 0);
  if (xing) {
    f.fill(0, 4, 36);
    f.set(
      [..."Xing"].map((c) => c.charCodeAt(0)),
      36,
    );
  }
  return f;
}
const id3 = () =>
  new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 10, ...new Array(10).fill(7)]);
const join = (...p: Uint8Array[]) => new Uint8Array(p.flatMap((x) => [...x]));

describe("audio helpers", () => {
  it("reads WAV duration and joins WAV parts under one header", () => {
    const a = testToneWav(1000);
    const b = testToneWav(500);
    expect(wavDurationMs(a)).toBe(1000);
    const joined = concatWav([a, b]);
    expect(wavDurationMs(joined)).toBe(1500);
    expect(parseWav(joined)!.data.length).toBe(parseWav(a)!.data.length + parseWav(b)!.data.length);
  });

  it("reads MP3 frame lengths and strips ID3 and Xing preludes before joining", () => {
    expect(mp3FrameAt(mp3Frame(1), 0)).toEqual({ length: 417, sideInfo: 32 });
    const part = join(id3(), mp3Frame(0, true), mp3Frame(1), mp3Frame(2));
    expect(stripMp3Prelude(part)).toEqual(join(mp3Frame(1), mp3Frame(2)));
    expect(concatMp3([part, part])).toEqual(
      join(mp3Frame(1), mp3Frame(2), mp3Frame(1), mp3Frame(2)),
    );
    expect(concatMp3([part])).toBe(part);
  });
});

describe("speak", () => {
  it("throws SpeechNotConfigured without a key", async () => {
    vi.stubEnv("SARVAM_API_KEY", "");
    await expect(speak("ನಮಸ್ಕಾರ")).rejects.toMatchObject({ name: "SpeechNotConfigured" });
  });

  it("calls Bulbul once per piece and joins WAV parts", async () => {
    vi.stubEnv("SARVAM_API_KEY", "test-key");
    mockFetch(
      json({ audios: [b64(testToneWav(1000))] }),
      json({ audios: [b64(testToneWav(500))] }),
    );
    const long = "ಮಕ್ಕಳಿಗೆ ಒಂದೇ ಅಕ್ಷರ ತೋರಿಸಿ. ".repeat(120);
    const out = await speak(long, { codec: "wav", voice: "shubh", pace: 5 });
    expect(out.mime).toBe("audio/wav");
    expect(wavDurationMs(out.audio)).toBe(1500);
    expect(calls).toHaveLength(2);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({
      target_language_code: "kn-IN",
      model: "bulbul:v3",
      speaker: "shubh",
      pace: 2,
      output_audio_codec: "wav",
    });
    expect(body.text.length).toBeLessThanOrEqual(2500);
    expect(rows.map((r) => r.role)).toEqual(["speak", "speak"]);
    expect(rows[0]!.tokensIn).toBe(body.text.length);
    // Billed per character sent, each piece on its own row; the span is the whole text.
    expect(rows[0]!.costUsd).toBe(speechCostUsd("bulbul:v3", body.text.length));
    const chars = rows.reduce((n, r) => n + r.tokensIn, 0);
    expect(out.span).toMatchObject({
      role: "speak",
      attempts: 2,
      costUsd: speechCostUsd("bulbul:v3", chars),
    });
  });

  it("defaults to mp3 and joins frames", async () => {
    vi.stubEnv("SARVAM_API_KEY", "test-key");
    const part = join(id3(), mp3Frame(1));
    mockFetch(json({ audios: [b64(part)] }));
    const out = await speak("ನಮಸ್ಕಾರ ಮೇಡಂ.");
    expect(out).toMatchObject({
      audio: part,
      mime: "audio/mpeg",
      span: { role: "speak", model: "bulbul:v3", costUsd: speechCostUsd("bulbul:v3", 13) },
    });
  });

  it("rejects a voice the model does not have", async () => {
    vi.stubEnv("SARVAM_API_KEY", "test-key");
    await expect(speak("ನಮಸ್ಕಾರ", { voice: "chaitra_kn_conversation" })).rejects.toMatchObject({
      code: "unknown_voice",
    });
    mockFetch(json({ audios: [b64(join(mp3Frame(1)))] }));
    await expect(
      speak("ನಮಸ್ಕಾರ", { model: "bulbul:v4-flash", voice: "chaitra_kn_conversation" }),
    ).resolves.toMatchObject({ mime: "audio/mpeg" });
  });
});

describe("lineSpeaker (D86: the voice starts before the text is final)", () => {
  // Each line answers with a tone as long as its own number, so the joined order can be read back.
  function toneByText(ms: Record<string, number>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const text = JSON.parse(String(init.body)).text as string;
        return json({ audios: [b64(testToneWav(ms[text] ?? 50))] })();
      }),
    );
  }

  it("speaks a line once, reuses it, and joins the lines in the order asked", async () => {
    vi.stubEnv("SARVAM_API_KEY", "test-key");
    toneByText({ "ಶೀರ್ಷಿಕೆ.": 100, "1. ಮೊದಲು.": 200, "2. ನಂತರ.": 400 });
    const voice = lineSpeaker({ codec: "wav" });
    voice.start("1. ಮೊದಲು.");
    voice.start("1. ಮೊದಲು.");
    voice.start("ಶೀರ್ಷಿಕೆ.");
    const out = await voice.build(["ಶೀರ್ಷಿಕೆ.", "1. ಮೊದಲು.", "2. ನಂತರ."]);
    expect(calls).toHaveLength(3);
    expect(wavDurationMs(out.audio)).toBe(700);
    expect(out.mime).toBe("audio/wav");
    expect(rows.map((r) => r.role)).toEqual(["speak", "speak", "speak"]);
  });

  it("a line started but never asked for is billed but not joined; a failed line fails the build", async () => {
    vi.stubEnv("SARVAM_API_KEY", "test-key");
    toneByText({ "ಒಂದು.": 100, "ಎರಡು.": 300 });
    const voice = lineSpeaker({ codec: "wav" });
    voice.start("ಎರಡು.");
    const out = await voice.build(["ಒಂದು."]);
    expect(wavDurationMs(out.audio)).toBe(100);
    mockFetch(json({ error: "busy" }, 500));
    await expect(lineSpeaker().build(["ಮೂರು."])).rejects.toMatchObject({ name: "SpeechFailed" });
  });

  it("needs a key, like speak", () => {
    vi.stubEnv("SARVAM_API_KEY", "");
    expect(() => lineSpeaker()).toThrow(/not configured/);
  });
});

describe("speech and the budget caps (Law 10)", () => {
  it("refuses a call that would cross the total cap, before calling Sarvam, and logs nothing paid", async () => {
    vi.stubEnv("SARVAM_API_KEY", "test-key");
    vi.stubEnv("AI_BUDGET_USD_CAP", "0.000001");
    mockFetch(json({ audios: [b64(testToneWav(500))] }));
    await expect(speak("ನಮಸ್ಕಾರ ಮೇಡಂ.")).rejects.toMatchObject({
      name: "SpeechFailed",
      code: "budget",
    });
    await expect(transcribeChunk(testToneWav(3000))).rejects.toMatchObject({
      name: "SpeechFailed",
      code: "budget",
    });
    expect(calls).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });

  it("a failed call costs nothing", async () => {
    vi.stubEnv("SARVAM_API_KEY", "test-key");
    mockFetch(json({ error: "busy" }, 500));
    await expect(transcribeChunk(testToneWav(3000))).rejects.toMatchObject({
      name: "SpeechFailed",
    });
    expect(rows).toEqual([
      expect.objectContaining({ role: "transcribe", status: "error", costUsd: 0 }),
    ]);
  });
});
