import type { CSSProperties } from "react";
import { colors } from "../../lib/tokens";

// The app's tokens (lib/tokens.ts, DESIGN §3), read from the same file, never retyped.
export { colors };

/** clay-lip lives only in app/globals.css (the ChunkyButton lip); Hanate's oil uses it. */
const CLAY_LIP = "#8e3624";

/** The CSS variables Hanate's artwork reads (`var(--color-flame)` and friends). */
export const cssVars = {
  ...Object.fromEntries(Object.entries(colors).map(([k, v]) => [`--color-${k}`, v])),
  "--color-clay-lip": CLAY_LIP,
} as CSSProperties;

export const fonts = {
  /** Baloo Tamma 2: display, Kannada and Latin (headlines, numbers). */
  display: "'Baloo Tamma 2', 'Noto Sans Kannada', sans-serif",
  /** Noto Sans Kannada: Kannada body and subtitles. */
  kannada: "'Noto Sans Kannada', 'Baloo Tamma 2', sans-serif",
  /** Plus Jakarta Sans: Latin body and English subtitles. */
  latin: "'Plus Jakarta Sans', 'Noto Sans Kannada', sans-serif",
} as const;

/** DESIGN §3: warm tinted shadows, never grey. */
export const shadow = {
  warm: "0 18px 50px rgba(200, 85, 61, 0.18), 0 4px 14px rgba(242, 169, 59, 0.16)",
  deep: "0 40px 90px rgba(21, 48, 42, 0.35), 0 10px 30px rgba(200, 85, 61, 0.18)",
} as const;

export const radius = { card: 28, sheet: 32, chip: 999, button: 18 } as const;

/** DESIGN §6 springs, for Remotion's spring(). */
export const springs = {
  snappy: { stiffness: 500, damping: 30, mass: 1 },
  gentle: { stiffness: 170, damping: 22, mass: 1 },
  bouncy: { stiffness: 300, damping: 14, mass: 1 },
} as const;
