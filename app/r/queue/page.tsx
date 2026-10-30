// The human queue. Who: a reviewer. One job: see what teachers asked that no checked card could
// answer (and every child safety case first), and mark it handled. Feeling: nothing falls through.
// Teachers stay anonymous here: only the redacted question text is shown (Law 6).
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { Suspense } from "react";
import { ArrowLeft, BookOpenCheck, Check, ShieldAlert } from "lucide-react";
import { SubmitButton } from "@/components/parampara/SubmitButton";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { FieldBadge, SampleBadge } from "@/components/parampara/Badges";
import { EmptyState } from "@/components/parampara/EmptyState";
import { SkeletonCard } from "@/components/parampara/Skeleton";
import Link from "next/link";
import { SessionBar } from "@/components/parampara/SessionBar";
import { BiText } from "@/components/parampara/BiText";
import { QueueNote } from "@/components/review/QueueNote";
import { FLN_TOPIC_LABELS, type FlnTopic } from "@/lib/domain/fln";
import { getSessionFor } from "@/lib/auth/session";
import { type MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { isFixtureMode } from "@/lib/env";
import { groupQueue, queueCounts } from "@/lib/review/queue-groups";
import { fixtureQueue, loadQueue, type QueueRow, type QueueText } from "@/lib/review/queue-store";
import { fixtureCardChoices, loadCardChoices, type CardChoice } from "@/lib/review/queue-cards";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerWithCard } from "./actions";

export const metadata: Metadata = { title: "Questions for an elder", robots: { index: false } };

const REASON: Record<string, MessageKey> = {
  no_card: "queue.reason.no_card",
  unsupported: "queue.reason.unsupported",
  safety: "queue.reason.safety",
};

async function resolve(form: FormData) {
  "use server";
  // One item can stand for several Sample copies of the same question (D98): handle them all.
  const ids = form
    .getAll("id")
    .map(String)
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 500);
  const note = String(form.get("note") ?? "").slice(0, 400) || null;
  const session = await getSessionFor("reviewer");
  const db = await createClient();
  if (!session || !db || ids.length === 0) return;
  // RLS decides: reviewers only, and a demo reviewer only on sample rows (0003, D38).
  await db
    .from("human_queue")
    .update({
      status: "resolved",
      resolution_note: note,
      resolved_at: new Date().toISOString(),
      assignee: session.userId,
    })
    .in("id", ids);
  revalidatePath("/r/queue");
  revalidatePath("/r");
}

