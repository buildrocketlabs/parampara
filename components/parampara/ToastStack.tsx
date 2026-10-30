"use client";

import { AnimatePresence } from "motion/react";
import { MotionIsland } from "./MotionIsland";
import * as m from "motion/react-m";
import { springs } from "@/lib/motion";
import { ToastCard, type ToastInput, type ToastLi } from "./Toast";

// The toasts with Motion: they rise in, sink out, and slide to make room for each other (layout,
// which needs Motion's layout feature, loaded with this module). Loaded at idle (DESIGN §10).

const MotionLi: ToastLi = (props) => (
  <m.li
    {...(props as React.ComponentProps<typeof m.li>)}
    layout
    initial={{ opacity: 0, y: 16, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18 } }}
    transition={springs.gentle}
  />
);

export function ToastStack({
  items,
  dismiss,
}: {
  items: Array<ToastInput & { id: number }>;
  dismiss: (id: number) => void;
}) {
  return (
    <MotionIsland features="max">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} Li={MotionLi} />
        ))}
      </AnimatePresence>
    </MotionIsland>
  );
}

/** A single animated toast card, for the design gallery. */
export function AnimatedToastCard(props: { item: ToastInput; onDismiss: () => void }) {
  return (
    <MotionIsland features="max">
      <ToastCard {...props} Li={MotionLi} />
    </MotionIsland>
  );
}
