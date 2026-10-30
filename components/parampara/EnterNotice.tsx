"use client";

import { useSearchParams } from "next/navigation";
import { Bi } from "./Bi";
import { Hanate } from "./hanate/Hanate";

// Shown above the doors after `/?enter=failed`: Hanate cares, one kind line, what to do next.
// Reads the query on the client so the landing stays a static shell (DECISIONS D22).
export function EnterNotice() {
  const failed = useSearchParams().get("enter") === "failed";
  if (!failed) return null;
  return (
    <div
      role="alert"
      className="mt-5 flex items-center gap-4 rounded-card border border-border bg-paper p-4 pr-6 shadow-warm-sm"
    >
      <Hanate state="caring" size={56} label="" className="shrink-0" />
      <p className="text-lg leading-snug">
        <Bi k="enter.failed.title" className="font-display font-bold text-ink" sub={false} />
        <Bi k="enter.failed.body" className="mt-0.5 text-base text-ink-3" sub={false} />
      </p>
    </div>
  );
}
