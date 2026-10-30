"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Mic, Phone, Send, Square } from "lucide-react";
import { sendFeedback } from "@/app/feedback/actions";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { BottomSheet } from "@/components/parampara/BottomSheet";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { useToast } from "@/components/parampara/Toast";
import type { Recording } from "@/lib/audio";
import { FEEDBACK_MAX } from "@/lib/feedback";
import { fill } from "@/lib/i18n/fill";
import { useLang } from "@/lib/i18n/provider";
import { haptics, vibrate } from "@/lib/motion";
import { cn } from "@/lib/utils";

// The sheet behind "How was this answer?" (D82). Who: a teacher who just read or heard an answer,
// often in the Talakal session. One job: say in her own words how it was, by voice or typing, and
// choose whether we may quote her (a role word only, never her name; off unless she ticks it).
// Her voice goes through the same speech to text as a question and is never stored; the words
// pass the same name redaction as questions on the server (Law 5).

type Phase = "idle" | "listening" | "transcribing";
type Result = { kept: boolean; helpline: "childline" | "telemanas" | null };

export function AnswerFeedbackSheet({
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
      title="answer.fb.title"
      description="answer.fb.sub"
      side="auto"
      className="kn-solo"
    >
      <FeedbackForm route={route} onDone={() => onOpenChange(false)} />
    </BottomSheet>
  );
}

