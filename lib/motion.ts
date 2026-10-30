import type { Transition } from "motion/react";

// Springs and durations from docs/DESIGN.md §6. Import these; never hand tune a spring in a component.
export const springs = {
  /** Presses and taps. */
  snappy: { type: "spring", stiffness: 500, damping: 30 },
  /** Cards, sheets, content entering. */
  gentle: { type: "spring", stiffness: 170, damping: 22 },
  /** Celebrations only. */
  bouncy: { type: "spring", stiffness: 300, damping: 14 },
} as const satisfies Record<string, Transition>;

/** Seconds, for Motion. */
export const durations = {
  tap: 0.1,
  small: 0.18,
  medium: 0.28,
  large: 0.45,
  story: 0.9,
} as const;

/** Content enters top to bottom with a 40 to 60 ms stagger; the primary button enters last. */
export const stagger = {
  children: 0.05,
} as const;

/** The landing's lamp passing beat (components/parampara/HeroLamps.tsx). */
export const lampStory = {
  /** Seconds between one lamp catching and the next. */
  stagger: 0.22,
  /** Milliseconds after load before Hanate hands over the flame. */
  startMs: 700,
  /** Seconds Hanate stays glad once the row is lit. */
  gladFor: 1.4,
} as const;

export const enterUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: springs.gentle },
} as const;

export const haptics = {
  press: 10,
  success: [20, 40, 20],
} as const;

/**
 * Android only in practice; a no-op elsewhere, when the API is missing, and before the person has
 * touched the page (browsers block it then and log an error).
 */
export function vibrate(pattern: number | readonly number[]) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  navigator.vibrate(pattern as number | number[]);
}
