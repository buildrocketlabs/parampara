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
import { DEMO_ACCOUNTS } from "@/lib/auth/roles";
import type { MessageKey } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
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

/**
 * The trace shown to anonymous visitors comes only from the seeded demo teacher's own questions:
 * never from anyone who joined by invite, even a Sample one (safety audit re check, 24 Oct).
 */
async function latestDemoTrace(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
): Promise<Trace | null> {
  const { data: demo } = await db
    .from("profiles")
    .select("id")
    .eq("role", "teacher")
    .eq("is_sample", true)
    .eq("display_name", DEMO_ACCOUNTS.teacher.displayName)
    .maybeSingle();
  if (!demo) return null;
  const { data: qs } = await db
    .from("questions")
    .select("id")
    .eq("teacher_id", demo.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const ids = (qs ?? []).map((q) => q.id as string);
  if (ids.length === 0) return null;
  const { data } = await db
    .from("answers")
    .select("trace")
    .in("question_id", ids)
    .eq("status", "answered")
    .eq("replayed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.trace as Trace | null) ?? null;
}

function usd(n: number): string {
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`;
}

async function Live() {
  const db = createAdminClient();
  // No database (fixture mode): no numbers to show, but the trace drawer's Sample answer, labelled.
  if (!db) return <SampleTrace />;
  const [counts, answers, spend, latest] = await Promise.all([
    db.from("v_library_counts").select("is_sample, approved_cards"),
    db
      .from("answers")
      .select("is_sample, cost_usd, latency_ms")
      .eq("status", "answered")
      .eq("replayed", false)
      .limit(5000),
    db.from("ai_calls").select("cost_usd").limit(100000),
    latestDemoTrace(db),
  ]);
  const cardsBy = (sample: boolean) =>
    (counts.data ?? []).find((c) => c.is_sample === sample)?.approved_cards ?? 0;
  const rows = answers.data ?? [];
  const stat = (sample: boolean) => {
    const r = rows.filter((a) => a.is_sample === sample);
    const n = r.length;
    return {
      n,
      cost: n ? r.reduce((s, a) => s + Number(a.cost_usd ?? 0), 0) / n : null,
      latency: n ? r.reduce((s, a) => s + Number(a.latency_ms ?? 0), 0) / n : null,
    };
  };
  const totalSpend = (spend.data ?? []).reduce((s, c) => s + Number(c.cost_usd ?? 0), 0);
  const trace = latest;

  return (
    <>
      <section aria-labelledby="numbers" className="mt-12">
        <h2 id="numbers" className="text-[26px] font-bold">
          <Bi k="howpage.numbers" sub={false} />
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {([false, true] as const).map((sample) => {
            const s = stat(sample);
            return (
              <div
                key={String(sample)}
                className="rounded-card border border-border bg-paper p-5 shadow-warm-sm"
              >
                {sample ? <SampleBadge /> : <FieldBadge />}
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Num label="howpage.n.cards" value={String(cardsBy(sample))} />
                  <Num label="howpage.n.answers" value={String(s.n)} />
                  <Num
                    label="howpage.n.cost"
                    value={
                      s.cost === null
                        ? null
                        : `${usd(s.cost)} · ₹${(s.cost * INR_PER_USD).toFixed(2)}`
                    }
                  />
                  <Num
                    label="howpage.n.latency"
                    value={s.latency === null ? null : `${(s.latency / 1000).toFixed(1)} s`}
                  />
                </dl>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[15px] text-ink-3">
          <Bi k="howpage.n.spend" sub={false} className="inline" />: {usd(totalSpend)} ·{" "}
          <BiText text="howpage.rate" vars={{ rate: INR_PER_USD }} sub={false} inline />
        </p>
      </section>

      <section aria-labelledby="trace" className="mt-12">
        <h2 id="trace" className="text-[26px] font-bold">
          <Bi k="howpage.trace" sub={false} />
        </h2>
        <p className="mt-1 text-[15px] text-ink-3">
          <Bi k={trace ? "howpage.trace.note" : "howpage.trace.none"} sub={false} />
        </p>
        {trace && <TraceWithVerdict trace={trace} />}
      </section>
    </>
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
        <p className="mt-3 font-display text-[22px] font-bold text-ink tabular-nums">
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

function Num({ label, value }: { label: MessageKey; value: string | null }) {
  return (
    <div>
      <dt className="text-[14px] text-ink-3">
        <Bi k={label} sub={false} />
      </dt>
      <dd className="mt-0.5 font-display text-[22px] font-bold tabular-nums">
        {value ?? <Bi k="howpage.n.none" sub={false} className="text-lg text-ink-3" />}
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
          <Bi k="howpage.evals.target" sub={false} className="inline" /> {target}
        </span>
      </div>
    </li>
  );
}
