// MicOrb's press logic (DESIGN §4): press and hold to talk, or tap to start and tap to stop, because
// elderly users tap. Space and Enter toggle. Pure, so it is tested without a browser.

/** A press shorter than this is a tap (start and keep listening); longer is hold to talk. */
export const HOLD_MS = 350;

export type MicPhase = "off" | "pressing" | "latched" | "stopping";
export type MicGesture = { phase: MicPhase; downAt: number };
export type MicEvent =
  | { type: "down"; at: number }
  | { type: "up"; at: number }
  | { type: "cancel"; at: number }
  | { type: "toggle" }
  | { type: "reset" };
export type MicEffect = "start" | "stop" | null;

export const MIC_IDLE: MicGesture = { phase: "off", downAt: 0 };

export function micGesture(g: MicGesture, e: MicEvent): { gesture: MicGesture; effect: MicEffect } {
  switch (e.type) {
    case "reset":
      return { gesture: MIC_IDLE, effect: null };
    case "toggle":
      if (g.phase === "off") return { gesture: { phase: "latched", downAt: 0 }, effect: "start" };
      if (g.phase === "latched") return { gesture: MIC_IDLE, effect: "stop" };
      return { gesture: g, effect: null };
    case "down":
      if (g.phase === "off")
        return { gesture: { phase: "pressing", downAt: e.at }, effect: "start" };
      if (g.phase === "latched")
        return { gesture: { phase: "stopping", downAt: e.at }, effect: "stop" };
      return { gesture: g, effect: null };
    case "up":
    case "cancel":
      if (g.phase === "pressing") {
        return e.at - g.downAt >= HOLD_MS
          ? { gesture: MIC_IDLE, effect: "stop" }
          : { gesture: { phase: "latched", downAt: g.downAt }, effect: null };
      }
      if (g.phase === "stopping") return { gesture: MIC_IDLE, effect: null };
      return { gesture: g, effect: null };
  }
}
