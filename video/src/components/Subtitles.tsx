import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Filled } from "../story-context";
import { colors, fonts } from "../theme";

/** Splits English into sentences or clauses short enough to read, each shown for a share of the scene. */
export function chunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["')]*\s*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  for (const s of sentences.map((x) => x.trim()).filter(Boolean)) {
    if (s.length <= 90) {
      out.push(s);
      continue;
    }
    // A long sentence breaks at a comma or colon near its middle.
    const cut = [...s.matchAll(/[,:] /g)]
      .map((m) => m.index!)
      .sort((a, b) => Math.abs(a - s.length / 2) - Math.abs(b - s.length / 2))[0];
    if (cut === undefined) out.push(s);
    else out.push(s.slice(0, cut + 1).trim(), s.slice(cut + 2).trim());
  }
  return out;
}

/** Which chunk is on screen at a frame: time shared by length, so long lines stay longer. */
export function chunkAt(parts: string[], frame: number, total: number): number {
  const weights = parts.map((p) => Math.max(p.length, 12));
  const sum = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < parts.length; i++) {
    acc += (weights[i]! / sum) * total;
    if (frame < acc) return i;
  }
  return parts.length - 1;
}

/**
 * The subtitle band: the Kannada line (if any) above its English, or the voiceover's words, so the
 * video reads with the sound off. Ink band, mist and paper text (DESIGN §3 pairs on ink).
 */
export function Subtitles({
  kannada,
  english,
  area = { left: 0, right: 0 },
}: {
  kannada?: string;
  english?: string;
  /** Beside a phone the band sits in the right column, so it never covers the screen. */
  area?: { left: number; right: number };
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!kannada && !english) return null;
  const parts = english ? chunks(english) : [];
  const i = chunkAt(parts, frame, durationInFrames);
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: area.left,
        right: area.right,
        bottom: 56,
        display: "flex",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          padding: "16px 36px 18px",
          borderRadius: 22,
          background: "rgba(21, 48, 42, 0.88)",
          textAlign: "center",
          // No widows: lines of even length ("ನೋಡಿ." never alone on a line).
          textWrap: "balance",
        }}
      >
        {kannada && (
          <div
            lang="kn"
            style={{
              fontFamily: fonts.kannada,
              fontWeight: 600,
              fontSize: 46,
              lineHeight: 1.65,
              color: colors.flame,
            }}
          >
            <Filled text={kannada} />
          </div>
        )}
        {parts.length > 0 && (
          <div
            style={{
              fontFamily: fonts.latin,
              fontWeight: 600,
              fontSize: kannada ? 32 : 38,
              lineHeight: 1.4,
              color: kannada ? colors.mist : colors.paper,
            }}
          >
            <Filled text={parts[i]!} />
          </div>
        )}
      </div>
    </div>
  );
}
