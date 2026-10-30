"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, MessageCirclePlus, Phone, Send, Undo2 } from "lucide-react";
import { recordTried, sendThanks } from "@/app/t/tried/actions";
import { Button } from "@/components/ui/button";
import { SampleBadge } from "@/components/parampara/Badges";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { SoundToggle } from "@/components/parampara/SoundToggle";
import { ErrorState } from "@/components/parampara/ErrorState";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import type { HanateState } from "@/components/parampara/hanate/variants";
import { LazyCelebration } from "@/components/parampara/lazy";
import { MasterMedallion } from "@/components/parampara/MasterMedallion";
import { useToast } from "@/components/parampara/Toast";
import type { MessageKey } from "@/lib/i18n";
import { fill } from "@/lib/i18n/fill";
import { useLang } from "@/lib/i18n/provider";
import { haptics, vibrate } from "@/lib/motion";
import { NOTE_MAX } from "@/lib/tried/note";
import { queueTried, removePending } from "@/lib/tried/pending";
import {
  OUTCOMES,
  THANK_PHRASES,
  type ThankPhrase,
  type TriedAnswer,
  type TriedOutcome,
  type TriedRecord,
} from "@/lib/tried/types";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";
import { idleModule } from "@/lib/idle-module";

// "Did it work?" (DESIGN §8 /t/tried, docs/BUILD.md M4.1). Who: the teacher, the morning after she
// tried a master's idea. One job: say how it went in one tap. Feeling: thanked, never judged.
// One tap records it. Worked: the lamps light, then she may thank the master. Partly or not: a
// kind word, room to say what happened, and a way on. A welfare hint never leads to a party.

type Helpline = "childline" | "telemanas";
type Phase =
  | { at: "ask" }
  | { at: "welfare"; helpline: Helpline; next: Phase }
  | { at: "celebrate" }
  | { at: "thanks" }
  | { at: "sent"; already: boolean }
  | { at: "done" }
  | { at: "kind"; outcome: "partly" | "didnt" }
  | { at: "queued" }
  | { at: "error"; retry: TriedOutcome };

const OUTCOME_LABEL: Record<TriedOutcome, MessageKey> = {
  worked: "tried.worked",
  partly: "tried.partly",
  didnt: "tried.didnt",
};

