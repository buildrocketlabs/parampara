import type { TargetAndTransition, Transition } from "motion/react";

// Hanate's states (DESIGN §5). The flame carries the emotion; the clay body only floats and hops.
// Each part animates at most three properties. `still` is the reduced motion pose for that state.
export const HANATE_STATES = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "happy",
  "caring",
  "resting",
  "celebrating",
] as const;

export type HanateState = (typeof HANATE_STATES)[number];

export type Part = { loop: TargetAndTransition; still: TargetAndTransition };

const loop = (t: Transition): Transition => ({ repeat: Infinity, ease: "easeInOut", ...t });

// Uneven keyframe timings read as a living flame rather than a metronome.
const FLICKER_TIMES = [0, 0.18, 0.42, 0.7, 1];

export const flame: Record<HanateState, Part> = {
  idle: {
    loop: {
      scaleY: [1, 1.06, 0.97, 1.04, 1],
      scaleX: [1, 0.96, 1.03, 0.98, 1],
      rotate: [0, -2, 1.5, -1, 0],
      transition: loop({ duration: 2.6, times: FLICKER_TIMES }),
    },
    still: { scaleY: 1, scaleX: 1, rotate: 0 },
  },
  listening: {
    loop: {
      rotate: [9, 13, 8, 12, 9],
      scaleY: [1.04, 1.1, 1.02, 1.08, 1.04],
      transition: loop({ duration: 1.6, times: FLICKER_TIMES }),
    },
    still: { rotate: 10, scaleY: 1.05, scaleX: 1 },
  },
  thinking: {
    loop: {
      scaleY: [1, 1.1, 0.95, 1.08, 1],
      rotate: [0, -3, 2, -2, 0],
      transition: loop({ duration: 1.3, times: FLICKER_TIMES }),
    },
    still: { scaleY: 1.04, scaleX: 1, rotate: 0 },
  },
  speaking: {
    loop: {
      scale: [1, 1.12, 1],
      transition: loop({ duration: 0.55 }),
    },
    still: { scale: 1.06, rotate: 0 },
  },
  happy: {
    loop: {
      scale: [1.16, 1.24, 1.16],
      rotate: [0, -3, 0],
      transition: loop({ duration: 1.4 }),
    },
    still: { scale: 1.2, rotate: 0 },
  },
  caring: {
    // Lowered clearly below idle (DESIGN §5 caring: "flame lowers"), still warm.
    loop: {
      scale: [0.68, 0.72, 0.68],
      rotate: [-8, -6, -8],
      transition: loop({ duration: 3.6 }),
    },
    still: { scale: 0.7, rotate: -7 },
  },
  resting: {
    loop: {
      scale: [0.36, 0.42, 0.36],
      transition: loop({ duration: 4.2 }),
    },
    still: { scale: 0.38, rotate: 0 },
  },
  celebrating: {
    loop: {
      scale: [1.22, 1.32, 1.2, 1.28, 1.22],
      rotate: [0, -4, 3, -2, 0],
      transition: loop({ duration: 1.1, times: FLICKER_TIMES }),
    },
    still: { scale: 1.26, rotate: 0 },
  },
};

export const glow: Record<HanateState, Part> = {
  idle: {
    loop: { scale: [1, 1.08, 1], opacity: [0.55, 0.8, 0.55], transition: loop({ duration: 3.2 }) },
    still: { scale: 1, opacity: 0.65 },
  },
  listening: {
    loop: {
      scale: [1.05, 1.15, 1.05],
      opacity: [0.7, 0.9, 0.7],
      transition: loop({ duration: 1.6 }),
    },
    still: { scale: 1.1, opacity: 0.8 },
  },
  thinking: {
    loop: { scale: [1, 1.12, 1], opacity: [0.6, 0.9, 0.6], transition: loop({ duration: 1.3 }) },
    still: { scale: 1.05, opacity: 0.75 },
  },
  speaking: {
    loop: { scale: [1, 1.14, 1], opacity: [0.7, 0.95, 0.7], transition: loop({ duration: 0.55 }) },
    still: { scale: 1.08, opacity: 0.8 },
  },
  happy: {
    loop: { scale: [1.2, 1.3, 1.2], opacity: [0.85, 1, 0.85], transition: loop({ duration: 1.4 }) },
    still: { scale: 1.25, opacity: 0.95 },
  },
  caring: {
    loop: {
      scale: [0.8, 0.86, 0.8],
      opacity: [0.4, 0.55, 0.4],
      transition: loop({ duration: 3.6 }),
    },
    still: { scale: 0.82, opacity: 0.45 },
  },
  resting: {
    loop: {
      scale: [0.45, 0.55, 0.45],
      opacity: [0.3, 0.45, 0.3],
      transition: loop({ duration: 4.2 }),
    },
    still: { scale: 0.5, opacity: 0.35 },
  },
  celebrating: {
    loop: { scale: [1.3, 1.45, 1.3], opacity: [0.9, 1, 0.9], transition: loop({ duration: 1.1 }) },
    still: { scale: 1.35, opacity: 1 },
  },
};

export const body: Record<HanateState, Part> = {
  idle: { loop: { y: [0, -3, 0], transition: loop({ duration: 3.6 }) }, still: { y: 0 } },
  listening: { loop: { y: [0, -2, 0], transition: loop({ duration: 2.4 }) }, still: { y: 0 } },
  thinking: { loop: { y: [0, -2, 0], transition: loop({ duration: 2 }) }, still: { y: 0 } },
  speaking: { loop: { y: [0, -1.5, 0], transition: loop({ duration: 1.1 }) }, still: { y: 0 } },
  happy: {
    loop: { y: [0, -10, 0, 0], transition: loop({ duration: 1.4, times: [0, 0.25, 0.5, 1] }) },
    still: { y: 0 },
  },
  caring: { loop: { y: [0, -1.5, 0], transition: loop({ duration: 4 }) }, still: { y: 0 } },
  resting: { loop: { y: [0, 1, 0], transition: loop({ duration: 4.2 }) }, still: { y: 0 } },
  celebrating: {
    loop: {
      y: [0, -12, 0, -6, 0],
      transition: loop({ duration: 1.2, times: [0, 0.2, 0.45, 0.65, 1] }),
    },
    still: { y: 0 },
  },
};

/** Blink every few seconds; the long hold keeps it from feeling mechanical. */
export const blink: TargetAndTransition = {
  scaleY: [1, 1, 0.1, 1],
  transition: { duration: 5.4, times: [0, 0.93, 0.96, 1], repeat: Infinity, repeatDelay: 0.8 },
};

/**
 * Each still pose is its loop's first frame (DESIGN §10): the page ships Hanate holding still, the
 * living lamp loads at idle and starts its loop from exactly that frame, so nothing jumps. Reduced
 * motion holds this pose. Keys the loop does not move keep the still values above.
 */
function firstFrame(loop: TargetAndTransition): TargetAndTransition {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(loop)) {
    if (k === "transition") continue;
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out as TargetAndTransition;
}
for (const parts of [flame, glow, body]) {
  for (const state of HANATE_STATES) {
    parts[state] = {
      ...parts[state],
      still: { ...parts[state].still, ...firstFrame(parts[state].loop) },
    };
  }
}

export const SPARK_STATES: ReadonlySet<HanateState> = new Set(["thinking", "celebrating"]);
export const CLOSED_EYE_STATES: ReadonlySet<HanateState> = new Set([
  "happy",
  "celebrating",
  "resting",
]);
