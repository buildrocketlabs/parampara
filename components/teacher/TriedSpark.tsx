"use client";

import * as m from "motion/react-m";
import { MotionIsland } from "@/components/parampara/MotionIsland";
import { durations } from "@/lib/motion";

// The spark that flies from the teacher's lamp to the master's (TriedFlow's thank you), in its own
// Motion island, loaded at idle (DESIGN §10).
export function Spark() {
  return (
    <MotionIsland>
      <m.span
        className="absolute top-0 left-0 size-3 rounded-full bg-flame shadow-flame"
        initial={{ x: 38, y: 24, scale: 0.4, opacity: 0 }}
        animate={{
          x: [38, 118, 204],
          y: [24, -2, 28],
          scale: [0.4, 1.2, 0.6],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: durations.story * 1.3, ease: "easeInOut", delay: 0.2 }}
      />
    </MotionIsland>
  );
}
