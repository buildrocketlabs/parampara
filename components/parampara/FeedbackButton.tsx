"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareHeart } from "lucide-react";
import { useOnline } from "@/lib/use-online";
import { useLang } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";

// The sheet and its form load after first paint (DESIGN §10): fetched when the page is idle, so
// the first tap still opens at once. Feedback needs the network anyway; offline the tab is hidden.
const loadSheet = () => import("./FeedbackSheet").then((m) => m.FeedbackSheet);
const FeedbackSheet = dynamic(loadSheet, { ssr: false });

// Feedback from any screen (docs/BUILD.md M4.5), never on the landing (its hero is the first
// impression). From sm up: a small, quiet tab on the right edge that steps aside whenever a
// primary button or the mic passes under it, so it never covers the one action of a screen.
// On a phone nothing floats (F-P1: at 390 px a corner button covered the mic hint, step 1 of an
// answer, the QR card's edge and a date in the queue, and a header button does not fit beside the
// language at 360 px): a quiet "Tell us about this page" closes the page's own <main>, after
// everything on it, where it can cover nothing.

// Primary actions it must never cover: clay ChunkyButtons (default and explicit), the MicOrb,
// anything a screen marks data-primary (the officer's action board, the lamp map's hint), and any
// line marked data-keep-clear (a safety line, a refusal) that runs to the right edge.
const PRIMARY =
  '[data-slot="button"]:not([data-variant]), [data-slot="button"][data-variant="clay"], button[data-state][aria-pressed], [data-primary], [data-keep-clear]';

export function FeedbackButton() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Mounted on the first tap and kept, so closing still animates.
  const [opened, setOpened] = useState(false);
  const [covered, setCovered] = useState(false);
  // The page's <main> (every page has one, #main), where the phone's button goes, inside a box of
  // our own that is kept as main's last child (React may insert a streamed or client rendered
  // part after it; the box is moved back to the end).
  const [main, setMain] = useState<HTMLElement | null>(null);
  const [box] = useState(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.setAttribute("data-feedback-foot", "");
    el.className = "mt-10 flex w-full justify-center sm:hidden";
    return el;
  });
  const tab = useRef<HTMLButtonElement>(null);
  const { t } = useLang();
  const online = useOnline();

  const show = () => {
    setOpened(true);
    setOpen(true);
  };

  // Follow the page's <main>: a route's loading screen hands over to the page without a new path.
  useEffect(() => {
    const find = () => setMain((now) => document.getElementById("main") ?? now);
    queueMicrotask(find);
    let timer = 0;
    const mo = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const el = document.getElementById("main");
        setMain((now) => (el && el !== now ? el : now));
      }, 150);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      window.clearTimeout(timer);
    };
  }, [path]);

  const hidden = path === "/" || path === "/offline" || !online;
  useEffect(() => {
    if (!box || !main || hidden) return;
    const place = () => {
      if (main.lastElementChild !== box) main.appendChild(box);
    };
    const mo = new MutationObserver(place);
    // Only once React has hydrated <main> itself (its fiber is on the node): a node added before
    // that is a hydration mismatch, and React would rebuild the page around it. Its streamed
    // Suspense parts hydrate later, but each between its own markers, so a last child is safe.
    let tries = 0;
    let timer = 0;
    const start = () => {
      if (!Object.keys(main).some((k) => k.startsWith("__reactFiber$"))) {
        if (++tries < 100) timer = window.setTimeout(start, 150);
        return;
      }
      place();
      mo.observe(main, { childList: true });
    };
    start();
    return () => {
      window.clearTimeout(timer);
      mo.disconnect();
      box.remove();
    };
  }, [box, main, hidden]);

  // Hide while a primary action shares the tab's band of the screen (sm and up).
  useEffect(() => {
    const el = tab.current;
    if (!el) return;
    let io: IntersectionObserver | null = null;
    const hits = new Set<Element>();
    const watch = () => {
      io?.disconnect();
      hits.clear();
      if (window.matchMedia("(max-width: 639px)").matches) return;
      const r = el.getBoundingClientRect();
      const top = Math.max(0, r.top - 8);
      const bottom = Math.max(0, window.innerHeight - r.bottom - 8);
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) hits.add(e.target);
            else hits.delete(e.target);
          }
          setCovered(hits.size > 0);
        },
        { rootMargin: `-${top}px 0px -${bottom}px 0px` },
      );
      document.querySelectorAll(PRIMARY).forEach((b) => io?.observe(b));
    };
    watch();
    let timer = 0;
    const mo = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(watch, 250);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", watch);
    return () => {
      io?.disconnect();
      mo.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener("resize", watch);
    };
  }, [path]);

  useEffect(() => {
    if (path === "/" || path === "/offline") return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const preload = () => void loadSheet().catch(() => undefined);
    if (w.requestIdleCallback) w.requestIdleCallback(preload);
    else window.setTimeout(preload, 2500);
  }, [path]);

  if (hidden) return null;

  return (
    <>
      <button
        ref={tab}
        type="button"
        onClick={show}
        aria-label={t("feedback.open")}
        aria-hidden={covered || undefined}
        tabIndex={covered ? -1 : 0}
        data-feedback-tab
        className={cn(
          // From sm up only: the labelled tab on the right edge.
          "fixed top-[62%] right-0 z-40 hidden h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-l-card border border-r-0 border-border bg-paper/95 text-ink-3 shadow-warm-sm transition-[opacity,translate] duration-200 hover:text-clay-cta sm:flex",
          covered && "pointer-events-none translate-x-full opacity-0",
        )}
      >
        <MessageSquareHeart className="size-5" aria-hidden />
        <span aria-hidden className="font-display text-[14px] leading-none font-bold">
          <Bi k="feedback.tab" sub={false} />
        </span>
      </button>
      {box &&
        main?.isConnected &&
        createPortal(
          <button
            type="button"
            onClick={show}
            className="inline-flex min-h-12 items-center gap-2 rounded-chip border border-border bg-paper/80 px-5 font-display text-[16px] font-semibold text-ink-3 shadow-warm-sm transition-colors duration-150 hover:text-clay-cta"
          >
            <MessageSquareHeart className="size-5 shrink-0" aria-hidden />
            <Bi k="feedback.open" sub={false} />
          </button>,
          box,
        )}
      {opened && <FeedbackSheet open={open} onOpenChange={setOpen} route={path} />}
    </>
  );
}
