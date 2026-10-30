"use client";

import { idleModule } from "@/lib/idle-module";
import { useLang } from "@/lib/i18n/provider";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { Hanate } from "./hanate/Hanate";
import { LampRowStill } from "./LampRowStill";

// The landing's lamps (DESIGN §8 `/`). The page ships their first frame: Hanate, and a row of dark
// lamps (lit under reduced motion). The story itself (./HeroLampsLive, Motion) loads at idle and
// starts from exactly this frame (DESIGN §10).
const useLive = idleModule(() => import("./HeroLampsLive"));
const LAMPS = 7;

export function HeroLamps() {
  const live = useLive();
  const { t } = useLang();
  const reduced = usePrefersReducedMotion();
  if (live) return <live.HeroLampsLive />;
  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        disabled={reduced}
        aria-label={reduced ? undefined : t("hanate.replay")}
        className="relative rounded-card p-1 disabled:cursor-default"
      >
        <Hanate state="idle" size={248} label={t("hanate.label")} className="h-auto w-36 sm:w-56" />
      </button>
      <div className="relative mt-3">
        <div
          aria-hidden
          className="absolute inset-x-2 top-1 -z-10 h-14 rounded-full bg-flame/30 blur-2xl"
          style={{ opacity: reduced ? 1 : 0 }}
        />
        <LampRowStill count={LAMPS} lit={reduced} />
      </div>
      <div className="mt-2 h-12" />
    </div>
  );
}
