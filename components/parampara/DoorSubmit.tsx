"use client";

import { useId } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, CloudOff } from "lucide-react";
import { haptics, vibrate } from "@/lib/motion";
import { useOfflineQueue } from "@/lib/use-offline-queue";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { Ember } from "./Ember";

// The door's call to action. Its ::after covers the card, so a tap anywhere enters. While the
// server signs in it says so ("Opening the door…") with a small ember, never a spinner; pressed
// offline, it holds the press and opens the door when the network returns.
export function DoorSubmit({ titleId, featured }: { titleId: string; featured: boolean }) {
  const { pending } = useFormStatus();
  const { held, hold } = useOfflineQueue();
  const ctaId = useId();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || held !== null || undefined}
      aria-labelledby={`${titleId} ${ctaId}`}
      onClick={(e) => {
        vibrate(haptics.press);
        hold(e);
      }}
      className={cn(
        "mt-auto inline-flex min-h-12 items-center gap-2 self-start pt-6 font-display text-lg font-bold outline-none",
        "after:absolute after:inset-0 after:rounded-card after:content-['']",
        "disabled:cursor-default",
        featured ? "text-flame" : "text-clay-cta",
      )}
    >
      <span id={ctaId} className="inline-flex items-center gap-2">
        {held !== null ? (
          <>
            <CloudOff className="size-5" aria-hidden />
            <Bi k="offline.held" sub={false} />
          </>
        ) : pending ? (
          <>
            <Ember />
            <Bi k="door.pending" sub={false} />
          </>
        ) : (
          <>
            <Bi k="door.enter" sub={false} />
            <ArrowRight
              className="size-5 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden
            />
          </>
        )}
      </span>
    </button>
  );
}
