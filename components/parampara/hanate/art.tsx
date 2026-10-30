import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { CLOSED_EYE_STATES, type HanateState } from "./variants";

// Hanate's artwork, drawn once for both versions: the still lamp that ships with the page, and the
// living one (HanateLive, Motion) that replaces it once loaded at idle (DESIGN §10). The parts that
// move are passed in: Motion's m.* elements, or plain SVG elements holding the still pose.

export type HanateProps = {
  state?: HanateState;
  /** Rendered width in px; height follows the 120:140 artwork. */
  size?: number;
  /** Accessible name. Pass "" when Hanate is decoration beside text that already speaks. */
  label?: string;
  className?: string;
};

/** A Motion target: transform and opacity values, or keyframe arrays (and their transition). */
export type Pose = {
  y?: unknown;
  scale?: unknown;
  scaleX?: unknown;
  scaleY?: unknown;
  rotate?: unknown;
  opacity?: unknown;
  transition?: unknown;
};

export type PartProps = {
  initial?: Pose;
  animate?: Pose;
  transition?: unknown;
  style?: Record<string, unknown>;
  children?: ReactNode;
} & Record<string, unknown>;

export type Part = (props: PartProps) => ReactNode;
export type Parts = { G: Part; Circle: Part; Ellipse: Part };

export type Poses = {
  /** Where each moving part starts (the still pose): Motion needs it said when it mounts late. */
  initial?: Partial<Record<"ground" | "body" | "glow" | "eyes" | "flame", Pose>>;
  ground: Pose;
  groundTransition?: unknown;
  body: Pose;
  glow: Pose;
  eyes: Pose;
  flame: Pose;
};

// Origins are fractions of each part's own box (transform-box: fill-box): the flame pivots on the wick.
export const FLAME_ORIGIN = { transformBox: "fill-box", originX: 0.5, originY: 1 } as const;
export const CENTRE_ORIGIN = { transformBox: "fill-box", originX: 0.5, originY: 0.5 } as const;

export function HanateArt({
  state = "idle",
  size = 160,
  label = "Hanate",
  className,
  uid,
  svgRef,
  parts: { G, Circle, Ellipse },
  poses,
  sparks,
}: HanateProps & {
  uid: string;
  svgRef?: Ref<SVGSVGElement>;
  parts: Parts;
  poses: Poses;
  sparks?: ReactNode;
}) {
  const closedEyes = CLOSED_EYE_STATES.has(state);
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      data-state={state}
      className={cn("overflow-visible", className)}
    >
      <defs>
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0%" stopColor="var(--color-flame)" stopOpacity="0.9" />
          <stop offset="55%" stopColor="var(--color-flame)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-flame)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`flame-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-flame)" />
          <stop offset="100%" stopColor="var(--color-flame-deep)" />
        </linearGradient>
      </defs>

      {/* ground shadow breathes with the float */}
      <Ellipse
        cx="60"
        cy="133"
        rx="30"
        ry="4"
        fill="var(--color-ink)"
        opacity={0.12}
        style={CENTRE_ORIGIN}
        initial={poses.initial?.ground}
        animate={poses.ground}
        transition={poses.groundTransition}
      />

      <G initial={poses.initial?.body} animate={poses.body}>
        <Circle
          data-part="glow"
          cx="60"
          cy="48"
          r="34"
          fill={`url(#glow-${uid})`}
          style={CENTRE_ORIGIN}
          initial={poses.initial?.glow}
          animate={poses.glow}
        />

        {sparks}

        {/* foot */}
        <ellipse cx="60" cy="122" rx="17" ry="5" fill="var(--color-clay-cta)" />

        {/* bowl */}
        <path
          data-part="body"
          d="M16 79 C16 106 36 121 60 121 C84 121 104 106 104 79 Z"
          fill="var(--color-clay)"
        />
        <path
          d="M27 91 C29 101 35 108 43 112"
          stroke="var(--color-clay-glow)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />

        {/* rim and oil */}
        <ellipse data-part="rim" cx="60" cy="79" rx="44" ry="9" fill="var(--color-clay-cta)" />
        <ellipse cx="60" cy="78.5" rx="36" ry="5.5" fill="var(--color-clay-lip)" />

        {/* wick */}
        <path
          d="M60 78 L60 70"
          stroke="var(--color-ink-2)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* face */}
        <g data-part="cheeks" fill="var(--color-flame-deep)" opacity="0.6">
          <ellipse cx="36" cy="101" rx="6.5" ry="3.6" />
          <ellipse cx="84" cy="101" rx="6.5" ry="3.6" />
        </g>
        {closedEyes ? (
          <g
            data-part="eyes"
            stroke="var(--color-ink)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          >
            {state === "resting" ? (
              <>
                <path d="M41 95 Q46 98 51 95" />
                <path d="M69 95 Q74 98 79 95" />
              </>
            ) : (
              <>
                <path d="M41 96 Q46 89 51 96" />
                <path d="M69 96 Q74 89 79 96" />
              </>
            )}
          </g>
        ) : (
          <G
            data-part="eyes"
            style={CENTRE_ORIGIN}
            initial={poses.initial?.eyes}
            animate={poses.eyes}
          >
            <ellipse cx="46" cy="93" rx="4.2" ry="5.4" fill="var(--color-ink)" />
            <ellipse cx="74" cy="93" rx="4.2" ry="5.4" fill="var(--color-ink)" />
            <circle cx="47.6" cy="91" r="1.4" fill="var(--color-paper)" />
            <circle cx="75.6" cy="91" r="1.4" fill="var(--color-paper)" />
          </G>
        )}
        {/* Caring (DESIGN §5: calm, a human to turn to) keeps a soft, near level mouth, not a grin. */}
        <path
          d={state === "caring" ? "M56 105 Q60 105.8 64 105" : "M54 103 Q60 108.5 66 103"}
          stroke="var(--color-ink)"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* flame */}
        <G
          data-part="flame"
          style={FLAME_ORIGIN}
          initial={poses.initial?.flame}
          animate={poses.flame}
        >
          <path
            data-part="flame-outer"
            d="M60 16 C66 29 76 40 76 53 C76 64 69 72 60 72 C51 72 44 64 44 53 C44 40 54 29 60 16 Z"
            fill={`url(#flame-${uid})`}
          />
          <path
            data-part="flame-inner"
            d="M60 38 C63 45 68 51 68 58 C68 64 64.5 68.5 60 68.5 C55.5 68.5 52 64 52 58 C52 51 57 45 60 38 Z"
            fill="var(--color-paper)"
            opacity="0.92"
          />
        </G>
      </G>
    </svg>
  );
}
