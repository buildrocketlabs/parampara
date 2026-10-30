import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Flame,
  ImageIcon,
  Link2,
  Mic,
  Share2,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { FieldBadge, SampleBadge } from "@/components/parampara/Badges";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import type { Bilingual } from "@/lib/domain/fln";
import type { MessageKey } from "@/lib/i18n";
import type { PulseAction, PulseActionKind } from "@/lib/insights/actions";
import { cn } from "@/lib/utils";
import { ShareLine } from "./ShareLine";

// "What to do this week" (DESIGN §1 Officer: action before any number). The chalkboard: ink, the
// one dark surface on the page, so it is read first. Either Claude's digest for this week (with
// its date and the promise that it used only these numbers) or the plain derived actions. Every
// row leads somewhere: a link where Parampara can do it, else a Send button to pass the line on.

const ICON: Record<PulseActionKind, LucideIcon> = {
  record: Mic,
  share: Share2,
  remind: BellRing,
  invite: Link2,
  lamps: Flame,
};

/** Under a digest, the derived actions' links stay one tap away. */
const QUICK: Record<PulseActionKind, { label: MessageKey; icon: LucideIcon }> = {
  share: { label: "pulse.practices.card", icon: ImageIcon },
  record: { label: "rhub.import", icon: Upload },
  invite: { label: "rhub.invites", icon: Link2 },
  lamps: { label: "pulse.lamps.title", icon: Flame },
  remind: { label: "pulse.lamps.title", icon: BellRing },
};

const LINK =
  "flex h-full min-h-14 gap-3 rounded-[20px] bg-ink-2 p-3.5 ring-1 ring-flame/30 transition-[translate,box-shadow] outline-none hover:-translate-y-0.5 hover:shadow-flame focus-visible:ring-2 focus-visible:ring-flame sm:p-4";

export type DigestView = {
  headline: Bilingual;
  actions: Bilingual[];
  watch: Bilingual[];
  /** "Written by Claude on 24 October, only from the numbers below". */
  byline: Bilingual;
};

type Row = { text: Bilingual; icon: LucideIcon; href?: string };

