"use client";

import { useId } from "react";
import { idleModule } from "@/lib/idle-module";
import type { HanateProps } from "./art";
import { HanateStill } from "./still";

// Hanate (ಹಣತೆ), the clay lamp. One SVG, parts as groups; the flame is the face's emotion.
// The page ships the still lamp (no Motion on first load, DESIGN §10); the living lamp loads when
// the page is idle and takes over from exactly the same pose. Reduced motion keeps the still pose.
const useLive = idleModule(() => import("./HanateLive"));

export function Hanate(props: HanateProps) {
  const uid = useId().replace(/:/g, "");
  const live = useLive();
  return live ? <live.HanateLive {...props} uid={uid} /> : <HanateStill {...props} uid={uid} />;
}
