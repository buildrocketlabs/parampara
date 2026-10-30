"use client";

import { useEffect, useRef, useState } from "react";
import * as m from "motion/react-m";
import { haptics, springs, vibrate } from "@/lib/motion";
import { playBell } from "@/lib/sound";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";
import { Hanate } from "./hanate/Hanate";
import { LampRow } from "./LampRow";
import { MotionIsland } from "./MotionIsland";

// "It worked" (DESIGN §4): Hanate lights a row of small lamps, marigold petals fall (our confetti,
// a few SVG petals, no library), an optional soft bell, and the line ನೀವು ಇಂದು ದೀಪ ಹಚ್ಚಿದ್ದೀರಿ.
// Mount it right after the teacher's tap (it plays on mount; remount with a key to replay). Tap
// anywhere to skip. Reduced motion: the lamps are simply lit, no petals. Load it with
// LazyCelebration so it never weighs on the teacher shell.
export type CelebrationProps = {
  /** Lamps, one per child in the class. Up to 6 sit in one row; 7 to 12 wrap into two even rows. */
  lamps?: number;
  /** Ring the bell (still silent if the teacher muted sounds). Off by default. */
  sound?: boolean;
  /** Called once the moment has finished, or when the teacher taps to skip. */
  onDone?: () => void;
  /** Milliseconds before onDone. Default 2600. */
  holdMs?: number;
  className?: string;
};

// Petals fall in a fixed, hand placed pattern (no randomness, so server and client agree).
const PETALS = [
  { x: 6, d: 0.42, t: 1.7, r: 220, s: 1, c: "flame" },
  { x: 14, d: 0.62, t: 1.9, r: -160, s: 0.8, c: "flame-deep" },
  { x: 22, d: 0.48, t: 1.6, r: 260, s: 1.1, c: "clay-glow" },
  { x: 31, d: 0.7, t: 2, r: -200, s: 0.9, c: "flame" },
  { x: 39, d: 0.4, t: 1.75, r: 180, s: 1, c: "flame-deep" },
  { x: 47, d: 0.58, t: 1.85, r: -240, s: 0.85, c: "flame" },
  { x: 55, d: 0.45, t: 1.65, r: 200, s: 1.15, c: "clay-glow" },
  { x: 63, d: 0.66, t: 1.95, r: -180, s: 0.9, c: "flame-deep" },
  { x: 71, d: 0.5, t: 1.7, r: 230, s: 1, c: "flame" },
  { x: 79, d: 0.74, t: 2.05, r: -210, s: 0.8, c: "flame" },
  { x: 87, d: 0.44, t: 1.8, r: 190, s: 1.05, c: "flame-deep" },
  { x: 94, d: 0.6, t: 1.9, r: -250, s: 0.9, c: "clay-glow" },
  { x: 18, d: 0.9, t: 1.8, r: 170, s: 0.75, c: "flame" },
  { x: 51, d: 0.95, t: 1.7, r: -190, s: 0.8, c: "flame-deep" },
  { x: 83, d: 0.88, t: 1.85, r: 210, s: 0.75, c: "flame" },
] as const;

const LAMP_STAGGER = 0.06;

// LampRow's lamp widths and gaps (40 px and 8 px on phones, 58 px and 16 px from sm).
function rowWidths(lamps: number): React.CSSProperties | undefined {
  if (lamps <= 6) return undefined;
  const perRow = Math.ceil(lamps / 2);
  return {
    "--row": `${perRow * 40 + (perRow - 1) * 8 + 2}px`,
    "--row-sm": `${perRow * 58 + (perRow - 1) * 16 + 2}px`,
  } as React.CSSProperties;
}

