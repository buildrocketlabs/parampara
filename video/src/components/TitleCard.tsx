import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Filled } from "../story-context";
import { colors, fonts, springs } from "../theme";
import { Hanate, type HanateState } from "./Hanate";
import { Grain } from "./Grain";

const TONES = {
  cream: {
    bg: `linear-gradient(180deg, ${colors.cream} 0%, ${colors.dusk} 100%)`,
    kn: colors["clay-cta"],
    en: colors.ink,
    lower: colors["ink-3"],
  },
  ink: { bg: colors.ink, kn: colors.flame, en: colors.paper, lower: colors.mist },
  black: { bg: "#000000", kn: colors.flame, en: colors.paper, lower: colors.mist },
} as const;

/**
 * A title card in our tokens: a Kannada line in Baloo Tamma 2, its English in Plus Jakarta Sans,
 * Hanate if asked, and a lower third. Content enters top to bottom (DESIGN §6 choreography).
 */
export function TitleCard({
  tone = "cream",
  kn,
  en,
  hanate,
  lower,
  credits,
}: {
  tone?: keyof typeof TONES;
  kn?: string;
  en?: string;
  hanate?: HanateState;
  lower?: string;
  /** End credits, small at the top of the frame, clear of the subtitles. */
  credits?: string;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = TONES[tone];
  const enter = (delay: number) => spring({ frame: frame - delay, fps, config: springs.gentle });
  const rise = (delay: number) => ({
    opacity: enter(delay),
    transform: `translateY(${interpolate(enter(delay), [0, 1], [24, 0])}px)`,
  });
  // On black the lamp flickers on: it fades up over the first second, as in the opening.
  const lampIn =
    tone === "black"
      ? interpolate(frame, [fps * 0.6, fps * 2.2], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : enter(0);
  const lowerAt = Math.min(fps * 1.2, durationInFrames * 0.45);

  return (
    // A card with a lower third is tall: it sits above the subtitle band, never under it.
    <AbsoluteFill
      style={{
        background: t.bg,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: lower ? 150 : 0,
      }}
    >
      {tone !== "black" && <Grain />}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          maxWidth: 1500,
          textAlign: "center",
        }}
      >
        {hanate && (
          <div style={{ opacity: lampIn, marginBottom: 8 }}>
            <Hanate state={hanate} size={kn || en ? 220 : 300} />
          </div>
        )}
        {kn && (
          <div
            lang="kn"
            style={{
              ...rise(6),
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: kn.length > 20 ? 84 : 132,
              lineHeight: 1.3,
              color: t.kn,
            }}
          >
            <Filled text={kn} />
          </div>
        )}
        {en && (
          <div
            style={{
              ...rise(12),
              fontFamily: fonts.latin,
              fontWeight: 600,
              fontSize: 48,
              lineHeight: 1.35,
              color: t.en,
            }}
          >
            <Filled text={en} />
          </div>
        )}
        {lower && (
          <div
            style={{
              ...rise(lowerAt),
              marginTop: 18,
              paddingTop: 18,
              borderTop: `2px solid ${t.lower}`,
              fontFamily: fonts.latin,
              fontWeight: 600,
              fontSize: 32,
              color: t.lower,
            }}
          >
            <Filled text={lower} />
          </div>
        )}
      </div>
      {credits && (
        <div
          style={{
            ...rise(lowerAt),
            position: "absolute",
            top: 26,
            left: 80,
            right: 80,
            textAlign: "center",
            fontFamily: fonts.latin,
            fontWeight: 600,
            fontSize: 22,
            lineHeight: 1.4,
            whiteSpace: "pre-line",
            color: t.lower,
          }}
        >
          {credits}
        </div>
      )}
    </AbsoluteFill>
  );
}
