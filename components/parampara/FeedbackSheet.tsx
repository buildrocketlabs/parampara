"use client";

import { useState, useTransition } from "react";
import { Phone, Send } from "lucide-react";
import { sendFeedback } from "@/app/feedback/actions";
import { Button } from "@/components/ui/button";
import { FEEDBACK_MAX } from "@/lib/feedback";
import { fill } from "@/lib/i18n/fill";
import { useLang } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { BottomSheet } from "./BottomSheet";
import { Hanate } from "./hanate/Hanate";
import { useToast } from "./Toast";

// The feedback sheet behind the "Tell us" tab (docs/BUILD.md M4.5), loaded after first paint.
export function FeedbackSheet({
  open,
  onOpenChange,
  route,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: string;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="feedback.title"
      description="feedback.sub"
      side="auto"
      className="kn-solo"
    >
      <FeedbackForm route={route} onDone={() => onOpenChange(false)} />
    </BottomSheet>
  );
}

function FeedbackForm({ route, onDone }: { route: string; onDone: () => void }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, startTransition] = useTransition();
  const [result, setResult] = useState<null | {
    kept: boolean;
    helpline: "childline" | "telemanas" | null;
  }>(null);

  const send = () =>
    startTransition(async () => {
      const res = await sendFeedback({ route, text }).catch(() => null);
      if (!res || !res.ok) {
        toast({ text: "error.body", tone: "caring" });
        return;
      }
      setResult({ kept: res.kept, helpline: res.helpline });
    });

  if (result?.helpline) {
    const child = result.helpline === "childline";
    return (
      <div className="flex flex-col items-center py-2 text-center">
        <Hanate state="caring" size={96} label="" />
        <p className="mt-3 text-[18px] leading-snug text-ink">
          <Bi
            k={child ? "tried.welfare.child" : "tried.welfare.teacher"}
            subClassName="text-[15px]"
          />
        </p>
        <a
          href={child ? "tel:1098" : "tel:14416"}
          className={cn(
            "mt-5 flex min-h-16 w-full items-center justify-center gap-3 rounded-card px-5 py-4 font-display text-lg font-bold",
            child ? "bg-flame text-ink shadow-flame" : "bg-moss text-white",
          )}
        >
          <Phone className="size-6 shrink-0" aria-hidden />
          <Bi k={child ? "ask.childline" : "ask.telemanas"} sub={false} />
        </a>
      </div>
    );
  }

  if (result) {
    return (
      <div role="status" className="flex flex-col items-center py-2 text-center">
        <Hanate state="happy" size={96} label="" />
        <p className="mt-3 text-[20px] leading-snug font-semibold text-ink">
          <Bi
            k={result.kept ? "feedback.thanks" : "feedback.notKept"}
            subClassName="text-[15px] font-normal"
          />
        </p>
        <div className="mt-6 flex w-full flex-col gap-3">
          <Button className="w-full" onClick={onDone}>
            <Bi k="celebrate.continue" sub={false} />
          </Button>
          <Button
            variant="paper"
            className="w-full"
            onClick={() => {
              setText("");
              setResult(null);
            }}
          >
            <Bi k="feedback.again" sub={false} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="feedback-text" className="block font-display text-[20px] font-bold text-ink">
        <Bi k="feedback.label" sub={false} />
      </label>
      <p id="feedback-hint" className="mt-0.5 text-[18px] text-ink-3">
        <Bi k="feedback.hint" sub={false} />
      </p>
      <textarea
        id="feedback-text"
        data-autofocus
        aria-describedby="feedback-hint"
        value={text}
        onChange={(e) => setText(e.currentTarget.value.slice(0, FEEDBACK_MAX))}
        maxLength={FEEDBACK_MAX}
        rows={4}
        placeholder={t("feedback.placeholder")}
        className="mt-2 block w-full resize-none rounded-button border border-border bg-cream px-4 py-3 text-[20px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus-visible:border-ink-3 focus-visible:shadow-warm-sm"
      />
      <p className="mt-1 text-right text-[14px] text-ink-3 tabular-nums">
        {fill(t("tried.note.count"), { n: text.length, max: FEEDBACK_MAX })}
      </p>
      <Button
        className="mt-3 w-full"
        onClick={send}
        disabled={busy || !text.trim()}
        aria-busy={busy}
      >
        <Send aria-hidden />
        <Bi k={busy ? "tried.sending" : "feedback.send"} sub={false} />
      </Button>
    </div>
  );
}
