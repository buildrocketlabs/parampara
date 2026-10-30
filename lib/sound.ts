import { useSyncExternalStore } from "react";

// One mute toggle for every sound (DESIGN §6). Sounds only ever follow a tap, never a page load.
// The bell is made with Web Audio (no audio file to download): three soft partials that fade.
const KEY = "parampara.muted";
const listeners = new Set<() => void>();

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    window.localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useMuted(): boolean {
  return useSyncExternalStore(subscribe, isMuted, () => false);
}

let ctx: AudioContext | null = null;

/** A soft temple bell. No-op when muted or when Web Audio is missing. */
export function playBell(volume = 0.09) {
  if (typeof window === "undefined" || isMuted()) return;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx ??= new AC();
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(ctx.destination);
  for (const [freq, level, decay] of [
    [784, 1, 1.8],
    [1568, 0.35, 1.1],
    [2352, 0.18, 0.7],
  ] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(level, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(g).connect(out);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }
}
