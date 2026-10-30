"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, Mic, MicOff, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { idleModule } from "@/lib/idle-module";
import { haptics, vibrate } from "@/lib/motion";
import { MIC_IDLE, micGesture, type MicEvent } from "@/lib/mic-gesture";
import { clamp01 } from "@/lib/stages";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";
import { BAR_SHAPE } from "./orb-shape";

// The breathing glow, ripples and voice bars move with Motion, loaded at idle (DESIGN §10).
const useOrbMotion = idleModule(() => import("./MicOrbMotion"));

// The front door of the teacher app (DESIGN §4): a 104 px clay circle with a white mic. Idle it
// breathes; listening, rings ripple with the live amplitude the caller passes in. Press and hold to
// talk, or tap to start and tap to stop; Space and Enter toggle. 10 ms haptic on press.
export type MicOrbState = "idle" | "listening" | "thinking" | "disabled";

export type MicOrbProps = {
  state: MicOrbState;
  /** 0..1 live amplitude from the recorder, while listening. */
  level?: number;
  /** Start listening. */
  onPress: () => void;
  /** Stop listening (release after a hold, or the second tap). */
  onRelease: () => void;
  mode?: "hold-or-tap";
  /** Accessible name, already in the reader's language (for example t("mic.label")). */
  label: string;
  /** Show the line under the orb that says what to do now. Default true. */
  caption?: boolean;
  /** The quiet alternative: typing. Shown under the orb; a full button when the mic is disabled. */
  onTypeInstead?: () => void;
  /** A second quiet alternative beside typing (for example "Show me"), shown while idle. */
  alsoAction?: { icon: LucideIcon; text: MessageKey; onClick: () => void; testId?: string };
  className?: string;
};

const CAPTION: Record<MicOrbState, MessageKey> = {
  idle: "mic.hint",
  listening: "mic.listening",
  thinking: "mic.thinking",
  disabled: "mic.disabled",
};

