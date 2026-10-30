"use client";

import { useLayoutEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

// A number that counts up once when the room opens. The server renders the true value, so it is
// right without JavaScript and under reduced motion, where it never moves. A small frame loop with
// the gentle spring's settle time, not Motion, so the master's room loads lighter (DESIGN §10).
const DURATION_MS = 900;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 4);

export function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced || to < 2) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      el.textContent = String(Math.round(easeOut(t) * to));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    el.textContent = "0";
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = String(to);
    };
  }, [to, reduced]);
  return <span ref={ref}>{to}</span>;
}
