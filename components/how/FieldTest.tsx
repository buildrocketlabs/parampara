import { Maximize2 } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { FieldBadge, SampleBadge } from "@/components/parampara/Badges";
import { ErrorState } from "@/components/parampara/ErrorState";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import type { Bilingual } from "@/lib/domain/fln";
import type { MessageKey } from "@/lib/i18n";
import { messages } from "@/lib/i18n/messages";
import { fill } from "@/lib/i18n/fill";
import { dayOf } from "@/lib/insights/format";
import { fieldChanges, type FieldChange } from "@/lib/field/changes";
import { heardEntries, type HeardEntry } from "@/lib/field/heard";
import {
  fieldIsEmpty,
  loadFieldSummary,
  type FieldCount,
  type FieldSummary,
} from "@/lib/field/summary";
import { createAdminClient } from "@/lib/supabase/admin";

// The Koppal field test on /how. Who: a juror or the Tech4Dev evaluator asking "is any of this
// real?". One job: show what the field test has put on record, straight from the database, and what
// we changed because of what people said. Feeling: plain, honest proof; an empty state that says
// so rather than a number that pretends.

export type FieldBody =
  { kind: "numbers"; summary: FieldSummary } | { kind: "empty" } | { kind: "error" };

/** Reads the field totals and the changes file, then renders the section. */
export async function FieldTest() {
  const db = createAdminClient();
  // No database (local fixture mode): this deployment has no field rows, which is the empty state.
  const summary = db ? await loadFieldSummary(db) : null;
  const body: FieldBody = !db
    ? { kind: "empty" }
    : !summary
      ? { kind: "error" }
      : fieldIsEmpty(summary)
        ? { kind: "empty" }
        : { kind: "numbers", summary };
  return <FieldTestSection body={body} changes={fieldChanges()} heard={heardEntries()} />;
}

export function FieldTestSection({
  body,
  changes,
  heard,
}: {
  body: FieldBody;
  changes: FieldChange[];
  heard: HeardEntry[];
}) {
  return (
    <section aria-labelledby="field" className="mt-12" data-field={body.kind}>
      <h2 id="field" className="text-[26px] font-bold">
        <Bi k="field.title" sub={false} />
      </h2>
      <p className="mt-2 max-w-2xl text-lg text-ink-3">
        <Bi k="field.sub" subClassName="text-base" />
      </p>
      <FieldTestCard body={body} changes={changes} heard={heard} badge={<FieldBadge />} />
    </section>
  );
}

/** The card itself. `badge` is the truth label: FieldBadge on /how, SampleBadge on a specimen. */
export function FieldTestCard({
  body,
  changes,
  heard = [],
  badge,
}: {
  body: FieldBody;
  changes: FieldChange[];
  /** The sourced "what we heard and what we changed" items (docs/field/heard.json). */
  heard?: HeardEntry[];
  badge: ReactNode;
}) {
  return (
    <div className="mt-5 rounded-card border border-border bg-paper p-5 shadow-warm-sm sm:p-7">
      {badge}
      {body.kind === "numbers" && <Numbers s={body.summary} />}
      {body.kind === "empty" && <Empty />}
      {body.kind === "error" && <ErrorState body="field.error" className="mt-2" />}
      {heard.length > 0 && <Heard entries={heard} />}
      {(changes.length > 0 || heard.length === 0) && <Changes changes={changes} />}
    </div>
  );
}

function Empty() {
  return (
    <div
      data-field-empty
      className="mt-4 flex flex-col items-start gap-2 rounded-[20px] bg-cream px-5 py-5 sm:flex-row sm:items-center sm:gap-6 sm:px-7"
    >
      {/* idle, not resting: "nothing yet" (resting is for offline, DESIGN §5). */}
      <Hanate state="idle" size={72} label="" className="-ml-2 shrink-0 sm:ml-0" />
      <div>
        <h3 className="text-[21px] leading-snug font-bold text-ink">
          <Bi k="field.empty.title" subClassName="font-sans text-[15px] font-semibold" />
        </h3>
        <p className="mt-2 max-w-xl text-[17px] text-ink-3">
          <Bi k="field.empty.body" subClassName="text-[15px]" />
        </p>
      </div>
    </div>
  );
}

const TILES: Array<{
  key: "masters" | "approvedCards" | "teachers" | "questions";
  label: MessageKey;
}> = [
  { key: "masters", label: "field.n.masters" },
  { key: "approvedCards", label: "field.n.cards" },
  { key: "teachers", label: "field.n.teachers" },
  { key: "questions", label: "field.n.questions" },
];