export function MicOrb({
  state,
  level = 0,
  onPress,
  onRelease,
  label,
  caption = true,
  onTypeInstead,
  alsoAction,
  className,
}: MicOrbProps) {
  const reduced = usePrefersReducedMotion();
  const orb = useOrbMotion();
  const gesture = useRef(MIC_IDLE);
  // When a pointer or key already handled this press, the click that follows is ignored.
  const handledAt = useRef(-Infinity);
  // Tapped to start (not held): the caption then says how to stop.
  const [latched, setLatched] = useState(false);
  const listening = state === "listening";
  const inert = state === "thinking" || state === "disabled";
  const amp = listening ? clamp01(level) : 0;

  // When the screen stops listening for its own reasons (silence, an error), forget the press.
  useEffect(() => {
    if (state !== "listening")
      gesture.current = micGesture(gesture.current, { type: "reset" }).gesture;
  }, [state]);

  const send = (event: MicEvent) => {
    const { gesture: next, effect } = micGesture(gesture.current, event);
    gesture.current = next;
    setLatched(next.phase === "latched");
    if (effect === "start") {
      vibrate(haptics.press);
      onPress();
    } else if (effect === "stop") {
      vibrate(haptics.press);
      onRelease();
    }
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative grid size-[184px] place-items-center">
        {orb ? (
          <orb.OrbHalo state={state} reduced={reduced} amp={amp} />
        ) : (
          <StillHalo state={state} reduced={reduced} amp={amp} />
        )}

        <button
          type="button"
          aria-label={label}
          aria-pressed={listening}
          aria-disabled={inert || undefined}
          data-state={state}
          onPointerDown={(e) => {
            if (inert || e.button !== 0) return;
            handledAt.current = e.timeStamp;
            e.currentTarget.setPointerCapture(e.pointerId);
            send({ type: "down", at: e.timeStamp });
          }}
          onPointerUp={(e) => {
            if (inert) return;
            send({ type: "up", at: e.timeStamp });
          }}
          onPointerCancel={(e) => {
            if (inert) return;
            send({ type: "cancel", at: e.timeStamp });
          }}
          onKeyDown={(e) => {
            if (inert || e.repeat || (e.key !== " " && e.key !== "Enter")) return;
            e.preventDefault();
            handledAt.current = e.timeStamp;
            send({ type: "toggle" });
          }}
          onClick={(e) => {
            // Screen readers activate with a bare click and no pointer events: treat it as a toggle.
            if (e.timeStamp - handledAt.current < 1000) return;
            if (!inert) send({ type: "toggle" });
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "relative grid size-[104px] touch-none place-items-center rounded-chip transition-[translate,box-shadow,background-color] duration-100 select-none [-webkit-touch-callout:none]",
            state === "idle" &&
              "bg-clay-cta text-white shadow-[0_6px_0_var(--color-clay-lip),var(--shadow-warm-lg)] hover:-translate-y-px active:translate-y-1.5 active:shadow-[0_0_0_var(--color-clay-lip),var(--shadow-warm)]",
            listening &&
              "translate-y-1 bg-clay-cta text-white shadow-[0_2px_0_var(--color-clay-lip),var(--shadow-flame)]",
            state === "thinking" &&
              "cursor-default bg-ink text-flame shadow-[0_6px_0_var(--color-ink-lip),var(--shadow-warm-lg)]",
            state === "disabled" &&
              "cursor-not-allowed border-2 border-border bg-paper text-muted-foreground shadow-warm-sm",
          )}
        >
          {state === "thinking" ? (
            <svg viewBox="0 0 12 16" aria-hidden className="h-11 w-8 animate-flicker">
              <path
                d="M6 0 C8 4 11 6.5 11 10 C11 13.5 8.8 16 6 16 C3.2 16 1 13.5 1 10 C1 6.5 4 4 6 0 Z"
                fill="currentColor"
              />
            </svg>
          ) : state === "disabled" ? (
            <MicOff className="size-10" aria-hidden />
          ) : listening ? (
            orb ? (
              <orb.VoiceBars level={amp} />
            ) : (
              <StillBars level={amp} />
            )
          ) : (
            <Mic className="size-11" strokeWidth={2.2} aria-hidden />
          )}
        </button>
      </div>

      {caption && (
        <p
          aria-live="polite"
          className="mt-1 min-h-[3.4rem] max-w-sm text-center text-[18px] font-semibold text-balance text-ink lg:max-w-md"
        >
          <BiText text={CAPTION[state]} subClassName="font-sans text-[15px] font-medium" />
          {listening && latched && (
            <span className="mt-1 block text-[16px] font-medium text-ink-3">
              <BiText text="mic.stop" sub={false} />
            </span>
          )}
        </p>
      )}
      {state !== "listening" && (onTypeInstead || alsoAction) && (
        <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-x-1">
          {onTypeInstead && (
            <button
              type="button"
              onClick={onTypeInstead}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-button font-display font-bold transition-[translate,box-shadow] duration-100",
                state === "disabled"
                  ? "h-14 w-full max-w-xs border border-border bg-paper px-6 text-[17px] text-ink lip-paper active:translate-y-1 active:shadow-none"
                  : QUIET,
              )}
            >
              <Keyboard className="size-5" aria-hidden />
              <BiText text="state.typeInstead" sub={false} inline />
            </button>
          )}
          {alsoAction && state === "idle" && (
            <button
              type="button"
              onClick={alsoAction.onClick}
              data-testid={alsoAction.testId}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-button font-display font-bold",
                QUIET,
              )}
            >
              <alsoAction.icon className="size-5" aria-hidden />
              <BiText text={alsoAction.text} sub={false} inline />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const QUIET =
  "h-12 px-4 text-[16px] text-ink-3 underline decoration-ink/20 underline-offset-4 hover:text-ink";

// Until Motion arrives (at idle, DESIGN §10): the orb's first animation frame, held still. Under
// reduced motion this is all there is, as before.
function StillHalo({ state, reduced, amp }: { state: MicOrbState; reduced: boolean; amp: number }) {
  if (state === "idle")
    return (
      <span
        aria-hidden
        className="absolute size-[104px] rounded-chip bg-flame/45"
        style={{ transform: `scale(${reduced ? 1.14 : 1.06})`, opacity: 0.5 }}
      />
    );
  if (state !== "listening") return null;
  return (
    <>
      <span
        aria-hidden
        className="absolute size-[104px] rounded-chip bg-clay/15"
        style={{ transform: `scale(${1.12 + amp * 0.62})` }}
      />
      <span
        aria-hidden
        className="absolute size-[104px] rounded-chip bg-flame/35"
        style={{ transform: `scale(${1.04 + amp * 0.32})` }}
      />
    </>
  );
}

function StillBars({ level }: { level: number }) {
  return (
    <span aria-hidden className="flex h-11 items-center gap-1.5">
      {BAR_SHAPE.map((k, i) => (
        <span
          key={i}
          className="block h-11 w-[7px] origin-center rounded-chip bg-white"
          style={{ transform: `scaleY(${0.18 + level * k * 0.82})` }}
        />
      ))}
    </span>
  );
}
