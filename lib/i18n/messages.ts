import { en } from "./en";
import { kn } from "./kn";
import { fill, nameIn, type Name, type Text, type Vars } from "./fill";
import type { Lang, MessageKey } from "./index";

// The whole dictionary, for server code only: server components, actions, routes and metadata.
// Client code never imports this module (lib/i18n/areas.test.ts checks); it reads its area's
// strings from LanguageProvider instead (DESIGN §10, first load JS).

export const messages: Record<Lang, Record<MessageKey, string>> = { kn, en };

export function t(lang: Lang, key: MessageKey): string {
  return messages[lang][key];
}

/** The line for one language, from a key or a {kn, en} pair. */
export function say(lang: Lang, text: Text, vars?: Vars): string {
  const line = typeof text === "string" ? messages[lang][text] : text[lang];
  return fill(line, vars);
}

/** A message with a name filled in each language's own spelling, as a {kn, en} pair. */
export function withName(key: MessageKey, name: Name, vars?: Vars): { kn: string; en: string } {
  return {
    kn: fill(messages.kn[key], { ...vars, name: nameIn(name, "kn") }),
    en: fill(messages.en[key], { ...vars, name: nameIn(name, "en") }),
  };
}
