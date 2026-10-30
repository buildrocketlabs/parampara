import { AbsoluteFill } from "remotion";
import { Hanate } from "./components/Hanate";
import { colors, cssVars, fonts } from "./theme";

// The YouTube thumbnail (1280 x 720): his lamp, the promise, the name. Hanate is the app's own
// artwork, so nothing here is generated. Rendered by `pnpm --dir video thumbnail`.
export function Thumbnail() {
  return (
    <AbsoluteFill
      style={{
        ...cssVars,
        background: `radial-gradient(ellipse at 28% 55%, #3a3a26 0%, ${colors["ink-2"]} 38%, ${colors.ink} 78%)`,
        flexDirection: "row",
        alignItems: "center",
        padding: "0 70px 0 40px",
        gap: 30,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 150,
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(242,169,59,0.45) 0%, rgba(242,169,59,0) 70%)",
        }}
      />
      <div style={{ flexShrink: 0, position: "relative" }}>
        <Hanate state="idle" size={470} still />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            fontFamily: fonts.latin,
            fontWeight: 800,
            fontSize: 84,
            lineHeight: 1.02,
            color: colors.paper,
            letterSpacing: -1.5,
          }}
        >
          His wisdom won&rsquo;t retire.
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
          <span
            lang="kn"
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: 96,
              color: colors.flame,
            }}
          >
            ಪರಂಪರೆ
          </span>
          <span
            style={{ fontFamily: fonts.latin, fontWeight: 600, fontSize: 40, color: colors.mist }}
          >
            Parampara
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
