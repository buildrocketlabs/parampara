"use client";

import { useId } from "react";
import * as m from "motion/react-m";
import { springs } from "@/lib/motion";
import { useOnline } from "@/lib/use-online";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useLang } from "@/lib/i18n/provider";
import { fill } from "@/lib/i18n/fill";
import {
  currentView,
  isComplete,
  overallProgress,
  stageViews,
  type Stage,
  type StageView,
} from "@/lib/stages";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";
import { Hanate } from "./hanate/Hanate";
import type { HanateState } from "./hanate/variants";
import { StageList } from "./StageList";
import { MotionIsland } from "./MotionIsland";

// The honest progress indicator (DESIGN §4), never a spinner. The master's lamp passes its flame
// along a dotted path to Hanate; the spark sits exactly as far along as the real work is. While a
// stage runs without known progress, only that stage's stretch of path shimmers.
export type LampLoaderProps = {
  stages: readonly Stage[];
  /** Key of the stage running now, or DONE from lib/stages when every stage has finished. */
  current: string;
  done?: readonly string[];
  /** Live detail for the running stage, for example "Part 12 of 96". Not announced, so it may tick. */
  detail?: React.ReactNode;
  /** 0..1 within the running stage, when the caller really knows it. */
  progress?: number;
  /** `caring` for the slow path and the human queue: Hanate lowers its flame, words get gentler. */
  tone?: "default" | "caring";
  /**
   * The job is waiting (queued offline, or paused by the server). Hanate rests and the line says it
   * will carry on. Offline is detected on its own; pass true when the caller knows it is paused.
   */
  paused?: boolean;
  /** Hide the stage list beneath (for tight spaces; use StageList elsewhere then). */
  showStages?: boolean;
  className?: string;
};

// Scene geometry, in the SVG's own units (viewBox 0 0 320 132).
const FROM = { x: 58, y: 30 };
const CTRL = { x: 162, y: -10 };
const TO = { x: 262, y: 34 };
const DOTS = 17;
const T_START = 0.05;
const T_END = 0.95;
const HANATE = { x: 226, y: 22, size: 86 };

function bezier(t: number) {
  const u = 1 - t;
  return {
    x: u * u * FROM.x + 2 * u * t * CTRL.x + t * t * TO.x,
    y: u * u * FROM.y + 2 * u * t * CTRL.y + t * t * TO.y,
  };
}

const DOT_POINTS = Array.from({ length: DOTS }, (_, i) => {
  const along = (i + 0.5) / DOTS;
  return { along, ...bezier(T_START + along * (T_END - T_START)) };
});

function LampLoaderMoving({
  stages,
  current,
  done,
  detail,
  progress,
  tone = "default",
  paused: pausedProp = false,
  showStages = true,
  className,
}: LampLoaderProps) {
  const { lang, t } = useLang();
  const views = stageViews(stages, current, done);
  const now = currentView(views);
  const complete = isComplete(views);
  const overall = overallProgress(views, progress);

  const online = useOnline();
  const paused = !complete && (pausedProp || !online);
  const hanate: HanateState = complete
    ? "happy"
    : paused
      ? "resting"
      : tone === "caring"
        ? "caring"
        : "thinking";
  const stepLine = now ? fill(t("loader.step"), { n: now.index + 1, total: views.length }) : "";
  const announce = complete ? t("stage.done") : now ? `${stepLine}. ${t(now.label)}` : "";

  return (
    <section
      aria-label={t("loader.region")}
      aria-busy={!complete}
      data-complete={complete || undefined}
      className={cn("mx-auto flex w-full max-w-md flex-col items-center", className)}
    >
      <Scene
        overall={overall}
        views={views}
        complete={complete}
        hanate={hanate}
        unknownProgress={progress === undefined && !paused}
      />

      <div className="mt-3 min-h-[5.5rem] text-center">
        {now && (
          <p className="text-[15px] font-semibold text-ink-3 tabular-nums" lang={lang}>
            {stepLine}
          </p>
        )}
        <p className="mt-1 font-display text-[24px] leading-snug font-bold text-ink">
          <BiText
            text={complete ? "stage.done" : (now?.label ?? stages[0]?.label ?? "stage.done")}
            subClassName="font-sans text-[16px] font-semibold"
          />
        </p>
        {paused ? (
          <p className="mt-2 text-[15px] text-ink-3">
            <BiText text="loader.paused" sub={false} />
          </p>
        ) : (
          tone === "caring" &&
          !complete && (
            <p className="mt-2 text-[15px] text-ink-3">
              <BiText text="loader.slow" sub={false} />
            </p>
          )
        )}
      </div>

      {/* One polite line per stage change; the ticking detail stays out of it. */}
      <p role="status" aria-live="polite" className="sr-only" lang={lang}>
        {announce}
      </p>

      {showStages && (
        <div className="mt-4 w-full rounded-card border border-border bg-paper/80 p-5 shadow-warm-sm">
          <StageList
            stages={stages}
            current={current}
            done={done}
            detail={detail}
            progress={progress}
          />
        </div>
      )}
      {!showStages && detail && (
        <p className="mt-1 text-[15px] text-ink-3 tabular-nums">{detail}</p>
      )}
    </section>
  );
}

