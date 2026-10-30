"use client";

import { releaseHeldPresses } from "@/lib/use-offline-queue";

// "Not now" on the consent page: opening it explains that nothing is kept, and it also lets go of
// an "I agree" pressed while offline, so the agreement is never sent after she said not now.
export function NotNow({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <details
      className="group mb-8 text-center"
      onToggle={(e) => {
        if (e.currentTarget.open) releaseHeldPresses();
      }}
    >
      <summary className="mx-auto flex min-h-12 w-fit cursor-pointer list-none items-center rounded-chip px-4 font-display text-base font-semibold text-ink-3 hover:text-ink [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      {children}
    </details>
  );
}
