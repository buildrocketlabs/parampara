import Link from "next/link";
import { Clock, Mic, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldBadge, SampleBadge } from "@/components/parampara/Badges";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { LampRowLazy as LampRow } from "@/components/parampara/LampRowLazy";
import type { MessageKey } from "@/lib/i18n";
import type { MasterCard, MasterHomeData, ThankYouNote } from "@/lib/masters/home";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";
import { ThanksSeen } from "./ThanksSeen";

// The master's room (DESIGN §8 /m). Who: a retired headmaster, reading glasses, not a tech user,
// proud of his craft. One button: tell a new story, always within thumb reach. The app speaks
// first; 20 px is the smallest text here and Kannada stands alone in Kannada mode (English is one
// tap away). Every number is for this master only; one or two teachers are "a few" (Law 6).

export function MasterRoom({ data }: { data: MasterHomeData }) {
  const fresh = data.thanks.filter((t) => t.isNew).length;
  const newest = data.thanks.find((t) => t.isNew) ?? null;
  // Dates on notes only once enough teachers are involved that a date points at no one (Law 6).
  const showDates = (data.impact?.reached ?? 0) >= 3;
  return (
    // A phone: one column with the one button pinned low. A laptop (lg): the greeting, what his
    // wisdom did and the one button stay in view on the left; thanks and cards read on the right.
    <main
      id="main"
      className="kn-solo mx-auto w-full max-w-xl flex-1 px-5 pt-4 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-x-12 lg:px-8 lg:pt-8 lg:pb-16"
    >
      <ThanksSeen pending={fresh} />

      <div className="lg:sticky lg:top-6">
        {/* the app speaks first: Hanate greets, then says what this room is for */}
        <section
          aria-labelledby="m-hello"
          className="rise rounded-card bg-paper px-5 pt-4 pb-5 shadow-warm"
        >
          <div className="flex items-center gap-3">
            <Hanate
              state={fresh > 0 ? "celebrating" : "idle"}
              size={72}
              label=""
              className="shrink-0 lg:h-[112px] lg:w-[96px]"
            />
            <h1
              id="m-hello"
              className="min-w-0 text-[28px] leading-tight font-extrabold text-clay-cta"
            >
              <BiText
                text={data.name ? "mhome.hello" : "mhome.helloPlain"}
                vars={data.name ? { name: data.name } : undefined}
                // On a phone the other language waits behind the toggle, so the lamps stay in view.
                subClassName="font-sans text-[18px] font-semibold text-ink-3 max-sm:hidden"
              />
            </h1>
          </div>
          <p className="mt-3 text-[22px] leading-snug text-ink">
            <Bi
              k={fresh > 0 ? "mhome.speakNew" : "mhome.speak"}
              subClassName="text-[18px] max-sm:hidden"
            />
          </p>
          {/* On a phone the new thank you is right here, not 700 px below the numbers. */}
          {newest && (
            <div className="mt-3 rounded-button bg-cream px-4 py-3 lg:hidden">
              <p
                lang="kn"
                data-lang-mode={newest.textEn ? "kn" : undefined}
                className="text-[20px] leading-snug text-ink"
              >
                “{newest.text}”
              </p>
              {/* In English: her words in English first, the Kannada she wrote beneath. */}
              {newest.textEn && (
                <span data-lang-mode="en" className="contents">
                  <p lang="en" className="text-[20px] leading-snug text-ink">
                    “{newest.textEn}”
                  </p>
                  <p lang="kn" className="mt-1 text-[15px] leading-snug text-ink-3">
                    {newest.text}
                  </p>
                </span>
              )}
            </div>
          )}
        </section>

        {/* On a laptop the one action comes straight after the greeting, in the first view. */}
        <RecordButton className="mt-5 hidden lg:flex" />
        <Impact data={data} />
      </div>

      <div className="lg:[&>section:first-child]:mt-0">
        <Thanks notes={data.thanks} isSample={data.isSample} showDates={showDates} />
        <Cards cards={data.cards} drafts={data.drafts} isSample={data.isSample} />

        <Link
          href="/m/import"
          className="mx-auto mt-10 flex min-h-14 w-fit items-center gap-2 rounded-chip px-5 font-display text-[20px] font-bold text-ink-3 underline decoration-ink/20 underline-offset-4 hover:text-ink"
        >
          <Upload className="size-5" aria-hidden />
          <Bi k="mhome.import" sub={false} />
        </Link>
      </div>

      {/* The one button on a phone: pinned at the bottom of the screen until the page ends where
          it lives. On a laptop it sits under the impact card instead (above). */}
      <div
        data-cta-tray
        className="sticky bottom-0 z-20 -mx-5 mt-4 border-t border-border bg-cream px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-warm-lg lg:hidden"
      >
        <RecordButton compact />
      </div>
    </main>
  );
}

function RecordButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Button
      asChild
      className={cn(
        "h-auto w-full flex-col gap-0.5 py-3 whitespace-normal",
        compact ? "min-h-16" : "min-h-[76px]",
        className,
      )}
    >
      <Link href="/m/talk">
        <span className="flex items-center gap-2.5 text-[24px] leading-tight">
          <Mic className="size-7" aria-hidden />
          <Bi k="mhome.record" sub={false} />
        </span>
        {/* The pinned phone tray keeps to one line, so it never hides the lamps above it. */}
        <span
          className={cn(
            "text-center font-sans text-[18px] leading-snug font-medium text-balance text-white",
            compact && "hidden",
          )}
        >
          <Bi k="mhome.record.sub" sub={false} />
        </span>
      </Link>
    </Button>
  );
}

function Impact({ data }: { data: MasterHomeData }) {
  const i = data.impact;
  const reached = i?.reached;
  const title: { k: MessageKey; n?: number } = data.impactFailed
    ? { k: "mhome.impactFailed" }
    : !i || reached === 0
      ? { k: "mhome.reachedNone" }
      : reached === null
        ? { k: "mhome.reachedFew" }
        : { k: "mhome.reached", n: reached };
  // "M said it worked" only when at least three teachers tried, so it is both true and anonymous.
  const tried = i?.tried ?? null;
  const showWorked = i !== null && tried !== null && tried >= 3 && i.worked !== null;
  const lit = i !== null && reached !== 0;
  // One lamp per teacher, up to six; "a few" lights one, so a lamp never claims a teacher.
  const lamps = reached == null ? 1 : Math.max(1, Math.min(6, reached));
  return (
    <section
      aria-labelledby="m-impact"
      className="mt-5 rise overflow-hidden rounded-card bg-ink px-5 pt-4 pb-5 text-white shadow-warm-lg"
      style={{ "--i": 1 } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        {title.n !== undefined ? (
          <p
            aria-hidden
            className="font-display text-[48px] leading-none font-extrabold text-flame tabular-nums"
          >
            <CountUp to={title.n} />
          </p>
        ) : (
          <span
            aria-hidden
            className="grid size-14 place-items-center rounded-chip bg-ink-2 text-flame"
          >
            <Sparkles className="size-7" />
          </span>
        )}
        {data.isSample ? <SampleBadge onDark /> : <FieldBadge onDark />}
      </div>
      <h2 id="m-impact" className="mt-2 text-[26px] leading-tight font-bold">
        <BiText
          text={title.k}
          vars={title.n !== undefined ? { n: title.n } : undefined}
          subClassName="font-sans text-[18px] font-semibold text-mist"
        />
      </h2>
      {showWorked && (
        <p className="mt-2 text-[22px] leading-snug text-flame">
          <BiText
            text="mhome.worked"
            vars={{ m: i.worked ?? 0 }}
            subClassName="text-[18px] text-mist"
          />
        </p>
      )}
      <LampRow count={lamps} lit={lit} stagger={0.12} onDark className="mt-3 justify-start" />
      <p className="mt-4 text-[20px] leading-snug text-mist max-sm:pr-14">
        <Bi k="mhome.private" sub={false} />
      </p>
    </section>
  );
}

function Thanks({
  notes,
  isSample,
  showDates,
}: {
  notes: ThankYouNote[];
  isSample: boolean;
  showDates: boolean;
}) {
  return (
    <section aria-labelledby="m-thanks" className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="m-thanks" className="text-[26px] leading-tight font-bold">
          <Bi k="mhome.thanks.title" subClassName="font-sans text-[18px] font-semibold" />
        </h2>
        {isSample && notes.length > 0 && <SampleBadge />}
      </div>
      {notes.length === 0 ? (
        <p className="mt-4 rounded-card bg-paper/80 px-5 py-4 text-[22px] leading-snug text-ink-3 shadow-warm-sm">
          <Bi k="mhome.thanks.empty" subClassName="text-[18px]" />
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className={cn(
                "rounded-card border px-5 py-4 shadow-warm-sm",
                n.isNew ? "border-flame-deep/60 bg-paper" : "border-border bg-paper/85",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[20px] text-ink-3">
                <span className="flex items-center gap-2">
                  <svg viewBox="0 0 12 16" aria-hidden className="h-5 w-4">
                    <path
                      d="M6 0 C8 4 11 6.5 11 10 C11 13.5 8.8 16 6 16 C3.2 16 1 13.5 1 10 C1 6.5 4 4 6 0 Z"
                      fill="var(--color-flame-deep)"
                    />
                  </svg>
                  <Bi k="mhome.thanks.from" sub={false} />
                  {showDates && (
                    <>
                      <span aria-hidden>·</span>
                      <When iso={n.createdAt} />
                    </>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {n.isNew && (
                    <span className="rounded-chip bg-flame px-3 py-0.5 font-display text-[16px] font-bold text-ink">
                      <Bi k="mhome.thanks.new" sub={false} />
                    </span>
                  )}
                </span>
              </div>
              <p lang="kn" className="mt-2 text-[22px] leading-snug text-ink">
                {n.text}
              </p>
              {/* English one tap away (Law 8); in Kannada the note stands alone. */}
              {n.textEn && (
                <p
                  lang="en"
                  data-lang-mode="en"
                  className="mt-1 text-[18px] leading-snug text-ink-3"
                >
                  {n.textEn}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A plain date in both languages (no clock, no "x hours ago" that would need the browser). */
function When({ iso }: { iso: string }) {
  const d = new Date(iso);
  const opts = { day: "numeric", month: "long" } as const;
  return (
    <BiText
      text={{ kn: d.toLocaleDateString("kn-IN", opts), en: d.toLocaleDateString("en-IN", opts) }}
      sub={false}
      inline
    />
  );
}

function Cards({
  cards,
  drafts,
  isSample,
}: {
  cards: MasterCard[];
  drafts: number;
  isSample: boolean;
}) {
  return (
    <section aria-labelledby="m-cards" className="mt-12">
      <h2 id="m-cards" className="text-[26px] leading-tight font-bold">
        <Bi k="mhome.cards.title" subClassName="font-sans text-[18px] font-semibold" />
      </h2>
      {cards.length === 0 ? (
        <div className="mt-4 flex items-center gap-4 rounded-card bg-paper/80 px-5 py-4 shadow-warm-sm">
          <Hanate
            state={drafts > 0 ? "thinking" : "idle"}
            size={64}
            label=""
            className="shrink-0"
          />
          <p className="text-[22px] leading-snug text-ink-3">
            <Bi
              k={drafts > 0 ? "mhome.cards.firstReview" : "mhome.cards.empty"}
              subClassName="text-[18px]"
            />
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {cards.map((c) => (
            <li
              key={c.id}
              className="rounded-card border border-border bg-paper px-5 py-4 shadow-warm-sm"
            >
              <p className="font-display text-[22px] leading-snug font-bold text-ink">
                <BiText text={c.title} subClassName="font-sans text-[18px] font-medium" />
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Evidence card={c} />
                {isSample && <SampleBadge />}
              </div>
            </li>
          ))}
          {drafts > 0 && (
            <li className="flex min-h-14 items-center gap-3 rounded-card bg-cream px-5 py-3 text-[20px] text-ink-3">
              <Clock className="size-6 shrink-0" aria-hidden />
              <BiText text="mhome.cards.review" vars={{ n: drafts }} sub={false} />
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function Evidence({ card }: { card: MasterCard }) {
  const chip =
    "inline-flex min-h-11 items-center gap-2 rounded-button px-4 py-1.5 text-[20px] leading-snug";
  if (card.tried === 0) {
    return (
      <span className={cn(chip, "bg-cream text-ink-3")}>
        <Bi k="mhome.cards.none" sub={false} />
      </span>
    );
  }
  if (card.tried === null || card.worked === null) {
    return (
      <span className={cn(chip, "bg-flame/30 text-ink")}>
        <Bi k="mhome.cards.few" sub={false} />
      </span>
    );
  }
  return (
    <span className={cn(chip, "bg-sage font-semibold text-moss")}>
      <svg viewBox="0 0 12 16" aria-hidden className="h-5 w-4 shrink-0">
        <path
          d="M6 0 C8 4 11 6.5 11 10 C11 13.5 8.8 16 6 16 C3.2 16 1 13.5 1 10 C1 6.5 4 4 6 0 Z"
          fill="var(--color-flame-deep)"
        />
      </svg>
      <BiText
        text="mhome.cards.worked"
        vars={{ w: card.worked, t: card.tried }}
        sub={false}
        inline
      />
    </span>
  );
}
