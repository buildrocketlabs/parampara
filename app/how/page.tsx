// How Parampara thinks. Who: a juror or the Tech4Dev evaluator, on a laptop, in English, wanting to
// see real reasoning, real guardrails and real numbers. One job: understand the system in a minute
// and believe it. Every number on this page is computed from the database (Law 7).
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  BookOpenCheck,
  Brain,
  Check,
  Ear,
  FlaskConical,
  ShieldCheck,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import { modelIdFor, SPEECH } from "@/ai/router";
import { INR_PER_USD as APP_INR_PER_USD } from "@/ai/speech/cost";
import { CostBlock } from "@/components/how/CostBlock";
import { SectionNav } from "@/components/how/SectionNav";
import { FieldTest } from "@/components/how/FieldTest";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { BiText } from "@/components/parampara/BiText";
import { FieldBadge, SampleBadge } from "@/components/parampara/Badges";
import { SkeletonCard } from "@/components/parampara/Skeleton";
import { Timeline } from "@/components/parampara/TraceDrawer";
import { SiteHeader } from "@/components/parampara/SiteHeader";
import { SAMPLE_TRACE } from "@/app/design/sample-data";
import type { Trace } from "@/lib/ask/types";
import { formatLatency, formatUsd, verdictCounts } from "@/lib/trace-format";
import { loadFieldSummary } from "@/lib/field/summary";
import { NETWORK_MEASURED, NETWORK_SOURCE_URL } from "@/lib/how/network";
import { clock, loadShowcase, type Showcase } from "@/lib/how/showcase";
import type { MessageKey } from "@/lib/i18n";
import { messages } from "@/lib/i18n/messages";
import { fill } from "@/lib/i18n/fill";
import { dayOf } from "@/lib/insights/format";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import evalReport from "@/docs/evals/latest.json";
import type { EvalReport, Gate, GateId } from "@/evals/gates";

/** A model id such as "claude, haiku, 5, 5" reads as "Claude Haiku 5.5" on the page. */
function modelLabel(role: Parameters<typeof modelIdFor>[0]): string {
  const id = modelIdFor(role);
  const m = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(id);
  return m ? `Claude ${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}.${m[3]}` : id;
}

const NAV: ReadonlyArray<[string, MessageKey]> = [
  ["trace", "howpage.nav.trace"],
  ["layers", "howpage.nav.layers"],
  ["field", "howpage.nav.field"],
  ["evals", "howpage.nav.evals"],
  ["cost", "howpage.nav.cost"],
  ["offline", "howpage.nav.offline"],
  ["open", "howpage.nav.open"],
];

export const metadata: Metadata = {
  title: "How Parampara thinks",
  description:
    "The six layers, the guardrails, a real answer's trace and the numbers, computed live.",
};

/** Stated, not hidden: the ₹ figures use the app's one rate (ai/speech/cost.ts, D63). */
const INR_PER_USD = APP_INR_PER_USD;

const LAYERS: Array<{ icon: LucideIcon; title: MessageKey; body: MessageKey; models: string[] }> = [
  {
    icon: Ear,
    title: "howpage.l1.title",
    body: "howpage.l1.body",
    models: [`Sarvam ${SPEECH.transcribe.model}`, `${modelLabel("triage")}`],
  },
  {
    icon: BookOpenCheck,
    title: "howpage.l2.title",
    body: "howpage.l2.body",
    models: [`${modelLabel("card_extractor")}`, "prompt caching"],
  },
  {
    icon: Brain,
    title: "howpage.l3.title",
    body: "howpage.l3.body",
    models: [`${modelLabel("retriever")}`, `${modelLabel("answerer")}`],
  },
  {
    icon: ShieldCheck,
    title: "howpage.l4.title",
    body: "howpage.l4.body",
    models: [
      `${modelLabel("grounding_judge")}`,
      `${modelLabel("safety")}`,
      "patterns kn · en · hi",
    ],
  },
  {
    icon: FlaskConical,
    title: "howpage.l5.title",
    body: "howpage.l5.body",
    models: ["pnpm evals", "worked · partly · didn't"],
  },
  {
    icon: Volume2,
    title: "howpage.l6.title",
    body: "howpage.l6.body",
    models: [`Sarvam ${SPEECH.speak.model}`],
  },
];

