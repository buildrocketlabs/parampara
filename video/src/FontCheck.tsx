import { AbsoluteFill } from "remotion";
import { Hanate } from "./components/Hanate";
import { Grain } from "./components/Grain";
import { colors, cssVars, fonts } from "./theme";

// One frame to check Kannada shaping in Remotion's Chrome: conjuncts (ಕ್ಯಾ, ಸ್ಕ್ಯಾ, ನ್ನೊ, ಚ್ಚು, ದ್ದೀ),
// vowel signs and the ZWNJ in ವಾಟ್ಸ್‌ಆ್ಯಪ್, in each face we use, beside Hanate.
const LINES = [
  "ಪರಂಪರೆ",
  "ಕ್ಯಾಮೆರಾದಿಂದ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
  "ಒಂದು ದೀಪ ಇನ್ನೊಂದು ದೀಪ ಹಚ್ಚುತ್ತದೆ",
  "ನೀವು ಇಂದು ದೀಪ ಹಚ್ಚಿದ್ದೀರಿ · ಮಹೇಶ ಬೆದವಟ್ಟಿ · ವಾಟ್ಸ್‌ಆ್ಯಪ್",
];

export function FontCheck() {
  return (
    <AbsoluteFill
      style={{
        ...cssVars,
        background: colors.cream,
        padding: "70px 90px",
        flexDirection: "row",
        gap: 60,
      }}
    >
      <Grain />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <Label>Baloo Tamma 2 (display)</Label>
        {LINES.slice(0, 2).map((l) => (
          <div
            key={l}
            lang="kn"
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 92,
              lineHeight: 1.3,
              color: colors["clay-cta"],
            }}
          >
            {l}
          </div>
        ))}
        <Label>Noto Sans Kannada (body and subtitles)</Label>
        {LINES.slice(2).map((l) => (
          <div
            key={l}
            lang="kn"
            style={{
              fontFamily: fonts.kannada,
              fontWeight: 600,
              fontSize: 52,
              lineHeight: 1.65,
              color: colors.ink,
            }}
          >
            {l}
          </div>
        ))}
        <Label>Plus Jakarta Sans (English)</Label>
        <div style={{ fontFamily: fonts.latin, fontWeight: 600, fontSize: 44, color: colors.ink }}>
          One lamp lights another and loses nothing.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <Hanate state="idle" size={300} still />
        <Label>Hanate (app artwork)</Label>
      </div>
    </AbsoluteFill>
  );
}

function Label({ children }: { children: string }) {
  return (
    <div
      style={{
        fontFamily: fonts.latin,
        fontSize: 24,
        fontWeight: 600,
        color: colors.muted,
        marginTop: 14,
      }}
    >
      {children}
    </div>
  );
}