function FeedbackForm({ route, onDone }: { route: string; onDone: () => void }) {
  const { lang, t } = useLang();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [spoken, setSpoken] = useState(false);
  const [quoteOk, setQuoteOk] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [voiceFailed, setVoiceFailed] = useState(false);
  const [busy, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const rec = useRef<Recording | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Nothing keeps listening once the sheet is gone.
  useEffect(() => () => void rec.current?.stop().catch(() => undefined), []);

  async function startVoice() {
    setVoiceFailed(false);
    try {
      vibrate(haptics.press);
      const { startRecording } = await import("@/lib/audio");
      rec.current = await startRecording({ maxMs: 29_000, onMaxReached: () => void stopVoice() });
      setPhase("listening");
    } catch {
      voiceDidNotWork();
    }
  }

  async function stopVoice() {
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    setPhase("transcribing");
    try {
      const blob = await r.stop();
      if (blob.size < 2_000) throw new Error("too_short");
      const { questionWav } = await import("@/lib/ask/client");
      const wav = await questionWav(blob);
      const res = await fetch(`/api/transcribe?lang=${lang}`, {
        method: "POST",
        headers: { "content-type": "audio/wav" },
        body: wav as BodyInit,
      });
      const body = (await res.json().catch(() => ({}))) as { text?: string };
      const words = body.text?.trim();
      if (!res.ok || !words) throw new Error("speech_failed");
      // She checks her words before anything is sent; adding to what she already typed.
      setText((now) => [now.trim(), words].filter(Boolean).join(" ").slice(0, FEEDBACK_MAX));
      setSpoken(true);
      setPhase("idle");
      box.current?.focus();
    } catch {
      voiceDidNotWork();
    }
  }

  function voiceDidNotWork() {
    setPhase("idle");
    setVoiceFailed(true);
    box.current?.focus();
  }

  const send = () =>
    startTransition(async () => {
      const res = await sendFeedback({
        route,
        text,
        kind: spoken ? "voice" : "text",
        quoteOk,
      }).catch(() => null);
      if (!res || !res.ok) {
        toast({ text: "error.body", tone: "caring" });
        return;
      }
      vibrate(haptics.success);
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
      <div
        role="status"
        className="flex flex-col items-center py-2 text-center"
        data-testid="answer-feedback-sent"
      >
        <Hanate state="happy" size={96} label="" />
        <p className="mt-3 text-[20px] leading-snug font-semibold text-ink">
          <Bi
            k={result.kept ? "feedback.thanks" : "feedback.notKept"}
            subClassName="text-[15px] font-normal"
          />
        </p>
        <Button className="mt-6 w-full" onClick={onDone}>
          <Bi k="celebrate.continue" sub={false} />
        </Button>
      </div>
    );
  }

  const listening = phase === "listening";
  const writing = phase === "transcribing";
  return (
    <div>
      {/* Voice first: one big round button, tap to start, tap when done. */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => void (listening ? stopVoice() : startVoice())}
          disabled={writing}
          aria-pressed={listening}
          data-testid="answer-feedback-mic"
          className={cn(
            "relative grid size-20 place-items-center rounded-full text-white shadow-warm transition-[scale,background-color] duration-150 active:scale-95 disabled:opacity-60",
            listening ? "bg-ink" : "bg-clay-cta",
          )}
        >
          {listening && (
            <span
              aria-hidden
              className="absolute inset-0 animate-breathe rounded-full bg-clay/30 motion-reduce:hidden"
            />
          )}
          {listening ? (
            <Square className="size-7 fill-current" aria-hidden />
          ) : (
            <Mic className="size-8" aria-hidden />
          )}
          <span className="sr-only">{t(listening ? "answer.fb.stop" : "answer.fb.speak")}</span>
        </button>
        <p className="mt-2 font-display text-[17px] font-bold text-ink" aria-live="polite">
          <Bi
            k={writing ? "answer.fb.writing" : listening ? "answer.fb.stop" : "answer.fb.speak"}
            sub={false}
          />
        </p>
      </div>

      {voiceFailed && (
        <p
          role="alert"
          className="mt-3 rounded-button bg-flame/25 px-4 py-2.5 text-[15px] text-ink"
        >
          <Bi k="answer.fb.voiceFailed" sub={false} />
        </p>
      )}

      <label
        htmlFor="answer-feedback-text"
        className="mt-5 block font-display text-[18px] font-bold text-ink"
      >
        <Bi k="feedback.label" sub={false} />
      </label>
      <p id="answer-feedback-hint" className="mt-0.5 text-[16px] text-ink-3">
        <Bi k={spoken ? "answer.fb.check" : "feedback.hint"} sub={false} />
      </p>
      <textarea
        ref={box}
        id="answer-feedback-text"
        aria-describedby="answer-feedback-hint"
        value={text}
        onChange={(e) => setText(e.currentTarget.value.slice(0, FEEDBACK_MAX))}
        maxLength={FEEDBACK_MAX}
        rows={3}
        placeholder={t("answer.fb.placeholder")}
        className="mt-2 block w-full resize-none rounded-button border border-border bg-cream px-4 py-3 text-[19px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus-visible:border-ink-3 focus-visible:shadow-warm-sm"
      />
      <p className="mt-1 text-right text-[14px] text-ink-3 tabular-nums">
        {fill(t("tried.note.count"), { n: text.length, max: FEEDBACK_MAX })}
      </p>

      {/* Quoting is her own yes, off by default, and only ever as a role word (Law 6). */}
      <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-button border border-border bg-paper px-4 py-3">
        <input
          type="checkbox"
          checked={quoteOk}
          onChange={(e) => setQuoteOk(e.currentTarget.checked)}
          data-testid="answer-feedback-quote"
          className="mt-1 size-5 shrink-0 accent-clay-cta"
        />
        <span>
          <span className="block text-[17px] font-semibold text-ink">
            <Bi k="answer.fb.quote" sub={false} />
          </span>
          <span className="block text-[15px] text-ink-3">
            <Bi k="answer.fb.quoteNote" sub={false} />
          </span>
        </span>
      </label>

      <Button
        className="mt-4 w-full"
        onClick={send}
        disabled={busy || listening || writing || !text.trim()}
        aria-busy={busy}
      >
        <Send aria-hidden />
        <Bi k={busy ? "tried.sending" : "feedback.send"} sub={false} />
      </Button>
    </div>
  );
}
