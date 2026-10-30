"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerActions, AnswerCard } from "@/components/parampara/AnswerCard";
import { Bi } from "@/components/parampara/Bi";
import { AnswerFeedback } from "@/components/teacher/AnswerFeedback";
import { OutcomePanel } from "@/components/teacher/OutcomePanel";
import { LazyTraceDrawer } from "@/components/parampara/lazy";
import { ShareCard } from "@/components/parampara/ShareCard";
import { SegmentPlayer, VoicePlayer } from "@/components/parampara/VoicePlayer";
import type { AnswerView } from "@/lib/answers/store";
import type { Outcome } from "@/lib/ask/types";
import { useLang } from "@/lib/i18n/provider";
import { formatWhen } from "@/lib/when";
import { readSaved, rememberOpened, writeSaved } from "@/lib/answers/on-phone";

// The storybook page that unfolds (DESIGN §4 AnswerCard): whose wisdom, the steps for tomorrow,
// the master's own voice, and "How this answer was made" one tap away.

export function AnswerScreen({ answer }: { answer: AnswerView }) {
  const router = useRouter();
  const { lang } = useLang();
  const [traceOpen, setTraceOpen] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    // After mount, so the server render and the first client render agree.
    const has = readSaved().includes(answer.id);
    queueMicrotask(() => setSaved(has));
  }, [answer.id]);
  // An answer she has just seen opens again with no network, without a Save tap (F-P1).
  const answered = answer.status === "answered";
  const titleKn = answer.title.kn;
  const titleEn = answer.title.en;
  useEffect(() => {
    if (answered) rememberOpened(answer.id, { kn: titleKn, en: titleEn }, answer.createdAt);
  }, [answered, answer.id, titleKn, titleEn, answer.createdAt]);

  if (answer.status !== "answered") {
    // The same care as when she first asked: distress never sees child safety copy (audit, 24 Oct).
    const outcome: Exclude<Outcome, { kind: "answered" }> =
      answer.outcome === "distress"
        ? { kind: "distress", answerId: answer.id, helpline: "telemanas" }
        : answer.outcome === "care"
          ? { kind: "escalated", answerId: answer.id, helpline: "both" }
          : answer.outcome === "child_safety" || answer.status === "escalated"
            ? { kind: "escalated", answerId: answer.id, helpline: "childline" }
            : answer.outcome === "no_card"
              ? {
                  kind: "no_card",
                  answerId: answer.id,
                  ...(answer.note ? { note: answer.note } : {}),
                }
              : { kind: "needs_human", answerId: answer.id, reason: "model" };
    return (
      <OutcomePanel
        outcome={outcome}
        question={answer.outcome === "distress" ? "" : (answer.question ?? "")}
        onAgain={() => router.push("/t/ask")}
        onClarify={() => router.push("/t/ask")}
      />
    );
  }

  const toggleSave = () => {
    const list = readSaved();
    const next = list.includes(answer.id)
      ? list.filter((x) => x !== answer.id)
      : [answer.id, ...list];
    writeSaved(next);
    setSaved(next.includes(answer.id));
  };

  // The master's voice plays at the top of the card: on a phone, bring it into view, so the tap
  // is never met with nothing.
  const hearMaster = () => {
    const opening = !hearing;
    setHearing(opening);
    if (!opening || !window.matchMedia("(max-width: 767px)").matches) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      document
        .querySelector("[data-answer-player]")
        ?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" }),
    );
  };

  const tryTomorrow = () => {
    if (!saved) toggleSave();
    router.push("/t");
  };

  // In IST, the day part in words for Kannada (F-P1), whatever the phone's own clock zone.
  const answeredAt = answer.replayed
    ? (formatWhen(answer.firstAnsweredAt, lang) ?? undefined)
    : undefined;

  return (
    <>
      {answer.question && (
        // Her own words, as she said them; the label is in the reader's language.
        <p className="mt-4 rounded-card bg-paper/70 px-4 py-3 text-base text-ink-3">
          <span className="block font-display text-[14px] font-bold text-ink-3">
            <Bi k="answer.asked" sub={false} />
          </span>
          <span className="line-clamp-1 text-ink md:line-clamp-none">“{answer.question}”</span>
        </p>
      )}
      <AnswerCard
        className="mt-4"
        title={answer.title}
        steps={answer.steps}
        materials={answer.materials}
        why={answer.why}
        master={answer.master}
        answerLang={answer.lang}
        replayed={answer.replayed}
        answeredAt={answeredAt}
        isSample={answer.isSample}
        player={
          hearing && answer.quoteSegmentId != null ? (
            <SegmentPlayer
              segmentId={String(answer.quoteSegmentId)}
              title="review.card.hear"
              onEnded={() => setHearing(false)}
            />
          ) : (
            <AnswerVoice answerId={answer.id} lang={answer.lang} />
          )
        }
        actions={
          <>
            <AnswerActions
              masterName={answer.master.name}
              onHearMaster={answer.quoteSegmentId != null ? hearMaster : undefined}
              hearing={hearing}
              onTryTomorrow={tryTomorrow}
              tryClassName="max-md:hidden"
              onSave={toggleSave}
              saved={saved}
              onFollowUp={() => router.push("/t/ask")}
            />
            {/* The first card as a Tomorrow card, for a WhatsApp group or the staff room wall. */}
            {answer.cardIds[0] && <ShareCard cardId={answer.cardIds[0]} className="mt-3" />}
          </>
        }
        onShowTrace={() => setTraceOpen(true)}
        note={
          answer.note === "hunger" ? (
            <Bi k="ask.note.hunger" className="text-[16px]" subClassName="text-[14px]" />
          ) : undefined
        }
      />
      {/* Right under every answer, one tap: how was it, by voice or in writing (D82). */}
      <AnswerFeedback answerId={answer.id} className="mt-5 lg:max-w-xl" />
      {/* On a phone the one action stays in reach while she reads the steps (DESIGN §2.10). */}
      <div
        data-cta-tray
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-paper px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] shadow-warm-lg md:hidden"
      >
        <Button onClick={tryTomorrow} className="w-full">
          <Sunrise aria-hidden />
          <Bi k="answer.tryTomorrow" sub={false} />
        </Button>
      </div>
      <LazyTraceDrawer
        open={traceOpen}
        onOpenChange={setTraceOpen}
        trace={answer.trace}
        isSample={answer.isSample}
        firstAnsweredAt={answer.firstAnsweredAt}
      />
    </>
  );
}

/** The answer read aloud in her language; made on first play and kept (see /api/answers/[id]/voice). */
function AnswerVoice({ answerId, lang }: { answerId: string; lang: "kn" | "en" | "hi" }) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "unavailable" | "error" | undefined>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/answers/${answerId}/voice`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { url?: string };
        if (res.ok && body.url) {
          setSrc(body.url);
          setStatus(undefined);
        } else setStatus(res.status >= 500 && res.status !== 503 ? "error" : "unavailable");
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setStatus("error");
      });
    return () => ctrl.abort();
  }, [answerId, attempt]);
  return (
    <VoicePlayer
      src={src}
      mime="audio/mpeg"
      spokenLang={lang === "en" ? "en" : "kn"}
      status={status}
      onRetry={() => {
        setStatus("loading");
        setAttempt((n) => n + 1);
      }}
    />
  );
}
