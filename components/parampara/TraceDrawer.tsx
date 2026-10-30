"use client";

import {
  Camera,
  Check,
  Minus,
  HeartHandshake,
  History,
  Library,
  Mic,
  PenLine,
  ScanSearch,
  ShieldCheck,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Trace, TraceStep, Verdict } from "@/lib/ask/types";
import type { MessageKey } from "@/lib/i18n";
import { useLang } from "@/lib/i18n/provider";
import {
  cacheDetail,
  formatLatency,
  formatTokens,
  formatUsd,
  isRemoved,
  replayInfo,
  replayLine,
  verdictCounts,
  type ReplayInfo,
} from "@/lib/trace-format";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import { SampleBadge } from "./Badges";
import { BiText } from "./BiText";
import { BottomSheet } from "./BottomSheet";
import { LanguageToggle } from "./LanguageToggle";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { SkeletonLine } from "./Skeleton";

// "How this answer was made" (DESIGN §4): a teacher's notebook timeline of every step, with model,
// time, tokens, cost and prompt version, and the grounding verdict for each answer step. Removed
// steps stay visible, struck through, with the reason. Our technical strength, made visible.
// Heavy for the teacher shell, so screens load it with LazyTraceDrawer (components/parampara/lazy).
export type TraceDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null while the trace is still loading (or could not load: see `status`). */
  trace: Trace | null;
  /** When there is no trace: still coming, failed, or the network is gone. Offline is detected too. */
  status?: "loading" | "error" | "offline";
  onRetry?: () => void;
  /** Made up data for the gallery and demos (Law 7). */
  isSample?: boolean;
  side?: "bottom" | "right" | "auto";
  /** A replayed answer: when its first answer was made (ISO), for traces that do not carry it. */
  firstAnsweredAt?: string | null;
};

const KIND: Record<TraceStep["kind"], { icon: LucideIcon; label: MessageKey }> = {
  transcript: { icon: Mic, label: "trace.kind.transcript" },
  photo: { icon: Camera, label: "trace.kind.photo" },
  triage: { icon: ScanSearch, label: "trace.kind.triage" },
  retrieval: { icon: Library, label: "trace.kind.retrieval" },
  draft: { icon: PenLine, label: "trace.kind.draft" },
  grounding: { icon: ShieldCheck, label: "trace.kind.grounding" },
  safety: { icon: HeartHandshake, label: "trace.kind.safety" },
  voice: { icon: Volume2, label: "trace.kind.voice" },
  cache: { icon: History, label: "trace.kind.cache" },
};

export function TraceDrawer({
  open,
  onOpenChange,
  trace,
  status = "loading",
  onRetry,
  isSample = false,
  side = "auto",
  firstAnsweredAt,
}: TraceDrawerProps) {
  const online = useOnline();
  const missing = !trace ? (!online ? "offline" : status) : null;
  // A replay shows what it took now, and the first answer's numbers as the first answer's (F-P1).
  const replay = trace ? replayInfo(trace, firstAnsweredAt) : null;
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="answer.how"
      description="trace.intro"
      badge={isSample ? <SampleBadge /> : undefined}
      headerAction={<LanguageToggle />}
      side={side}
      surface="notebook"
      footer={trace ? <Totals trace={trace} replayed={replay !== null} /> : undefined}
    >
      {replay && <ReplayNote info={replay} />}
      {trace && <TraceVerdict trace={trace} replay={replay} />}
      {trace && <Timeline steps={trace.steps} />}
      {missing === "loading" && <Loading />}
      {missing === "error" && (
        <ErrorState title="trace.error.title" body="trace.error.body" onRetry={onRetry} />
      )}
      {missing === "offline" && (
        <EmptyState title="trace.offline.title" body="trace.offline.body" hanate="resting" />
      )}
    </BottomSheet>
  );
}

/** The timeline alone, for the /how page or a reviewer view without a sheet. */
export function Timeline({ steps }: { steps: readonly TraceStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="py-6 text-[16px] text-ink-3">
        <BiText text="trace.empty" />
      </p>
    );
  }
  return (
    <ol className="relative flex flex-col">
      {steps.map((s, i) => (
        <TraceItem key={`${s.kind}-${i}`} step={s} last={i === steps.length - 1} />
      ))}
    </ol>
  );
}

