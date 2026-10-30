import { Check } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { clamp01, stageViews, type Stage, type StageStatus } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";

// The compact text form of LampLoader (DESIGN §4): done ticks, the running stage lit like a small
// flame, the rest waiting with their number. For long jobs (a 60 minute import) and the trace.
// No hooks, so it renders in server and client trees alike.
export type StageListProps = {
  stages: readonly Stage[];
  /** Key of the stage running now, or DONE from lib/stages when all have finished. */
  current: string;
  /** Stages already finished (earlier stages are done anyway; the pipeline only moves forward). */
  done?: readonly string[];
  /** Shown under the running stage, for example "Part 12 of 96". */
  detail?: React.ReactNode;
  /** 0..1 within the running stage, when known. Omit it rather than guess. */
  progress?: number;
  size?: "md" | "sm";
  className?: string;
};

const STATUS_LABEL: Record<StageStatus, MessageKey> = {
  done: "stage.status.done",
  current: "stage.status.now",
  pending: "stage.status.next",
};

export function StageList({
  stages,
  current,
  done,
  detail,
  progress,
  size = "md",
  className,
}: StageListProps) {
  const views = stageViews(stages, current, done);
  const sm = size === "sm";

  return (
    <ol className={cn("flex flex-col", className)}>
      {views.map((v, i) => {
        const last = i === views.length - 1;
        const now = v.status === "current";
        return (
          <li
            key={v.key}
            data-status={v.status}
            aria-current={now ? "step" : undefined}
            className={cn("relative flex items-start gap-3", !last && (sm ? "pb-3" : "pb-4"))}
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute w-0.5 rounded-chip",
                  sm ? "top-7 bottom-1 left-[11px]" : "top-9 bottom-1 left-[15px]",
                  v.status === "done" ? "bg-moss/35" : "bg-ink/10",
                )}
              />
            )}
            <StageMark status={v.status} n={i + 1} sm={sm} />
            <div className={cn("min-w-0 flex-1", sm ? "pt-0.5" : "pt-1")}>
              <span className="sr-only">
                <BiText text={STATUS_LABEL[v.status]} sub={false} inline />
                {": "}
              </span>
              <BiText
                text={v.label}
                sub={now}
                className={cn(
                  "font-display leading-snug",
                  sm ? "text-[15px]" : "text-[17px]",
                  now ? "font-bold text-ink" : "font-semibold",
                  v.status === "done" && "text-ink-3",
                  v.status === "pending" && "text-muted-foreground",
                )}
                subClassName="font-sans text-[14px] font-medium"
              />
              {now && detail && (
                <p
                  className={cn("mt-1 text-ink-3 tabular-nums", sm ? "text-[14px]" : "text-[15px]")}
                >
                  {detail}
                </p>
              )}
              {now && progress !== undefined && <StageProgress value={progress} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StageMark({ status, n, sm }: { status: StageStatus; n: number; sm: boolean }) {
  const box = sm ? "size-6" : "size-8";
  if (status === "done") {
    return (
      <span
        aria-hidden
        className={cn("grid shrink-0 place-items-center rounded-chip bg-sage text-moss", box)}
      >
        <Check className={sm ? "size-3.5" : "size-4.5"} strokeWidth={3.2} />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-chip bg-paper shadow-flame ring-2 ring-flame-deep",
          box,
        )}
      >
        <svg viewBox="0 0 12 16" className={cn("animate-ember", sm ? "h-3 w-2.5" : "h-4 w-3")}>
          <path
            d="M6 0 C8 4 11 6.5 11 10 C11 13.5 8.8 16 6 16 C3.2 16 1 13.5 1 10 C1 6.5 4 4 6 0 Z"
            fill="var(--color-flame-deep)"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-chip border-2 border-ink/15 bg-paper font-display font-bold text-muted-foreground",
        box,
        sm ? "text-[12px]" : "text-[14px]",
      )}
    >
      {n}
    </span>
  );
}

/** A calm bar for progress inside one stage. Scales on transform only. */
export function StageProgress({ value, className }: { value: number; className?: string }) {
  const v = clamp01(value);
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cn(
        "mt-2 block h-1.5 w-full max-w-64 overflow-hidden rounded-chip bg-sage",
        className,
      )}
    >
      <span
        className="block h-full w-full origin-left rounded-chip bg-flame-deep transition-transform duration-500 ease-gentle"
        style={{ transform: `scaleX(${v})` }}
      />
    </span>
  );
}
