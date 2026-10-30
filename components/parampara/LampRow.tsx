"use client";

import * as m from "motion/react-m";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { MotionIsland } from "./MotionIsland";

// A row of small diyas. When `lit` turns on they catch fire one after another (DESIGN §2.1).
type LampRowProps = {
  count?: number;
  lit: boolean;
  /** Seconds between one lamp and the next. */
  stagger?: number;
  /** On ink, a softer deep flame glow (the bright one turns muddy on a dark ground). */
  onDark?: boolean;
  className?: string;
};

function LampRowMoving({
  count = 5,
  lit,
  stagger = 0.22,
  onDark = false,
  className,
}: LampRowProps) {
  return (
    <div className={cn("flex items-end justify-center gap-2 sm:gap-4", className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <SmallLamp key={i} index={i} lit={lit} delay={i * stagger} onDark={onDark} />
      ))}
    </div>
  );
}

const ORIGIN_CENTRE = { transformBox: "fill-box", originX: 0.5, originY: 0.5 } as const;
const ORIGIN_WICK = { transformBox: "fill-box", originX: 0.5, originY: 1 } as const;

function SmallLamp({
  index,
  lit,
  delay,
  onDark,
}: {
  index: number;
  lit: boolean;
  delay: number;
  onDark: boolean;
}) {
  return (
    <svg
      viewBox="0 0 40 44"
      className="h-11 w-10 overflow-visible sm:h-16 sm:w-[58px]"
      data-lamp={index}
    >
      <m.circle
        cx="20"
        cy="14"
        r="17"
        fill={onDark ? "var(--color-flame-deep)" : "var(--color-flame)"}
        style={ORIGIN_CENTRE}
        initial={false}
        animate={lit ? { opacity: onDark ? 0.25 : 0.45, scale: 1 } : { opacity: 0, scale: 0.2 }}
        transition={lit ? { ...springs.gentle, delay } : { duration: 0 }}
      />
      {/* unlit wick, so a dark lamp still reads as a lamp */}
      <path d="M20 26 L20 21" stroke="var(--color-ink-2)" strokeWidth="2" strokeLinecap="round" />
      <m.g
        style={ORIGIN_WICK}
        initial={false}
        animate={lit ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={lit ? { ...springs.bouncy, delay } : { duration: 0 }}
      >
        <path
          d="M20 2 C23 8 27 12 27 17 C27 21.5 24 24 20 24 C16 24 13 21.5 13 17 C13 12 17 8 20 2 Z"
          fill="var(--color-flame)"
        />
        <path
          d="M20 13 C21.4 16 23 18 23 20 C23 22 21.6 23 20 23 C18.4 23 17 22 17 20 C17 18 18.6 16 20 13 Z"
          fill="var(--color-paper)"
          opacity="0.9"
        />
      </m.g>
      <path d="M4 27 C4 37 11 42 20 42 C29 42 36 37 36 27 Z" fill="var(--color-clay)" />
      <ellipse cx="20" cy="27" rx="16" ry="3.6" fill="var(--color-clay-cta)" />
    </svg>
  );
}

/** LampRow, inside its own Motion island (components/parampara/MotionIsland). */
export function LampRow(props: React.ComponentProps<typeof LampRowMoving>) {
  return (
    <MotionIsland>
      <LampRowMoving {...props} />
    </MotionIsland>
  );
}
