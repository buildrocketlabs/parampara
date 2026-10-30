import { correction, generate } from "lean-qr";
import { toSvgPath } from "lean-qr/extras/svg";

// A QR code drawn on the server (D84): the page sends a plain SVG path, so no QR encoder ever
// ships in client JS. Medium error correction (about 15% of the code can be smudged or glared and
// still read), which a phone screen held up in a sunny classroom needs.

/** The quiet zone the QR standard asks for, in modules, on every side. */
export const QR_QUIET = 4;

export type QrDrawing = { size: number; path: string };

export function qrDrawing(text: string): QrDrawing {
  const code = generate(text, { minCorrectionLevel: correction.M });
  return { size: code.size, path: toSvgPath(code) };
}
