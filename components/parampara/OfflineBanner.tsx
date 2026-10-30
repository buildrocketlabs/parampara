"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { idleModule } from "@/lib/idle-module";
import { usePageOffline } from "@/lib/page-offline";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { Hanate } from "./hanate/Hanate";

// Offline is a mode, not a failure (DESIGN §4 OfflineBanner): a small ember, calm words, never red.
// Phones: bottom centre, lifted above a page's action tray. Desktop: bottom left, clear of the
// centred actions it would otherwise cover. It says the whole sentence first, then after a few
// seconds (or the first scroll) settles into a small ember pill, so it never sits over a page's
// buttons for long; tapping the pill says the sentence again. While it shows, the page gains room
// at its foot, so a last button (Ask, Send) can always scroll clear of it and stay tappable.
const SETTLE_MS = 4000;

// Its rise and fall load at idle (DESIGN §10); before then it simply appears and goes.
const useSlide = idleModule(() => import("./SlideIn"));

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const [compact, setCompact] = useState(false);
  // Officers cannot ask questions: their pages say what offline means for the numbers instead.
  // Read when it goes offline (not usePathname: the banner sits outside every Suspense boundary).
  const [officer, setOfficer] = useState(false);
  const [opened, setOpened] = useState(0);
  const banner = useRef<HTMLDivElement>(null);
  const slide = useSlide();
  // The page itself says it is offline (OfflineState): the banner would only repeat it.
  const pageSays = usePageOffline();
  const show = !online && !pageSays;

  // Each time it goes offline (or the pill is tapped): the full sentence, then the pill.
  useEffect(() => {
    if (online) return;
    queueMicrotask(() => {
      setCompact(false);
      setOfficer(/^\/i(\/|$)/.test(window.location.pathname));
    });
    const settle = () => setCompact(true);
    const timer = window.setTimeout(settle, SETTLE_MS);
    const onScroll = () => {
      window.clearTimeout(timer);
      settle();
    };
    // The first scroll after the sentence shows settles it too (ignore the scroll that opened it).
    const arm = window.setTimeout(
      () => window.addEventListener("scroll", onScroll, { once: true, passive: true }),
      300,
    );
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(arm);
      window.removeEventListener("scroll", onScroll);
    };
  }, [online, opened]);

  useEffect(() => {
    if (!show) return;
    const body = document.body;
    const before = body.style.paddingBottom;
    const id = window.requestAnimationFrame(() => {
      const h = banner.current?.offsetHeight ?? 88;
      body.style.paddingBottom = `${h + 32}px`;
    });
    return () => {
      window.cancelAnimationFrame(id);
      body.style.paddingBottom = before;
    };
  }, [show, compact]);

  const props = {
    ref: banner,
    "data-offline-banner": true,
    "data-compact": compact || undefined,
    role: "status",
    "aria-live": "polite" as const,
    className: cn(
      "fixed bottom-[calc(var(--tray-h,0px)+1rem)] z-50 text-white shadow-warm-lg",
      compact
        ? "left-4 rounded-chip bg-ink-2"
        : "inset-x-4 mx-auto flex max-w-md items-center gap-3 rounded-card bg-ink-2 py-3 pr-5 pl-3 md:right-auto md:left-4 md:mx-0 md:w-64",
    ),
  };
  const content = (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpened((n) => n + 1)}
          className="flex min-h-12 items-center gap-2 rounded-chip py-1.5 pr-4 pl-1.5 outline-none focus-visible:ring-2 focus-visible:ring-flame"
        >
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-chip bg-ink">
            <Hanate state="resting" size={26} label="" />
          </span>
          <span className="font-display text-[15px] font-semibold">
            <Bi k="offline.pill" sub={false} />
          </span>
        </button>
      ) : (
        <>
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-chip bg-ink"
          >
            <Hanate state="resting" size={36} label="" />
          </span>
          <span className="text-[15px] leading-snug">
            <Bi
              k={officer ? "offline.body.officer" : "offline.body"}
              subClassName="text-[14px] text-mist"
            />
          </span>
        </>
      )}
    </>
  );

  if (slide)
    return (
      <slide.SlideIn show={show} {...props}>
        {content}
      </slide.SlideIn>
    );
  return show ? <div {...props}>{content}</div> : null;
}
