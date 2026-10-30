// Small script checks shared by the roles: each language's field must be in its own script.

const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;

export const kannadaLetters = (s: string) => count(s, /[\u0C80-\u0CFF]/gu);
export const latinLetters = (s: string) => count(s, /[A-Za-z]/g);
export const devanagariLetters = (s: string) => count(s, /[\u0900-\u0963\u0966-\u097F]/gu);

/** English copy: no em or en dashes (CLAUDE.md Style). */
export const tidyEn = (s: string) => s.replace(/\s*[\u2014\u2013]\s*/g, ", ").trim();

/** Collapse whitespace and quotes so a quote can be found in its source despite small differences. */
export function looseText(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\u2060\u00AD\uFEFF]/g, "")
    .replace(/[\u201C\u201D"\u2018\u2019'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