function TraceItem({ step, last }: { step: TraceStep; last: boolean }) {
  const { msg } = useLang();
  const { icon: Icon, label } = KIND[step.kind];
  const meta = [
    step.model && { k: "model", v: step.model, mono: true },
    step.latencyMs !== undefined && { k: "time", v: formatLatency(step.latencyMs) },
    (step.tokensIn !== undefined || step.tokensOut !== undefined) && {
      k: "tokens",
      v: `${formatTokens(step.tokensIn ?? 0)} → ${formatTokens(step.tokensOut ?? 0)}`,
    },
    step.costUsd !== undefined && { k: "cost", v: formatUsd(step.costUsd) },
    step.promptVersion && { k: "prompt", v: step.promptVersion, mono: true },
  ].filter(Boolean) as Array<{ k: string; v: string; mono?: boolean }>;

  return (
    <li data-kind={step.kind} className={cn("relative flex gap-4 pb-6", last && "pb-2")}>
      {!last && (
        <span
          aria-hidden
          className="absolute top-10 bottom-0 left-[19px] w-0.5 rounded-chip bg-clay/25"
        />
      )}
      <span
        aria-hidden
        className="relative z-10 grid size-10 shrink-0 place-items-center rounded-chip border-2 border-clay/40 bg-paper text-clay-cta shadow-warm-sm"
      >
        <Icon className="size-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {step.title.en !== msg("en", label) && (
          <p className="text-[14px] font-semibold text-ink-3">
            <BiText text={label} sub={false} />
          </p>
        )}
        <h3 className="mt-0.5 font-display text-[18px] leading-snug font-bold text-ink">
          <BiText text={step.title} subClassName="font-sans text-[14px] font-medium" />
        </h3>
        {step.detail && (
          <p className="mt-1.5 rounded-button bg-cream/80 px-3 py-2 text-[15px] leading-relaxed text-ink">
            {step.kind === "cache" ? cacheDetail(step.detail) : step.detail}
          </p>
        )}
        {meta.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {meta.map((m) => (
              <li
                key={m.k}
                className={cn(
                  "inline-flex min-h-7 items-center rounded-chip border border-border bg-paper px-2.5 text-[14px] text-ink-3 tabular-nums",
                  m.mono && "font-mono text-[14px]",
                )}
              >
                {m.v}
              </li>
            ))}
          </ul>
        )}
        {step.verdicts && step.verdicts.length > 0 && <Verdicts verdicts={step.verdicts} />}
      </div>
    </li>
  );
}

type VerdictRow = NonNullable<TraceStep["verdicts"]>[number];

const VERDICT_LABEL: Record<Verdict, MessageKey> = {
  supported: "trace.verdict.supported",
  partial: "trace.verdict.partial",
  unsupported: "trace.verdict.unsupported",
};

