"use client";

import { LazyMotion, MotionConfig } from "motion/react";

// Motion for one moving part of a page, never for the page as a whole: every component that uses
// m.* sits in an island, and loads after first paint (DESIGN §10). The features load once, the
// first time any island mounts. `strict` makes a stray full `motion.*` component an error in
// development, so the bundle cannot quietly regrow. Reduced motion is honoured as before.
const animation = () => import("@/lib/motion-features/animation").then((f) => f.default);
const max = () => import("@/lib/motion-features/max").then((f) => f.default);

export function MotionIsland({
  features = "animation",
  children,
}: {
  /** "max" adds drag and layout animations (the bottom sheet, the toasts). */
  features?: "animation" | "max";
  children: React.ReactNode;
}) {
  return (
    <LazyMotion features={features === "max" ? max : animation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
