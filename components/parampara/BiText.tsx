"use client";

import type { Lang } from "@/lib/i18n";
import { sayWith, type Text, type Vars } from "@/lib/i18n/fill";
import { useLang } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

// Bi, generalised: takes a message key or a {kn, en} pair from data, plus `{name}` style vars.
// Both orders render on the server; CSS shows the one matching <html data-lang> (see Bi.tsx),
// so it works in server and client trees alike and never flashes the wrong language.
type BiTextProps = {
  text: Text;
  vars?: Vars;
  className?: string;
  subClassName?: string;
  /** Show the other language as a quieter line beneath. */
  sub?: boolean;
  /** Render inline (spans flow in a sentence) instead of as stacked blocks. */
  inline?: boolean;
};

const ORDERS: ReadonlyArray<[lead: Lang, quiet: Lang]> = [
  ["kn", "en"],
  ["en", "kn"],
];

export function BiText({
  text,
  vars,
  className,
  subClassName,
  sub = true,
  inline = false,
}: BiTextProps) {
  const { msg } = useLang();
  return (
    <>
      {ORDERS.map(([lead, quiet]) => (
        <span key={lead} data-lang-mode={lead} className="contents">
          <span lang={lead} className={cn(!inline && "block", className)}>
            {sayWith(msg, lead, text, vars)}
          </span>
          {sub && (
            <span lang={quiet} className={cn("mt-1 block text-[0.8em] text-ink-3", subClassName)}>
              {sayWith(msg, quiet, text, vars)}
            </span>
          )}
        </span>
      ))}
    </>
  );
}
