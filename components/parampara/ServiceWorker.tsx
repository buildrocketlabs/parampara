"use client";

import { useEffect } from "react";

// Registers public/sw.js (DECISIONS D52): production builds only, and only once the page is idle,
// so it never competes with the landing's first paint. "Leave" (any form marked data-leave) asks
// the worker to forget cached pages, so the next person on this phone sees none of them.
const SAVED_META_KEY = "parampara.saved.meta";
const RECENT_KEY = "parampara.recent"; // lib/answers/on-phone (kept literal: this ships on every page)

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const version = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
    const register = () => {
      void navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" })
        .catch(() => undefined);
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(register, { timeout: 5000 })
      : window.setTimeout(register, 2500);

    const onSubmit = (e: SubmitEvent) => {
      if (!(e.target instanceof HTMLFormElement) || !e.target.matches("form[data-leave]")) return;
      navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_PAGES" });
      try {
        window.localStorage.removeItem(SAVED_META_KEY);
        // The answers she opened lately go too (F-P1); saved ones stay hers to unsave.
        window.localStorage.removeItem(RECENT_KEY);
      } catch {
        // Private mode: nothing was kept.
      }
    };
    document.addEventListener("submit", onSubmit, true);
    return () => {
      if (window.cancelIdleCallback && typeof idle === "number") window.cancelIdleCallback(idle);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);
  return null;
}
