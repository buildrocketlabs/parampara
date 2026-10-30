import Link from "next/link";
import {
  ArrowRight,
  Check,
  HelpCircle,
  ImageIcon,
  MessageCircleQuestion,
  Send,
  Server,
  Sprout,
} from "lucide-react";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { MasterMedallion } from "@/components/parampara/MasterMedallion";
import { FLN_TOPIC_LABELS } from "@/lib/domain/fln";
import type { MessageKey } from "@/lib/i18n";
import type { Text } from "@/lib/i18n/fill";
import { districtName } from "@/lib/insights/districts";
import { barWidth } from "@/lib/insights/format";
import { INR_PER_USD, inr, usd } from "@/lib/insights/money";
import type { Count, PlatformCost, PulseSide } from "@/lib/insights/types";
import { cn } from "@/lib/utils";

// The numbers under "What to do this week". Server components: no client JS on the officer's page
// beyond the shared header. Bars are plain divs on DESIGN tokens (no chart library). A group of
// fewer than 5 teachers never gets a bar length or a number, only the words "fewer than 5".

export function Section({
  id,
  title,
  note,
  aside,
  children,
  className,
}: {
  id: string;
  title: MessageKey;
  note?: MessageKey;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-card border border-border bg-paper p-5 shadow-warm-sm sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={id} className="text-[22px] leading-tight font-bold">
            <Bi k={title} subClassName="font-sans text-[15px] font-semibold" />
          </h2>
          {note && (
            <p className="mt-1.5 text-[15px] text-ink-3">
              <Bi k={note} sub={false} />
            </p>
          )}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** A count, or "fewer than 5" in words. */
export function Num({ c, className }: { c: Count; className?: string }) {
  if (c.hidden) {
    return (
      <span data-suppressed className={cn("text-[15px] font-semibold text-ink-3", className)}>
        <Bi k={c.shield ? "pulse.shield" : "pulse.fewer.cap"} sub={false} />
      </span>
    );
  }
  return <span className={cn("tabular-nums", className)}>{c.n}</span>;
}

const FUNNEL: Array<{
  key: "asked" | "answered" | "tried" | "worked";
  label: MessageKey;
  icon: typeof Check;
}> = [
  { key: "asked", label: "pulse.funnel.asked", icon: MessageCircleQuestion },
  { key: "answered", label: "pulse.funnel.answered", icon: Send },
  { key: "tried", label: "pulse.funnel.tried", icon: Sprout },
  { key: "worked", label: "pulse.funnel.worked", icon: Check },
];

export function Funnel({ side }: { side: PulseSide }) {
  return (
    <Section id="funnel-title" title="pulse.funnel.title" note="pulse.funnel.note">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FUNNEL.map((step, i) => {
          const c = side.funnel[step.key];
          const Icon = step.icon;
          const last = i === FUNNEL.length - 1;
          return (
            <li
              key={step.key}
              data-funnel={step.key}
              className={cn(
                "relative flex min-h-32 rise flex-col justify-between rounded-[22px] p-4",
                last ? "bg-flame/30" : "bg-cream",
              )}
              style={{ "--i": i + 2 } as React.CSSProperties}
            >
              <span className="flex items-center gap-2 text-[15px] font-semibold text-ink-3">
                <Icon
                  className={cn("size-4 shrink-0", last ? "text-ink" : "text-moss")}
                  aria-hidden
                />
                <Bi k={step.label} sub={false} />
              </span>
              <Num
                c={c}
                className="mt-3 font-display text-[40px] leading-none font-extrabold text-ink"
              />
              {!last && (
                <ArrowRight
                  aria-hidden
                  className="absolute top-1/2 -right-3 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-paper text-ink-3 sm:block"
                />
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

type Bar = { key: string; label: Text; count: Count };

export function BarList({ items, empty }: { items: Bar[]; empty: MessageKey }) {
  if (items.length === 0) {
    return (
      <p className="rounded-[20px] bg-cream px-4 py-5 text-center text-[16px] text-ink-3">
        <Bi k={empty} sub={false} />
      </p>
    );
  }
  const max = Math.max(0, ...items.map((i) => (i.count.hidden ? 0 : i.count.n)));
  const shielded = items.some((i) => i.count.hidden && i.count.shield);
  return (
    <>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.key} data-bar={item.key} data-suppressed={item.count.hidden || undefined}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 font-display text-[17px] leading-snug font-semibold text-ink">
                <BiText text={item.label} sub={false} inline />
              </span>
              <Num
                c={item.count}
                className="shrink-0 font-display text-[19px] font-bold text-ink"
              />
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-chip bg-cream">
              {item.count.hidden ? (
                <div className="h-full w-full rounded-chip border border-dashed border-ink-3/40" />
              ) : (
                <div
                  className="h-full rounded-chip bg-clay"
                  style={{ width: barWidth(item.count.n, max) }}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      {shielded && (
        <p className="mt-4 text-[14px] text-ink-3">
          <Bi k="pulse.shield.note" sub={false} />
        </p>
      )}
    </>
  );
}

export function TopicBars({ side }: { side: PulseSide }) {
  const items = side.topics
    .filter((t) => t.asked.hidden || t.asked.n > 0)
    .map((t) => ({ key: t.topic, label: FLN_TOPIC_LABELS[t.topic], count: t.asked }));
  return (
    <Section id="topics-title" title="pulse.topics.title">
      <BarList items={items} empty="pulse.topics.none" />
    </Section>
  );
}

export function NeedsList({ side }: { side: PulseSide }) {
  const items = side.topics
    .filter((t) => t.waiting.hidden || t.waiting.n > 0)
    .sort(
      (a, b) =>
        Number(a.waiting.hidden) - Number(b.waiting.hidden) ||
        (b.waiting.n ?? 0) - (a.waiting.n ?? 0),
    )
    .map((t) => ({ key: t.topic, label: FLN_TOPIC_LABELS[t.topic], count: t.waiting }));
  return (
    <Section id="needs-title" title="pulse.needs.title" note="pulse.needs.body">
      <BarList items={items} empty="pulse.needs.none" />
    </Section>
  );
}

export function DistrictBars({ side }: { side: PulseSide }) {
  const items = side.districts.map((d) => ({
    key: d.district ?? "none",
    label: districtName(d.district),
    count: d.asked,
  }));
  return (
    <Section id="districts-title" title="pulse.districts.title">
      <BarList items={items} empty="pulse.topics.none" />
    </Section>
  );
}

export function PracticeList({ side }: { side: PulseSide }) {
  return (
    <Section id="practices-title" title="pulse.practices.title" note="pulse.practices.since">
      {side.practices.length === 0 ? (
        <p className="rounded-[20px] bg-cream px-4 py-5 text-center text-[16px] text-ink-3">
          <Bi k="pulse.practices.none" sub={false} />
        </p>
      ) : (
        // Full width on a laptop, so the practices sit three to a row instead of one long column.
        <ul className="divide-y divide-border lg:grid lg:grid-cols-3 lg:gap-x-8 lg:divide-y-0">
          {side.practices.map((p) => (
            <li
              key={p.cardId}
              data-practice={p.cardId}
              className="flex gap-3 py-4 first:pt-0 last:pb-0 lg:border-t lg:border-border lg:pb-4 lg:last:pb-4 lg:[&:nth-child(-n+3)]:border-t-0 lg:[&:nth-child(-n+3)]:pt-0"
            >
              <MasterMedallion
                name={p.master.name}
                size="sm"
                portraitOnly
                isSample={p.cardIsSample}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[18px] leading-snug font-bold text-ink">
                  <BiText text={p.title} subClassName="font-sans text-[15px] font-medium" />
                </p>
                <p className="mt-1 text-[15px] text-ink-3">
                  {p.master.name ?? <Bi k="master.anonymous" sub={false} className="inline" />}
                  {p.master.years ? (
                    <>
                      {" · "}
                      <BiText text="master.years" vars={{ n: p.master.years }} sub={false} inline />
                    </>
                  ) : null}
                </p>
                {p.worked.hidden ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[15px] font-semibold text-ink-3">
                    <HelpCircle className="size-4 shrink-0" aria-hidden />
                    <Bi k="pulse.practices.few" sub={false} />
                  </p>
                ) : (
                  <div className="mt-2">
                    <p className="flex items-center gap-1.5 text-[15px] font-semibold text-moss">
                      <Check className="size-4 shrink-0" aria-hidden strokeWidth={3} />
                      <BiText
                        text="pulse.practices.worked"
                        vars={{ worked: p.worked.n, tried: p.tried.hidden ? "" : p.tried.n }}
                        sub={false}
                        inline
                      />
                    </p>
                    {!p.tried.hidden && p.tried.n > 0 && (
                      <div className="mt-1.5 h-2 max-w-60 overflow-hidden rounded-chip bg-sage">
                        <div
                          className="h-full rounded-chip bg-moss"
                          style={{ width: barWidth(p.worked.n, p.tried.n) }}
                        />
                      </div>
                    )}
                  </div>
                )}
                <a
                  href={`/api/cards/${encodeURIComponent(p.cardId)}/image`}
                  target="_blank"
                  rel="noopener"
                  data-card-image={p.cardId}
                  className="mt-1 -ml-1 inline-flex min-h-12 items-center gap-1.5 rounded-chip px-1 text-[15px] font-semibold text-clay-cta underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-clay"
                >
                  <ImageIcon className="size-4 shrink-0" aria-hidden />
                  <Bi k="pulse.practices.card" sub={false} />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function CostCard({ side, platform }: { side: PulseSide; platform: PlatformCost | null }) {
  const { perTeacherUsd, perAnswerUsd, answersUsd } = side.cost;
  return (
    <Section id="cost-title" title="pulse.cost.title">
      {perTeacherUsd !== null ? (
        <div data-cost="per-teacher">
          <p className="font-display text-[44px] leading-none font-extrabold text-ink tabular-nums">
            {inr(perTeacherUsd)}
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[16px] font-semibold text-ink">
            <Bi k="pulse.cost.perTeacher" sub={false} />
            <span className="font-normal text-ink-3 tabular-nums">{usd(perTeacherUsd)}</span>
          </p>
          {!side.teachers.hidden && (
            <p className="mt-0.5 text-[15px] text-ink-3">
              <BiText text="pulse.cost.teachers" vars={{ n: side.teachers.n }} sub={false} />
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-[20px] bg-cream px-4 py-4 text-[16px] text-ink-3">
          <Bi k={side.teachers.hidden ? "pulse.cost.few" : "pulse.cost.none"} sub={false} />
        </p>
      )}
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-[20px] bg-cream p-4">
          <dt className="text-[15px] text-ink-3">
            <Bi k="pulse.cost.perAnswer" sub={false} />
          </dt>
          <dd className="mt-1 font-display text-[22px] font-bold text-ink tabular-nums">
            {perAnswerUsd !== null ? (
              <>
                {inr(perAnswerUsd)}
                <span className="ml-1.5 font-sans text-[14px] font-normal text-ink-3">
                  {usd(perAnswerUsd)}
                </span>
              </>
            ) : side.funnel.answered.hidden ? (
              <Bi k="pulse.fewer.cap" sub={false} className="text-[16px] text-ink-3" />
            ) : (
              inr(0)
            )}
          </dd>
        </div>
        <div className="rounded-[20px] bg-cream p-4">
          <dt className="text-[15px] text-ink-3">
            <Bi k="pulse.cost.total" sub={false} />
          </dt>
          <dd className="mt-1 font-display text-[22px] font-bold text-ink tabular-nums">
            {answersUsd === null ? (
              // A week of fewer than 5 teachers: the total over a typical answer would be a count.
              <Bi k="pulse.fewer.cap" sub={false} className="text-[16px] text-ink-3" />
            ) : (
              <>
                {inr(answersUsd)}
                <span className="ml-1.5 font-sans text-[14px] font-normal text-ink-3">
                  {usd(answersUsd)}
                </span>
              </>
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-[14px] text-ink-3">
        <BiText text="pulse.cost.rate" vars={{ rate: INR_PER_USD }} sub={false} />
      </p>
      {platform && (
        // Not this week's numbers: every AI call the app made (field, Sample, tests and evals),
        // which cannot be told apart (D55). Set apart so no one adds it to the week above.
        <div
          data-cost="platform"
          className="mt-6 rounded-[20px] border border-dashed border-ink-3/40 bg-paper px-4 py-4"
        >
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Server className="size-4.5 shrink-0 text-ink-3" aria-hidden />
            <Bi k="pulse.cost.platform" sub={false} />
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-[22px] font-bold text-ink tabular-nums">
              {inr(platform.aiCostUsd)}
            </span>
            <span className="text-[14px] text-ink-3 tabular-nums">
              {usd(platform.aiCostUsd)} ·{" "}
              <BiText
                text="pulse.cost.platformCalls"
                vars={{ calls: platform.aiCalls }}
                sub={false}
                inline
              />
            </span>
          </p>
          <p className="mt-2 text-[14px] leading-snug text-ink-3">
            <Bi k="pulse.cost.platformNote" sub={false} />
          </p>
        </div>
      )}
    </Section>
  );
}

export function LampsLink({ className }: { className?: string }) {
  return (
    <Link
      href="/i/lamps"
      data-lamps-link
      className={cn(
        "group flex min-h-16 items-center gap-4 rounded-card bg-sage px-5 py-4 shadow-warm-sm transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-warm",
        className,
      )}
    >
      <Hanate state="happy" size={60} label="" className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[21px] leading-tight font-bold text-ink">
          <Bi k="pulse.lamps.title" subClassName="font-sans text-[15px] font-semibold" />
        </span>
        <span className="mt-1 block text-[15px] text-ink-3">
          <Bi k="pulse.lamps.body" sub={false} />
        </span>
      </span>
      <ArrowRight
        className="size-6 shrink-0 text-ink transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
