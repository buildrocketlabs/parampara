"use client";

import type { Lang, MessageKey } from "@/lib/i18n";
import { useLang } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

// Bilingual text: the chosen language leads, the other follows as a quieter line
// (DESIGN §4 LanguageToggle: English mode keeps Kannada visible; jurors get English under Kannada).
// Both orders are rendered on the server and CSS shows the one matching <html data-lang>, which a
// head script sets before first paint. So there is no Kannada flash for English readers. The strings
// come from the route's LanguageProvider (lib/i18n/areas.ts), so no page ships the whole
// dictionary. The quiet line is ink-3: muted drops below 4.5:1 on the dusk gradient.
type BiProps = {
  k: MessageKey;
  className?: string;
  subClassName?: string;
  /** Hide the second language (for short labels where both would crowd). */
  sub?: boolean;
};

const ORDERS: ReadonlyArray<[lead: Lang, quiet: Lang]> = [
  ["kn", "en"],
  ["en", "kn"],
];

export function Bi({ k, className, subClassName, sub = true }: BiProps) {
  const { msg } = useLang();
  return (
    <>
      {ORDERS.map(([lead, quiet]) => (
        <span key={lead} data-lang-mode={lead} className="contents">
          <span lang={lead} className={cn("block", className)}>
            {msg(lead, k)}
          </span>
          {sub && (
            <span lang={quiet} className={cn("mt-1 block text-[0.8em] text-ink-3", subClassName)}>
              {msg(quiet, k)}
            </span>
          )}
        </span>
      ))}
    </>
  );
}
