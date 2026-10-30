import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts, springs } from "../theme";
import { Hanate, type HanateState } from "./Hanate";

/**
 * "One lamp lights another and loses nothing": Hanate glows, then a row of sleeping lamps (Hanate's
 * own artwork, resting) wake one by one, left to right, and keep flickering out of step.
 */
export function LampRow({
  state = "celebrating",
  lamps = 9,
}: {
  state?: HanateState;
  lamps?: number;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: springs.gentle });
  // Timed to the scene: the lamps wake through its first half, so the title has time to be read.
  const first = Math.min(fps * 1.6, durationInFrames * 0.15);
  const stagger = Math.min(fps * 0.42, (durationInFrames * 0.4) / Math.max(lamps, 1));
  const word = spring({ frame: frame - (first + stagger * lamps), fps, config: springs.gentle });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 35%, ${colors["ink-2"]} 0%, ${colors.ink} 70%)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity: enter,
          transform: `scale(${interpolate(enter, [0, 1], [0.9, 1])})`,
        }}
      >
        <Hanate state={state} size={260} />
      </div>
      <div style={{ display: "flex", gap: 34, marginTop: 34, alignItems: "flex-end" }}>
        {Array.from({ length: lamps }, (_, i) => {
          const at = first + i * stagger;
          const lit = interpolate(frame, [at, at + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const pop = spring({ frame: frame - at, fps, config: springs.bouncy });
          return (
            <div key={i} style={{ position: "relative", width: 96, height: 112 }}>
              <div style={{ position: "absolute", inset: 0, opacity: 1 - lit }}>
                <Hanate state="resting" size={96} phase={i * 0.37} />
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: lit,
                  transform: `scale(${interpolate(pop, [0, 1], [0.92, 1])})`,
                  transformOrigin: "50% 100%",
                }}
              >
                <Hanate state="idle" size={96} phase={i * 0.53} />
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 36,
          opacity: word,
          display: "flex",
          alignItems: "baseline",
          gap: 30,
        }}
      >
        <span
          lang="kn"
          style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 96, color: colors.flame }}
        >
          ಪರಂಪರೆ
        </span>
        <span
          style={{ fontFamily: fonts.latin, fontWeight: 600, fontSize: 48, color: colors.paper }}
        >
          Parampara
        </span>
      </div>
    </AbsoluteFill>
  );
}
