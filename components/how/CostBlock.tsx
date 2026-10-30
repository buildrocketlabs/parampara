import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { messages } from "@/lib/i18n/messages";
import { fill } from "@/lib/i18n/fill";
import type { Vars } from "@/lib/i18n/fill";
import { dayOf } from "@/lib/insights/format";
import { about, ASSUMED, costModel, HOSTING, rupees, type CostModel } from "@/lib/costs/model";

// "What it costs" on /how. Who: a juror or the Tech4Dev evaluator scoring the roadmap. One job:
// about how many rupees per teacher a month, and who would pay; then how we got there. Every figure
// is worked out at build time (lib/costs/model.ts). A figure that rests on an assumption is shown
// rounded ("About ₹33") with a dashed Assumption chip; only the breakdown carries paise.

const n = (x: number) => x.toLocaleString("en-IN");

export function CostBlock({ model = costModel() }: { model?: CostModel | null }) {
  return (
    <section aria-labelledby="cost" className="mt-12" data-cost-block>
      <h2 id="cost" className="text-[26px] font-bold">
        <Bi k="howpage.cost.title" subClassName="font-sans text-base font-semibold" />
      </h2>
      {model ? (
        <Costs m={model} />
      ) : (
        <>
          <div
            data-cost-none
            className="mt-5 flex items-center gap-4 rounded-[20px] bg-cream px-5 py-5 text-lg text-ink-3"
          >
            <Hanate state="idle" size={56} label="" className="shrink-0" />
            <p>
              <Bi k="howpage.cost.none" subClassName="text-base" />
            </p>
          </div>
          <Payer />
        </>
      )}
    </section>
  );
}

