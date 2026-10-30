"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// The /how section nav: jump to a part, and see which part you are in (aria-current).
// Labels come rendered from the server, so this island carries no strings of its own.
export function SectionNav({
  items,
  label,
}: {
  items: ReadonlyArray<{ id: string; label: React.ReactNode }>;
  label: React.ReactNode;
}) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const heads = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (heads.length === 0) return;
    // The part whose heading last passed under the nav is the one being read.
    const pick = () => {
      // The first part is marked from the start, so the nav shows what it does at once.
      let at: string | null = heads[0]!.id;
      for (const h of heads) if (h.getBoundingClientRect().top < 160) at = h.id;
      setCurrent(at);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    return () => window.removeEventListener("scroll", pick);
  }, [items]);

  return (
    <nav
      aria-labelledby="how-nav"
      // Full width band without widening the page: a cream shadow, clipped to the band's height.
      className="sticky top-0 z-20 mt-6 overflow-x-auto border-b border-border bg-cream py-2 shadow-[0_0_0_100vmax_var(--color-cream)] [clip-path:inset(0_-100vmax)]"
    >
      <span id="how-nav" className="sr-only">
        {label}
      </span>
      <ul className="flex w-max gap-2">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={current === i.id ? "location" : undefined}
              className={cn(
                "inline-flex min-h-12 items-center rounded-chip border px-4 font-display text-[15px] font-semibold transition-colors",
                current === i.id
                  ? "border-clay-cta bg-clay-cta text-white"
                  : "border-border bg-paper text-ink-2 hover:border-clay/50 hover:text-ink",
              )}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
