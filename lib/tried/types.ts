import type { MessageKey } from "@/lib/i18n";

// The "Did it work?" loop (docs/BUILD.md M4.1). Outcomes match the tried_outcome enum (0001).
export const OUTCOMES = ["worked", "partly", "didnt"] as const;
export type TriedOutcome = (typeof OUTCOMES)[number];

export function isOutcome(value: unknown): value is TriedOutcome {
  return typeof value === "string" && (OUTCOMES as readonly string[]).includes(value);
}

/** One tap thank you phrases. The master hears Kannada first, so the Kannada line is what is sent. */
export const THANK_PHRASES = [
  "tried.thanks.p1",
  "tried.thanks.p2",
  "tried.thanks.p3",
] as const satisfies readonly MessageKey[];
export type ThankPhrase = (typeof THANK_PHRASES)[number];

export function isThankPhrase(value: unknown): value is ThankPhrase {
  return typeof value === "string" && (THANK_PHRASES as readonly string[]).includes(value);
}

/** What the page needs about the answer the teacher tried. */
export type TriedAnswer = {
  id: string;
  title: { kn: string; en: string; hi?: string };
  firstStep: { kn: string; en: string; hi?: string } | null;
  master: { name: string | null; years: number | null; district: string | null; isSample: boolean };
  isSample: boolean;
};

/** What she said before, if anything (she may change her mind). */
export type TriedRecord = { outcome: TriedOutcome; thanked: boolean };

export type TriedResult =
  | {
      ok: true;
      outcome: TriedOutcome;
      /** The note was dropped (Law 5) though the outcome was kept; say so kindly. */
      noteDropped: boolean;
      helpline: "childline" | "telemanas" | null;
    }
  | { ok: false; error: "sign_in" | "not_found" | "invalid" | "failed" };

export type ThanksResult =
  | { ok: true; already: boolean; helpline: "childline" | "telemanas" | null }
  | { ok: false; error: "sign_in" | "not_found" | "not_tried" | "invalid" | "failed" };
