"use client";

import { useEffect, useState } from "react";
import { idleModule } from "@/lib/idle-module";
import { LampRowStill } from "./LampRowStill";

// A small row of lamps that catch fire one after another a moment after the page opens: your
// lamp is lit (DESIGN §2.1). Under reduced motion Motion skips the movement and they simply show lit.
// The page ships the dark row; the moving row loads at idle and lights a moment after it arrives,
// so the lighting is never skipped (DESIGN §10).
const useRow = idleModule(() => import("./LampRow"));

export function LampsLighting({ count = 3, delayMs = 500, className }: { count?: number; delayMs?: number; className?: string }) {
  const row = useRow();
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (!row) return;
    const timer = window.setTimeout(() => setLit(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [row, delayMs]);
  if (!row) return <LampRowStill count={count} lit={false} className={className} />;
  return <row.LampRow count={count} lit={lit} className={className} />;
}
