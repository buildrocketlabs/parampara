"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ChevronRight, CloudOff, MessageSquareHeart } from "lucide-react";
import { Bi } from "@/components/parampara/Bi";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

// "How was this answer? Tell us" right under every answer (field path, D82): one tap opens a
// sheet to speak or write, Kannada first. The sheet and the recording code load after first paint
// (DESIGN §10), fetched when the page is idle so the tap still opens at once.
const loadSheet = () => import("./AnswerFeedbackSheet").then((m) => m.AnswerFeedbackSheet);
const AnswerFeedbackSheet = dynamic(loadSheet, { ssr: false });

export function AnswerFeedback({ answerId, className }: { answerId: string; className?: string }) {
  const online = useOnline();
  const [open, setOpen] = useState(false);
  // Mounted on the first tap and kept, so closing still animates.
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const preload = () => void loadSheet().catch(() => undefined);
    if (w.requestIdleCallback) w.requestIdleCallback(preload);
    else window.setTimeout(preload, 2500);
  }, []);

  if (!online) {
    // Feedback needs the network; offline it says so instead of failing on a tap (Law 9).
    return (
      <p
        className={cn(
          "flex items-center gap-2.5 rounded-card border border-dashed border-ink-3/40 bg-paper/70 px-4 py-3 text-[15px] text-ink-3",
          className,
        )}
      >
        <CloudOff className="size-5 shrink-0" aria-hidden />
        <Bi k="answer.fb.offline" sub={false} />
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        data-testid="answer-feedback"
        data-feedback-clear
        onClick={() => {
          setOpened(true);
          setOpen(true);
        }}
        className={cn(
          "group flex min-h-16 w-full items-center gap-3 rounded-card border border-border bg-paper px-4 py-3 text-left shadow-warm-sm transition-[box-shadow,translate] duration-150 hover:-translate-y-px hover:shadow-warm active:translate-y-0",
          className,
        )}
      >
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-flame/30 text-clay-cta"
        >
          <MessageSquareHeart className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[18px] leading-snug font-bold text-ink">
            <Bi k="answer.fb.ask" sub={false} />
          </span>
          <span className="block text-[15px] text-ink-3">
            <Bi k="answer.fb.askSub" sub={false} />
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
      </button>
      {opened && (
        <AnswerFeedbackSheet open={open} onOpenChange={setOpen} route={`/t/a/${answerId}`} />
      )}
    </>
  );
}
