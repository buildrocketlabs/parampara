import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts, radius, shadow, springs } from "../theme";

// Child safety, shown rather than said: a teacher's typed words name a child, and the name turns
// into ಒಂದು ಮಗು before anything is stored (triage does exactly this, ai/roles/triage.ts); then the
// Childline 1098 card a child welfare disclosure brings (CLAUDE.md Law 5). The name is made up.

const NAME = "ರಾಮು";
const REST = " ಇನ್ನೂ ಅಕ್ಷರ ಬರೆಯುತ್ತಿಲ್ಲ.";
const CHILD = "ಒಂದು ಮಗು";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function SafetyRedact() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: d } = useVideoConfig();
  // 0 to 30%: the sentence types. 30 to 50%: the name is caught and becomes ಒಂದು ಮಗು. 55%: 1098.
  const typed = Math.round(
    interpolate(frame, [0.04 * d, 0.3 * d], [0, (NAME + REST).length], clamp),
  );
  const swap = interpolate(frame, [0.36 * d, 0.48 * d], [0, 1], clamp);
  const mark = interpolate(frame, [0.3 * d, 0.36 * d], [0, 1], clamp);
  const card = spring({ frame: frame - 0.55 * d, fps, config: springs.gentle });
  const shown = (NAME + REST).slice(0, typed);
  // Half of the second card's width plus the gap: the row is centred while only one card shows.
  const shift = (1 - card) * 275;
  const nameShown = shown.slice(0, NAME.length);
  const restShown = shown.slice(NAME.length);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 40% 40%, ${colors["ink-2"]} 0%, ${colors.ink} 75%)`,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 80,
        paddingBottom: 120,
      }}
    >
      <div
        style={{
          width: 900,
          transform: `translateX(${shift}px)`,
          padding: "44px 52px",
          borderRadius: radius.card,
          background: colors.paper,
          boxShadow: shadow.deep,
        }}
      >
        <div
          style={{ fontFamily: fonts.latin, fontWeight: 600, fontSize: 24, color: colors["ink-3"] }}
        >
          A teacher types (an example; the name is made up)
        </div>
        <div
          lang="kn"
          style={{
            marginTop: 18,
            minHeight: 140,
            fontFamily: fonts.kannada,
            fontWeight: 600,
            fontSize: 54,
            lineHeight: 1.45,
            color: colors.ink,
          }}
        >
          {/* The name fades out, then ಒಂದು ಮಗು fades in, in the same place: one swap, no gap. */}
          {swap < 0.5 ? (
            <span
              style={{
                opacity: 1 - swap * 2,
                textDecoration: mark > 0 ? "line-through" : "none",
                textDecorationColor: colors["clay-cta"],
                textDecorationThickness: 5,
                background: `rgba(242, 169, 59, ${0.35 * mark})`,
                borderRadius: 10,
                padding: "0 6px",
              }}
            >
              {nameShown}
            </span>
          ) : (
            <span style={{ opacity: swap * 2 - 1, color: colors["clay-cta"], padding: "0 6px" }}>{CHILD}</span>
          )}
          {restShown}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: fonts.latin,
            fontWeight: 600,
            fontSize: 26,
            color: colors["ink-3"],
            opacity: interpolate(swap, [0.6, 1], [0, 1], clamp),
          }}
        >
          Stored as "a child". The name never reaches the database, the answer or the logs.
        </div>
      </div>
      <div
        style={{
          width: 470,
          padding: "40px 44px",
          borderRadius: radius.card,
          background: colors.cream,
          boxShadow: shadow.warm,
          opacity: card,
          transform: `translate(${shift}px, ${interpolate(card, [0, 1], [40, 0])}px)`,
        }}
      >
        <div
          lang="kn"
          style={{
            fontFamily: fonts.kannada,
            fontWeight: 600,
            fontSize: 30,
            color: colors["ink-3"],
          }}
        >
          ಮಕ್ಕಳ ಸಹಾಯವಾಣಿ
        </div>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 150,
            lineHeight: 1.05,
            color: colors["clay-cta"],
          }}
        >
          1098
        </div>
        <div
          style={{
            fontFamily: fonts.latin,
            fontWeight: 600,
            fontSize: 26,
            lineHeight: 1.4,
            color: colors.ink,
          }}
        >
          Childline. A child at risk goes to a person, never to the AI alone.
        </div>
      </div>
    </AbsoluteFill>
  );
}
