import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { liveEvalsAllowed } from "@/ai/evals/recording";
import { parseWav } from "@/ai/speech/audio";
import { INR_PER_USD } from "@/ai/speech/cost";
import { FIXTURES_DIR, speak, transcribeChunk } from "@/ai/speech/sarvam";
import { createAdminClient } from "@/lib/supabase/admin";

// Speech really works: a round trip through Sarvam (D63). Bulbul speaks two short Kannada classroom
// sentences (no names) as 16 kHz WAV, Saaras transcribes them through transcribeChunk, and the
// transcript must carry most of the content words back. About ₹0.35 to speak 115 characters and
// ₹0.07 to transcribe some 8 seconds: under ₹1, checked from the logged costs.
//
// Without LIVE_EVALS it replays the recorded audio against the recorded transcript (a fixture in
// ai/speech/fixtures) and spends nothing, like the other suites. With the founder's approval:
//   pnpm evals:live speech
// runs this file alone (Vitest's file filter), calls only Sarvam, never Claude (the test empties
// ANTHROPIC_API_KEY for its run and fails on any request that is not to Sarvam or the database),
// records the audio and the transcript for later replays, and prints only marks and costs.

const SOURCE =
  "ಮಕ್ಕಳೇ, ಇವತ್ತು ಮರಳಿನಲ್ಲಿ ಒಂದು ಹೊಸ ಅಕ್ಷರ ಬರೆಯೋಣ. ಮೊದಲು ಅದರ ಶಬ್ದವನ್ನು ಜೋರಾಗಿ ಹೇಳಿ, ಆಮೇಲೆ ಬೆರಳಿನಿಂದ ನಿಧಾನವಾಗಿ ಬರೆಯಿರಿ.";

const DIR = join(process.cwd(), "evals", "speech");
const WAV_PATH = join(DIR, "roundtrip.wav");
const SUMMARY_PATH = join(DIR, "roundtrip.json");
const BUDGET_INR = 1;

// ── How close the transcript is ──────────────────────────────────────────────
// Content words are the source's words of three letters or more, without a few function words. A
// word counts as heard when the transcript has a word with the same first three letters: Saaras
// may write a spoken form (ಬರೆಯೋಣ / ಬರಿಯೋಣ), join or split words, or punctuate differently, and the
// stem survives all of that. The bar is 70 percent: synthetic speech in a quiet file should come
// back almost whole, while the wrong language, silence or noise shares next to nothing (a check
// below shows an unrelated sentence scoring far under it). It proves speech carries the meaning
// without failing on spelling that a teacher would read the same way.
export const OVERLAP_BAR = 0.7;
const FUNCTION_WORDS = new Set(["ಒಂದು", "ಅದರ", "ಮೊದಲು", "ಆಮೇಲೆ", "ನಾವು"]);

