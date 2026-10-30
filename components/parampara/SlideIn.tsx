"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { springs } from "@/lib/motion";
import { MotionIsland } from "./MotionIsland";

// A block that rises in and sinks out (AnimatePresence), for pieces that load at idle and must
// not bring Motion onto the first load (DESIGN §10): the offline banner.
function SlideInMoving({
  show,
  ref,
  children,
  ...rest
}: { show: boolean; ref?: React.Ref<HTMLDivElement>; children: React.ReactNode } & Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> &
  Record<`data-${string}`, unknown>) {
  return (
    <AnimatePresence>
      {show && (
        <m.div
          ref={ref}
          {...(rest as React.ComponentProps<typeof m.div>)}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={springs.gentle}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** SlideIn, inside its own Motion island (components/parampara/MotionIsland). */
export function SlideIn(props: React.ComponentProps<typeof SlideInMoving>) {
  return (
    <MotionIsland>
      <SlideInMoving {...props} />
    </MotionIsland>
  );
}
