import { describe, expect, it } from "vitest";
import { prepareAudio } from "@/lib/audio";
import { buildWav, synth, talk } from "@/lib/audio/test-audio";
import { checkPlan, CreateInterviewSchema } from "./create";
import { orderVoiceNotes } from "./order";
import { createBody, isConsentPart } from "./plan";

// The whole browser side of a WhatsApp import, without a browser: notes picked out of order are
// put in WhatsApp's order, prepared as one timeline, and the plan passes the server's own checks.

function note(name: string, ms: number, seed: number) {
  const wav = buildWav({ sampleRate: 16_000, channels: [synth(talk(ms, seed)).samples] });
  // A real .opus would be Ogg; WAV bytes keep this test free of a decoder. Only the name matters.
  return new File([wav as BlobPart], name, { lastModified: seed });
}

describe("a WhatsApp interview as one import", () => {
  it("orders, prepares end to end and builds a plan the server accepts", async () => {
    const picked = [
      note("PTT-20261028-WA0005.opus", 40_000, 5),
      note("PTT-20261028-WA0003.opus", 12_000, 3), // the consent note
      note("PTT-20261028-WA0004.opus", 35_000, 4),
    ];
    const { files } = orderVoiceNotes(picked);
    expect(files.map((f) => f.name)).toEqual([
      "PTT-20261028-WA0003.opus",
      "PTT-20261028-WA0004.opus",
      "PTT-20261028-WA0005.opus",
    ]);
    const prepared = await prepareAudio(files);
    expect(prepared.parts).toHaveLength(3);
    expect(prepared.parts[1]!.startMs).toBe(prepared.parts[0]!.endMs);
    // A part boundary is always a chunk boundary, so the consent note never shares a chunk.
    expect(prepared.chunks.some((c) => c.startMs === prepared.parts[1]!.startMs)).toBe(true);

    const body = createBody({
      masterId: "00000000-0000-4000-8000-000000000001",
      files,
      prepared,
      consent: { mode: "first_note" },
    });
    expect(body.parts.map((p) => p.mime)).toEqual(["audio/ogg", "audio/ogg", "audio/ogg"]);
    expect(CreateInterviewSchema.safeParse(body).success).toBe(true);
    expect(checkPlan(body, 3 * 60 * 60_000)).toBeNull();
    expect(files.map((_, i) => isConsentPart("first_note", i, files.length))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("marks no consent part for one file or another consent mode", () => {
    expect(isConsentPart("first_note", 0, 1)).toBe(false);
    expect(isConsentPart("in_recording", 0, 7)).toBe(false);
    expect(isConsentPart(null, 0, 7)).toBe(false);
  });
});
