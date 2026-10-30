// What we keep of a teacher's free text (a "how it went" note or her own thank you words).
// Law 5: no child's name may be stored. A deterministic pass cannot find names reliably, so until
// the note goes through the triage redactor (TODO M4: route tried notes and thank you text through
// ai/ redaction before storage) we keep a note only when it is short and the safety patterns find
// nothing in it. Harm or welfare signals are never stored; welfare shows the helpline instead.

export const NOTE_MAX = 200;

export type NoteChecks = {
  findUnsafe: (text: string) => string[];
  /** A child at risk described in her own words (safety audit, 24 Oct): Childline, never stored. */
  findDisclosures?: (text: string) => string[];
  findWelfareSignals: (text: string) => Array<"child_welfare" | "teacher_distress">;
};

export type NoteDecision =
  | { keep: string }
  | { keep: null; reason: "empty" | "too_long" | "unsafe" }
  | { keep: null; reason: "welfare"; helpline: "childline" | "telemanas" };

export function decideNote(
  raw: string | null | undefined,
  checks: NoteChecks,
  max: number = NOTE_MAX,
): NoteDecision {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { keep: null, reason: "empty" };
  if ((checks.findDisclosures?.(text) ?? []).length > 0) {
    return { keep: null, reason: "welfare", helpline: "childline" };
  }
  const welfare = checks.findWelfareSignals(text);
  if (welfare.length > 0) {
    return {
      keep: null,
      reason: "welfare",
      helpline: welfare.includes("child_welfare") ? "childline" : "telemanas",
    };
  }
  if (text.length > max) return { keep: null, reason: "too_long" };
  if (checks.findUnsafe(text).length > 0) return { keep: null, reason: "unsafe" };
  return { keep: text };
}
