import type { PreparedAudio } from "@/lib/audio";
import type { CreateInterviewInput } from "./create";
import { storableMime } from "./mime";

// What the page sends to POST /api/interviews once the browser has prepared the parts (F-A1).
// Pure, so the tests check the payload the server will validate without a browser.

export type ConsentMode = CreateInterviewInput["consent"]["mode"];

type FileLike = { name: string; type: string; size: number };

export function createBody(opts: {
  masterId: string;
  title?: string;
  files: FileLike[];
  prepared: Pick<PreparedAudio, "parts" | "chunks">;
  consent: { mode: ConsentMode; clip?: FileLike };
}): CreateInterviewInput {
  const { files, prepared, consent } = opts;
  if (files.length !== prepared.parts.length) throw new Error("files and prepared parts differ");
  return {
    masterId: opts.masterId,
    title: opts.title,
    consent: {
      mode: consent.mode,
      clip: consent.clip
        ? { name: consent.clip.name, mime: storableMime(consent.clip), bytes: consent.clip.size }
        : undefined,
    },
    parts: files.map((f, i) => ({
      name: f.name,
      mime: storableMime(f),
      bytes: f.size,
      durationMs: prepared.parts[i]!.endMs - prepared.parts[i]!.startMs,
    })),
    chunks: prepared.chunks.map(({ idx, startMs, endMs, silent }) => ({
      idx,
      startMs,
      endMs,
      silent,
    })),
  };
}

/** Whether a part holds only the consent: shown on the page and kept out of the cards. */
export function isConsentPart(mode: ConsentMode | null, index: number, parts: number): boolean {
  return mode === "first_note" && index === 0 && parts > 1;
}
