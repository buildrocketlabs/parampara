"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { sayWith, withNameWith, type Name, type Text, type Vars } from "./fill";
import { DEFAULT_LANG, isLang, LANG_STORAGE_KEY, type Lang, type MessageKey } from "./index";

// Language lives in localStorage (and a cookie, for later server reads). Kannada is the default.
// Bilingual text is switched by CSS from <html data-lang>, so only strings read through `t()`
// (labels, aria text) wait for hydration.
const listeners = new Set<() => void>();

function read(): Lang {
  // The head script has already resolved ?lang and storage into <html data-lang>.
  const v = document.documentElement.dataset.lang;
  return isLang(v) ? v : DEFAULT_LANG;
}

// <html lang data-lang> is written only here and by the head script, never from an effect:
// a hydration pass with the server snapshot would otherwise flip it back to Kannada for a frame.
function write(lang: Lang) {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  document.cookie = `${LANG_STORAGE_KEY}=${lang}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === LANG_STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Strings for the keys a part of the app uses, in both languages (lib/i18n/areas.ts). */
export type Strings = Record<Lang, Partial<Record<MessageKey, string>>>;

type LangContext = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** The line in the reader's language. */
  t: (key: MessageKey) => string;
  /** The line in a given language (Bi renders both). */
  msg: (lang: Lang, key: MessageKey) => string;
  /** A key or a {kn, en} pair in one language, with `{name}` style vars filled. */
  say: (lang: Lang, text: Text, vars?: Vars) => string;
  /** A message with a name in each language's own spelling, as a {kn, en} pair. */
  withName: (key: MessageKey, name: Name, vars?: Vars) => { kn: string; en: string };
  strings: Strings;
};

const Ctx = createContext<LangContext | null>(null);

/**
 * The language, and the strings this part of the app needs. The root layout passes the core
 * strings; a role's layout nests another provider with its own (both languages, so the toggle
 * needs no round trip). Nested providers add to their parent's strings.
 */
export function LanguageProvider({
  strings: own,
  children,
}: {
  strings: Strings;
  children: React.ReactNode;
}) {
  const parent = useContext(Ctx);
  const lang = useSyncExternalStore(subscribe, read, () => DEFAULT_LANG);
  const setLang = useCallback((next: Lang) => write(next), []);
  const strings = useMemo<Strings>(
    () =>
      parent
        ? { kn: { ...parent.strings.kn, ...own.kn }, en: { ...parent.strings.en, ...own.en } }
        : own,
    [parent, own],
  );
  const value = useMemo<LangContext>(() => {
    const msg = (l: Lang, key: MessageKey) => {
      const line = strings[l][key];
      if (line === undefined) {
        // A key outside this area's prefixes: lib/i18n/areas.test.ts should have caught it.
        if (process.env.NODE_ENV !== "production")
          console.error(`[i18n] missing in this area: ${key}`);
        return "";
      }
      return line;
    };
    return {
      lang,
      setLang,
      t: (key) => msg(lang, key),
      msg,
      say: (l, text, vars) => sayWith(msg, l, text, vars),
      withName: (key, name, vars) => withNameWith(msg, key, name, vars),
      strings,
    };
  }, [lang, setLang, strings]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLang must be used inside <LanguageProvider>");
  return ctx;
}
