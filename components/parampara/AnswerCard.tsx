"use client";

import {
  BookOpenText,
  Check,
  ChevronRight,
  History,
  MessageCirclePlus,
  NotebookPen,
  School,
  Sparkles,
  Sunrise,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Name } from "@/lib/i18n/fill";
import { useLang } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { BiText } from "./BiText";
import { Hanate } from "./hanate/Hanate";
import { MasterMedallion, type MasterMedallionProps } from "./MasterMedallion";

// The answer, as a storybook page that unfolds (DESIGN §4): whose practice it is, the title, the
// voice, then steps one by one, each with its source, what you need, and why it works in one line.
// Grounded or silent (Law 4): every step carries the card it came from and shows whose it is.
export type AnswerText = { kn: string; en: string; hi?: string };
export type AnswerStep = AnswerText & { cardId: string; masterName: Name | null };

export type AnswerCardProps = {
  title: AnswerText;
  steps: readonly AnswerStep[];
  materials: readonly AnswerText[];
  why: AnswerText | null;
  master: Omit<MasterMedallionProps, "size">;
  /** The teacher's answer language. Hindi leads with Hindi and keeps the reader's language beneath. */
  answerLang?: "kn" | "en" | "hi";
  /** A cached answer served again (Law 10): says so, with when it was first answered. */
  replayed?: boolean;
  /** Already formatted for the reader, for example "yesterday, 9:14 pm". */
  answeredAt?: string;
  isSample?: boolean;
  /** The VoicePlayer for this answer. */
  player?: React.ReactNode;
  /** Footer actions; AnswerActions below covers the usual four. */
  actions?: React.ReactNode;
  /** Opens the TraceDrawer ("How this answer was made"). */
  onShowTrace?: () => void;
  /** One calm line under the steps (D72), never a helpline. */
  note?: React.ReactNode;
  className?: string;
};