function words(text: string): string[] {
  return text
    .normalize("NFC")
    .replace(/[\p{P}\p{S}\d]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function contentOverlap(source: string, heard: string): { found: number; total: number; share: number } {
  const content = words(source).filter((w) => [...w].length >= 3 && !FUNCTION_WORDS.has(w));
  const stems = new Set(words(heard).map((w) => [...w].slice(0, 3).join("")));
  const found = content.filter((w) => stems.has([...w].slice(0, 3).join(""))).length;
  return { found, total: content.length, share: content.length ? found / content.length : 0 };
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const inr = (usd: number) => usd * INR_PER_USD;
const mark = (line: string) => console.log(`  ✓ ${line}`);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("speech round trip: the overlap check itself", () => {
  it("passes the sentence itself and a spoken form of it, and refuses an unrelated sentence", () => {
    expect(contentOverlap(SOURCE, SOURCE).share).toBe(1);
    const spoken = "ಮಕ್ಕಳೆ ಇವತ್ತು ಮರಳಲ್ಲಿ ಹೊಸ ಅಕ್ಷರ ಬರಿಯೋಣ ಮೊದಲು ಅದರ ಶಬ್ದ ಜೋರಾಗಿ ಹೇಳಿ ಆಮೇಲೆ ಬೆರಳಿಂದ ನಿಧಾನವಾಗಿ ಬರೀರಿ";
    expect(contentOverlap(SOURCE, spoken).share).toBeGreaterThanOrEqual(OVERLAP_BAR);
    const unrelated = "ನಾಳೆ ಶಾಲೆಗೆ ರಜೆ, ಪೋಷಕರ ಸಭೆ ಮುಂದಿನ ವಾರ ನಡೆಯುತ್ತದೆ.";
    expect(contentOverlap(SOURCE, unrelated).share).toBeLessThan(0.2);
    expect(contentOverlap(SOURCE, "").share).toBe(0);
  });

  it("the source is short, has no names and stays under ₹1 at list prices", () => {
    expect([...SOURCE].length).toBeLessThanOrEqual(130);
    // ₹30 per 10,000 characters to speak, ₹0.49 a minute to hear about ten seconds.
    expect((SOURCE.length * 30) / 10_000 + (10 * 0.49) / 60).toBeLessThan(BUDGET_INR);
  });
});

describe("speech round trip with Sarvam", () => {
  if (liveEvalsAllowed()) {
    it("Bulbul speaks, Saaras hears it back, both calls are costed in ai_calls, under ₹1", async () => {
      // No Claude call can happen here: no key, so every Claude role would only replay.
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      const hosts: string[] = [];
      let sttResponse: unknown = null;
      const realFetch = globalThis.fetch;
      vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        hosts.push(new URL(url).host);
        const res = await realFetch(input, init);
        if (url.startsWith("https://api.sarvam.ai/speech-to-text") && res.ok) sttResponse = await res.clone().json();
        return res;
      });

      const traceId = crypto.randomUUID();
      const said = await speak(SOURCE, { codec: "wav", sampleRate: 16_000, traceId });
      const wav = parseWav(said.audio);
      expect(wav?.format.sampleRate).toBe(16_000);
      mark(`speak ${SOURCE.length} characters, $${said.span.costUsd.toFixed(6)} (₹${inr(said.span.costUsd).toFixed(3)})`);

      const heard = await transcribeChunk(said.audio, { traceId });
      mark(`transcribe ${heard.span.tokensIn} s, $${heard.span.costUsd.toFixed(6)} (₹${inr(heard.span.costUsd).toFixed(3)})`);

      const overlap = contentOverlap(SOURCE, heard.text);
      expect(overlap.share).toBeGreaterThanOrEqual(OVERLAP_BAR);
      mark(`${overlap.found} of ${overlap.total} content words heard back (bar ${OVERLAP_BAR * 100}%)`);

      const total = said.span.costUsd + heard.span.costUsd;
      expect(said.span.costUsd).toBeGreaterThan(0);
      expect(heard.span.costUsd).toBeGreaterThan(0);
      expect(inr(total)).toBeLessThan(BUDGET_INR);
      mark(`round trip $${total.toFixed(6)} (₹${inr(total).toFixed(3)}), under ₹${BUDGET_INR}`);

      // Both calls are in ai_calls with their cost, so the budget caps count them (Law 10).
      const db = createAdminClient();
      expect(db, "ai_calls is not reachable: the database keys are missing").not.toBeNull();
      const { data, error } = await db!.from("ai_calls").select("role, status, cost_usd").eq("trace_id", traceId);
      expect(error).toBeNull();
      const paid = (data ?? []).filter((r) => r.status === "ok" && Number(r.cost_usd) > 0).map((r) => r.role).sort();
      expect(paid).toEqual(["speak", "transcribe"]);
      mark("ai_calls: speak and transcribe, each with cost_usd above 0");

      // Only Sarvam and the database were called: never Anthropic.
      const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://none.invalid").host;
      expect(hosts.filter((h) => h !== "api.sarvam.ai" && h !== supabaseHost)).toEqual([]);
      expect(hosts).not.toContain("api.anthropic.com");
      mark(`hosts called: ${[...new Set(hosts)].map((h) => (h === "api.sarvam.ai" ? "Sarvam" : "the database")).join(", ")}`);

      // Recorded for the offline replay: the audio, Saaras's own response, and the costs.
      expect(sttResponse).not.toBeNull();
      mkdirSync(DIR, { recursive: true });
      writeFileSync(WAV_PATH, said.audio);
      writeFileSync(join(FIXTURES_DIR, `${sha256(said.audio)}.json`), `${JSON.stringify({ sample: true, response: sttResponse }, null, 2)}\n`);
      writeFileSync(
        SUMMARY_PATH,
        `${JSON.stringify(
          {
            sample: true,
            recordedOn: new Date().toISOString().slice(0, 10),
            characters: SOURCE.length,
            audioSeconds: heard.span.tokensIn,
            speakUsd: said.span.costUsd,
            transcribeUsd: heard.span.costUsd,
            overlap: { found: overlap.found, total: overlap.total },
          },
          null,
          2,
        )}\n`,
      );
      mark("recorded evals/speech/roundtrip.wav, its transcript fixture and the costs");
    }, 120_000);
  } else if (existsSync(WAV_PATH)) {
    it("replays the recorded round trip: the recorded transcript still carries the sentence", async () => {
      // Never Sarvam in a replay, even if a key is in the shell.
      vi.stubEnv("SARVAM_API_KEY", "");
      const audio = new Uint8Array(readFileSync(WAV_PATH));
      const heard = await transcribeChunk(audio);
      expect(contentOverlap(SOURCE, heard.text).share).toBeGreaterThanOrEqual(OVERLAP_BAR);
      const summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf8")) as { speakUsd: number; transcribeUsd: number };
      expect(summary.speakUsd).toBeGreaterThan(0);
      expect(summary.transcribeUsd).toBeGreaterThan(0);
      expect(inr(summary.speakUsd + summary.transcribeUsd)).toBeLessThan(BUDGET_INR);
    });
  } else {
    it.todo("round trip through Sarvam: not yet recorded; run pnpm evals:live speech with founder approval");
  }
});
