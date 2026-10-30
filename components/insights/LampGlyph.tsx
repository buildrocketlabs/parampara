import { cn } from "@/lib/utils";

// One small clay diya (the same drawing as LampRow and the Wordmark). Lit: a flame that flickers by
// size only when asked (animate-flicker; off by default, since only Hanate loops forever). Unlit: the bare wick,
// so a dark lamp still reads as a lamp. No hooks, so server pages can draw rows of them.
export function LampGlyph({
  lit,
  scale = 1,
  size = 40,
  flicker = false,
  className,
  style,
}: {
  lit: boolean;
  /** 0.5 to 1: lamps sized by how many times an idea worked. */
  scale?: number;
  size?: number;
  flicker?: boolean;
  className?: string;
  /** For a size that follows CSS (a custom property), set width here and h-auto in className. */
  style?: React.CSSProperties;
}) {
  const w = Math.round(size * scale);
  return (
    <svg
      viewBox="0 0 40 44"
      width={w}
      height={Math.round(w * 1.1)}
      aria-hidden
      className={cn("shrink-0 overflow-visible", className)}
      style={style}
    >
      {lit && <circle cx="20" cy="15" r="16" fill="var(--color-flame)" opacity="0.4" />}
      <path d="M20 26 L20 21" stroke="var(--color-ink-2)" strokeWidth="2" strokeLinecap="round" />
      {lit && (
        <g className={cn(flicker && "animate-flicker")} style={{ transformBox: "fill-box" }}>
          <path
            d="M20 2 C23 8 27 12 27 17 C27 21.5 24 24 20 24 C16 24 13 21.5 13 17 C13 12 17 8 20 2 Z"
            fill="var(--color-flame)"
          />
          <path
            d="M20 13 C21.4 16 23 18 23 20 C23 22 21.6 23 20 23 C18.4 23 17 22 17 20 C17 18 18.6 16 20 13 Z"
            fill="var(--color-paper)"
            opacity="0.9"
          />
        </g>
      )}
      <path
        d="M4 27 C4 37 11 42 20 42 C29 42 36 37 36 27 Z"
        fill={lit ? "var(--color-clay)" : "var(--color-mist)"}
      />
      <ellipse
        cx="20"
        cy="27"
        rx="16"
        ry="3.6"
        fill={lit ? "var(--color-clay-cta)" : "var(--color-ink-3)"}
        opacity={lit ? 1 : 0.35}
      />
    </svg>
  );
}