function Costs({ m }: { m: CostModel }) {
  const at = dayOf(`${m.evalDate}T12:00:00+05:30`);
  const teacher = rupees(about(m.perTeacherMonthInr, 1));
  const hosting = rupees(about(m.hostingPerTeacherInr, 1));
  const scale = n(ASSUMED.teachersAtScale);
  return (
    <>
      <p className="mt-3 max-w-3xl text-[22px] leading-snug font-semibold text-ink" data-cost-lead>
        <BiText
          text={msg("howpage.cost.lead", { teacher, hosting, n: scale })}
          subClassName="text-[17px] font-normal text-ink-3"
        />
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="rounded-card border border-border bg-paper p-5 shadow-warm-sm sm:p-6">
          <dl>
            <div data-cost-teacher>
              <dt className="flex items-start justify-between gap-3">
                <span className="flex flex-wrap items-center gap-2 text-[17px] font-semibold text-ink">
                  <Bi k="howpage.cost.teacher" sub={false} />
                  <AssumptionChip />
                </span>
                <Hanate state="happy" size={52} label="" className="-mt-2 shrink-0" />
              </dt>
              <dd className="mt-1 font-display text-[40px] leading-none font-extrabold text-ink tabular-nums sm:text-[48px]">
                <BiText text={msg("howpage.cost.about", { v: teacher })} sub={false} />
              </dd>
              <dd className="mt-2 text-[15px] text-ink-3">
                <BiText
                  text={msg("howpage.cost.teacher.at", { q: ASSUMED.questionsPerTeacherMonth })}
                  sub={false}
                />
              </dd>
            </div>
            <div className="mt-5 rounded-[20px] bg-cream p-4" data-cost-scale>
              <dt className="text-[15px] text-ink-3">
                <BiText text={msg("howpage.cost.scale", { n: scale })} sub={false} />
              </dt>
              <dd className="mt-1 font-display text-[30px] leading-none font-extrabold text-ink tabular-nums">
                <BiText
                  text={msg("howpage.cost.about", { v: rupees(about(m.atScaleMonthInr, 100)) })}
                  sub={false}
                />
              </dd>
            </div>
          </dl>
          <h3 className="mt-5 flex flex-wrap items-center gap-2 text-[16px] font-semibold text-ink">
            <Bi k="howpage.cost.hosting" sub={false} />
          </h3>
          <ul className="mt-1 space-y-1.5 text-[15px] text-ink-3" data-cost-hosting>
            <li>
              <BiText
                text={msg("howpage.cost.hosting.now", { plans: HOSTING.today.plans })}
                sub={false}
              />
            </li>
            <li>
              <BiText
                text={msg("howpage.cost.hosting.next", {
                  plans: HOSTING.next.map((h) => `${h.plan} $${h.usdMonth}`).join(" + "),
                  usd: `$${m.hostingNextUsd}`,
                  inr: rupees(m.hostingNextInr),
                  per: hosting,
                  n: scale,
                })}
                sub={false}
              />
              <AssumptionChip className="mt-1.5" />
            </li>
          </ul>
        </div>

        <div className="rounded-card border border-border bg-paper p-5 shadow-warm-sm sm:p-6">
          <h3 className="text-[20px] leading-snug font-bold text-ink">
            <Bi k="howpage.cost.q" subClassName="font-sans text-[15px] font-semibold" />
          </h3>
          <dl className="mt-3 divide-y divide-border" data-cost-question>
            <Line
              label={msg("howpage.cost.model", {})}
              note={{
                kn: fill(messages.kn["howpage.cost.measured"], { date: at.kn, n: m.evalCases }),
                en: fill(messages.en["howpage.cost.measured"], { date: at.en, n: m.evalCases }),
              }}
              value={rupees(m.perQuestion.modelInr)}
              aside={`$${m.perQuestion.modelUsd.toFixed(4)}`}
              chip={<MeasuredChip />}
            />
            <Line
              label={msg("howpage.cost.listen", { s: ASSUMED.questionSeconds })}
              value={rupees(m.perQuestion.listenInr)}
              chip={<AssumptionChip />}
            />
            <Line
              label={msg("howpage.cost.speak", { c: ASSUMED.answerCharacters })}
              value={rupees(m.perQuestion.speakInr)}
              chip={<AssumptionChip />}
            />
            <div className="flex items-start justify-between gap-4 pt-3" data-cost-total>
              <dt className="text-[17px] font-bold text-ink">
                <Bi k="howpage.cost.total" sub={false} />
                <AssumptionChip label="howpage.cost.partly" className="mt-1.5" />
              </dt>
              <dd className="font-display text-[28px] font-extrabold text-ink tabular-nums">
                {rupees(m.perQuestion.totalInr)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <Payer />

      <p className="mt-4 max-w-3xl text-[15px] leading-[1.65] text-ink-3">
        <BiText
          text={msg("howpage.cost.assume", {
            q: ASSUMED.questionsPerTeacherMonth,
            s: ASSUMED.questionSeconds,
            c: ASSUMED.answerCharacters,
          })}
          subClassName="text-[14px]"
        />
      </p>
      <p className="mt-2 max-w-3xl text-[14px] text-ink-3">
        <BiText
          text={msg("howpage.cost.sources", {
            listen: m.models.listen,
            speak: m.models.speak,
            rate: m.rate,
          })}
          sub={false}
        />
      </p>
    </>
  );
}

function Payer() {
  return (
    <div className="mt-4 rounded-card bg-sage p-5 sm:p-6" data-cost-payer>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[19px] leading-snug font-bold text-ink">
          <Bi k="howpage.cost.payer" sub={false} />
        </h3>
        <span className="inline-flex h-7 items-center rounded-chip border border-dashed border-ink-3/60 px-2.5 font-display text-[14px] font-semibold text-ink-3">
          <Bi k="howpage.cost.plan" sub={false} />
        </span>
      </div>
      <p className="mt-2 max-w-3xl text-[17px] text-ink">
        <Bi k="howpage.cost.payer.body" subClassName="text-[15px] text-ink-3" />
      </p>
    </div>
  );
}

function Line({
  label,
  note,
  value,
  aside,
  chip,
}: {
  label: { kn: string; en: string };
  note?: { kn: string; en: string };
  value: string;
  aside?: string;
  chip?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="min-w-0 text-[17px] text-ink">
        <BiText text={label} sub={false} />
        {note && (
          <span className="mt-0.5 block text-[14px] text-ink-3">
            <BiText text={note} sub={false} />
          </span>
        )}
        {chip && <span className="mt-1.5 block">{chip}</span>}
      </dt>
      <dd className="shrink-0 text-right font-display text-[20px] font-bold text-ink tabular-nums">
        {value}
        {aside && (
          <span className="block font-sans text-[14px] font-normal text-ink-3">{aside}</span>
        )}
      </dd>
    </div>
  );
}

function AssumptionChip({
  className = "",
  label = "howpage.cost.assumption",
}: {
  className?: string;
  label?: "howpage.cost.assumption" | "howpage.cost.partly";
}) {
  return (
    <span
      data-assumption
      className={`inline-flex h-7 items-center rounded-chip border border-dashed border-ink-3/60 px-2.5 font-display text-[14px] font-semibold text-ink-3 ${className}`}
    >
      <Bi k={label} sub={false} />
    </span>
  );
}

function MeasuredChip() {
  return (
    <span
      data-measured
      className="inline-flex h-7 items-center rounded-chip bg-sage px-2.5 font-display text-[14px] font-semibold text-ink"
    >
      <Bi k="howpage.cost.measuredChip" sub={false} />
    </span>
  );
}

/** A message in both languages with the same vars (numbers, plan names). */
function msg(
  key:
    | "howpage.cost.lead"
    | "howpage.cost.about"
    | "howpage.cost.model"
    | "howpage.cost.listen"
    | "howpage.cost.speak"
    | "howpage.cost.teacher.at"
    | "howpage.cost.scale"
    | "howpage.cost.assume"
    | "howpage.cost.hosting.now"
    | "howpage.cost.hosting.next"
    | "howpage.cost.sources",
  vars: Vars,
): { kn: string; en: string } {
  return { kn: fill(messages.kn[key], vars), en: fill(messages.en[key], vars) };
}
