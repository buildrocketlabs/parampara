import type { CSSProperties } from "react";
import {
  HanateArt,
  type HanateProps,
  type PartProps,
  type Parts,
  type Pose,
  type Poses,
} from "./art";
import { body, flame, glow, type HanateState } from "./variants";

// Hanate holding still: plain SVG, no Motion, so it ships with the page. This is the pose the
// living lamp starts from (and the only pose under reduced motion), so the swap shows no jump.

const num = (v: unknown, fallback: number) => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "number" ? x : fallback;
};

/** A Motion pose and origin as plain CSS, in Motion's own transform order. */
export function poseStyle(style: Record<string, unknown> | undefined, pose: Pose | undefined) {
  const css: CSSProperties = {};
  if (style?.transformBox) css.transformBox = style.transformBox as CSSProperties["transformBox"];
  if (style?.originX !== undefined || style?.originY !== undefined) {
    css.transformOrigin = `${num(style?.originX, 0.5) * 100}% ${num(style?.originY, 0.5) * 100}%`;
  }
  const t: string[] = [];
  if (pose?.y !== undefined) t.push(`translateY(${num(pose.y, 0)}px)`);
  if (pose?.scale !== undefined) t.push(`scale(${num(pose.scale, 1)})`);
  if (pose?.scaleX !== undefined) t.push(`scaleX(${num(pose.scaleX, 1)})`);
  if (pose?.scaleY !== undefined) t.push(`scaleY(${num(pose.scaleY, 1)})`);
  if (pose?.rotate !== undefined) t.push(`rotate(${num(pose.rotate, 0)}deg)`);
  if (t.length) css.transform = t.join(" ");
  if (pose?.opacity !== undefined) css.opacity = num(pose.opacity, 1);
  return css;
}

function still(Tag: "g" | "circle" | "ellipse") {
  return function StillPart({ animate, transition, initial, style, children, ...rest }: PartProps) {
    void transition;
    void initial;
    return (
      <Tag {...rest} style={poseStyle(style, animate)}>
        {children}
      </Tag>
    );
  };
}

const STILL_PARTS: Parts = { G: still("g"), Circle: still("circle"), Ellipse: still("ellipse") };

export function stillPoses(state: HanateState): Poses {
  return {
    ground: { scaleX: 1 },
    body: body[state].still,
    glow: glow[state].still,
    eyes: { scaleY: 1 },
    flame: flame[state].still,
  };
}

export function HanateStill({ uid, ...props }: HanateProps & { uid: string }) {
  return (
    <HanateArt {...props} uid={uid} parts={STILL_PARTS} poses={stillPoses(props.state ?? "idle")} />
  );
}