function Scene({
  overall,
  views,
  complete,
  hanate,
  unknownProgress,
}: {
  overall: number;
  views: readonly StageView[];
  complete: boolean;
  hanate: HanateState;
  unknownProgress: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const uid = useId().replace(/:/g, "");
  const n = views.length || 1;
  const runningIndex = views.findIndex((v) => v.status === "current");
  const segStart = runningIndex >= 0 ? runningIndex / n : 1;
  const segEnd = runningIndex >= 0 ? (runningIndex + 1) / n : 1;
  const spark = bezier(T_START + overall * (T_END - T_START));
  const move = reduced ? { duration: 0 } : springs.gentle;

  return (
    <svg viewBox="0 0 320 132" className="h-auto w-full max-w-[360px] overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`ml-flame-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-flame)" />
          <stop offset="100%" stopColor="var(--color-flame-deep)" />
        </linearGradient>
        <radialGradient id={`ml-glow-${uid}`}>
          <stop offset="0%" stopColor="var(--color-flame)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--color-flame)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="48" cy="124" rx="34" ry="3.5" fill="var(--color-ink)" opacity="0.1" />
      <MasterLamp uid={uid} live={!reduced} />

      {/* the dotted path: dim dots, lit dots fade in as the work moves */}
      {DOT_POINTS.map((d, i) => {
        const lit = complete || d.along <= overall;
        const working =
          !complete && !lit && unknownProgress && d.along > segStart && d.along < segEnd;
        return (
          <g key={i}>
            <circle cx={d.x} cy={d.y} r="2.3" fill="var(--color-ink)" opacity="0.16" />
            <m.circle
              cx={d.x}
              cy={d.y}
              r="2.6"
              fill="var(--color-flame-deep)"
              initial={false}
              animate={
                working && !reduced
                  ? { opacity: [0.15, 0.9, 0.15] }
                  : { opacity: lit ? 1 : working ? 0.45 : 0 }
              }
              transition={
                working && !reduced
                  ? { duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: (i % DOTS) * 0.12 }
                  : { duration: reduced ? 0 : 0.28 }
              }
            />
          </g>
        );
      })}

      {/* the travelling flame: exactly as far along as the work */}
      <m.g
        initial={false}
        animate={{ x: spark.x, y: spark.y, opacity: complete ? 0 : 1 }}
        transition={move}
      >
        <circle r="11" fill={`url(#ml-glow-${uid})`} />
        <m.circle
          initial={false}
          r="4.6"
          fill="var(--color-flame)"
          animate={reduced ? { scale: 1 } : { scale: [1, 1.25, 1] }}
          transition={{ duration: 1.1, repeat: reduced ? 0 : Infinity, ease: "easeInOut" }}
        />
        <circle r="2" fill="var(--color-paper)" />
      </m.g>

      {/* Hanate's glow gathers as the flame arrives: the receiving lamp brightens, the giver never dims */}
      <m.circle
        cx={TO.x + 7}
        cy={TO.y + 22}
        r="30"
        fill={`url(#ml-glow-${uid})`}
        initial={false}
        animate={{ opacity: 0.15 + overall * 0.85 }}
        transition={reduced ? { duration: 0 } : { duration: 0.5 }}
      />
      <g transform={`translate(${HANATE.x} ${HANATE.y})`}>
        <Hanate state={hanate} size={HANATE.size} label="" />
      </g>
    </svg>
  );
}

const FLAME_ORIGIN = { transformBox: "fill-box", originX: 0.5, originY: 1 } as const;

// The elder's lamp: deeper clay, a row of kolam dots, a steady flame that never dims as it gives.
function MasterLamp({ uid, live }: { uid: string; live: boolean }) {
  return (
    <g>
      <circle cx="48" cy="50" r="30" fill={`url(#ml-glow-${uid})`} opacity="0.7" />
      <m.g
        initial={false}
        style={FLAME_ORIGIN}
        animate={
          live ? { scaleY: [1, 1.05, 0.98, 1], rotate: [0, -1.5, 1, 0] } : { scaleY: 1, rotate: 0 }
        }
        transition={{ duration: 2.8, repeat: live ? Infinity : 0, ease: "easeInOut" }}
      >
        <path
          d="M48 22 C53.5 34 61 42 61 53 C61 62.5 55 69 48 69 C41 69 35 62.5 35 53 C35 42 42.5 34 48 22 Z"
          fill={`url(#ml-flame-${uid})`}
        />
        <path
          d="M48 41 C50.5 46.5 54 50.5 54 56 C54 61.5 51.5 65.5 48 65.5 C44.5 65.5 42 61.5 42 56 C42 50.5 45.5 46.5 48 41 Z"
          fill="var(--color-paper)"
          opacity="0.9"
        />
      </m.g>
      <path d="M48 77 L48 69" stroke="var(--color-ink-2)" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="48" cy="121" rx="15" ry="4" fill="var(--color-clay-lip)" />
      <path d="M11 79 C11 103 27 117 48 117 C69 117 85 103 85 79 Z" fill="var(--color-clay-cta)" />
      <path
        d="M20 89 C22 99 28 106 36 110"
        stroke="var(--color-clay-glow)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <g fill="var(--color-flame)" opacity="0.85">
        <circle cx="31" cy="96" r="2" />
        <circle cx="40" cy="99.5" r="2" />
        <circle cx="48" cy="100.5" r="2.4" />
        <circle cx="56" cy="99.5" r="2" />
        <circle cx="65" cy="96" r="2" />
      </g>
      <ellipse cx="48" cy="79" rx="37" ry="7.5" fill="var(--color-clay)" />
      <ellipse cx="48" cy="78.5" rx="30" ry="4.6" fill="var(--color-clay-lip)" />
    </g>
  );
}

/** LampLoader, inside its own Motion island (components/parampara/MotionIsland). */
export function LampLoader(props: React.ComponentProps<typeof LampLoaderMoving>) {
  return (
    <MotionIsland>
      <LampLoaderMoving {...props} />
    </MotionIsland>
  );
}
