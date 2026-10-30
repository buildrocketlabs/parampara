"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, HeartHandshake, Phone, School, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import type { Bi as BiPair, Outcome } from "@/lib/ask/types";
import type { MessageKey } from "@/lib/i18n";
import { useLang } from "@/lib/i18n/provider";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { AnswerFeedback } from "./AnswerFeedback";

// Every way a question can end other than a straight answer: care for a child at risk, care for
// the teacher, a clarifying question, a photo refused, or "we will not guess". Its own module so
// the answer page (which shows these too) does not load the whole ask flow (DESIGN §10).

export function OutcomePanel({
  outcome,
  question,
  onAgain,
  onClarify,
  onRetakePhoto,
  onWithoutPhoto,
}: {
  outcome: Exclude<Outcome, { kind: "answered" }>;
  question: string;
  onAgain: () => void;
  onClarify: (reply: string) => void;
  onRetakePhoto?: () => void;
  onWithoutPhoto?: () => void;
}) {
  const [reply, setReply] = useState("");
  const { lang } = useLang();
  const reduced = usePrefersReducedMotion();
  const top = useRef<HTMLElement>(null);
  // The refusal and both ways forward fit the screen: bring it to the top.
  useEffect(() => {
    if (outcome.kind !== "photo_refused") return;
    top.current?.scrollIntoView({ block: "start", behavior: reduced ? "instant" : "smooth" });
  }, [outcome.kind, reduced]);

  if (outcome.kind === "photo_refused") {
    return (
      <section
        ref={top}
        className="mt-6 flex scroll-mt-4 flex-col items-center rounded-card bg-paper p-6 text-center shadow-warm-lg sm:p-8"
        role="alert"
        data-testid="outcome-photo-refused"
      >
        <Hanate state="caring" size={84} label="" />
        <h2 className="mt-3 text-[26px] leading-tight font-bold">
          <Bi k="ask.out.photo_faces.title" subClassName="font-sans text-base font-semibold" />
        </h2>
        <p className="mt-3 max-w-md text-lg text-ink-3" data-keep-clear>
          <Bi k="ask.out.photo_faces.body" subClassName="text-base" />
        </p>
        <div className="mt-6 flex w-full flex-col gap-3">
          {onRetakePhoto && (
            <Button className="w-full" onClick={onRetakePhoto}>
              <Camera aria-hidden />
              <Bi k="ask.out.photo_faces.retake" sub={false} />
            </Button>
          )}
          {onWithoutPhoto && (
            <Button variant="paper" className="w-full" onClick={onWithoutPhoto}>
              <Bi k="ask.out.photo_faces.without" sub={false} />
            </Button>
          )}
        </div>
        {/* Nothing was answered, so the helpline stays in reach, as on every unanswered outcome. */}
        <a
          href="tel:1098"
          className="mt-4 inline-flex min-h-12 items-center gap-2 text-[15px] font-semibold text-ink underline underline-offset-4"
        >
          <Phone className="size-4" aria-hidden />
          <Bi k="ask.childline_small" sub={false} />
        </a>
      </section>
    );
  }

  if (outcome.kind === "escalated") {
    return (
      <section
        className="mt-6 rounded-card bg-ink p-6 text-white shadow-warm-lg sm:p-8"
        role="alert"
        data-testid="outcome-escalated"
      >
        <div className="flex items-center gap-4">
          <Hanate state="caring" size={84} label="" />
          <h2 className="text-[26px] leading-tight font-bold text-flame">
            <Bi
              k={outcome.helpline === "both" ? "ask.out.care.title" : "ask.out.escalated.title"}
              subClassName="font-sans text-base font-semibold text-mist"
            />
          </h2>
        </div>
        <p className="mt-4 text-lg">
          <Bi
            k={outcome.helpline === "both" ? "ask.out.care.body" : "ask.out.escalated.body"}
            subClassName="text-base text-mist"
          />
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Helpline href="tel:1098" text="ask.childline" />
          {outcome.helpline === "both" ? (
            <Helpline href="tel:14416" text="ask.telemanas" />
          ) : (
            <Helpline href="tel:112" text="ask.emergency" />
          )}
        </div>
        <p className="mt-5 flex items-center gap-2 text-[15px] text-mist">
          <ShieldCheck className="size-5 text-flame" aria-hidden />
          <Bi k="ask.reviewer_told" sub={false} />
        </p>
        <Button variant="paper" className="mt-6 w-full" onClick={onAgain}>
          <Bi k="ask.again" sub={false} />
        </Button>
      </section>
    );
  }

  if (outcome.kind === "distress") {
    return (
      <section
        className="mt-6 rounded-card bg-paper p-6 shadow-warm-lg sm:p-8"
        data-testid="outcome-distress"
      >
        <div className="flex items-center gap-4">
          <Hanate state="caring" size={84} label="" />
          <h2 className="text-[26px] leading-tight font-bold">
            <Bi k="ask.out.distress.title" subClassName="font-sans text-base font-semibold" />
          </h2>
        </div>
        <p className="mt-4 text-lg text-ink-3">
          <Bi k="ask.out.distress.body" subClassName="text-base" />
        </p>
        <div className="mt-6">
          <Helpline href="tel:14416" text="ask.telemanas" light />
        </div>
        <Button variant="paper" className="mt-6 w-full" onClick={onAgain}>
          <Bi k="ask.again" sub={false} />
        </Button>
      </section>
    );
  }

  if (outcome.kind === "clarify") {
    const q: BiPair = outcome.question;
    return (
      <form
        className="mt-6 rounded-card bg-paper p-6 shadow-warm-lg"
        onSubmit={(e) => {
          e.preventDefault();
          if (reply.trim()) onClarify(reply);
        }}
      >
        <div className="flex items-center gap-4">
          <Hanate state="idle" size={72} label="" />
          <p className="text-[22px] leading-snug font-bold">
            <span lang={lang}>{lang === "kn" ? q.kn : q.en}</span>
            <span className="mt-1 block font-sans text-base font-semibold text-ink-3">
              {lang === "kn" ? q.en : q.kn}
            </span>
          </p>
        </div>
        <p className="mt-3 text-[15px] text-ink-3">{question}</p>
        <input
          autoFocus
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="mt-4 h-14 w-full rounded-button border border-input bg-paper px-4 text-lg outline-none focus:border-clay focus:shadow-flame"
        />
        <Button type="submit" className="mt-4 w-full" disabled={!reply.trim()}>
          <Bi k="ask.clarify.send" sub={false} />
        </Button>
      </form>
    );
  }

  const copy: { title?: MessageKey; body: MessageKey; testid: string } =
    outcome.kind === "no_card"
      ? { title: "ask.out.no_card.title", body: "ask.out.no_card.body", testid: "outcome-no-card" }
      : outcome.kind === "needs_human"
        ? {
            title: "ask.out.needs_human.title",
            body: "ask.out.needs_human.body",
            testid: "outcome-needs-human",
          }
        : outcome.kind === "limited"
          ? { body: "ask.out.limited", testid: "outcome-limited" }
          : { body: "ask.out.redirect", testid: "outcome-redirect" };

  return (
    <section
      className="mt-6 flex flex-col items-center rounded-card bg-paper p-6 text-center shadow-warm-lg sm:p-8"
      data-testid={copy.testid}
    >
      <Hanate state="caring" size={104} label="" />
      {copy.title && (
        <h2 className="mt-4 text-[26px] leading-tight font-bold">
          <Bi k={copy.title} subClassName="font-sans text-base font-semibold" />
        </h2>
      )}
      <p className="mt-3 max-w-md text-lg text-ink-3">
        <Bi k={copy.body} subClassName="text-base" />
      </p>
      {outcome.kind === "no_card" && outcome.note === "hunger" && (
        <p
          className="mt-4 flex max-w-md gap-2.5 rounded-button bg-sage/45 px-4 py-3 text-left text-[14px] leading-snug text-ink"
          data-testid="note-hunger"
        >
          <School className="mt-0.5 size-[18px] shrink-0 text-moss" aria-hidden />
          <span>
            <Bi k="ask.note.hunger" className="text-[16px]" subClassName="text-[14px] text-ink-3" />
          </span>
        </p>
      )}
      {(outcome.kind === "no_card" || outcome.kind === "needs_human") && (
        <>
          <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-moss">
            <HeartHandshake className="size-5" aria-hidden />
            <Bi k="ask.queued" sub={false} />
          </p>
          {/* We did not answer, so we cannot rule out a child in danger: the helpline is always here. */}
          <a
            href="tel:1098"
            className="mt-3 inline-flex min-h-12 items-center gap-2 text-[15px] font-semibold text-ink underline underline-offset-4"
          >
            <Phone className="size-4" aria-hidden />
            <Bi k="ask.childline_small" sub={false} />
          </a>
        </>
      )}
      <Button className="mt-6 w-full" onClick={onAgain}>
        <Bi k="ask.again" sub={false} />
      </Button>
      {/* Even "no master yet" is an answer she can tell us about (D82). */}
      {(outcome.kind === "no_card" || outcome.kind === "needs_human") && (
        <AnswerFeedback answerId={outcome.answerId} className="mt-4" />
      )}
    </section>
  );
}

function Helpline({
  href,
  text,
  light = false,
}: {
  href: string;
  text: MessageKey;
  light?: boolean;
}) {
  return (
    <a
      href={href}
      className={
        light
          ? "flex min-h-16 items-center gap-3 rounded-card bg-moss px-5 py-4 font-display text-lg font-bold text-white shadow-warm"
          : "flex min-h-16 items-center gap-3 rounded-card bg-flame px-5 py-4 font-display text-lg font-bold text-ink shadow-flame"
      }
    >
      <Phone className="size-6 shrink-0" aria-hidden />
      <Bi k={text} sub={false} />
    </a>
  );
}