function Go({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  // The Tomorrow card is an image, not a page: open it beside the board.
  return href.startsWith("/api/") ? (
    <a href={href} target="_blank" rel="noopener" className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function ActionsCard({
  actions,
  digest,
  isSample,
  hasNumbers = true,
  freshNoteComing = false,
  className,
}: {
  actions: PulseAction[];
  digest: DigestView | null;
  /** Labels the board itself, so a cropped screenshot never loses the Sample mark (Law 7). */
  isSample: boolean;
  /** False when there are no numbers below to point at. */
  hasNumbers?: boolean;
  /** Claude's last note described other numbers, so it is hidden and a fresh one is coming. */
  freshNoteComing?: boolean;
  className?: string;
}) {
  const rows: Row[] = digest
    ? digest.actions.map((text) => ({ text, icon: Sparkles }))
    : actions.map((a) => ({ text: a.text, icon: ICON[a.kind], href: a.href }));
  const quick = digest ? actions.filter((a) => a.href) : [];

  return (
    <section
      aria-labelledby="do-title"
      data-actions={digest ? "digest" : "derived"}
      className={cn(
        "relative overflow-hidden rounded-card bg-ink p-4 text-white shadow-warm-lg sm:p-7",
        className,
      )}
    >
      {/* A soft lamp glow in the corner: the only flame of colour on the board. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-flame/20 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h2
          id="do-title"
          className="min-w-0 flex-1 text-[26px] leading-tight font-bold sm:text-[30px]"
        >
          <Bi k="pulse.do.title" subClassName="font-sans text-[16px] font-semibold text-mist" />
        </h2>
        {isSample ? (
          <SampleBadge onDark className="mt-1 shrink-0" />
        ) : (
          <FieldBadge onDark className="mt-1 shrink-0" />
        )}
      </div>
      {digest && (
        <p className="relative mt-4 max-w-3xl font-display text-[21px] leading-snug font-bold text-flame sm:text-[23px]">
          <BiText
            text={digest.headline}
            subClassName="font-sans text-[16px] font-semibold text-mist"
          />
        </p>
      )}
      <ol className="relative mt-5 grid gap-3 lg:grid-cols-2">
        {rows.map((row, i) => {
          const first = i === 0;
          const Icon = row.icon;
          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  "grid shrink-0 place-items-center rounded-chip bg-flame font-display font-extrabold text-ink",
                  first
                    ? "size-10 text-[18px] sm:size-12 sm:text-[20px]"
                    : "size-9 text-[16px] sm:size-11 sm:text-[18px]",
                )}
              >
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-3">
                <span
                  className={cn(
                    "max-w-[62ch] leading-relaxed",
                    first ? "text-[19px] sm:text-[20px]" : "text-[18px]",
                  )}
                >
                  <BiText
                    text={row.text}
                    // On a phone one language per row, so the first row's Send sits in the thumb
                    // zone; the other language is one tap away in the header toggle (Law 8).
                    subClassName="mt-1.5 text-[15px] leading-normal text-mist max-sm:hidden"
                  />
                </span>
                {!row.href && <ShareLine text={row.text} />}
              </span>
              {row.href ? (
                <ArrowRight className="mt-2.5 size-5 shrink-0 text-flame" aria-hidden />
              ) : (
                <Icon
                  className="mt-2.5 hidden size-5 shrink-0 text-clay-glow sm:block"
                  aria-hidden
                />
              )}
            </>
          );
          return (
            <li
              key={i}
              data-action-row={i}
              // The feedback tab steps aside for these rows (FeedbackButton's PRIMARY).
              data-primary
              className={cn("rise", first && rows.length > 2 && "lg:col-span-2")}
              style={{ "--i": i + 1 } as React.CSSProperties}
            >
              {row.href ? (
                <Go href={row.href} className={LINK}>
                  {body}
                </Go>
              ) : (
                <div className="flex h-full min-h-14 gap-3 rounded-[20px] bg-ink-2 p-3 sm:p-4">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {quick.length > 0 && (
        <ul className="relative mt-4 flex flex-wrap gap-2.5">
          {quick.map((a) => {
            const q = QUICK[a.kind];
            const QIcon = q.icon;
            return (
              <li key={a.kind}>
                <Go
                  href={a.href!}
                  className="inline-flex min-h-12 items-center gap-2 rounded-chip bg-ink-2 px-4 font-display text-[15px] font-semibold text-white ring-1 ring-flame/40 outline-none hover:bg-ink-3 focus-visible:ring-2 focus-visible:ring-flame"
                >
                  <QIcon className="size-4 text-flame" aria-hidden />
                  <Bi k={q.label} sub={false} />
                </Go>
              </li>
            );
          })}
        </ul>
      )}
      {digest && digest.watch.length > 0 && (
        <div className="relative mt-5">
          <h3 className="font-display text-[17px] font-bold text-clay-glow">
            <Bi k="pulse.digest.watch" sub={false} />
          </h3>
          <ul className="mt-2 space-y-2">
            {digest.watch.map((w, i) => (
              <li key={i} className="flex gap-2.5 text-[16px] leading-relaxed">
                <span aria-hidden className="mt-2.5 size-2 shrink-0 rounded-full bg-clay-glow" />
                <span className="min-w-0">
                  <BiText text={w} subClassName="text-[14px] text-mist" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(digest || hasNumbers) && (
        <p className="relative mt-5 flex items-center gap-2 text-[14px] text-mist">
          {digest ? <Sparkles className="size-4 shrink-0" aria-hidden /> : null}
          {digest ? (
            <BiText text={digest.byline} sub={false} />
          ) : freshNoteComing ? (
            <span data-fresh-note>
              <Bi k="pulse.digest.fresh" sub={false} />
            </span>
          ) : (
            <Bi k="pulse.do.fromNumbers" sub={false} />
          )}
        </p>
      )}
    </section>
  );
}
