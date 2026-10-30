import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import india from "../data/india-states.json";
import { colors, fonts, radius } from "../theme";

// The vision beat: one lamp in Koppal, then Karnataka, then the lamps spread state by state.
// Drawn from real boundaries (DataMeet, Survey of India based, CC BY 4.0; scripts/india-map.mjs),
// never generated: a wrong outline of India would be noticed at once.

type State = { name: string; d: string; c: [number, number] };
const { width, height, projection, states } = india as unknown as {
  width: number;
  height: number;
  projection: { lon0: number; lat1: number; k: number; scale: number };
  states: State[];
};

const project = (lon: number, lat: number): [number, number] => [
  (lon - projection.lon0) * projection.k * projection.scale,
  (projection.lat1 - lat) * projection.scale,
];

/** Koppal, where the first lamp is (15.35 N, 76.15 E). */
const KOPPAL = project(76.15, 15.35);

// Karnataka first, then every other state by its distance from Koppal: the light travels outward.
const ORDER = [...states]
  .map((s) => ({
    ...s,
    dist: s.name === "Karnataka" ? -1 : Math.hypot(s.c[0] - KOPPAL[0], s.c[1] - KOPPAL[1]),
  }))
  .sort((a, b) => a.dist - b.dist);

function Lamp({ x, y, on, size }: { x: number; y: number; on: number; size: number }) {
  if (on <= 0) return null;
  return (
    <g opacity={on}>
      <circle cx={x} cy={y} r={size * 3.2} fill="url(#glow)" />
      <circle cx={x} cy={y} r={size * 0.55} fill={colors.flame} />
    </g>
  );
}

export function IndiaMap({ caption }: { caption?: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / Math.max(durationInFrames - 1, 1);
  // 0 to 0.12: Koppal's lamp. 0.12 to 0.25: Karnataka warms. 0.25 to 0.85: the rest, outward.
  const lit = (i: number) =>
    i === 0
      ? interpolate(t, [0.1, 0.24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(
          t,
          [0.25 + (0.6 * (i - 1)) / ORDER.length, 0.33 + (0.6 * (i - 1)) / ORDER.length],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
  const first = interpolate(t, [0, 0.1], [0, 1], { extrapolateRight: "clamp" });
  // Leaves the bottom band to the subtitles, so the southern tip is never covered.
  const scale = 800 / height;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 60%, #22403a 0%, ${colors.ink} 70%)`,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 70,
      }}
    >
      <svg
        width={width * scale}
        height={height * scale}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <radialGradient id="glow">
            <stop offset="0%" stopColor={colors.flame} stopOpacity={0.85} />
            <stop offset="45%" stopColor={colors["flame-deep"]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colors["flame-deep"]} stopOpacity={0} />
          </radialGradient>
        </defs>
        {ORDER.map((s, i) => {
          const on = lit(i);
          return (
            <path
              key={s.name}
              d={s.d}
              fill={colors["flame-deep"]}
              fillOpacity={0.05 + on * (s.name === "Karnataka" ? 0.5 : 0.3)}
              stroke={colors.paper}
              strokeOpacity={0.22 + on * 0.25}
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          );
        })}
        {ORDER.slice(1).map((s, i) => (
          <Lamp key={s.name} x={s.c[0]} y={s.c[1]} on={lit(i + 1)} size={7} />
        ))}
        <Lamp x={KOPPAL[0]} y={KOPPAL[1]} on={first} size={11} />
      </svg>
      {caption && (
        <div
          style={{
            position: "absolute",
            left: 64,
            top: 56,
            color: colors.paper,
            fontFamily: fonts.latin,
            fontWeight: 600,
            fontSize: 32,
          }}
        >
          {caption}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 40,
          padding: "6px 18px",
          borderRadius: radius.chip,
          background: colors.paper,
          color: colors.ink,
          fontFamily: fonts.latin,
          fontWeight: 600,
          fontSize: 22,
        }}
      >
        Illustration
      </div>
      <div
        style={{
          position: "absolute",
          right: 40,
          bottom: 28,
          color: colors.paper,
          opacity: 0.55,
          fontFamily: fonts.latin,
          fontSize: 18,
        }}
      >
        Boundaries: DataMeet India community (Survey of India based), CC BY 4.0
      </div>
    </AbsoluteFill>
  );
}
