import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useOnline } from "./use-online";

// Offline is a mode, not a dead button (Law 9). A submit pressed offline is held, the button says
// so, and the form is sent by itself the moment the network returns (same submitter, same value).
// A hold is always the person's to take back: pressing the held button again releases it, and so
// does any `parampara:release` window event (the consent page's "Not now"), so nothing is ever
// sent that the screen has since said will not be. If the page closes first, nothing was sent.
export const RELEASE_EVENT = "parampara:release";

export function releaseHeldPresses() {
  window.dispatchEvent(new Event(RELEASE_EVENT));
}

export function useOfflineQueue() {
  const online = useOnline();
  /** The held submitter's value ("" when it has none); null when nothing is held. */
  const [held, setHeld] = useState<string | null>(null);
  const submitter = useRef<HTMLButtonElement | null>(null);

  const release = useCallback(() => {
    submitter.current = null;
    setHeld(null);
  }, []);

  useEffect(() => {
    window.addEventListener(RELEASE_EVENT, release);
    return () => window.removeEventListener(RELEASE_EVENT, release);
  }, [release]);

  useEffect(() => {
    if (!online || held === null) return;
    const button = submitter.current;
    submitter.current = null;
    // Sending resets the hold; the form's own pending state takes over from here.
    queueMicrotask(() => setHeld(null));
    button?.form?.requestSubmit(button);
  }, [online, held]);

  /**
   * Put on the submit button's onClick. Offline it holds the press (or, pressed again, lets it
   * go) and returns true, so the caller does nothing else. Online it returns false.
   */
  const hold = (e: MouseEvent<HTMLButtonElement>) => {
    if (navigator.onLine) return false;
    e.preventDefault();
    if (submitter.current === e.currentTarget) {
      release();
      return true;
    }
    submitter.current = e.currentTarget;
    setHeld(e.currentTarget.value ?? "");
    return true;
  };

  return { online, held, hold, release };
}
