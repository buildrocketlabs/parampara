import { type Lang } from "@/lib/i18n";
import { messages } from "@/lib/i18n/messages";

// The hero sentence reads as one thought in the lead language, with the other language beneath.
// Caveat has no Kannada glyphs, so the handwritten coda is English only. Both orders render;
// CSS picks one (see Bi).
const ORDERS: ReadonlyArray<[lead: Lang, quiet: Lang]> = [
  ["kn", "en"],
  ["en", "kn"],
];

export function HeroLine() {
  return (
    <>
      {ORDERS.map(([lead, quiet]) => (
        <span key={lead} data-lang-mode={lead} className="contents">
          <span lang={lead} className="block">
            {messages[lead]["hero.line"]}
          </span>
          <span
            lang={lead}
            className={
              lead === "en"
                ? "block font-hand text-[1.1em] font-normal text-clay-cta"
                : "block text-[0.8em] text-clay-cta"
            }
          >
            {messages[lead]["hero.coda"]}
            {lead === "en" && "."}
          </span>
          <span
            lang={quiet}
            className="mt-3 block font-sans text-lg font-semibold text-ink-3 sm:text-xl"
          >
            {messages[quiet]["hero.line"]}, {messages[quiet]["hero.coda"]}
          </span>
        </span>
      ))}
    </>
  );
}
