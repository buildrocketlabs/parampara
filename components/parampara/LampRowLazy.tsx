"use client";

import type { ComponentProps } from "react";
import { idleModule } from "@/lib/idle-module";
import type { LampRow } from "./LampRow";
import { LampRowStill } from "./LampRowStill";

// LampRow for pages where the row shows a state (lamps lit or dark) rather than lighting up on
// arrival: the still row ships with the page and the moving one takes over at idle, from the same
// pose (LampRow mounts at its pose, with no entrance), so later changes still animate (DESIGN §10).
const useRow = idleModule(() => import("./LampRow"));

export function LampRowLazy(props: ComponentProps<typeof LampRow>) {
  const live = useRow();
  if (live) return <live.LampRow {...props} />;
  return (
    <LampRowStill count={props.count} lit={props.lit} onDark={props.onDark} className={props.className} />
  );
}
