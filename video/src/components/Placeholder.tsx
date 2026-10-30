import { colors, fonts, radius } from "../theme";

/** Stands where an asset is missing: says which file, and what it is for. Never a crash. */
export function Placeholder({
  path,
  what,
  note,
  width = "100%",
  height = "100%",
}: {
  path: string;
  what: string;
  note?: string;
  width?: number | string;
  height?: number | string;
}) {
  return (
    <div
      style={{
        width,
        height,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 40,
        background: `repeating-linear-gradient(135deg, ${colors.paper} 0 22px, ${colors.cream} 22px 44px)`,
        border: `4px dashed ${colors["clay-cta"]}`,
        borderRadius: radius.card,
        color: colors.ink,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: fonts.latin,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: 2,
          color: colors["clay-cta"],
        }}
      >
        MISSING {what.toUpperCase()}
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 30, wordBreak: "break-all" }}>
        video/public/{path}
      </div>
      {note && (
        <div
          style={{ fontFamily: fonts.latin, fontSize: 24, color: colors["ink-3"], maxWidth: 900 }}
        >
          {note}
        </div>
      )}
    </div>
  );
}
