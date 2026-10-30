import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REHEARSAL_NOTES_KN } from "./notes.kn";

// Live rehearsal of /m/import (F-A1), step 1 of 2: speak the seven synthetic Kannada notes with
// the product's own text to speech (ai/speech/sarvam.ts, so each call is costed in ai_calls and
// counts against the caps, Law 10). About 5,000 characters on bulbul:v3: under ₹16 (about $0.17).
// Skipped unless REHEARSAL_TTS=1, so `pnpm test` never spends anything. Run by the lead:
//   REHEARSAL_TTS=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/rehearsal
// Step 2: node scripts/rehearsal-notes.mjs --from tests/rehearsal/out/src
const OUT = "tests/rehearsal/out/src";

describe("the seven rehearsal notes", () => {
  it("are seven, consent first, with no child's name and no digits", () => {
    expect(REHEARSAL_NOTES_KN).toHaveLength(7);
    expect(REHEARSAL_NOTES_KN[0]).toContain("ಒಪ್ಪಿಗೆ ನೀಡುತ್ತೇನೆ");
    for (const text of REHEARSAL_NOTES_KN) {
      expect(text.length).toBeLessThan(2_500); // one speak request each
      expect(text).not.toMatch(/[0-9೦-೯]/);
    }
  });
});

describe.skipIf(!process.env.REHEARSAL_TTS)("speak the rehearsal notes (spends credits)", () => {
  it("writes one 16 kHz WAV per note", { timeout: 300_000 }, async () => {
    const { speak } = await import("@/ai/speech/sarvam");
    mkdirSync(OUT, { recursive: true });
    for (const [i, text] of REHEARSAL_NOTES_KN.entries()) {
      const { audio } = await speak(text, {
        codec: "wav",
        sampleRate: 16_000,
        traceId: `rehearsal-f-a1-${i + 1}`,
      });
      writeFileSync(join(OUT, `${String(i + 1).padStart(2, "0")}.wav`), audio);
    }
  });
});