function CelebrationMoving({
  lamps = 6,
  sound = false,
  onDone,
  holdMs = 2600,
  className,
}: CelebrationProps) {
  const reduced = usePrefersReducedMotion();
  // Unlit on the first frame so the row visibly catches fire, one lamp after another.
  const [lit, setLit] = useState(false);
  const doneRef = useRef(onDone);
  const finished = useRef(false);
  useEffect(() => {
    doneRef.current = onDone;
  });

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    doneRef.current?.();
  };

  useEffect(() => {
    vibrate(haptics.success);
    if (sound) playBell();
    const light = window.setTimeout(() => setLit(true), 120);
    const id = window.setTimeout(() => {
      if (!finished.current) {
        finished.current = true;
        doneRef.current?.();
      }
    }, holdMs);
    return () => {
      window.clearTimeout(light);
      window.clearTimeout(id);
    };
  }, [sound, holdMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={finish}
      className={cn(
        "relative isolate flex cursor-pointer flex-col items-center overflow-hidden rounded-card bg-dusk-gradient px-5 pt-8 pb-7 text-center",
        className,
      )}
    >
      {!reduced && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {PETALS.map((p, i) => (
            <m.span
              key={i}
              className="absolute top-0 h-full w-5"
              style={{ left: `${p.x}%` }}
              initial={{ y: "-8%" }}
              animate={{ y: "100%" }}
              transition={{ duration: p.t, delay: p.d, ease: [0.3, 0.1, 0.4, 1] }}
            >
              <m.svg
                viewBox="0 0 20 14"
                className="block w-5"
                style={{ scale: p.s }}
                initial={{ rotate: 0, x: 0, opacity: 0 }}
                animate={{ rotate: p.r, x: [0, 10, -6, 4], opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: p.t,
                  delay: p.d,
                  ease: "easeInOut",
                  times: [0, 0.15, 0.8, 1],
                }}
              >
                <path d="M1 7 C4 1 12 0 19 7 C12 14 4 13 1 7 Z" fill={`var(--color-${p.c})`} />
                <path
                  d="M3 7 C8 6 13 6 17 7"
                  stroke="var(--color-clay)"
                  strokeWidth="0.8"
                  fill="none"
                  opacity="0.5"
                />
              </m.svg>
            </m.span>
          ))}
        </div>
      )}

      <m.div
        initial={reduced ? false : { scale: 0.85, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        transition={springs.bouncy}
      >
        <Hanate state="celebrating" size={120} label="" />
      </m.div>

      <div className="relative mt-3">
        <span
          aria-hidden
          className="absolute inset-x-4 top-2 -z-10 h-12 rounded-full bg-flame/40 blur-2xl"
        />
        {/* More than six lamps wrap into two even rows, so none touch the card's edges. */}
        <div
          className={cn(lamps > 6 && "mx-auto max-w-[var(--row)] sm:max-w-[var(--row-sm)]")}
          style={rowWidths(lamps)}
        >
          <LampRow
            count={lamps}
            lit={lit}
            stagger={reduced ? 0 : LAMP_STAGGER}
            className={lamps > 6 ? "flex-wrap gap-y-3" : undefined}
          />
        </div>
      </div>

      <m.p
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.gentle, delay: reduced ? 0 : 0.35 + lamps * LAMP_STAGGER }}
        className="mt-5 font-display text-[28px] leading-tight font-extrabold text-balance text-clay-cta sm:text-[32px]"
      >
        <BiText
          text="celebrate.line"
          subClassName="mt-1 font-sans text-[17px] font-semibold text-ink-3"
        />
      </m.p>
      <m.p
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: reduced ? 0 : 0.6 + lamps * LAMP_STAGGER }}
        className="mt-2 text-[16px] text-ink-3"
      >
        <BiText text="celebrate.sub" sub={false} />
      </m.p>
      {onDone && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            finish();
          }}
          className="mt-6 inline-flex h-14 w-full max-w-sm items-center justify-center rounded-button bg-clay-cta px-7 font-display text-lg font-bold text-white lip-clay transition-[translate,box-shadow] duration-100 hover:-translate-y-px active:translate-y-1 active:shadow-none"
        >
          <BiText text="celebrate.continue" sub={false} inline />
        </button>
      )}
    </div>
  );
}

/** The one mute toggle (DESIGN §6). Put it wherever sounds can play. */

/** Celebration, inside its own Motion island (components/parampara/MotionIsland). */
export function Celebration(props: React.ComponentProps<typeof CelebrationMoving>) {
  return (
    <MotionIsland>
      <CelebrationMoving {...props} />
    </MotionIsland>
  );
}

export { SoundToggle } from "./SoundToggle";
