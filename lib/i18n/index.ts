import type { kn } from "./kn";

// Types and helpers only, safe for client code. The dictionary itself is server side
// (lib/i18n/messages.ts); client components get only their area's strings from LanguageProvider
// (lib/i18n/areas.ts), so no page ships the whole of kn.ts and en.ts (DESIGN §10).

export const LANGS = ["kn", "en"] as const;
export type Lang = (typeof LANGS)[number];
export type MessageKey = keyof typeof kn;

export const DEFAULT_LANG: Lang = "kn";
export const LANG_STORAGE_KEY = "parampara.lang";

/**
 * Runs in <head> before first paint: picks ?lang=en|kn (links we send to jurors) or the stored
 * choice, and sets <html lang data-lang> so the right language shows with no flash.
 */
export const LANG_BOOT_SCRIPT = `try{var k=${JSON.stringify(LANG_STORAGE_KEY)},q=new URLSearchParams(location.search).get("lang"),l=q==="en"||q==="kn"?q:localStorage.getItem(k);if(q===l)localStorage.setItem(k,l);if(l==="en"||l==="kn"){var d=document.documentElement;d.lang=l;d.dataset.lang=l}}catch(e){}`;

export function otherLang(lang: Lang): Lang {
  return lang === "kn" ? "en" : "kn";
}

export function isLang(value: unknown): value is Lang {
  return value === "kn" || value === "en";
}
