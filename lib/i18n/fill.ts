import type { Lang, MessageKey } from "./index";

// Pure helpers, safe on both sides. The dictionary lookups that need kn.ts and en.ts live in
// lib/i18n/messages.ts (server); client code passes its provider's lookup in (useLang().msg).

/** A line of copy: a message key, or a pair of strings that came from data (card titles, steps). */
export type Text = MessageKey | { kn: string; en: string };

export type Vars = Record<string, string | number>;

/** Looks a key up in one language: messages on the server, the provider on the client. */
export type Lookup = (lang: Lang, key: MessageKey) => string;

/** Replaces `{name}` placeholders. Unknown placeholders stay visible so a missing var is noticed. */
export function fill(line: string, vars?: Vars): string {
  if (!vars) return line;
  return line.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** The line for one language, from a key (through `look`) or a {kn, en} pair. */
export function sayWith(look: Lookup, lang: Lang, text: Text, vars?: Vars): string {
  const line = typeof text === "string" ? look(lang, text) : text[lang];
  return fill(line, vars);
}

/** A person's name: one spelling, or one per language (ಶಾಂತಮ್ಮ ಕೆ. / Shantamma K.). */
export type Name = string | { kn: string; en: string };

export function nameIn(name: Name, lang: Lang): string {
  return typeof name === "string" ? name : name[lang];
}

/** A message with a name filled in each language's own spelling, as a {kn, en} pair. */
export function withNameWith(
  look: Lookup,
  key: MessageKey,
  name: Name,
  vars?: Vars,
): { kn: string; en: string } {
  return {
    kn: fill(look("kn", key), { ...vars, name: nameIn(name, "kn") }),
    en: fill(look("en", key), { ...vars, name: nameIn(name, "en") }),
  };
}
