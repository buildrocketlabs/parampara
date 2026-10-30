import { describe, expect, it } from "vitest";
import { HOLD_MS, MIC_IDLE, micGesture, type MicEvent, type MicGesture } from "./mic-gesture";

function run(events: MicEvent[], from: MicGesture = MIC_IDLE) {
  let g = from;
  const effects: string[] = [];
  for (const e of events) {
    const r = micGesture(g, e);
    g = r.gesture;
    if (r.effect) effects.push(r.effect);
  }
  return { phase: g.phase, effects };
}

describe("mic gesture", () => {
  it("press and hold talks while held, and stops on release", () => {
    expect(
      run([
        { type: "down", at: 0 },
        { type: "up", at: HOLD_MS + 600 },
      ]),
    ).toEqual({
      phase: "off",
      effects: ["start", "stop"],
    });
  });

  it("a tap starts and keeps listening; the next tap stops on press", () => {
    const tap = run([
      { type: "down", at: 0 },
      { type: "up", at: 120 },
    ]);
    expect(tap).toEqual({ phase: "latched", effects: ["start"] });
    expect(
      run([
        { type: "down", at: 0 },
        { type: "up", at: 120 },
        { type: "down", at: 4_000 },
        { type: "up", at: 4_090 },
      ]),
    ).toEqual({ phase: "off", effects: ["start", "stop"] });
  });

  it("Space or Enter toggles", () => {
    expect(run([{ type: "toggle" }])).toEqual({ phase: "latched", effects: ["start"] });
    expect(run([{ type: "toggle" }, { type: "toggle" }])).toEqual({
      phase: "off",
      effects: ["start", "stop"],
    });
  });

  it("ignores a key press in the middle of a finger press", () => {
    expect(run([{ type: "down", at: 0 }, { type: "toggle" }, { type: "up", at: 900 }])).toEqual({
      phase: "off",
      effects: ["start", "stop"],
    });
  });

  it("a cancelled long press still stops, a cancelled short one keeps listening", () => {
    expect(
      run([
        { type: "down", at: 0 },
        { type: "cancel", at: 1_000 },
      ]).effects,
    ).toEqual(["start", "stop"]);
    expect(
      run([
        { type: "down", at: 0 },
        { type: "cancel", at: 50 },
      ]).phase,
    ).toBe("latched");
  });

  it("reset forgets everything when the screen stops listening for us", () => {
    expect(run([{ type: "down", at: 0 }, { type: "reset" }, { type: "up", at: 2_000 }])).toEqual({
      phase: "off",
      effects: ["start"],
    });
  });
});