function Verdicts({ verdicts }: { verdicts: readonly VerdictRow[] }) {
  const { kept, removed } = verdictCounts([
    { kind: "grounding", title: { kn: "", en: "" }, verdicts: [...verdicts] },
  ]);
  return (
    <div className="mt-3">
      <p className="text-[14px] font-semibold text-moss">
        <BiText text="trace.kept" vars={{ kept, removed }} sub={false} />
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {verdicts.map((v, i) => {
          const gone = isRemoved(v);
          const label = gone ? VERDICT_LABEL.unsupported : VERDICT_LABEL[v.verdict];
          return (
            <li
              key={i}
              data-verdict={gone ? "removed" : v.verdict}
              className={cn(
                "flex gap-2.5 rounded-button px-3 py-2.5",
                gone ? "bg-cream" : v.verdict === "partial" ? "bg-flame/25" : "bg-sage/60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-chip",
                  gone && "bg-ink/10 text-ink-3",
                  !gone && v.verdict === "supported" && "bg-moss text-white",
                  !gone && v.verdict === "partial" && "bg-flame text-ink",
                )}
              >
                {gone ? (
                  <X className="size-3.5" strokeWidth={3} />
                ) : v.verdict === "supported" ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  <Minus className="size-3.5" strokeWidth={3.4} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[15px] leading-snug",
                    gone ? "text-ink-3 line-through decoration-clay/70 decoration-2" : "text-ink",
                  )}
                >
                  {v.step}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[14px] font-semibold",
                    gone ? "text-clay-cta" : v.verdict === "partial" ? "text-ink-3" : "text-moss",
                  )}
                >
                  <BiText text={label} sub={false} inline />
                  {gone && (
                    <>
                      {": "}
                      <BiText text="trace.removed.reason" sub={false} inline />
                    </>
                  )}
                </p>
                {!gone && v.quote && (
                  <blockquote className="mt-1.5 border-l-2 border-moss/50 pl-2.5 text-[14px] leading-snug text-ink-3">
                    <span className="sr-only">
                      <BiText text="trace.quote" sub={false} inline />:{" "}
                    </span>
                    “{v.quote}”
                  </blockquote>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A replay says so first: how long it took and what it spent now, and when the first answer was
 * made, in how long and for what (D35, F-P1). The steps below are the first answer's.
 */
function ReplayNote({ info }: { info: ReplayInfo }) {
  const { msg } = useLang();
  return (
    <div
      data-testid="trace-replay"
      className="mb-4 flex items-start gap-3 rounded-button border border-border bg-paper px-4 py-3"
    >
      <History className="mt-0.5 size-5 shrink-0 text-clay-cta" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[16px] leading-snug font-bold text-ink">
          <BiText text="trace.replay.title" sub={false} />
        </p>
        <p className="mt-1 text-[15px] leading-snug text-ink-3 tabular-nums">
          <BiText text={replayLine(info, msg)} sub={false} />
        </p>
        <p className="mt-1 text-[14px] text-ink-3">
          <BiText text="trace.replay.note" sub={false} />
        </p>
      </div>
    </div>
  );
}

/** The verdict first: how much of the answer stands on approved practice, how long, what cost. */
function TraceVerdict({ trace, replay }: { trace: Trace; replay: ReplayInfo | null }) {
  const graded = trace.steps.some((s) => s.verdicts && s.verdicts.length > 0);
  if (!graded) return null;
  const { kept, removed } = verdictCounts(trace.steps);
  return (
    <p className="mb-5 flex items-start gap-3 rounded-button bg-sage px-4 py-3 text-moss">
      <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[16px] leading-snug font-bold">
          <BiText text="trace.summary" vars={{ kept, total: kept + removed }} sub={false} />
        </span>
        {/* A replay's time and cost are in the note above; these would read as if made now. */}
        {!replay && (
          <span className="mt-0.5 block text-[14px] text-ink-3 tabular-nums">
            {formatLatency(trace.totals.latencyMs)} · {formatUsd(trace.totals.costUsd)}
          </span>
        )}
        {removed > 0 && (
          // The strongest part of the story: a step the check took out, and why.
          <button
            type="button"
            onClick={() => {
              const step = document.querySelector<HTMLElement>('[data-verdict="removed"]');
              if (!step) return;
              step.scrollIntoView({ block: "center", behavior: "smooth" });
              // A brief ring marks it once it arrives (static under reduced motion, then gone).
              step.classList.add("ring-2", "ring-clay/60");
              window.setTimeout(() => step.classList.remove("ring-2", "ring-clay/60"), 1600);
            }}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-chip bg-paper px-3 text-[14px] font-semibold text-clay-cta hover:bg-cream"
          >
            <X className="size-4" strokeWidth={3} aria-hidden />
            <BiText text="trace.removedChip" vars={{ n: removed }} sub={false} inline />
          </button>
        )}
      </span>
    </p>
  );
}

function Totals({ trace, replayed }: { trace: Trace; replayed: boolean }) {
  return (
    <p className="flex items-center justify-between gap-3 font-display text-[16px] font-bold text-ink tabular-nums">
      <BiText text={replayed ? "trace.replay.firstTotal" : "trace.total"} sub={false} inline />
      <span className="flex items-center gap-3">
        <span>{formatLatency(trace.totals.latencyMs)}</span>
        <span aria-hidden className="size-1 rounded-chip bg-ink/30" />
        <span>{formatUsd(trace.totals.costUsd)}</span>
      </span>
    </p>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4">
          <span className="block size-10 shrink-0 animate-breathe rounded-chip bg-clay/15" />
          <div className="flex-1 space-y-2 pt-1">
            <SkeletonLine width="40%" className="h-3" />
            <SkeletonLine width="80%" />
            <SkeletonLine width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}
