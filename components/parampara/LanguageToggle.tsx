"use client";

import { useLayoutEffect, useRef } from "react";
import { vibrate, haptics } from "@/lib/motion";
import { LANGS, type Lang } from "@/lib/i18n";
import { useLang } from "@/lib/i18n/provider";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

const LABEL: Record<Lang, string> = { kn: "ಕನ್ನಡ", en: "English" };

// ಕನ್ನಡ / English pill (DESIGN §4). Each half is a 48 px target; the active half is a sliding clay chip.
// The slide is a FLIP with the browser's own Web Animations API (the springs.snappy feel), so the
// header on every page needs no layout animation code on first load (DESIGN §10).
const SLIDE: KeyframeAnimationOptions = {
  duration: 260,
  easing: "cubic-bezier(0.22, 1.2, 0.36, 1)",
};

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  const reduced = usePrefersReducedMotion();
  const pill = useRef<HTMLSpanElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const last = useRef<DOMRect | null>(null);
  // Only her tap slides the chip; hydrating into a stored English choice must not.
  const tapped = useRef(false);

  // Where the chip was, where it is now: slide from the one to the other.
  useLayoutEffect(() => {
    const el = pill.current;
    if (!el) return;
    const now = el.getBoundingClientRect();
    const before = last.current;
    last.current = now;
    const slide = tapped.current;
    tapped.current = false;
    if (!slide || !before || reduced || typeof el.animate !== "function") return;
    const dx = before.left - now.left;
    const sx = now.width ? before.width / now.width : 1;
    if (Math.abs(dx) < 1) return;
    el.animate(
      [
        { transform: `translateX(${dx}px) scaleX(${sx})`, transformOrigin: "left center" },
        { transform: "none", transformOrigin: "left center" },
      ],
      SLIDE,
    );
  }, [lang, reduced]);

  const choose = (l: Lang) => {
    if (l === lang) return;
    vibrate(haptics.press);
    tapped.current = true;
    setLang(l);
  };

  // A radio group is one Tab stop; the arrow keys move between the two languages (WAI-ARIA).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next: Lang = lang === "kn" ? "en" : "kn";
    choose(next);
    group.current?.querySelector<HTMLButtonElement>(`button[lang="${next}"]`)?.focus();
  };

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={t("lang.switch")}
      onKeyDown={onKeyDown}
      className={cn(
        "relative inline-flex h-12 items-center rounded-chip border border-border bg-paper shadow-warm-sm",
        className,
      )}
    >
      {LANGS.map((l) => {
        const active = l === lang;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            lang={l}
            onClick={() => choose(l)}
            className={cn(
              "relative z-10 h-12 min-w-20 rounded-chip px-4 font-display text-[15px] font-semibold transition-colors duration-150",
              active ? "text-white" : "text-ink-3 hover:text-ink",
            )}
          >
            {active && (
              <span ref={pill} className="absolute inset-0 -z-10 rounded-chip bg-clay-cta" />
            )}
            {LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}