export function AnswerCard({
  title,
  steps,
  materials,
  why,
  master,
  answerLang = "kn",
  replayed = false,
  answeredAt,
  isSample = false,
  player,
  actions,
  onShowTrace,
  note,
  className,
}: AnswerCardProps) {
  const { lang } = useLang();
  // Steps arrive one by one after the page has opened; the footer comes last. CSS keyframes, so
  // nothing waits for hydration and reduced motion shows it all at once (globals.css).
  const stepDelay = (i: number) => 250 + i * 140;
  const afterSteps = stepDelay(steps.length);
  const at = (ms: number) => ({ "--d": ms }) as React.CSSProperties;

  return (
    <article
      aria-label={lineFor(title, answerLang === "hi" ? "hi" : lang)}
      className={cn(
        "@container paper-grain unfold overflow-clip rounded-card border border-border bg-paper shadow-warm-lg",
        className,
      )}
    >
      {/* the page's head: whose practice this is */}
      <header className="relative bg-dusk-gradient px-5 pt-5 pb-4 sm:px-7 sm:pt-6">
        {/* Hanate keeps her company while she reads: the lamp that passes the light on. */}
        <Hanate
          state="happy"
          size={64}
          label=""
          className="absolute top-3 right-3 sm:top-4 sm:right-6"
        />
        {/* Room for Hanate on the right, so a long district never runs under the lamp. */}
        <div className="pr-20">
          {/* Sample and Illustration ride in the medallion's own line, so the steps start higher. */}
          <MasterMedallion {...master} isSample={isSample || master.isSample} size="md" />
        </div>
        {replayed && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {replayed && (
              <span className="inline-flex min-h-7 items-center gap-1.5 rounded-chip bg-paper/80 px-2.5 py-0.5 text-[14px] font-medium text-ink-3">
                <History className="size-4" aria-hidden />
                {answeredAt ? (
                  <BiText text="answer.replayed" vars={{ at: answeredAt }} sub={false} inline />
                ) : (
                  <BiText text="answer.replayedPlain" sub={false} inline />
                )}
              </span>
            )}
          </div>
        )}
        <h2 className="mt-3 text-[26px] leading-tight font-bold text-ink sm:text-[30px]">
          <Line
            text={title}
            answerLang={answerLang}
            subClassName="font-sans text-[16px] font-semibold"
          />
        </h2>
      </header>

      {/* On a phone one column: voice, steps, why, actions. On a laptop the steps keep a reading
          width on the left and the voice, why and actions ride beside them (a wide card). */}
      <div className="px-5 pb-6 sm:px-7 @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_344px] @3xl:grid-rows-[auto_1fr] @3xl:gap-x-10 @3xl:pb-8">
        {player && (
          <div
            data-answer-player
            className="-mt-1 scroll-mt-24 pt-4 @3xl:col-start-2 @3xl:row-start-1 @3xl:mt-0 @3xl:pt-6"
          >
            {player}
          </div>
        )}

        <div className="@3xl:col-start-1 @3xl:row-span-2 @3xl:row-start-1">
          <h3 className="mt-6 flex items-center gap-2 font-display text-[15px] font-bold text-clay-cta">
            <Sunrise className="size-5" aria-hidden />
            <Bi k="answer.steps" sub={false} />
          </h3>
          <ol className="mt-3 flex flex-col gap-4">
            {steps.map((s, i) => (
              <li
                key={`${s.cardId}-${i}`}
                data-card={s.cardId}
                style={at(stepDelay(i))}
                className="flex rise-at gap-3.5"
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-chip bg-flame font-display text-[18px] font-extrabold text-ink shadow-warm-sm"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[18px] leading-snug text-ink">
                    <Line text={s} answerLang={answerLang} subClassName="text-[15px]" />
                  </p>
                  <SourceChip name={s.masterName} />
                </div>
              </li>
            ))}
          </ol>

          {materials.length > 0 && (
            <section style={at(afterSteps)} className="mt-6 rise-at">
              <h3 className="font-display text-[15px] font-bold text-ink-3">
                <Bi k="answer.materials" sub={false} />
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {materials.map((m, i) => (
                  <li
                    key={i}
                    className="inline-flex min-h-9 items-center rounded-chip bg-sage px-3.5 py-1 text-[15px] font-medium text-ink"
                  >
                    {answerLang === "hi" && m.hi ? (
                      <span lang="hi">{m.hi}</span>
                    ) : (
                      <BiText text={m} sub={false} inline />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* On a laptop the actions lead the rail, so "I will try it tomorrow" is in the first view. */}
        <div className="@3xl:sticky @3xl:top-6 @3xl:col-start-2 @3xl:row-start-2 @3xl:flex @3xl:flex-col @3xl:self-start">
          {why && (
            <aside
              style={at(afterSteps + 100)}
              className="mt-5 flex rise-at gap-3 rounded-button bg-sage/70 p-4 @3xl:mt-4"
            >
              <Sparkles className="mt-0.5 size-5 shrink-0 text-moss" aria-hidden />
              <div>
                <p className="font-display text-[15px] font-bold text-moss">
                  <Bi k="answer.why" sub={false} />
                </p>
                <p className="mt-0.5 text-[16px] leading-snug text-ink">
                  <Line text={why} answerLang={answerLang} subClassName="text-[14px]" />
                </p>
              </div>
            </aside>
          )}

          {/* Closes the card: what to do and what to bring stay together above it. */}
          {note && (
            <p
              style={at(afterSteps + 150)}
              className="mt-5 flex rise-at gap-2.5 border-t border-border/70 pt-3 text-[15px] leading-snug text-ink-3"
              data-testid="answer-note"
            >
              <School className="mt-0.5 size-[18px] shrink-0 text-moss" aria-hidden />
              <span>{note}</span>
            </p>
          )}

          {actions && (
            <footer
              style={at(afterSteps + 200)}
              className="mt-6 rise-at @3xl:order-first @3xl:mt-4"
            >
              {actions}
            </footer>
          )}
          {/* How it was made: last in the rail on a laptop, after why (actions, why, trace). */}
          {onShowTrace && (
            <button
              type="button"
              onClick={onShowTrace}
              data-trace-open
              style={at(afterSteps + 250)}
              className="group mt-3 flex min-h-12 w-full rise-at items-center gap-3 rounded-button border border-dashed border-ink/20 bg-cream/70 px-4 py-2 text-left font-display text-[15px] font-semibold text-ink transition-colors hover:border-clay/50 hover:bg-sage/50"
            >
              <NotebookPen className="size-5 shrink-0 text-clay-cta" aria-hidden />
              <span className="flex-1">
                <Bi k="answer.how" sub={false} />
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function lineFor(text: AnswerText, lang: "kn" | "en" | "hi"): string {
  if (lang === "hi") return text.hi ?? text.en;
  return text[lang];
}

/** Lead line in the answer language; the quiet line beneath is the other language. */
function Line({
  text,
  answerLang,
  subClassName,
}: {
  text: AnswerText;
  answerLang: "kn" | "en" | "hi";
  subClassName?: string;
}) {
  if (answerLang === "hi" && text.hi) {
    return (
      <>
        <span lang="hi" className="block">
          {text.hi}
        </span>
        <BiText
          text={{ kn: text.kn, en: text.en }}
          sub={false}
          className={cn("mt-1 text-ink-3", subClassName)}
        />
      </>
    );
  }
  return <BiText text={{ kn: text.kn, en: text.en }} subClassName={subClassName} />;
}

function SourceChip({ name }: { name: Name | null }) {
  const { withName } = useLang();
  return (
    <span className="mt-2 inline-flex min-h-7 items-center gap-1.5 rounded-chip bg-cream px-2.5 py-0.5 text-[14px] font-medium text-ink-3">
      <svg viewBox="0 0 12 16" aria-hidden className="h-3 w-2.5 shrink-0">
        <path
          d="M6 0 C8 4 11 6.5 11 10 C11 13.5 8.8 16 6 16 C3.2 16 1 13.5 1 10 C1 6.5 4 4 6 0 Z"
          fill="var(--color-flame-deep)"
        />
      </svg>
      {name ? (
        <BiText text={withName("answer.from", name)} sub={false} inline />
      ) : (
        <BiText text="answer.fromAnonymous" sub={false} inline />
      )}
    </span>
  );
}

export type AnswerActionsProps = {
  /** The credited master's name, or null when they chose to stay anonymous. */
  masterName?: Name | null;
  /** Only when the master allowed their voice to be heard (voice_public). */
  onHearMaster?: () => void;
  hearing?: boolean;
  onTryTomorrow?: () => void;
  onSave?: () => void;
  saved?: boolean;
  onFollowUp?: () => void;
  /** Extra classes on the primary button, e.g. hidden on a phone where a pinned bar carries it. */
  tryClassName?: string;
};

// Two buttons share a row on phones, so long Kannada labels may wrap instead of overflowing.
const WRAP = "h-auto min-h-12 w-full py-2 text-[15px] leading-tight text-balance whitespace-normal";

/** The usual footer: commit to trying it (primary), hear the master, save, ask a follow up. */
export function AnswerActions({
  masterName,
  onHearMaster,
  hearing = false,
  onTryTomorrow,
  onSave,
  saved = false,
  onFollowUp,
  tryClassName,
}: AnswerActionsProps) {
  const { withName } = useLang();
  return (
    <div className="flex flex-col gap-3">
      {onTryTomorrow && (
        <Button onClick={onTryTomorrow} className={cn("w-full", tryClassName)}>
          <Sunrise aria-hidden />
          <Bi k="answer.tryTomorrow" sub={false} />
        </Button>
      )}
      {onHearMaster && (
        <Button
          variant="paper"
          onClick={onHearMaster}
          aria-pressed={hearing}
          className="h-auto min-h-14 w-full py-2 leading-tight text-balance whitespace-normal"
        >
          <Volume2 aria-hidden />
          {masterName ? (
            <BiText text={withName("answer.hearNamed", masterName)} sub={false} inline />
          ) : (
            <Bi k="answer.hearMaster" sub={false} />
          )}
        </Button>
      )}
      {(onSave || onFollowUp) && (
        <div className="grid auto-rows-fr grid-cols-2 gap-3">
          {onSave && (
            <Button
              variant="paper"
              size="md"
              onClick={onSave}
              aria-pressed={saved}
              className={cn(WRAP, saved && "text-moss")}
            >
              {saved ? <Check aria-hidden /> : <BookOpenText aria-hidden />}
              <Bi k={saved ? "answer.saved" : "answer.save"} sub={false} />
            </Button>
          )}
          {onFollowUp && (
            <Button
              variant="paper"
              size="md"
              onClick={onFollowUp}
              className={cn(WRAP, !onSave && "col-span-2")}
            >
              <MessageCirclePlus aria-hidden />
              <Bi k="answer.followUp" sub={false} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
