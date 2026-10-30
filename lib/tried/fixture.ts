import type { TriedAnswer, TriedOutcome, TriedRecord } from "./types";

// Fixture mode (no database yet, docs/BUILD.md §1): one Sample answer to try, and what the teacher
// said kept in a cookie, so the whole loop works without keys and in e2e. Labelled Sample (Law 7).
export const FIXTURE_ANSWER_ID = "00000000-0000-4000-8000-0000000a0001";
export const FIXTURE_TRIED_COOKIE = "pp_fixture_tried";

export const FIXTURE_ANSWER: TriedAnswer = {
  id: FIXTURE_ANSWER_ID,
  title: {
    kn: "ಹತ್ತರ ಕಟ್ಟು: ಕಡ್ಡಿಗಳಿಂದ ಸ್ಥಾನಬೆಲೆ",
    en: "Bundles of ten: place value with sticks",
  },
  firstStep: {
    kn: "ಹತ್ತು ಕಡ್ಡಿಗಳನ್ನು ಎಣಿಸಿ, ರಬ್ಬರ್ ಬ್ಯಾಂಡ್ ಹಾಕಿ ಒಂದು ಕಟ್ಟು ಮಾಡಿ.",
    en: "Count ten sticks and tie them with a rubber band into one bundle.",
  },
  master: { name: "Sharanappa", years: 32, district: "Koppal", isSample: true },
  isSample: true,
};

export type FixtureTried = Record<string, TriedRecord & { thanks?: string }>;

export function readFixtureTried(raw: string | undefined): FixtureTried {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: FixtureTried = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      const r = v as { outcome?: unknown; thanked?: unknown };
      if (r && (r.outcome === "worked" || r.outcome === "partly" || r.outcome === "didnt")) {
        out[id] = { outcome: r.outcome as TriedOutcome, thanked: r.thanked === true };
      }
    }
    return out;
  } catch {
    return {};
  }
}
