"use client";

import { useRef } from "react";
import { useInView } from "motion/react";
import * as m from "motion/react-m";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { HanateArt, type HanateProps, type PartProps, type Parts, type Poses } from "./art";
import { stillPoses } from "./still";
import { blink, body, flame, glow, SPARK_STATES } from "./variants";
import { MotionIsland } from "../MotionIsland";

// Hanate alive (Motion): loaded at idle and swapped in for the still lamp (./Hanate.tsx). Loops
// pause offscreen and never run under reduced motion. Every still pose is its loop's first frame
// (./variants.ts), so the swap and each repeat are seamless.

const LIVE_PARTS: Parts = {
  G: (p: PartProps) => <m.g {...(p as React.ComponentProps<typeof m.g>)} />,
  Circle: (p: PartProps) => <m.circle {...(p as React.ComponentProps<typeof m.circle>)} />,
  Ellipse: (p: PartProps) => <m.ellipse {...(p as React.ComponentProps<typeof m.ellipse>)} />,
};

function HanateLiveMoving({ uid, ...props }: HanateProps & { uid: string }) {
  const state = props.state ?? "idle";
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { amount: 0.1 });
  const reduced = usePrefersReducedMotion();
  const live = inView && !reduced;

  const still = stillPoses(state);
  const initial = {
    ground: still.ground,
    body: still.body,
    glow: still.glow,
    eyes: still.eyes,
    flame: still.flame,
  };
  const loopPoses: Poses = live
    ? {
        ground: { scaleX: [1, 0.92, 1] },
        groundTransition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
        body: body[state].loop,
        glow: glow[state].loop,
        eyes: blink,
        flame: flame[state].loop,
      }
    : { ...still, groundTransition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" } };
  const poses: Poses = { ...loopPoses, initial };

  return (
    <HanateArt
      {...props}
      uid={uid}
      svgRef={ref}
      parts={LIVE_PARTS}
      poses={poses}
      sparks={SPARK_STATES.has(state) && live ? <Sparks /> : null}
    />
  );
}

const SPARKS = [
  { x: 42, delay: 0 },
  { x: 78, delay: 0.45 },
  { x: 60, delay: 0.9 },
];

function Sparks() {
  return (
    <g fill="var(--color-flame)">
      {SPARKS.map((s) => (
        <m.circle
          key={s.x}
          cx={s.x}
          cy="40"
          r="2"
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], y: [0, -22] }}
          transition={{ duration: 1.3, delay: s.delay, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </g>
  );
}

/** HanateLive, inside its own Motion island (components/parampara/MotionIsland). */
export function HanateLive(props: React.ComponentProps<typeof HanateLiveMoving>) {
  return (
    <MotionIsland>
      <HanateLiveMoving {...props} />
    </MotionIsland>
  );
}
