import { cn } from "@/lib/utils";
import { poseStyle } from "./hanate/still";

// LampRow's first frame, in plain SVG (no Motion on first load, DESIGN §10): all dark, or all lit
// (reduced motion). Same artwork and poses as LampRow, so the swap to the moving row shows nothing.
const ORIGIN_CENTRE = { transformBox: "fill-box", originX: 0.5, originY: 0.5 };
const ORIGIN_WICK = { transformBox: "fill-box", originX: 0.5, originY: 1 };

export function LampRowStill({
  count = 5,
  lit,
  onDark = false,
  className,
}: {
  count?: number;
  lit: boolean;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-center gap-2 sm:gap-4", className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 40 44"
          className="h-11 w-10 overflow-visible sm:h-16 sm:w-[58px]"
          data-lamp={i}
        >
          <circle
            cx="20"
            cy="14"
            r="17"
            fill={onDark ? "var(--color-flame-deep)" : "var(--color-flame)"}
            style={poseStyle(
              ORIGIN_CENTRE,
              lit ? { opacity: onDark ? 0.25 : 0.45, scale: 1 } : { opacity: 0, scale: 0.2 },
            )}
          />
          <path
            d="M20 26 L20 21"
            stroke="var(--color-ink-2)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g
            style={poseStyle(
              ORIGIN_WICK,
              lit ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 },
            )}
          >
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
          <path d="M4 27 C4 37 11 42 20 42 C29 42 36 37 36 27 Z" fill="var(--color-clay)" />
          <ellipse cx="20" cy="27" rx="16" ry="3.6" fill="var(--color-clay-cta)" />
        </svg>
      ))}
    </div>
  );
}