// The eval gates as `pnpm evals` last wrote them (evals/reporter.ts), read at build time. A gate
// shows a number only when it was measured from recorded model outputs; otherwise it says so.
const EVALS = evalReport as unknown as EvalReport;
/** Model outputs on record; with none, only the guardrail tests ran (no model score is claimed). */
const RECORDED = EVALS.recordings.reduce((n, r) => n + r.recorded, 0);
const GATE_COPY: Record<GateId, { label: MessageKey; target: MessageKey | string }> = {
  grounding: { label: "howpage.g.grounding", target: "100%" },
  unsafe_advice: { label: "howpage.g.unsafe", target: "0" },
  safety_recall: { label: "howpage.g.escalation", target: "100%" },
  retrieval_hit_at_3: { label: "howpage.g.retrieval", target: "≥ 80%" },
  evidence_resolvability: { label: "howpage.g.evidence", target: "100%" },
  needs_human_rate: { label: "howpage.g.needs_human", target: "howpage.t.reported" },
  latency: { label: "howpage.g.latency", target: "p50 < 10 s · p95 < 18 s" },
  cost_per_question: { label: "howpage.g.cost", target: "howpage.t.cost" },
};

export default function Page() {
  return (
    <div className="paper-grain min-h-dvh bg-dusk-gradient">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 pt-6 pb-20 sm:px-8 [&_h2[id]]:scroll-mt-24">
        {/* Hanate keeps the hero company (beside the title on a phone, after the lead on a laptop);
            a phone reads the lead in its own language. */}
        <div className="flex items-start gap-4 lg:items-center lg:gap-10">
          <div className="max-w-3xl min-w-0">
            <h1 className="text-[34px] leading-tight font-bold sm:text-[44px]">
              <Bi k="howpage.title" subClassName="font-sans text-xl font-semibold" />
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-ink-3">
              <Bi k="howpage.sub" subClassName="text-base max-sm:hidden" />
            </p>
          </div>
          <Hanate
            state="thinking"
            size={120}
            label=""
            className="shrink-0 max-lg:order-first max-lg:h-[75px] max-lg:w-[64px]"
          />
        </div>

        {/* An evaluator jumps straight to the part they came for. */}
        <SectionNav
          label={<Bi k="howpage.nav" sub={false} />}
          items={NAV.map(([id, k]) => ({ id, label: <Bi k={k} sub={false} /> }))}
        />
        <Suspense fallback={<SkeletonCard className="mt-8" lines={6} />}>
          <Live />
        </Suspense>

        <section aria-labelledby="layers" className="mt-10">
          <h2 id="layers" className="text-[26px] font-bold">
            <Bi k="howpage.layers" sub={false} />
          </h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-2">
            {LAYERS.map((l, i) => {
              const Icon = l.icon;
              return (
                <li
                  key={l.title}
                  className="rounded-card border border-border bg-paper p-5 shadow-warm-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-chip bg-flame font-display text-lg font-extrabold text-ink">
                      {i + 1}
                    </span>
                    <Icon className="size-6 text-clay" aria-hidden />
                    <h3 className="text-[20px] leading-snug font-bold">
                      <Bi k={l.title} subClassName="font-sans text-[15px] font-semibold" />
                    </h3>
                  </div>
                  <p className="mt-3 text-base text-ink-3">
                    <Bi k={l.body} subClassName="text-[15px]" />
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="models">
                    {[...new Set(l.models)].map((m) => (
                      <li
                        key={m}
                        className="rounded-chip bg-cream px-3 py-1 font-mono text-[14px] text-ink-2"
                      >
                        {m}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>

        <Suspense fallback={<SkeletonCard className="mt-12" lines={5} />}>
          <FieldTest />
        </Suspense>

        <section aria-labelledby="evals" className="mt-12">
          <h2 id="evals" className="text-[26px] font-bold">
            <Bi k="howpage.evals" sub={false} />
          </h2>
          <p className="mt-2 text-[15px] text-ink-3">
            <BiText
              text={RECORDED > 0 ? "howpage.evals.asof" : "howpage.evals.asof.none"}
              vars={{ date: EVALS.date }}
              sub={false}
            />
          </p>
          {/* Two columns on a laptop, so the gates fill the width and scan in one look. */}
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-card border border-border bg-paper lg:grid lg:grid-cols-2 lg:divide-y-0">
            {EVALS.gates.map((g) => (
              <EvalGate key={g.id} gate={g} />
            ))}
          </ul>
        </section>

        <CostBlock />

        <section
          aria-labelledby="offline"
          className="mt-12 rounded-card bg-ink p-6 text-white shadow-warm-lg sm:p-8"
        >
          <h2 id="offline" className="text-[26px] font-bold text-flame">
            <Bi k="howpage.offline" subClassName="font-sans text-base font-semibold text-mist" />
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {(["howpage.o1", "howpage.o2", "howpage.o3", "howpage.o4"] as const).map((k) => (
              <li key={k} className="rounded-button bg-ink-2 px-4 py-3 text-base">
                <Bi k={k} subClassName="text-[14px] text-mist" />
              </li>
            ))}
          </ul>
          {/* The measured numbers, as docs/evals/network.md recorded them (lib/how/network.ts). */}
          <p data-network-measured className="mt-5 max-w-3xl text-base text-white">
            <BiText text={networkLine()} subClassName="text-[14px] text-mist" />
          </p>
          <a
            href={NETWORK_SOURCE_URL}
            className="mt-2 inline-flex min-h-12 items-center gap-1.5 text-base font-semibold text-flame underline underline-offset-4"
          >
            <Bi k="howpage.o.source" sub={false} />
            <span className="font-mono text-[14px]">docs/evals/network.md</span>
          </a>
        </section>

        <section aria-labelledby="open" className="mt-12">
          <h2 id="open" className="text-[26px] font-bold">
            <Bi k="howpage.open" sub={false} />
          </h2>
          <p className="mt-2 max-w-2xl text-lg text-ink-3">
            <Bi k="howpage.open.body" subClassName="text-base" />
          </p>
          <p className="mt-3 flex flex-wrap gap-3 text-base font-semibold">
            <Link
              className="inline-flex min-h-12 items-center text-clay-cta underline underline-offset-4"
              href="/api/open/cards"
            >
              /api/open/cards
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}

/** The bad network sentence, in both languages, with the numbers from docs/evals/network.md. */
function networkLine(): { kn: string; en: string } {
  const day = dayOf(NETWORK_MEASURED.date);
  const line = (lang: "kn" | "en") =>
    fill(messages[lang]["howpage.o.measured"], {
      date: day[lang],
      cold: NETWORK_MEASURED.coldFirstPaint,
      warm: NETWORK_MEASURED.warmFirstPaint,
      answer: NETWORK_MEASURED.sampleAnswer,
    });
  return { kn: line("kn"), en: line("en") };
}

const PAGE = 1_000;

/**
 * Every row of a read, a page at a time: the database API returns at most 1,000 rows per request,
 * so one query would quietly undercount (ai/spend.ts pages for the same reason).
 */
async function allRows<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let page = 0; page < 200; page++) {
    const { data, error } = await read(page * PAGE, page * PAGE + PAGE - 1);
    if (error) return null;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function usd(n: number): string {
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`;
}

async function Live() {
  const db = createAdminClient();
  // No database (fixture mode): no numbers to show, but the trace drawer's Sample answer, labelled.
  if (!db) return <SampleTrace />;
  const [counts, answers, spend, showcase, field] = await Promise.all([
    db.from("v_library_counts").select("is_sample, approved_cards"),
    allRows<{ is_sample: boolean; cost_usd: number | null; latency_ms: number | null }>(
      (from, to) =>
        db
          .from("answers")
          .select("is_sample, cost_usd, latency_ms")
          .eq("status", "answered")
          .eq("replayed", false)
          .order("id")
          .range(from, to),
    ),
    allRows<{ cost_usd: number | null }>((from, to) =>
      db.from("ai_calls").select("cost_usd").gt("cost_usd", 0).order("id").range(from, to),
    ),
    loadShowcase(db as AdminClient),
    loadFieldSummary(db as AdminClient),
  ]);
  const cardsBy = (sample: boolean) =>
    (counts.data ?? []).find((c) => c.is_sample === sample)?.approved_cards ?? 0;
  const rows = answers ?? [];
  // One privacy rule everywhere (lib/field/summary.ts): field answers, and what they cost and
  // took, stay private while fewer than 5 different teachers asked. Unread counts stay private.
  const fieldPrivate = !field || field.questions.hidden;
  const stat = (sample: boolean) => {
    const r = rows.filter((a) => a.is_sample === sample);
    const n = r.length;
    return {
      n,
      cost: n ? r.reduce((s, a) => s + Number(a.cost_usd ?? 0), 0) / n : null,
      latency: n ? r.reduce((s, a) => s + Number(a.latency_ms ?? 0), 0) / n : null,
    };
  };
  const totalSpend = spend ? spend.reduce((s, c) => s + Number(c.cost_usd ?? 0), 0) : null;

  return (
    <>
      <section aria-labelledby="numbers" className="mt-12">
        <h2 id="numbers" className="text-[26px] font-bold">
          <Bi k="howpage.numbers" sub={false} />
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {([false, true] as const).map((sample) => {
            const s = stat(sample);
            const hidden = !sample && fieldPrivate;
            return (
              <div
                key={String(sample)}
                className="rounded-card border border-border bg-paper p-5 shadow-warm-sm"
              >
                {sample ? <SampleBadge /> : <FieldBadge />}
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Num label="howpage.n.cards" value={String(cardsBy(sample))} />
                  <Num label="howpage.n.answers" value={String(s.n)} hidden={hidden} />
                  <Num
                    label="howpage.n.cost"
                    value={
                      s.cost === null
                        ? null
                        : `${usd(s.cost)} · ₹${(s.cost * INR_PER_USD).toFixed(2)}`
                    }
                    hidden={hidden}
                  />
                  <Num
                    label="howpage.n.latency"
                    value={s.latency === null ? null : `${(s.latency / 1000).toFixed(1)} s`}
                    hidden={hidden}
                  />
                </dl>
                {hidden && (
                  <p className="mt-3 text-[14px] text-ink-3">
                    <Bi k="howpage.n.privateNote" sub={false} />
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {totalSpend !== null && (
          <p data-total-spend className="mt-3 text-[15px] text-ink-3">
            <Bi k="howpage.n.spend" sub={false} className="inline" />:{" "}
            <span className="font-semibold text-ink tabular-nums">
              {usd(totalSpend)} · ₹{(totalSpend * INR_PER_USD).toFixed(2)}
            </span>
            , <BiText text="howpage.rate" vars={{ rate: INR_PER_USD }} sub={false} inline />
          </p>
        )}
      </section>

      {showcase ? <ShowcaseTrace showcase={showcase} /> : <SampleTrace />}
    </>
  );
}

/** One real shipped answer: its trace, and the card it cites with the seconds behind each step. */
function ShowcaseTrace({ showcase }: { showcase: Showcase }) {
  const { trace, cards, field } = showcase;
  const lead = cards[0]?.master;
  return (
    <section aria-labelledby="trace" className="mt-12" data-showcase={field ? "field" : "sample"}>
      <h2 id="trace" className="flex flex-wrap items-center gap-3 text-[26px] font-bold">
        <Bi k="howpage.trace" sub={false} />
        <SampleBadge />
        {field && <FieldBadge />}
      </h2>
      <p className="mt-1 max-w-prose text-[15px] text-ink-3">
        {field && lead ? (
          <BiText
            text={{
              kn: fill(messages.kn["howpage.trace.field"], { master: lead.kn }),
              en: fill(messages.en["howpage.trace.field"], { master: lead.en }),
            }}
            sub={false}
          />
        ) : (
          <Bi k="howpage.trace.note" sub={false} />
        )}
      </p>
      {cards.length > 0 && (
        <div className="mt-4 rounded-card border border-border bg-paper p-5 shadow-warm-sm">
          <h3 className="text-[17px] font-bold text-ink">
            <Bi
              k={cards.length > 1 ? "howpage.trace.cardsMany" : "howpage.trace.cards"}
              sub={false}
            />
          </h3>
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {cards.map((c) => (
              <li key={c.id} data-cited-card className="rounded-[20px] bg-cream p-4">
                {c.isSample ? <SampleBadge /> : <FieldBadge />}
                <p className="mt-2 font-display text-[19px] leading-snug font-bold text-ink">
                  <BiText text={c.title} subClassName="font-sans text-[15px] font-medium" />
                </p>
                <p className="mt-1 text-[15px] text-ink-3">
                  {c.master ? (
                    <BiText
                      text={{
                        kn: fill(messages.kn["howpage.trace.by"], { master: c.master.kn }),
                        en: fill(messages.en["howpage.trace.by"], { master: c.master.en }),
                      }}
                      sub={false}
                    />
                  ) : (
                    <Bi k="howpage.trace.byAnon" sub={false} />
                  )}
                </p>
                {c.spans.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {c.spans.map((sp) => (
                      <li
                        key={sp.step}
                        className="rounded-chip bg-paper px-2.5 py-0.5 text-[14px] text-ink-2 tabular-nums"
                      >
                        <BiText
                          text="howpage.trace.span"
                          vars={{ n: sp.step, from: clock(sp.from), to: clock(sp.to) }}
                          sub={false}
                          inline
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <TraceWithVerdict trace={trace} />
    </section>
  );
}

/** The timeline, with its verdict beside it on a laptop: how much stands on approved practice. */
function TraceWithVerdict({ trace, sample = false }: { trace: Trace; sample?: boolean }) {
  const graded = trace.steps.some((s) => s.verdicts && s.verdicts.length > 0);
  const { kept, removed } = verdictCounts(trace.steps);
  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="rounded-card border border-border bg-paper p-5 shadow-warm-sm">
        <Timeline steps={trace.steps} />
      </div>
      <aside className="rounded-card bg-sage p-5 text-moss max-lg:order-first lg:sticky lg:top-24">
        {sample && <SampleBadge />}
        {graded && (
          <p className="mt-3 flex items-start gap-2 font-display text-[18px] leading-snug font-bold first:mt-0">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
            <BiText text="trace.summary" vars={{ kept, total: kept + removed }} sub={false} />
          </p>
        )}
        {removed > 0 && (
          <p className="mt-2 text-[15px] text-ink">
            <BiText text="trace.kept" vars={{ kept, removed }} sub={false} />
          </p>
        )}
        <p className="mt-3 text-[14px] font-semibold text-moss">
          <Bi k="howpage.trace.this" sub={false} />
        </p>
        <p className="font-display text-[22px] font-bold text-ink tabular-nums">
          {formatLatency(trace.totals.latencyMs)} · {formatUsd(trace.totals.costUsd)}
        </p>
      </aside>
    </div>
  );
}

function SampleTrace() {
  return (
    <section aria-labelledby="trace" className="mt-12">
      <h2 id="trace" className="flex flex-wrap items-center gap-3 text-[26px] font-bold">
        <Bi k="howpage.trace" sub={false} />
        <SampleBadge />
      </h2>
      <p className="mt-1 max-w-prose text-[15px] text-ink-3">
        <Bi k="howpage.trace.sample" sub={false} />
      </p>
      <TraceWithVerdict trace={SAMPLE_TRACE} sample />
    </section>
  );
}

function Num({
  label,
  value,
  hidden = false,
}: {
  label: MessageKey;
  value: string | null;
  /** Kept private by the field rule (fewer than 5 teachers): no number at all. */
  hidden?: boolean;
}) {
  return (
    <div>
      <dt className="text-[14px] text-ink-3">
        <Bi k={label} sub={false} />
      </dt>
      <dd className="mt-0.5 font-display text-[22px] font-bold tabular-nums">
        {hidden ? (
          <Bi k="howpage.n.private" sub={false} className="text-lg text-ink-3" />
        ) : (
          (value ?? <Bi k="howpage.n.none" sub={false} className="text-lg text-ink-3" />)
        )}
      </dd>
    </div>
  );
}

function EvalGate({ gate }: { gate: Gate }) {
  const copy = GATE_COPY[gate.id];
  const measured = gate.basis === "recorded";
  const target = copy.target.startsWith("howpage.") ? (
    <Bi k={copy.target as MessageKey} sub={false} className="inline" />
  ) : (
    copy.target
  );
  return (
    <li
      className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:gap-4 lg:border-t lg:border-border lg:odd:border-r lg:[&:nth-child(-n+2)]:border-t-0"
      data-gate={gate.id}
    >
      <div className="min-w-0 flex-1">
        <p className="text-base">
          <Bi k={copy.label} subClassName="text-[14px]" />
        </p>
        <p className="mt-1 text-[14px] text-ink-3">
          {measured ? (
            <BiText text="howpage.evals.rests" vars={{ n: gate.cases }} sub={false} />
          ) : gate.guardrails ? (
            <BiText
              text="howpage.evals.guard"
              vars={{ held: gate.guardrails.held, cases: gate.guardrails.cases }}
              sub={false}
            />
          ) : null}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1 sm:shrink-0 sm:items-end sm:text-right">
        {measured ? (
          <span className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="font-display text-lg font-bold whitespace-nowrap tabular-nums">
              {gate.display}
            </span>
            {gate.pass !== null && (
              // Met or not, at a glance: a moss tick or a clay mark beside the number.
              <span
                className={
                  gate.pass
                    ? "inline-flex items-center gap-1 rounded-chip bg-sage px-2.5 py-0.5 text-[14px] font-semibold text-moss"
                    : "inline-flex items-center gap-1 rounded-chip bg-flame/25 px-2.5 py-0.5 text-[14px] font-semibold text-clay-cta"
                }
              >
                {gate.pass ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <X className="size-4" aria-hidden />
                )}
                <Bi
                  k={gate.pass ? "howpage.evals.pass" : "howpage.evals.fail"}
                  sub={false}
                  className="inline"
                />
              </span>
            )}
          </span>
        ) : (
          <span className="rounded-chip bg-cream px-3 py-1 text-sm font-semibold text-ink-3">
            <Bi k="howpage.evals.none" sub={false} />
          </span>
        )}
        <span className="text-[14px] text-ink-3">
          {copy.target === "howpage.t.reported" ? (
            target
          ) : (
            <>
              <Bi k="howpage.evals.target" sub={false} className="inline" /> {target}
            </>
          )}
        </span>
      </div>
    </li>
  );
}
