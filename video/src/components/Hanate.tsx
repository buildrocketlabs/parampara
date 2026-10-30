import { createContext, useContext, useId, type ReactNode } from "react";
import { Easing, useCurrentFrame, useVideoConfig } from "remotion";
// Hanate's artwork and motion come from the app, unchanged: the same SVG paths (art.tsx), the same
// keyframes per state (variants.ts) and the same pose to CSS mapping (still.tsx). Only the clock
// differs: Motion runs on wall time in the app; here every pose is computed from the frame.
import {
  HanateArt,
  type PartProps,
  type Parts,
  type Pose,
  type Poses,
} from "../../../components/parampara/hanate/art";
import { poseStyle } from "../../../components/parampara/hanate/still";
import {
  blink,
  body,
  flame,
  glow,
  type HanateState,
} from "../../../components/parampara/hanate/variants";

export type { HanateState };

// Motion's "easeInOut" is cubic-bezier(0.42, 0, 0.58, 1).
const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);

const num = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);

/** A looping Motion keyframe array, read at time t (seconds). */
function sample(value: unknown, transition: Record<string, unknown> | undefined, t: number) {
  if (!Array.isArray(value)) return value;
  const frames = value as number[];
  if (frames.length < 2) return frames[0];
  const duration = num(transition?.duration, 1);
  const cycle = duration + num(transition?.repeatDelay, 0);
  const local = Math.min((((t % cycle) + cycle) % cycle) / duration, 1);
  const times = Array.isArray(transition?.times)
    ? (transition.times as number[])
    : frames.map((_, i) => i / (frames.length - 1));
  let i = 0;
  while (i < frames.length - 2 && local > times[i + 1]!) i++;
  const span = times[i + 1]! - times[i]!;
  const p = span > 0 ? Math.min(Math.max((local - times[i]!) / span, 0), 1) : 1;
  const eased = transition?.ease === "linear" ? p : easeInOut(p);
  return frames[i]! + (frames[i + 1]! - frames[i]!) * eased;
}

function poseAt(pose: Pose | undefined, t: number): Pose {
  if (!pose) return {};
  const transition = pose.transition as Record<string, unknown> | undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(pose)) {
    if (k !== "transition") out[k] = sample(v, transition, t);
  }
  return out as Pose;
}

const Clock = createContext(0);

function framePart(Tag: "g" | "circle" | "ellipse") {
  return function FramePart({ animate, initial, transition, style, children, ...rest }: PartProps) {
    void initial;
    void transition;
    const t = useContext(Clock);
    return (
      <Tag {...rest} style={poseStyle(style, poseAt(animate, t))}>
        {children}
      </Tag>
    );
  };
}

const FRAME_PARTS: Parts = {
  G: framePart("g"),
  Circle: framePart("circle"),
  Ellipse: framePart("ellipse"),
};

function loopPoses(state: HanateState): Poses {
  return {
    ground: { scaleX: 1 },
    body: body[state].loop as Pose,
    glow: glow[state].loop as Pose,
    eyes: blink as Pose,
    flame: flame[state].loop as Pose,
  };
}

/**
 * Hanate, alive on the video's clock. `phase` shifts the loop (seconds) so a row of lamps does not
 * flicker in step; `still` holds the state's first frame.
 */
export function Hanate({
  state = "idle",
  size = 240,
  phase = 0,
  still = false,
}: {
  state?: HanateState;
  size?: number;
  phase?: number;
  still?: boolean;
}): ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const uid = `v${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Clock.Provider value={still ? 0 : frame / fps + phase}>
      <HanateArt
        state={state}
        size={size}
        label=""
        uid={uid}
        parts={FRAME_PARTS}
        poses={loopPoses(state)}
      />
    </Clock.Provider>
  );
}
