"use client";

import type { Lang, MessageKey } from "@/lib/i18n";
import { useLang } from "@/lib/i18n/provider";

// Both languages on one line, the chosen one first: "ನಾನು ಒಪ್ಪುತ್ತೇನೆ · I agree". For the few
// labels where a person must be sure what they press, whichever language they read.
const ORDERS: ReadonlyArray<[lead: Lang, quiet: Lang]> = [
  ["kn", "en"],
  ["en", "kn"],
];

export function BiPair({ k }: { k: MessageKey }) {
  const { msg } = useLang();
  return (
    <>
      {ORDERS.map(([lead, quiet]) => (
        <span key={lead} data-lang-mode={lead} className="contents">
          <span lang={lead}>{msg(lead, k)}</span>
          <span aria-hidden className="opacity-70">
            ·
          </span>
          <span lang={quiet} className="font-semibold opacity-90">
            {msg(quiet, k)}
          </span>
        </span>
      ))}
    </>
  );
}
