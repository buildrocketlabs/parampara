"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { durations, haptics, lampStory, springs, vibrate } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useLang } from "@/lib/i18n/provider";
import { Hanate } from "./hanate/Hanate";
import type { HanateState } from "./hanate/variants";
import { LampRow } from "./LampRow";
import { MotionIsland } from "./MotionIsland";

// The landing's signature beat (DESIGN §8 `/`): Hanate gives a spark of its flame to the first lamp,
// each lamp lights the next, and Hanate's own flame never dims. Tap Hanate to watch it again.
// Loaded at idle (./HeroLamps.tsx shows the same first frame until then, DESIGN §10).
const LAMPS = 7;
const { stagger: STAGGER, startMs: START_AFTER_MS, gladFor: GLAD_FOR } = lampStory;

type Point = { x: number; y: number };
type Phase = "waiting" | "passing" | "lit";

// Flame centres as fractions of each artwork's box (Hanate 120x140, small lamp 40x44).
const HANATE_FLAME = { x: 0.5, y: 0.3 };
const LAMP_FLAME = { x: 0.5, y: 0.32 };

function HeroLampsLiveMoving() {
  const { lang, t } = useLang();
  const reduced = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const giver = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [run, setRun] = useState(0);
  const [mood, setMood] = useState<HanateState>("idle");
  const [path, setPath] = useState<{ from: Point; to: Point } | null>(null);

  const measure = useCallback(() => {
    const root = box.current?.getBoundingClientRect();
    const svg = giver.current?.querySelector("svg")?.getBoundingClientRect();
    const lamp = box.current?.querySelector('[data-lamp="0"]')?.getBoundingClientRect();
    if (!root || !svg || !lamp) return;
    setPath({
      from: {
        x: svg.left - root.left + svg.width * HANATE_FLAME.x,
        y: svg.top - root.top + svg.height * HANATE_FLAME.y,
      },
      to: {
        x: lamp.left - root.left + lamp.width * LAMP_FLAME.x,
        y: lamp.top - root.top + lamp.height * LAMP_FLAME.y,
      },
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Hand the flame over shortly after load, and again on every replay.
  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => setPhase("passing"), run === 0 ? START_AFTER_MS : 150);
    return () => window.clearTimeout(timer);
  }, [reduced, run]);

  // Once the row is alight, Hanate is glad for a moment, then settles.
  useEffect(() => {
    if (phase !== "lit" || reduced) return;
    const glad = window.setTimeout(() => setMood("happy"), (LAMPS * STAGGER + 0.2) * 1000);
    const settle = window.setTimeout(
      () => setMood("idle"),
      (LAMPS * STAGGER + 0.2 + GLAD_FOR) * 1000,
    );
    return () => {
      window.clearTimeout(glad);
      window.clearTimeout(settle);
    };
  }, [phase, reduced]);

  // Reduced motion shows the row already lit. If measuring failed, light it rather than wait.
  const lit = reduced || phase === "lit" || (phase === "passing" && !path);

  const replay = () => {
    if (reduced || phase === "passing") return;
    vibrate(haptics.press);
    setMood("idle");
    setPhase("waiting");
    setRun((r) => r + 1);
  };

  const arcTop = path ? Math.min(path.from.y, path.to.y) - 36 : 0;

  return (
    <div ref={box} className="relative flex flex-col items-center">
      {/* Under reduced motion there is nothing to replay, so Hanate is not a button then. */}
      <button
        ref={giver}
        type="button"
        onClick={replay}
        disabled={reduced}
        aria-label={reduced ? undefined : t("hanate.replay")}
        className="relative rounded-card p-1 disabled:cursor-default"
      >
        <Hanate state={mood} size={248} label={t("hanate.label")} className="h-auto w-36 sm:w-56" />
      </button>

      <div className="relative mt-3">
        <m.div
          aria-hidden
          className="absolute inset-x-2 top-1 -z-10 h-14 rounded-full bg-flame/30 blur-2xl"
          initial={false}
          animate={{ opacity: lit ? 1 : 0 }}
          transition={lit ? { ...springs.gentle, delay: LAMPS * STAGGER * 0.6 } : { duration: 0 }}
        />
        <LampRow count={LAMPS} stagger={STAGGER} lit={lit} />
      </div>

      <div className="mt-2 h-12">
        {lit && !reduced && (
          <m.button
            type="button"
            onClick={replay}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.gentle, delay: LAMPS * STAGGER + 0.4 }}
            className="inline-flex h-12 items-center gap-2 rounded-chip px-4 font-display text-base font-semibold text-ink-3 hover:bg-paper/70"
          >
            <RotateCcw className="size-4" aria-hidden />
            <span lang={lang}>{t("hanate.again")}</span>
          </m.button>
        )}
      </div>

      <AnimatePresence>
        {phase === "passing" && path && (
          <m.span
            key={run}
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 size-3 rounded-full bg-flame shadow-flame"
            initial={{ x: path.from.x - 6, y: path.from.y - 6, scale: 0.4, opacity: 0 }}
            animate={{
              x: [path.from.x - 6, (path.from.x + path.to.x) / 2 - 6, path.to.x - 6],
              y: [path.from.y - 6, arcTop - 6, path.to.y - 6],
              scale: [0.4, 1.2, 0.8],
              opacity: [0, 1, 1],
            }}
            exit={{ opacity: 0, scale: 0, transition: { duration: durations.small } }}
            transition={{ duration: durations.story, ease: "easeInOut" }}
            onAnimationComplete={() => setPhase("lit")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** HeroLampsLive, inside its own Motion island (components/parampara/MotionIsland). */
export function HeroLampsLive() {
  return (
    <MotionIsland>
      <HeroLampsLiveMoving />
    </MotionIsland>
  );
}
