import { AbsoluteFill } from "remotion";

// DESIGN §3: a paper grain overlay at 4%, as an inline SVG noise (no image file).
const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.08  0 0 0 0 0.19  0 0 0 0 0.16  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function Grain() {
  return <AbsoluteFill style={{ backgroundImage: NOISE, opacity: 0.04, pointerEvents: "none" }} />;
}
