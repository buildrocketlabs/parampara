"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, CloudOff } from "lucide-react";
import { haptics, vibrate } from "@/lib/motion";
import { useLang } from "@/lib/i18n/provider";
import { useOfflineQueue } from "@/lib/use-offline-queue";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { Ember } from "./Ember";

// Three big cards, one tap each: the tap is the choice and the way on (no separate Save).
// Kannada or English also switches the screens at once; Hindi changes only the answers.
type AnswerLang = "kn" | "en" | "hi";

const CARDS: ReadonlyArray<{ lang: AnswerLang; native: string; greeting: string; glyph: string }> = [
  { lang: "kn", native: "ಕನ್ನಡ", greeting: "ನಮಸ್ಕಾರ ಮೇಡಂ", glyph: "ಕ" },
  { lang: "en", native: "English", greeting: "Namaskara, madam", glyph: "A" },
  { lang: "hi", native: "हिन्दी", greeting: "नमस्ते मैडम", glyph: "हि" },
];

export function LanguageCards({ devanagari }: { devanagari: string }) {
  const { pending, data } = useFormStatus();
  const { held, hold } = useOfflineQueue();
  const { setLang, t } = useLang();
  const chosen = pending ? data?.get("lang") : held;

  return (
    <div role="group" aria-label={t("welcome.lang.title")} className="flex flex-col gap-3">
      {CARDS.map((c, i) => {
        const busy = chosen === c.lang;
        const script = c.lang === "hi" ? devanagari : undefined;
        return (
          <button
            key={c.lang}
            type="submit"
            name="lang"
            value={c.lang}
            disabled={pending}
            aria-busy={busy || undefined}
            onClick={(e) => {
              vibrate(haptics.press);
              if (c.lang !== "hi") setLang(c.lang);
              hold(e);
            }}
            style={{ "--i": i + 2 } as React.CSSProperties}
            className={cn(
              "rise group flex min-h-20 w-full items-center gap-4 rounded-card border border-border bg-paper p-3.5 pr-4 text-left transition-[translate,box-shadow,border-color] duration-100",
              "lip-paper hover:-translate-y-px hover:border-clay active:translate-y-1 active:shadow-none disabled:cursor-default",
              busy && "border-clay",
              (pending || held !== null) && !busy && "opacity-60",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-13 shrink-0 place-items-center rounded-chip bg-sage font-display text-[24px] leading-none font-extrabold text-ink-2 transition-colors duration-150 group-hover:bg-clay-cta group-hover:text-white",
                busy && "bg-clay-cta text-white",
                script,
              )}
            >
              {c.glyph}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span lang={c.lang} className={cn("font-display text-[26px] leading-tight font-bold text-ink", script)}>
                {c.native}
              </span>
              <span lang={c.lang} className={cn("text-[15px] font-normal text-ink-3", script)}>
                {c.greeting}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-clay-cta">
              {busy && held !== null ? (
                <>
                  <CloudOff className="size-5 text-ink-3" aria-hidden />
                  <span className="sr-only">
                    <Bi k="offline.held" sub={false} />
                  </span>
                </>
              ) : busy ? (
                <Ember />
              ) : (
                <ArrowRight
                  className="size-6 transition-transform duration-200 group-hover:translate-x-1"
                  strokeWidth={2.4}
                  aria-hidden
                />
              )}
            </span>
          </button>
        );
      })}
      {held !== null && (
        <p className="flex items-center gap-2 text-[15px] text-ink-3" role="status">
          <CloudOff className="size-4 shrink-0" aria-hidden />
          <Bi k="offline.held" sub={false} />
        </p>
      )}
    </div>
  );
}