export default function Page({ searchParams }: PageProps<"/r/queue">) {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <SessionBar home="/r" />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-4 pb-16 sm:px-8">
        <div>
          <Link
            href="/r"
            className="inline-flex min-h-12 items-center gap-2 rounded-button pr-3 font-display text-lg font-bold text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="size-5" aria-hidden />
            <Bi k="room.reviewer" sub={false} />
          </Link>
          <h1 className="mt-2 text-[30px] leading-tight font-bold sm:text-[36px]">
            <Bi k="queue.title" subClassName="font-sans text-lg font-semibold" />
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-3">
            <Bi k="queue.sub" subClassName="text-base max-sm:hidden" />
          </p>
          <Suspense fallback={<SkeletonCard className="mt-8" />}>
            <Queue searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function Queue({ searchParams }: Pick<PageProps<"/r/queue">, "searchParams">) {
  const [session, query] = await Promise.all([getSessionFor("reviewer"), searchParams]);
  const db = await createClient();
  const fixture = Boolean(session) && isFixtureMode();
  if (!session || (!db && !fixture)) {
    return (
      <EmptyState
        className="mt-10"
        hanate="caring"
        title="review.sign_in"
        action={{ label: "room.back", href: "/#doors" }}
      />
    );
  }
  // Fixture mode (no keys): Sample questions, so the queue can be seen and tested.
  const { rows, text } = fixture || !db ? fixtureQueue() : await loadQueue(db, session.isSample);
  // The approved cards a waiting question can be answered with, per pool (D64, D83).
  const admin = fixture ? null : createAdminClient();
  const choices = admin
    ? await loadCardChoices(admin).catch(() => ({ field: [], all: [] }))
    : { field: [], all: fixtureCardChoices() };
  return (
    <>
      {query.e === "answer" && (
        <p
          role="alert"
          className="mt-6 rounded-card border border-border bg-paper p-4 text-base shadow-warm-sm"
        >
          <Bi k="queue.answer.error" sub={false} />
        </p>
      )}
      <QueueList
        rows={rows}
        text={text}
        choices={choices}
        sent={typeof query.sent === "string" ? query.sent : null}
      />
    </>
  );
}

function QueueList({
  rows,
  text,
  choices,
  sent,
}: {
  rows: QueueRow[];
  text: QueueText;
  choices: { field: CardChoice[]; all: CardChoice[] };
  /** The row just answered with a card, to say so beside it. */
  sent: string | null;
}) {
  const items = groupQueue(rows, (q) => text.get(q)?.text_redacted, new Date());
  if (!items.length) {
    return (
      <EmptyState
        className="mt-10"
        size="page"
        title="queue.empty.title"
        body="queue.empty.body"
        hanate="happy"
      />
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <ul className="space-y-3">
        {items.map((item) => {
          const r = item.row;
          const question = text.get(r.question_id);
          const open = r.status !== "resolved";
          return (
            <li
              key={r.id}
              id={`q-${r.id}`}
              data-queue-row={r.reason}
              className={cn(
                "scroll-mt-6 rounded-card border p-5 shadow-warm-sm",
                item.urgentNow ? "border-clay shadow-flame" : "border-border",
                open ? "bg-paper" : "bg-sage/40 shadow-none",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                {item.urgentNow && (
                  <span className="inline-flex items-center gap-1.5 rounded-chip bg-ink px-3 py-1 text-sm font-semibold text-flame">
                    <ShieldAlert className="size-4" aria-hidden />
                    <Bi k="queue.urgent" sub={false} />
                  </span>
                )}
                <span className="rounded-chip bg-cream px-3 py-1 text-sm font-semibold text-ink-3">
                  <Bi k={REASON[r.reason] ?? "queue.reason.no_card"} sub={false} />
                </span>
                {question?.topic && question.topic in FLN_TOPIC_LABELS && (
                  <span className="rounded-chip bg-sage px-3 py-1 text-sm font-semibold text-ink">
                    <BiText
                      text={FLN_TOPIC_LABELS[question.topic as FlnTopic]}
                      sub={false}
                      inline
                    />
                    {question.grade_band && (
                      <>
                        {" · "}
                        <BiText
                          text="queue.grade"
                          vars={{ g: question.grade_band }}
                          sub={false}
                          inline
                        />
                      </>
                    )}
                  </span>
                )}
                {r.is_sample ? <SampleBadge /> : <FieldBadge />}
                {item.count > 1 && (
                  <span
                    className="rounded-chip bg-flame/30 px-3 py-1 text-sm font-semibold text-ink tabular-nums"
                    data-testid="queue-asked-times"
                  >
                    <BiText text="queue.asked_times" vars={{ n: item.count }} sub={false} inline />
                  </span>
                )}
                <span className="ml-auto text-sm text-ink-3 tabular-nums">
                  {/* The day only: a time to the minute could identify who asked (Law 6). For a
                      merged Sample item, the day it was last asked. */}
                  <span data-lang-mode="kn" lang="kn">
                    {new Date(r.created_at).toLocaleDateString("kn-IN", {
                      dateStyle: "medium",
                    })}
                  </span>
                  <span data-lang-mode="en" lang="en">
                    {new Date(r.created_at).toLocaleDateString("en-IN", {
                      dateStyle: "medium",
                    })}
                  </span>
                </span>
              </div>
              <p className="mt-3 max-w-[70ch] text-lg leading-[1.65]">
                {question?.text_redacted ?? "…"}
              </p>
              {question?.text_en && (
                <p lang="en" className="mt-1 max-w-[70ch] text-[16px] text-ink-3">
                  {question.text_en}
                </p>
              )}
              {r.reason === "safety" && (
                <p className="mt-2 text-[15px] text-ink-3">
                  <Bi k="queue.safety_hint" sub={false} />
                </p>
              )}
              {r.reason === "no_card" && open && (
                <p className="mt-2 text-[15px] text-ink-3">
                  <Bi k="queue.gap_hint" sub={false} />
                </p>
              )}
              {r.reason === "no_card" && open && (
                <AnswerWithCard
                  rowId={r.id}
                  also={item.ids.filter((id) => id !== r.id)}
                  choices={r.is_sample ? choices.all : choices.field}
                />
              )}
              {open ? (
                <>
                  <form
                    action={resolve}
                    className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
                  >
                    {item.ids.map((id) => (
                      <input key={id} type="hidden" name="id" value={id} />
                    ))}
                    <QueueNote />
                    <Button type="submit" variant="paper">
                      <Bi k="queue.resolve" sub={false} />
                    </Button>
                  </form>
                  {item.count > 1 && (
                    <p className="mt-2 text-[15px] text-ink-3">
                      <BiText text="queue.closes_all" vars={{ n: item.count }} sub={false} inline />
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-3 text-[15px]" role={sent === r.id ? "status" : undefined}>
                  <p className="inline-flex items-center gap-1.5 font-semibold text-moss">
                    <Check className="size-4.5" aria-hidden />
                    <Bi k={sent === r.id ? "queue.answer.sent" : "queue.resolved"} sub={false} />
                  </p>
                  {r.resolution_note && <p className="mt-1 text-ink-3">{r.resolution_note}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <QueueAside
        waiting={queueCounts(items).open}
        handled={items.filter((i) => i.row.status === "resolved").length}
      />
    </div>
  );
}

/**
 * A question no card answered can be answered here (D83): pick an approved card from the right
 * pool and it becomes her answer, word for word. With none yet, the two ways to make one.
 */
function AnswerWithCard({
  rowId,
  also,
  choices,
}: {
  rowId: string;
  /** The other copies of the same Sample question (D98). */
  also: string[];
  choices: CardChoice[];
}) {
  return (
    <details
      className="group mt-4 rounded-button border border-border bg-cream/60 px-4 py-1"
      data-testid="answer-with-card"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-display text-[16px] font-bold text-clay-cta [&::-webkit-details-marker]:hidden">
        <BookOpenCheck className="size-5" aria-hidden />
        <Bi k="queue.answer.title" sub={false} />
      </summary>
      <div className="pb-4">
        <p className="text-[15px] text-ink-3">
          <Bi k={choices.length ? "queue.answer.body" : "queue.answer.none"} sub={false} />
        </p>
        {choices.length > 0 && (
          <form
            action={answerWithCard}
            className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="id" value={rowId} />
            {also.map((id) => (
              <input key={id} type="hidden" name="also" value={id} />
            ))}
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[15px] font-semibold text-ink">
              <Bi k="queue.answer.pick" sub={false} />
              <select
                name="card"
                required
                className="h-12 w-full min-w-0 rounded-button border border-input bg-paper px-3 text-base text-ink shadow-warm-sm outline-none focus-visible:border-clay"
              >
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.title.kn} · ${c.title.en}${c.isSample ? " (Sample)" : ""}`}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton pendingLabel="tried.sending" className="sm:w-auto">
              <Bi k="queue.answer.send" sub={false} />
            </SubmitButton>
          </form>
        )}
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          <Link
            href="/r/cards"
            className="inline-flex min-h-11 items-center font-display text-[15px] font-bold text-clay-cta underline decoration-clay/40 underline-offset-4 hover:text-ink"
          >
            <Bi k="queue.answer.drafts" sub={false} />
          </Link>
          <Link
            href="/m/import"
            className="inline-flex min-h-11 items-center font-display text-[15px] font-bold text-clay-cta underline decoration-clay/40 underline-offset-4 hover:text-ink"
          >
            <Bi k="queue.answer.record" sub={false} />
          </Link>
        </p>
      </div>
    </details>
  );
}

/** Beside the list on a laptop: how many wait, how many are done, and what they are for. */
function QueueAside({ waiting, handled }: { waiting: number; handled: number }) {
  return (
    // On a phone only the two counts, first, as chips; the card with its note on a laptop.
    <aside className="order-first lg:sticky lg:top-6 lg:order-none lg:rounded-card lg:border lg:border-border lg:bg-paper/80 lg:p-5 lg:shadow-warm-sm">
      <h2 className="hidden font-display text-[18px] font-bold lg:block">
        <Bi k="queue.aside.title" sub={false} />
      </h2>
      <p className="flex flex-wrap gap-2 lg:mt-3">
        <span className="rounded-chip bg-flame/30 px-3 py-1 font-display text-[15px] font-bold tabular-nums">
          <BiText text="rhub.waiting" vars={{ n: waiting }} sub={false} inline />
        </span>
        <span className="rounded-chip bg-sage px-3 py-1 font-display text-[15px] font-bold text-moss tabular-nums">
          <BiText text="queue.aside.handled" vars={{ n: handled }} sub={false} inline />
        </span>
      </p>
      <p className="mt-3 hidden text-[15px] leading-snug text-ink-3 lg:block">
        <Bi k="queue.aside.body" sub={false} />
      </p>
      <Link
        href="/m/import"
        className="mt-3 hidden min-h-12 items-center gap-2 rounded-button font-display text-[15px] font-bold text-clay-cta underline decoration-clay/40 underline-offset-4 hover:text-ink lg:inline-flex"
      >
        <Bi k="rhub.import" sub={false} />
      </Link>
    </aside>
  );
}
