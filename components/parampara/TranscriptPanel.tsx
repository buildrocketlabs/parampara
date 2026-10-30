"use client";

import { useEffect, useRef } from "react";
import { Play, ShieldCheck } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { fill } from "@/lib/i18n/fill";
import { useLang } from "@/lib/i18n/provider";
import { formatTime } from "@/lib/player";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";

// The reviewer's evidence (DESIGN §4 PracticeCard): the redacted transcript with every cited moment
// lit in flame. Pressing a moment asks the page to play it; the active one is ringed and scrolled
// into view. Text arrives already redacted (Law 5); a small mark says where a name was hidden.
export type TranscriptSegment = {
  id: number;
  startMs: number;
  endMs: number;
  kn: string;
  en: string | null;
  speaker: string | null;
  /** A child's name was replaced in this segment. */
  redacted: boolean;
};

export type TranscriptPanelProps = {
  segments: readonly TranscriptSegment[];
  /** Segment ids cited as evidence by the card being reviewed. */
  highlight: readonly number[];
  /** The segment playing or chosen now. */
  activeId?: number | null;
  onPlay: (id: number) => void;
  /** Show the English line under each Kannada line. Default true. */
  showEnglish?: boolean;
  className?: string;
};

const SPEAKER: Record<string, MessageKey> = {
  master: "transcript.master",
  interviewer: "transcript.interviewer",
  other: "transcript.other",
};

export function TranscriptPanel({
  segments,
  highlight,
  activeId,
  onPlay,
  showEnglish = true,
  className,
}: TranscriptPanelProps) {
  const { t } = useLang();
  const reduced = usePrefersReducedMotion();
  const list = useRef<HTMLOListElement>(null);
  const cited = new Set(highlight);
  const citedCount = segments.filter((s) => cited.has(s.id)).length;

  useEffect(() => {
    if (activeId == null) return;
    const row = list.current?.querySelector<HTMLElement>(`[data-segment="${activeId}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [activeId, reduced]);

  return (
    <section aria-label={t("transcript.label")} className={cn("flex min-h-0 flex-col", className)}>
      <header className="flex items-center justify-between gap-3 pb-3">
        <h3 className="font-display text-[18px] font-bold text-ink">
          <BiText text="transcript.label" sub={false} />
        </h3>
        {citedCount > 0 && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-chip bg-flame/40 px-3 font-display text-[14px] font-semibold text-ink">
            <span aria-hidden className="size-2 rounded-chip bg-flame-deep" />
            <BiText text="transcript.cited" vars={{ n: citedCount }} sub={false} inline />
          </span>
        )}
      </header>

      {segments.length === 0 ? (
        <p className="rounded-button bg-cream p-4 text-[16px] text-ink-3">
          <BiText text="transcript.empty" />
        </p>
      ) : (
        <ol ref={list} className="-mx-1 flex min-h-0 flex-col gap-1 overflow-y-auto px-1 py-1">
          {segments.map((s) => {
            const lit = cited.has(s.id);
            const active = s.id === activeId;
            const speaker = s.speaker ? SPEAKER[s.speaker] : undefined;
            const time = formatTime(s.startMs);
            return (
              <li key={s.id} data-segment={s.id} data-cited={lit || undefined}>
                <button
                  type="button"
                  onClick={() => onPlay(s.id)}
                  aria-current={active ? "true" : undefined}
                  aria-label={`${fill(t("transcript.play"), { time })}${lit ? ` · ${t("transcript.evidence")}` : ""}`}
                  className={cn(
                    "group flex w-full gap-3 rounded-button px-3 py-2.5 text-left transition-colors duration-150",
                    lit
                      ? "border-l-4 border-flame-deep bg-flame/30 hover:bg-flame/45"
                      : "border-l-4 border-transparent hover:bg-cream",
                    active && "ring-2 ring-clay ring-offset-1 ring-offset-paper",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-chip px-2 font-mono text-[14px] tabular-nums",
                      lit || active
                        ? "bg-ink text-white"
                        : "bg-sage text-ink-2 group-hover:bg-ink group-hover:text-white",
                    )}
                  >
                    <Play className="size-3" fill="currentColor" aria-hidden />
                    {time}
                  </span>
                  <span className="min-w-0 flex-1">
                    {(speaker || s.speaker || s.redacted) && (
                      <span className="mb-0.5 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink-3">
                        {speaker ? <BiText text={speaker} sub={false} inline /> : s.speaker}
                        {s.redacted && (
                          <span className="inline-flex items-center gap-1 font-medium text-moss">
                            <ShieldCheck className="size-3.5" aria-hidden />
                            <BiText text="transcript.redacted" sub={false} inline />
                          </span>
                        )}
                      </span>
                    )}
                    <span lang="kn" className="block text-[17px] leading-[1.65] text-ink">
                      {s.kn}
                    </span>
                    {showEnglish && s.en && (
                      <span lang="en" className="mt-0.5 block text-[15px] leading-snug text-ink-3">
                        {s.en}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