function Numbers({ s }: { s: FieldSummary }) {
  const since = s.since ? dayOf(s.since) : null;
  return (
    <>
      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map(({ key, label }) => {
          const value = s[key];
          const count: FieldCount = typeof value === "number" ? { n: value, hidden: false } : value;
          return (
            // The number leads (visually first, so the four line up); the label follows it.
            <div
              key={key}
              data-field-tile={key}
              className="flex flex-col-reverse justify-end rounded-[20px] bg-cream p-4"
            >
              <dt className="mt-2 text-[15px] leading-snug text-ink-3">
                <Bi k={label} sub={false} />
              </dt>
              <dd className="flex min-h-9 items-end font-display text-[34px] leading-none font-extrabold text-ink tabular-nums">
                {count.hidden ? (
                  // Words, never a lone "5": a count kept private must not read as a count.
                  <span className="flex flex-col font-sans text-[16px] leading-snug font-semibold text-ink-3">
                    <Bi k="field.n.private" sub={false} />
                    <Bi k="field.n.privateWhy" sub={false} className="text-[14px] font-normal" />
                  </span>
                ) : (
                  count.n
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <Outcomes s={s} />
      <Footnote since={since} privacySaid={s.tried.hidden} />
    </>
  );
}

/** When the outcomes box already says why it is private, the footnote keeps to the date. */
function Footnote({ since, privacySaid }: { since: Bilingual | null; privacySaid: boolean }) {
  if (privacySaid && !since) return null;
  const key = privacySaid ? "field.since.short" : "field.since";
  return (
    <p data-field-private className="mt-4 text-[15px] text-ink-3">
      {since ? (
        <BiText
          text={{
            kn: fill(messages.kn[key], { date: since.kn }),
            en: fill(messages.en[key], { date: since.en }),
          }}
          subClassName="text-[14px]"
        />
      ) : (
        <Bi k="field.private" subClassName="text-[14px]" />
      )}
    </p>
  );
}

const OUTCOMES: Array<{ key: "worked" | "partly" | "didnt"; label: MessageKey; dot: string }> = [
  { key: "worked", label: "tried.worked", dot: "bg-moss" },
  { key: "partly", label: "tried.partly", dot: "bg-flame-deep" },
  // Mist is pale on cream, so its segment and dot carry a thin ink ring to stay visible.
  { key: "didnt", label: "tried.didnt", dot: "bg-mist ring-1 ring-inset ring-ink-3/40" },
];

function Outcomes({ s }: { s: FieldSummary }) {
  const total = s.tried.n;
  return (
    <div data-field-outcomes className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[17px] font-semibold text-ink">
          <Bi k="field.outcomes" sub={false} />
        </h3>
        {!s.tried.hidden && total ? (
          <p className="text-[15px] text-ink-3">
            <BiText text="field.outcomes.total" vars={{ n: total }} sub={false} />
          </p>
        ) : null}
      </div>
      {s.tried.hidden ? (
        <p className="mt-2 rounded-[20px] bg-cream px-4 py-3 text-[16px] text-ink-3">
          <Bi k="field.outcomes.few" subClassName="text-[14px]" />
        </p>
      ) : !total ? (
        <p className="mt-2 rounded-[20px] bg-cream px-4 py-3 text-[16px] text-ink-3">
          <Bi k="field.outcomes.none" subClassName="text-[14px]" />
        </p>
      ) : (
        <>
          <div className="mt-3 flex h-4 gap-0.5 overflow-hidden rounded-chip" aria-hidden>
            {OUTCOMES.map(({ key, dot }) => {
              const n = s[key].n ?? 0;
              return n > 0 ? (
                <span
                  key={key}
                  className={`rounded-chip ${dot}`}
                  style={{ width: `${(n / total) * 100}%` }}
                />
              ) : null;
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {OUTCOMES.map(({ key, label, dot }) => (
              <li key={key} className="flex items-center gap-2 text-[16px] text-ink">
                <span className={`size-3 rounded-chip ${dot}`} aria-hidden />
                <Bi k={label} sub={false} className="inline" />
                <span className="font-display text-[20px] font-bold tabular-nums">{s[key].n}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Changes({ changes }: { changes: FieldChange[] }) {
  return (
    <div data-field-changes className="mt-6 border-t border-border pt-5">
      <h3 className="text-[19px] leading-snug font-bold text-ink">
        <Bi k="field.changes" subClassName="font-sans text-[15px] font-semibold" />
      </h3>
      {changes.length === 0 ? (
        <p data-field-changes-empty className="mt-2 max-w-prose text-[15px] text-ink-3">
          <Bi k="field.changes.empty" subClassName="text-[14px]" />
        </p>
      ) : (
        <>
          <p className="mt-1 text-[15px] text-ink-3">
            <Bi k="field.changes.sub" sub={false} />
          </p>
          <ol className="mt-4 grid gap-4">
            {changes.map((c, i) => (
              <Change key={`${c.date}-${i}`} c={c} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

/** What we heard or saw, dated, with where the source and the change live in the repo. */
function Heard({ entries }: { entries: HeardEntry[] }) {
  return (
    <div data-field-heard className="mt-6 border-t border-border pt-5">
      <h3 className="text-[19px] leading-snug font-bold text-ink">
        <Bi k="field.heard" subClassName="font-sans text-[15px] font-semibold" />
      </h3>
      <p className="mt-1 max-w-prose text-[15px] text-ink-3">
        <Bi k="field.heard.sub" sub={false} />
      </p>
      <ol className="mt-4 grid gap-4 lg:grid-cols-2">
        {entries.map((e, i) => (
          <li
            key={`${e.date}-${i}`}
            data-field-heard-item={e.sample ? "sample" : "field"}
            className="rounded-[20px] bg-cream p-4 sm:p-5"
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-3">
              <time dateTime={e.date}>
                <BiText text={dayOf(e.date)} sub={false} inline />
              </time>
              <span aria-hidden>·</span>
              <Bi k={`field.heard.who.${e.who}` as MessageKey} sub={false} className="inline" />
              {e.sample && <SampleBadge className="ml-1" />}
            </p>
            <p className="mt-2 text-[14px] font-semibold tracking-wide text-clay-cta uppercase">
              <Bi k={`field.heard.${e.kind}` as MessageKey} sub={false} />
            </p>
            <p className="mt-0.5 text-[17px] leading-snug font-semibold text-ink">
              <BiText text={e.heard} subClassName="text-[15px] font-normal" />
            </p>
            <p className="mt-3 text-[14px] font-semibold tracking-wide text-moss uppercase">
              <Bi k="field.changes.changed" sub={false} />
            </p>
            <p className="mt-0.5 text-[16px] text-ink">
              <BiText text={e.changed} subClassName="text-[14px] text-ink-3" />
            </p>
            <p className="mt-3 flex flex-wrap gap-1.5" aria-label="sources">
              {e.where.map((w) => (
                <span
                  key={w}
                  className="rounded-chip bg-paper px-2.5 py-0.5 font-mono text-[14px] break-all text-ink-2"
                >
                  {w}
                </span>
              ))}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Change({ c }: { c: FieldChange }) {
  const day = dayOf(c.date);
  const who = `field.who.${c.who}` as MessageKey;
  return (
    <li data-field-change className="rounded-[20px] bg-cream p-4 sm:p-5">
      <p className="flex flex-wrap items-center gap-x-2 text-[14px] text-ink-3">
        <time dateTime={c.date}>
          <BiText text={day} sub={false} inline />
        </time>
        <span aria-hidden>·</span>
        <Bi k={who} sub={false} className="inline" />
      </p>
      <blockquote className="mt-2 text-[19px] leading-snug font-semibold text-ink">
        <BiText
          text={{ kn: `“${c.said.kn}”`, en: `“${c.said.en}”` }}
          subClassName="text-[15px] font-normal"
        />
      </blockquote>
      <p className="mt-3 text-[16px] text-ink">
        <span className="font-semibold">
          <Bi k="field.changes.changed" sub={false} className="inline" />
        </span>
        <span aria-hidden>: </span>
        <BiText text={c.changed} sub={false} inline />
      </p>
      {(c.before || c.after) && (
        <div className="mt-4 grid max-w-xl grid-cols-2 gap-3">
          {(
            [
              ["field.changes.before", c.before],
              ["field.changes.after", c.after],
            ] as const
          ).map(([label, src]) => (
            <div key={label} data-field-shot={src ? "linked" : "none"}>
              {src ? (
                // The thumbnail is small at 390, so it opens the full screenshot.
                <a href={src} target="_blank" rel="noopener" className="group block rounded-[16px]">
                  <Shot src={src} alt={`${messages.en[label]}: ${c.changed.en}`} />
                  <span className="flex min-h-12 items-center gap-1.5 text-[15px] font-semibold text-ink-3 group-hover:text-ink">
                    <Bi k={label} sub={false} className="inline" />
                    <Maximize2 className="size-4" aria-hidden />
                  </span>
                </a>
              ) : (
                <>
                  <Shot src={null} alt="" />
                  <span className="flex min-h-12 items-center text-[15px] font-semibold text-ink-3">
                    <Bi k={label} sub={false} />
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function Shot({ src, alt }: { src: string | null; alt: string }) {
  return (
    // Phone screenshots, so a phone shaped frame (390 by 700, top aligned).
    <div className="relative aspect-[390/700] overflow-hidden rounded-[16px] border border-border bg-paper">
      {src && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 640px) 280px, 45vw"
          unoptimized={src.endsWith(".svg")}
          className="object-cover object-top"
        />
      )}
    </div>
  );
}
