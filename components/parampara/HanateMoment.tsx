"use client";

import { useEffect, useState } from "react";
import { Hanate } from "./hanate/Hanate";
import type { HanateState } from "./hanate/variants";

// Hanate reacts for a moment (glad she agreed), then settles back to idle breathing: only idle
// loops for long (ui-screen skill, motion). Under reduced motion Hanate already holds a still pose.
type HanateMomentProps = {
  moment: HanateState;
  /** Seconds before settling. */
  forSeconds?: number;
  size?: number;
  label?: string;
  className?: string;
};

export function HanateMoment({ moment, forSeconds = 1.6, ...props }: HanateMomentProps) {
  const [state, setState] = useState<HanateState>(moment);
  useEffect(() => {
    const timer = window.setTimeout(() => setState("idle"), forSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [forSeconds]);
  return <Hanate state={state} {...props} />;
}
