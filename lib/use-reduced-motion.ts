import { useSyncExternalStore } from "react";

// Motion's useReducedMotion keeps its first (server) answer after hydration, so a reduced motion
// user still got loops. This follows the media query live: false on the server, true on the client
// as soon as it hydrates, and it reacts if the OS setting changes.
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