export function TriedFlow({
  answer,
  record,
  initialOutcome,
}: {
  answer: TriedAnswer;
  record: TriedRecord | null;
  /** From the home prompt's one tap: recorded as soon as the page opens. */
  initialOutcome?: TriedOutcome;
}) {
  const { lang, t, msg, withName } = useLang();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>({ at: "ask" });
  const [choice, setChoice] = useState<TriedOutcome | null>(record?.outcome ?? null);
  const [sending, setSending] = useState<TriedOutcome | null>(null);
  const [pending, startTransition] = useTransition();
  const top = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  const name = answer.master.name;
  const isSample = answer.isSample || answer.master.isSample;
  const thanked = record?.thanked ?? false;

  // A new step of the story starts at the top, and screen readers hear its heading.
  useEffect(() => {
    if (phase.at === "ask") return;
    top.current?.scrollIntoView({ block: "start" });
    top.current?.querySelector<HTMLElement>("h1, h2")?.focus({ preventScroll: true });
  }, [phase.at]);

  const afterRecorded = (outcome: TriedOutcome, helpline: Helpline | null): Phase => {
    const next: Phase =
      outcome === "worked"
        ? helpline
          ? { at: "done" } // a child may be at risk: no lamps and bells now
          : { at: "celebrate" }
        : { at: "kind", outcome };
    return helpline ? { at: "welfare", helpline, next } : next;
  };

  const choose = (outcome: TriedOutcome) => {
    setChoice(outcome);
    if (!navigator.onLine) {
      queueTried({ answerId: answer.id, outcome, note: "" });
      setPhase({ at: "queued" });
      return;
    }
    setSending(outcome);
    startTransition(async () => {
      const res = await recordTried({ answerId: answer.id, outcome }).catch(() => null);
      setSending(null);
      if (!res || !res.ok) {
        setPhase({ at: "error", retry: outcome });
        return;
      }
      removePending(answer.id);
      setPhase(afterRecorded(res.outcome, res.helpline));
      // A mis tap is never permanent: one more tap takes her back to the three answers. After
      // "It worked" the celebration is the confirmation and carries its own Change, so no toast
      // covers it.
      if (!res.helpline && res.outcome !== "worked") {
        const said = (l: "kn" | "en") =>
          fill(msg(l, "tried.recorded"), { outcome: msg(l, OUTCOME_LABEL[res.outcome]) });
        toast({
          text: { kn: said("kn"), en: said("en") },
          tone: "success",
          durationMs: 6000,
          action: { label: "tried.change", onClick: () => setPhase({ at: "ask" }) },
        });
      }
    });
  };

  // The home prompt's tap already chose: record it once, unless it is what she said before.
  useEffect(() => {
    if (!initialOutcome || autoSent.current || record?.outcome === initialOutcome) return;
    autoSent.current = true;
    queueMicrotask(() => choose(initialOutcome));
    // Runs once on arrival; choose is recreated each render and must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOutcome]);

  const thank = (phrase: ThankPhrase | null, text?: string) => {
    if (!navigator.onLine) {
      toast({ text: "tried.thanks.offline", tone: "caring" });
      return;
    }
    startTransition(async () => {
      const res = await sendThanks({ answerId: answer.id, phrase, text }).catch(() => null);
      if (!res || !res.ok) {
        toast({ text: "error.body", tone: "caring" });
        return;
      }
      vibrate(haptics.success);
      const next: Phase = { at: "sent", already: res.already };
      setPhase(res.helpline ? { at: "welfare", helpline: res.helpline, next } : next);
    });
  };

  return (
    // The question itself spreads into two columns on a laptop (data-wide); every other step keeps
    // a phone's reading width, centred.
    <div
      ref={top}
      className="scroll-mt-4 [&>*:not([data-wide])]:mx-auto [&>*:not([data-wide])]:max-w-xl"
    >
      {phase.at === "ask" && (
        <AskStep
          answer={answer}
          record={record}
          isSample={isSample}
          choice={choice}
          sending={sending}
          onChoose={(o) => {
            vibrate(haptics.press);
            choose(o);
          }}
        />
      )}

      {phase.at === "celebrate" && (
        <div className="mt-6">
          <LazyCelebration
            lamps={6}
            sound
            onDone={() => setPhase(thanked ? { at: "done" } : { at: "thanks" })}
          />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <SoundToggle />
            <Button variant="ghost" size="md" onClick={() => setPhase({ at: "ask" })}>
              <Undo2 aria-hidden />
              <Bi k="tried.change" sub={false} />
            </Button>
          </div>
        </div>
      )}

      {phase.at === "thanks" && (
        <ThanksStep
          master={answer.master}
          busy={pending}
          onThank={thank}
          onNotNow={() => setPhase({ at: "done" })}
        />
      )}

      {phase.at === "sent" && (
        <Closing
          hero={<FlamePass name={name} />}
          title={
            phase.already
              ? "tried.thanks.already"
              : name
                ? withName("tried.thanks.sent", name)
                : "tried.thanks.sentAnon"
          }
          body="tried.learns"
          primary={{ label: "tried.home", href: "/t" }}
        />
      )}

      {phase.at === "done" && (
        <Closing
          hanate="happy"
          title="tried.done.title"
          body="tried.done.body"
          primary={{ label: "tried.home", href: "/t" }}
          secondary={{ label: "answer.followUp", href: `/t/ask?about=${answer.id}` }}
        />
      )}

      {phase.at === "kind" && (
        <KindStep
          answerId={answer.id}
          outcome={phase.outcome}
          onWelfare={(helpline) => setPhase({ at: "welfare", helpline, next: phase })}
        />
      )}

      {phase.at === "welfare" && (
        <Welfare helpline={phase.helpline} onContinue={() => setPhase(phase.next)} />
      )}

      {phase.at === "queued" && (
        <Closing
          hanate="resting"
          title="tried.queued"
          primary={{ label: "tried.home", href: "/t" }}
        />
      )}

      {phase.at === "error" && (
        <div className="mt-6 rise rounded-card bg-paper p-5 shadow-warm-lg">
          <ErrorState
            onRetry={() => choose(phase.retry)}
            fallback={{ label: "tried.home", href: "/t" }}
          />
        </div>
      )}

      <p className="sr-only" aria-live="polite" lang={lang}>
        {pending ? t("tried.sending") : ""}
      </p>
    </div>
  );
}

function AskStep({
  answer,
  record,
  isSample,
  choice,
  sending,
  onChoose,
}: {
  answer: TriedAnswer;
  record: TriedRecord | null;
  isSample: boolean;
  choice: TriedOutcome | null;
  sending: TriedOutcome | null;
  onChoose: (o: TriedOutcome) => void;
}) {
  const { t, msg, withName } = useLang();
  const name = answer.master.name;
  return (
    <section
      aria-labelledby="tried-title"
      data-wide
      className="rise lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-start lg:gap-x-12"
    >
      <div className="flex flex-col items-center text-center lg:col-start-1 lg:row-start-1 lg:items-start lg:text-left">
        <Hanate
          state={sending ? "thinking" : "idle"}
          size={60}
          label=""
          className="lg:h-[112px] lg:w-[96px]"
        />
        <h1
          id="tried-title"
          tabIndex={-1}
          className="mt-2 text-[26px] leading-tight font-bold text-ink outline-none sm:text-[32px]"
        >
          <Bi k="tried.title" subClassName="font-sans text-[17px] font-semibold" />
        </h1>
        <p className="mt-2 max-w-sm text-[17px] leading-snug text-balance text-ink-3">
          <Bi k="tried.sub" sub={false} />
        </p>
      </div>

      {/* which idea this is about; on a laptop it stands beside the choices, with what she tried */}
      <div className="mt-4 flex items-center gap-3 rounded-card border border-border bg-paper/85 p-3.5 shadow-warm-sm lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:mt-2 lg:flex-col lg:items-start lg:gap-4 lg:p-6">
        <MasterMedallion name={name} size="sm" portraitOnly />
        <div className="min-w-0 flex-1 lg:w-full">
          {/* Sample sits in the line, so the title keeps the full width */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-ink-3">
            <BiText
              text={name ? withName("tried.idea", name) : "tried.ideaAnon"}
              sub={false}
              inline
            />
            {isSample && <SampleBadge />}
          </p>
          <p className="font-display text-[18px] leading-snug font-bold text-ink lg:mt-1 lg:text-[22px]">
            <BiText text={answer.title} sub={false} />
          </p>
          {answer.firstStep && (
            <p className="mt-4 hidden border-t border-border/70 pt-4 text-[16px] leading-snug text-ink lg:block">
              <span className="mb-1 block font-display text-[14px] font-bold text-clay-cta">
                <Bi k="tried.firstStep" sub={false} />
              </span>
              <BiText text={answer.firstStep} subClassName="text-[14px] text-ink-3" />
            </p>
          )}
        </div>
      </div>

      {record && (
        <p className="mt-3 rounded-button bg-sage/70 px-4 py-2.5 text-[16px] text-ink lg:col-start-1 lg:row-start-2">
          <BiText
            text={{
              kn: fill(msg("kn", "tried.previous"), {
                outcome: msg("kn", OUTCOME_LABEL[record.outcome]),
              }),
              en: fill(msg("en", "tried.previous"), {
                outcome: msg("en", OUTCOME_LABEL[record.outcome]),
              }),
            }}
            sub={false}
          />
        </p>
      )}

      {/* One Tab stop; the arrow keys move between the three, Enter or Space answers (it sends at
          once, so the arrows only move focus). */}
      <div
        role="radiogroup"
        aria-label={t("tried.choices")}
        onKeyDown={(e) => {
          const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
          if (!keys.includes(e.key)) return;
          e.preventDefault();
          const all = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-outcome]")];
          const at = all.indexOf(document.activeElement as HTMLButtonElement);
          const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
          all[(at + step + all.length) % all.length]?.focus();
        }}
        className="mt-4 flex flex-col gap-3 lg:col-start-1 lg:row-start-3 lg:mt-6"
      >
        {OUTCOMES.map((o, i) => (
          <OutcomeButton
            key={o}
            outcome={o}
            tabbable={choice ? choice === o : i === 0}
            selected={choice === o}
            sending={sending === o}
            disabled={sending !== null}
            onChoose={onChoose}
          />
        ))}
      </div>
    </section>
  );
}

function OutcomeButton({
  outcome,
  tabbable,
  selected,
  sending,
  disabled,
  onChoose,
}: {
  outcome: TriedOutcome;
  tabbable: boolean;
  selected: boolean;
  sending: boolean;
  disabled: boolean;
  onChoose: (o: TriedOutcome) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabbable ? 0 : -1}
      aria-busy={sending || undefined}
      disabled={disabled}
      data-outcome={outcome}
      onClick={() => onChoose(outcome)}
      className={cn(
        "flex min-h-[76px] w-full items-center gap-4 rounded-card border-2 px-4 py-3 text-left transition-[translate,box-shadow,background-color,border-color] duration-100 active:translate-y-1 active:shadow-none disabled:cursor-default",
        selected
          ? "border-clay-cta bg-clay-cta text-white lip-clay"
          : "border-border bg-paper text-ink lip-paper hover:-translate-y-px hover:border-clay/45",
        disabled && !sending && "opacity-70",
      )}
    >
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-chip bg-dusk">
        <OutcomeLamp outcome={outcome} />
      </span>
      <span className="min-w-0 flex-1 font-display text-[21px] leading-tight font-bold">
        <Bi
          k={OUTCOME_LABEL[outcome]}
          subClassName={cn(
            "font-sans text-[15px] font-medium",
            selected ? "text-white" : "text-ink-3",
          )}
        />
      </span>
      {sending ? (
        <svg viewBox="0 0 12 16" aria-hidden className="h-6 w-5 shrink-0 animate-flicker">
          <path
            d="M6 0 C8 4 11 6.5 11 10 C11 13.5 8.8 16 6 16 C3.2 16 1 13.5 1 10 C1 6.5 4 4 6 0 Z"
            fill="var(--color-flame)"
          />
        </svg>
      ) : (
        selected && <Check className="size-6 shrink-0" strokeWidth={3} aria-hidden />
      )}
    </button>
  );
}

// A small diya: a full flame for worked, a small one for partly, only an ember for not yet.
function OutcomeLamp({ outcome }: { outcome: TriedOutcome }) {
  const flame = outcome === "worked" ? 1 : outcome === "partly" ? 0.62 : 0;
  return (
    <svg viewBox="0 0 40 44" className="h-9 w-8">
      {flame > 0 ? (
        <g style={{ transformOrigin: "20px 24px", transform: `scale(${flame})` }}>
          <path
            d="M20 2 C23 8 27 12 27 17 C27 21.5 24 24 20 24 C16 24 13 21.5 13 17 C13 12 17 8 20 2 Z"
            fill="var(--color-flame)"
          />
          <path
            d="M20 13 C21.4 16 23 18 23 20 C23 22 21.6 23 20 23 C18.4 23 17 22 17 20 C17 18 18.6 16 20 13 Z"
            fill="var(--color-paper)"
            opacity="0.9"
          />
        </g>
      ) : (
        <circle cx="20" cy="22" r="2.6" fill="var(--color-flame-deep)" opacity="0.8" />
      )}
      <path d="M20 26 L20 21" stroke="var(--color-ink-2)" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 27 C4 37 11 42 20 42 C29 42 36 37 36 27 Z" fill="var(--color-clay)" />
      <ellipse cx="20" cy="27" rx="16" ry="3.6" fill="var(--color-clay-cta)" />
    </svg>
  );
}

function KindStep({
  answerId,
  outcome,
  onWelfare,
}: {
  answerId: string;
  outcome: "partly" | "didnt";
  onWelfare: (helpline: Helpline) => void;
}) {
  const { t } = useLang();
  const [note, setNote] = useState("");
  const [noted, setNoted] = useState<null | "kept" | "dropped">(null);
  const [busy, startTransition] = useTransition();
  const partly = outcome === "partly";

  const save = () => {
    startTransition(async () => {
      const res = await recordTried({ answerId, outcome, note }).catch(() => null);
      if (!res || !res.ok) return;
      if (res.helpline) {
        onWelfare(res.helpline);
        return;
      }
      setNoted(res.noteDropped ? "dropped" : "kept");
    });
  };

  return (
    <section
      aria-labelledby="closing-title"
      className="mt-6 flex rise flex-col items-center rounded-card bg-paper px-5 pt-7 pb-6 text-center shadow-warm-lg"
    >
      <Hanate state="caring" size={104} label="" />
      <h2
        id="closing-title"
        tabIndex={-1}
        className="mt-3 text-[28px] leading-tight font-bold text-ink outline-none"
      >
        <Bi
          k={partly ? "tried.kind.partly.title" : "tried.kind.didnt.title"}
          subClassName="font-sans text-[16px] font-semibold"
        />
      </h2>
      <p className="mt-3 max-w-sm text-[18px] leading-snug text-balance text-ink-3">
        <Bi
          k={partly ? "tried.kind.partly.body" : "tried.kind.didnt.body"}
          subClassName="text-[15px]"
        />
      </p>

      <div className="mt-6 w-full max-w-sm text-left">
        {noted ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-button bg-sage/70 px-4 py-3 text-[16px] text-ink"
          >
            <Check className="size-5 shrink-0 text-moss" strokeWidth={3} aria-hidden />
            <Bi k={noted === "kept" ? "tried.noted" : "tried.noteDropped"} sub={false} />
          </p>
        ) : (
          <>
            <label
              htmlFor="tried-note"
              className="block font-display text-[17px] font-bold text-ink"
            >
              <Bi k="tried.kind.note" sub={false} />
            </label>
            <p id="tried-note-hint" className="mt-0.5 text-[16px] text-ink-3">
              <Bi k="tried.note.hint" sub={false} />
            </p>
            <textarea
              id="tried-note"
              aria-describedby="tried-note-hint"
              value={note}
              onChange={(e) => setNote(e.currentTarget.value.slice(0, NOTE_MAX))}
              maxLength={NOTE_MAX}
              rows={3}
              placeholder={t("tried.note.placeholder")}
              className="mt-2 block w-full resize-none rounded-button border border-border bg-cream px-4 py-3 text-[18px] leading-relaxed text-ink placeholder:text-ink-3 focus-visible:border-clay"
            />
            <div className="mt-2 flex min-h-12 items-center justify-between gap-3">
              <span className="text-[14px] text-ink-3 tabular-nums">
                {fill(t("tried.note.count"), { n: note.length, max: NOTE_MAX })}
              </span>
              {note.trim() && (
                <Button variant="paper" size="md" onClick={save} disabled={busy} aria-busy={busy}>
                  <Send aria-hidden />
                  <Bi k={busy ? "tried.sending" : "tried.send"} sub={false} />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <p className="mt-4 max-w-sm text-[15px] text-ink-3">
        <Bi k="tried.learns" sub={false} />
      </p>
      <Button asChild className="mt-5 w-full max-w-sm">
        <Link href={`/t/ask?about=${answerId}`}>
          <MessageCirclePlus aria-hidden />
          <Bi k="answer.followUp" sub={false} />
        </Link>
      </Button>
      <Button asChild variant="paper" className="mt-3 w-full max-w-sm">
        <Link href="/t">
          <Bi k="tried.home" sub={false} />
        </Link>
      </Button>
    </section>
  );
}

function ThanksStep({
  master,
  busy,
  onThank,
  onNotNow,
}: {
  master: TriedAnswer["master"];
  busy: boolean;
  onThank: (phrase: ThankPhrase | null, text?: string) => void;
  onNotNow: () => void;
}) {
  const { withName } = useLang();
  const [own, setOwn] = useState("");
  const name = master.name;
  return (
    <section
      aria-labelledby="thanks-title"
      className="mt-6 rise rounded-card bg-paper p-5 shadow-warm-lg sm:p-6"
    >
      <MasterMedallion
        name={name}
        years={master.years}
        district={master.district}
        size="md"
        isSample={master.isSample}
      />
      <h2
        id="thanks-title"
        tabIndex={-1}
        className="mt-5 text-[26px] leading-tight font-bold text-ink outline-none"
      >
        <BiText
          text={name ? withName("tried.thanks.title", name) : "tried.thanks.titleAnon"}
          subClassName="font-sans text-[16px] font-semibold"
        />
      </h2>
      <p className="mt-1 text-[16px] text-ink-3">
        <Bi k="tried.thanks.private" sub={false} />
      </p>

      <ul className="mt-5 flex flex-col gap-3">
        {THANK_PHRASES.map((p) => (
          <li key={p}>
            <button
              type="button"
              disabled={busy}
              data-phrase={p}
              onClick={() => onThank(p)}
              className="flex min-h-16 w-full items-start gap-3 rounded-card border-2 border-border bg-cream px-4 py-3 text-left lip-paper transition-[translate,box-shadow,border-color] duration-100 hover:-translate-y-px hover:border-clay/45 active:translate-y-1 active:shadow-none disabled:opacity-70"
            >
              <svg viewBox="0 0 12 16" aria-hidden className="mt-1.5 h-4 w-3 shrink-0">
                <path
                  d="M6 0 C8 4 11 6.5 11 10 C11 13.5 8.8 16 6 16 C3.2 16 1 13.5 1 10 C1 6.5 4 4 6 0 Z"
                  fill="var(--color-flame-deep)"
                />
              </svg>
              <span className="text-[17px] leading-snug text-ink">
                <Bi k={p} subClassName="text-[15px]" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <label
        htmlFor="thanks-own"
        className="mt-6 block font-display text-[16px] font-bold text-ink-3"
      >
        <Bi k="tried.thanks.own" sub={false} />
      </label>
      <textarea
        id="thanks-own"
        value={own}
        onChange={(e) => setOwn(e.currentTarget.value.slice(0, NOTE_MAX))}
        maxLength={NOTE_MAX}
        rows={2}
        className="mt-2 block w-full resize-none rounded-button border border-border bg-paper px-4 py-3 text-[18px] leading-relaxed text-ink shadow-warm-sm focus-visible:border-clay"
      />
      {own.trim() && (
        <Button
          variant="paper"
          className="mt-3 w-full"
          disabled={busy}
          onClick={() => onThank(null, own)}
        >
          <Send aria-hidden />
          <Bi k="tried.thanks.send" sub={false} />
        </Button>
      )}
      <button
        type="button"
        onClick={onNotNow}
        className="mx-auto mt-4 flex h-12 items-center rounded-chip px-5 font-display text-[16px] font-bold text-ink-3 hover:bg-sage hover:text-ink"
      >
        <Bi k="tried.thanks.notnow" sub={false} />
      </button>
    </section>
  );
}

// Hanate hands a spark of its flame to the master's medallion: the thank you travels (DESIGN §2.1).
// The spark that carries her thanks to the master: Motion, loaded at idle (DESIGN §10).
const useSpark = idleModule(() => import("./TriedSpark"));

function FlamePass({ name }: { name: string | null }) {
  const reduced = usePrefersReducedMotion();
  const spark = useSpark();
  return (
    <div
      className="relative mx-auto flex h-[104px] w-[248px] items-end justify-between"
      aria-hidden
    >
      <Hanate state="happy" size={72} label="" />
      <svg
        viewBox="0 0 248 104"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        <path
          d="M44 30 Q124 -18 210 34"
          fill="none"
          stroke="var(--color-flame-deep)"
          strokeWidth="2.4"
          strokeDasharray="1 8"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
      {!reduced && spark && <spark.Spark />}
      <MasterMedallion name={name} size="md" portraitOnly className="mb-1" />
    </div>
  );
}

function Closing({
  hanate,
  hero,
  title,
  body,
  primary,
  secondary,
}: {
  hanate?: HanateState;
  hero?: React.ReactNode;
  title: MessageKey | { kn: string; en: string };
  body?: MessageKey;
  primary: { label: MessageKey; href: string };
  secondary?: { label: MessageKey; href: string };
}) {
  return (
    <section
      aria-labelledby="closing-title"
      className="mt-6 flex rise flex-col items-center rounded-card bg-paper px-5 py-8 text-center shadow-warm-lg"
    >
      {hero ?? <Hanate state={hanate ?? "idle"} size={120} label="" />}
      <h2
        id="closing-title"
        tabIndex={-1}
        className="mt-4 text-[28px] leading-tight font-bold text-ink outline-none"
      >
        <BiText text={title} subClassName="font-sans text-[16px] font-semibold" />
      </h2>
      {body && (
        <p className="mt-3 max-w-sm text-[18px] leading-snug text-balance text-ink-3">
          <Bi k={body} subClassName="text-[15px]" />
        </p>
      )}
      <Button asChild className="mt-8 w-full max-w-sm">
        <Link href={primary.href}>
          <Bi k={primary.label} sub={false} />
        </Link>
      </Button>
      {secondary && (
        <Button asChild variant="paper" className="mt-3 w-full max-w-sm">
          <Link href={secondary.href}>
            <Bi k={secondary.label} sub={false} />
          </Link>
        </Button>
      )}
    </section>
  );
}

function Welfare({ helpline, onContinue }: { helpline: Helpline; onContinue: () => void }) {
  const child = helpline === "childline";
  return (
    <section
      aria-labelledby="welfare-title"
      className="mt-6 flex rise flex-col items-center rounded-card bg-ink px-5 py-8 text-center text-white shadow-warm-lg"
    >
      <Hanate state="caring" size={110} label="" />
      <h2
        id="welfare-title"
        tabIndex={-1}
        className="mt-4 text-[26px] leading-tight font-bold text-flame outline-none"
      >
        <Bi k="tried.welfare.title" subClassName="font-sans text-[16px] font-semibold text-mist" />
      </h2>
      <p className="mt-3 max-w-sm text-[18px] leading-snug">
        <Bi
          k={child ? "tried.welfare.child" : "tried.welfare.teacher"}
          subClassName="text-[15px] text-mist"
        />
      </p>
      <a
        href={child ? "tel:1098" : "tel:14416"}
        className={cn(
          "mt-6 flex min-h-16 w-full max-w-sm items-center justify-center gap-3 rounded-card px-5 py-4 font-display text-lg font-bold",
          child ? "bg-flame text-ink shadow-flame" : "bg-moss text-white",
        )}
      >
        <Phone className="size-6 shrink-0" aria-hidden />
        <Bi k={child ? "ask.childline" : "ask.telemanas"} sub={false} />
      </a>
      <Button variant="paper" className="mt-3 w-full max-w-sm" onClick={onContinue}>
        <Bi k="celebrate.continue" sub={false} />
      </Button>
    </section>
  );
}
