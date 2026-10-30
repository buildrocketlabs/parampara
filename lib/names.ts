// The first letter of a name for a portrait placeholder. Kannada aware: a conjunct like ಶ್ರೀ stays
// whole (consonant, virama, consonant, vowel sign), honorifics are skipped, Latin is upper cased.
const HONORIFIC = /^(dr|sri|shri|smt|mr|mrs|ms)\.?\s+/i;
const MARK = /\p{M}/u;
const VIRAMA = "್";
const ZWJ = "‍";

export function initialOf(name: string | null | undefined): string {
  const chars = Array.from((name ?? "").trim().replace(HONORIFIC, ""));
  const first = chars[0];
  if (!first) return "";
  let out = first;
  for (let i = 1; i < chars.length; i++) {
    const c = chars[i] as string;
    const joins = out.endsWith(VIRAMA) || out.endsWith(ZWJ);
    if (MARK.test(c) || c === ZWJ || (joins && /\p{L}/u.test(c))) out += c;
    else break;
  }
  return out.toLocaleUpperCase("en");
}
