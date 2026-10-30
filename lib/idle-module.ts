"use client";

import { useEffect, useSyncExternalStore } from "react";

// A module fetched when the page is idle, after first paint (DESIGN §10): the caller renders a
// still version until it arrives, then the full one. During hydration the server's answer (not
// loaded) is used, so the first client render always matches the HTML.
export function idleModule<T>(load: () => Promise<T>): () => T | null {
  let loaded: T | null = null;
  let pending: Promise<void> | null = null;
  const subscribers = new Set<() => void>();

  const start = () => {
    pending ??= load()
      .then((mod) => {
        loaded = mod;
        subscribers.forEach((notify) => notify());
      })
      .catch(() => {
        pending = null; // Offline before it arrived: the still version stays, a later page retries.
      });
  };
  const subscribe = (notify: () => void) => {
    subscribers.add(notify);
    return () => {
      subscribers.delete(notify);
    };
  };

  return function useIdleModule(): T | null {
    const ready = useSyncExternalStore(
      subscribe,
      () => loaded !== null,
      () => false,
    );
    useEffect(() => {
      if (loaded) return;
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (w.requestIdleCallback) {
        const id = w.requestIdleCallback(start, { timeout: 2000 });
        return () => w.cancelIdleCallback?.(id);
      }
      const id = window.setTimeout(start, 600);
      return () => window.clearTimeout(id);
    }, []);
    return ready ? loaded : null;
  };
}
