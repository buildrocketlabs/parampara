// Colour tokens from docs/DESIGN.md §3. app/globals.css repeats these hex values for Tailwind;
// tests/brand-contrast.test.ts fails if the two ever drift or a pair loses its contrast.
export const colors = {
  ink: "#15302A",
  "ink-2": "#21453C",
  "ink-3": "#2C574C",
  cream: "#F7F3EA",
  paper: "#FFFDF8",
  sage: "#DFE9D5",
  moss: "#3F6B57",
  muted: "#5B6B64",
  mist: "#A9C4B8",
  clay: "#C8553D",
  "clay-cta": "#B5472F",
  "clay-glow": "#E8866C",
  flame: "#FFC94D",
  "flame-deep": "#F2A93B",
  dusk: "#F3E3D3",
  white: "#FFFFFF",
} as const;

export type ColorToken = keyof typeof colors;

type Usage = "normal" | "large";

/** Every text pair DESIGN.md states, with its stated ratio. `large` pairs need 3:1, normal 4.5:1. */
export const contrastPairs: ReadonlyArray<{
  fg: ColorToken;
  bg: ColorToken;
  stated?: number;
  usage: Usage;
}> = [
  { fg: "ink", bg: "cream", stated: 12.74, usage: "normal" },
  { fg: "ink-3", bg: "cream", stated: 7.37, usage: "normal" },
  { fg: "ink", bg: "sage", stated: 11.26, usage: "normal" },
  { fg: "moss", bg: "cream", stated: 5.49, usage: "normal" },
  { fg: "muted", bg: "cream", stated: 5.08, usage: "normal" },
  { fg: "mist", bg: "ink", stated: 7.58, usage: "normal" },
  { fg: "clay", bg: "cream", stated: 3.93, usage: "large" },
  { fg: "white", bg: "clay-cta", stated: 5.37, usage: "normal" },
  { fg: "clay-cta", bg: "cream", stated: 4.85, usage: "normal" },
  { fg: "clay-glow", bg: "ink", stated: 5.41, usage: "normal" },
  { fg: "ink", bg: "flame", stated: 9.22, usage: "normal" },
  // "White text sits only on clay-cta, ink, ink-2, moss."
  { fg: "white", bg: "ink", usage: "normal" },
  { fg: "white", bg: "ink-2", usage: "normal" },
  { fg: "white", bg: "moss", usage: "normal" },
  // The dusk end of the gradient: secondary text there must be ink-3 (muted is 4.48:1, too low).
  { fg: "ink-3", bg: "dusk", usage: "normal" },
  { fg: "ink", bg: "dusk", usage: "normal" },
  // Clay on dusk is for large display lines only (the hero coda), never body text.
  { fg: "clay-cta", bg: "dusk", usage: "large" },
  // Officer screens (M5): quiet lines on the chalkboard's cards, labels on sage.
  { fg: "mist", bg: "ink-2", usage: "normal" },
  { fg: "ink-3", bg: "sage", usage: "normal" },
  { fg: "flame", bg: "ink", usage: "normal" },
  { fg: "flame", bg: "ink-2", usage: "normal" },
];

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
