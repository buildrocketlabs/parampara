"use client";

import * as m from "motion/react-m";
import { springs } from "@/lib/motion";
import type { MicOrbState } from "./MicOrb";
import { BAR_SHAPE } from "./orb-shape";
import { MotionIsland } from "./MotionIsland";

// MicOrb's moving parts, loaded at idle and swapped in for the still ones (DESIGN §10). The still
// glow is the idle loop's first frame, so the loop starts without a jump.
function OrbHaloMoving({
  state,
  reduced,
  amp,
}: {
  state: MicOrbState;
  reduced: boolean;
  amp: number;
}) {
  const listening = state === "listening";
  return (
    <>
      {/* idle: a slow breathing glow */}
      {state === "idle" && (
        <m.span
          aria-hidden
          className="absolute size-[104px] rounded-chip bg-flame/45"
          // The still glow's pose (MicOrb's StillHalo): the loop leaves from exactly here.
          initial={reduced ? false : { scale: 1.06, opacity: 0.5 }}
          animate={
            reduced
              ? { scale: 1.14, opacity: 0.5 }
              : { scale: [1.06, 1.26, 1.06], opacity: [0.5, 0.15, 0.5] }
          }
          transition={
            reduced ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
          }
        />
      )}

      {/* listening: ripples outward, and two rings that follow the voice */}
      {listening &&
        !reduced &&
        [0, 0.8].map((delay) => (
          <m.span
            key={delay}
            aria-hidden
            className="absolute size-[104px] rounded-chip border-2 border-clay/50"
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: [1, 1.75], opacity: [0.55, 0] }}
            transition={{ duration: 1.6, delay, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
      {listening && (
        <>
          <m.span
            initial={false}
            aria-hidden
            className="absolute size-[104px] rounded-chip bg-clay/15"
            animate={{ scale: 1.12 + amp * 0.62 }}
            transition={springs.snappy}
          />
          <m.span
            initial={false}
            aria-hidden
            className="absolute size-[104px] rounded-chip bg-flame/35"
            animate={{ scale: 1.04 + amp * 0.32 }}
            transition={springs.snappy}
          />
        </>
      )}
    </>
  );
}

// Five white bars that follow the voice while listening: the mic is hearing you.

function VoiceBarsMoving({ level }: { level: number }) {
  return (
    <span aria-hidden className="flex h-11 items-center gap-1.5">
      {BAR_SHAPE.map((k, i) => (
        <m.span
          initial={false}
          key={i}
          className="block h-11 w-[7px] origin-center rounded-chip bg-white"
          animate={{ scaleY: 0.18 + level * k * 0.82 }}
          transition={springs.snappy}
        />
      ))}
    </span>
  );
}

/** OrbHalo, inside its own Motion island (components/parampara/MotionIsland). */
export function OrbHalo(props: React.ComponentProps<typeof OrbHaloMoving>) {
  return (
    <MotionIsland>
      <OrbHaloMoving {...props} />
    </MotionIsland>
  );
}

/** VoiceBars, inside its own Motion island (components/parampara/MotionIsland). */
export function VoiceBars(props: React.ComponentProps<typeof VoiceBarsMoving>) {
  return (
    <MotionIsland>
      <VoiceBarsMoving {...props} />
    </MotionIsland>
  );
}
