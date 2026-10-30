import { useSyncExternalStore } from "react";

// Whether the page itself is showing the calm offline state (components/parampara/OfflineState),
// so the offline banner does not repeat it or say something the page no longer shows (F-P2).
let shown = 0;
const listeners = new Set<() => void>();

export function markPageOffline(): () => void {
  shown += 1;
  listeners.forEach((l) => l());
  return () => {
    shown -= 1;
    listeners.forEach((l) => l());
  };
}

export function usePageOffline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => shown > 0,
    () => false,
  );
}

/** A page that could not load for want of a network, not a fault in the page. */
export function isNetworkFailure(error: unknown, online: boolean): boolean {
  if (!online) return true;
  if (!(error instanceof Error)) return false;
  return (
    error.name === "ChunkLoadError" ||
    /failed to fetch|load failed|networkerror|network request failed|loading chunk|failed to load chunk/i.test(
      error.message,
    )
  );
}
