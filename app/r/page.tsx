// Reviewer's room. Who: a headmaster reviewer or the founder, on a laptop or phone. One job: see
// what is waiting (cards to check, questions for an elder, child safety first) and go to it.
// Feeling: accountable and calm; nothing reaches a teacher without them.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  ChevronRight,
  ClipboardCheck,
  HeartHandshake,
  Link2,
  MessageCircleQuestion,
  ShieldAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { RoomSoon } from "@/components/parampara/RoomSoon";
import { SessionBar } from "@/components/parampara/SessionBar";
import { SkeletonCard } from "@/components/parampara/Skeleton";
import { getSession } from "@/lib/auth/session";
import type { MessageKey } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { isFixtureMode } from "@/lib/env";
import { FIXTURE_DRAFTS } from "@/lib/review/fixture";
import { groupQueue, queueCounts } from "@/lib/review/queue-groups";
import { fixtureQueue, loadQueue } from "@/lib/review/queue-store";
import { listDrafts } from "@/lib/review/store";
import type { DraftSummary } from "@/lib/review/types";
import type { Session } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { FieldBadge, SampleBadge } from "@/components/parampara/Badges";
import { Hanate } from "@/components/parampara/hanate/Hanate";

export const metadata: Metadata = { title: "Reviewer" };

export default function Page() {
  return (
    <Suspense fallback={<SkeletonCard className="mx-auto mt-24 max-w-2xl" lines={4} />}>
      <Hub />
    </Suspense>
  );
}

type Counts = { drafts: number; open: number; urgentField: number; urgentSample: number };

/**
 * What waits, counted as the queue shows it (D98): Sample copies of one safety question are one
 * item, a Sample urgent item stops counting a day after it was asked, field urgent stays urgent.
 */
async function counts(isSample: boolean): Promise<Counts> {
  if (isFixtureMode()) {
    const { rows, text } = fixtureQueue();
    const q = queueCounts(groupQueue(rows, (id) => text.get(id)?.text_redacted, new Date()));
    return { drafts: FIXTURE_DRAFTS.length, ...q };
  }
  const db = await createClient();
  if (!db) return { drafts: 0, open: 0, urgentField: 0, urgentSample: 0 };
  // RLS decides what a reviewer may see; a demo reviewer is shown Sample work only (D38).
  let drafts = db.from("cards").select("id", { count: "exact", head: true }).eq("status", "draft");
  if (isSample) drafts = drafts.eq("is_sample", true);
  const [d, queue] = await Promise.all([
    drafts,
    loadQueue(db, isSample, { openOnly: true }).catch(() => null),
  ]);
  const q = queue
    ? queueCounts(groupQueue(queue.rows, (id) => queue.text.get(id)?.text_redacted, new Date()))
    : { open: 0, urgentField: 0, urgentSample: 0 };
  return { drafts: d.count ?? 0, ...q };
}

type CareMoment = {
  interviewId: string;
  part: number;
  startMs: number;
  care: "child" | "self" | "both";
  master: string | null;
  date: string;
};

/**
 * Answers in a live interview where the master spoke of a child in danger or of their own despair
 * (lib/talk/care.ts, D53): Hanate moved on and showed a helpline; a person should follow up.
 */
async function careMoments(isSample: boolean): Promise<CareMoment[]> {
  const db = await createClient();
  const admin = createAdminClient();
  if (!db || !admin) return [];
  let q = db
    .from("interviews")
    .select("id, master_id, parts, is_sample, created_at")
    .eq("source", "live")
    .order("created_at", { ascending: false })
    .limit(50);
  if (isSample) q = q.eq("is_sample", true);
  const { data } = await q;
  const found: Array<Omit<CareMoment, "master"> & { masterId: string }> = [];
  for (const iv of data ?? []) {
    ((iv.parts as Array<Record<string, unknown>> | null) ?? []).forEach((p, n) => {
      const care = p.care;
      if (care === "child" || care === "self" || care === "both") {
        found.push({
          interviewId: iv.id as string,
          part: n,
          startMs: Number(p.start_ms ?? 0),
          care,
          masterId: iv.master_id as string,
          date: iv.created_at as string,
        });
      }
    });
  }
  if (found.length === 0) return [];
  const { data: masters } = await admin
    .from("masters")
    .select("id, profiles!masters_profile_id_fkey(display_name)")
    .in("id", [...new Set(found.map((f) => f.masterId))]);
  const name = new Map(
    (masters ?? []).map((m) => {
      const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as
        { display_name: string | null } | undefined;
      return [m.id as string, p?.display_name ?? null];
    }),
  );
  return found
    .slice(0, 20)
    .map(({ masterId, ...f }) => ({ ...f, master: name.get(masterId) ?? null }));
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function Hub() {
  const session = await getSession();
  if (!session || session.role !== "reviewer" || !session.consentedAt)
    return <RoomSoon role="reviewer" />;
  const [c, care, next] = await Promise.all([
    counts(session.isSample),
    careMoments(session.isSample),
    nextDraft(session),
  ]);

  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <SessionBar home="/r" />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-16 sm:px-8">
        <div>
          <h1 className="text-[30px] leading-tight font-bold sm:text-[36px]">
            <Bi k="rhub.title" subClassName="font-sans text-lg font-semibold" />
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-3">
            <Bi k="rhub.sub" subClassName="text-base" />
          </p>

          {/* A real child safety case leads, always: field first, then Sample (D98). */}
          {c.urgentField > 0 && (
            <Link
              href="/r/queue"
              data-testid="urgent-field"
              className="mt-6 flex min-h-16 items-center gap-3 rounded-card bg-ink px-5 py-4 text-white shadow-warm-lg"
            >
              <ShieldAlert className="size-6 shrink-0 text-flame" aria-hidden />
              <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-display text-lg font-bold">
                  <BiText text="rhub.urgent" vars={{ n: c.urgentField }} sub={false} inline /> ·{" "}
                  <Bi k="queue.reason.safety" sub={false} className="inline" />
                </span>
                <FieldBadge onDark />
              </span>
              <ChevronRight className="size-6" aria-hidden />
            </Link>
          )}
          {c.urgentSample > 0 && (
            <Link
              href="/r/queue"
              data-testid="urgent-sample"
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-card border border-clay/60 bg-paper px-5 py-3 shadow-warm-sm",
                c.urgentField > 0 ? "mt-3" : "mt-6",
              )}
            >
              <ShieldAlert className="size-5 shrink-0 text-clay" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-display text-[17px] font-bold">
                    <BiText text="rhub.urgent" vars={{ n: c.urgentSample }} sub={false} inline /> ·{" "}
                    <Bi k="queue.reason.safety" sub={false} className="inline" />
                  </span>
                  <SampleBadge />
                </span>
                <span className="mt-0.5 block text-[15px] leading-snug text-ink-3">
                  <Bi k="rhub.urgent.sample_note" sub={false} />
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
            </Link>
          )}

          {care.length > 0 && (
            <section
              aria-labelledby="care-title"
              className="mt-6 rounded-card border border-clay bg-paper p-5 shadow-warm"
            >
              <h2
                id="care-title"
                className="flex items-center gap-2 font-display text-xl font-bold"
              >
                <HeartHandshake className="size-6 text-clay" aria-hidden />
                <Bi k="rhub.care.title" sub={false} />
              </h2>
              <p className="mt-1 text-[15px] text-ink-3">
                <Bi k="rhub.care.note" sub={false} />
              </p>
              <ul className="mt-3 space-y-2">
                {care.map((m) => (
                  <li
                    key={`${m.interviewId}-${m.part}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base"
                  >
                    <span className="font-semibold">{m.master ?? "…"}</span>
                    <span className="text-ink-3 tabular-nums">{clock(m.startMs)}</span>
                    <span className="rounded-chip bg-flame/30 px-3 py-0.5 text-sm font-semibold">
                      <Bi k={`rhub.care.${m.care}`} sub={false} />
                    </span>
                    <span className="text-sm text-ink-3">
                      {new Date(m.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* The next card leads: approve in one press is the reviewer's whole job (DESIGN §8). On a
              laptop the other doors stand beside it. */}
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
            {next ? <NextCard draft={next} waiting={c.drafts} /> : <AllClear />}
            <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Door href="/r/cards" icon={ClipboardCheck} title="rhub.cards" count={c.drafts} />
              <Door
                href="/r/queue"
                icon={MessageCircleQuestion}
                title="rhub.queue"
                count={c.open}
              />
              <Door href="/m/import" icon={Upload} title="rhub.import" body="rhub.import.body" />
              <Door href="/r/invites" icon={Link2} title="rhub.invites" body="rhub.invites.body" />
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

/** The first draft waiting, previewed so one press opens it. */
async function nextDraft(session: Session): Promise<DraftSummary | null> {
  if (isFixtureMode()) return FIXTURE_DRAFTS[0] ?? null;
  const db = await createClient();
  const admin = createAdminClient();
  if (!db || !admin) return null;
  try {
    return (await listDrafts(db, admin, session))[0] ?? null;
  } catch {
    return null;
  }
}

function NextCard({ draft, waiting }: { draft: DraftSummary; waiting: number }) {
  return (
    <section
      aria-labelledby="next-title"
      className="rounded-card bg-ink p-6 text-white shadow-warm-lg sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-[15px] font-bold text-flame">
          <ClipboardCheck className="size-5" aria-hidden />
          <Bi k="rhub.next" sub={false} />
        </p>
        <span className="flex items-center gap-2">
          {draft.isSample && <SampleBadge onDark />}
          <span className="rounded-chip bg-flame px-3 py-1 font-display text-[15px] font-bold text-ink tabular-nums">
            <BiText text="rhub.waiting" vars={{ n: waiting }} sub={false} />
          </span>
        </span>
      </div>
      <h2 id="next-title" className="mt-4 text-[26px] leading-tight font-bold sm:text-[30px]">
        <BiText text={draft.title} subClassName="font-sans text-[17px] font-semibold text-mist" />
      </h2>
      <p className="mt-3 text-[16px] text-mist">
        {draft.masterName && (
          <span className="font-semibold text-white">{draft.masterName} · </span>
        )}
        <BiText text="rhub.next.steps" vars={{ n: draft.steps }} sub={false} inline />
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button asChild size="lg" className="w-full sm:w-auto sm:min-w-56">
          <Link href={`/r/cards/${draft.id}`}>
            <Bi k="rhub.next.go" sub={false} />
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Link
          href="/r/cards"
          className="inline-flex min-h-12 items-center rounded-button px-3 font-display text-[16px] font-bold text-mist underline decoration-mist/40 underline-offset-4 hover:text-white"
        >
          <Bi k="rhub.next.all" sub={false} />
        </Link>
      </div>
    </section>
  );
}

function AllClear() {
  return (
    <section className="flex items-center gap-5 rounded-card border border-border bg-paper p-6 shadow-warm">
      <Hanate state="resting" size={88} label="" className="shrink-0" />
      <div className="min-w-0">
        <h2 className="text-[22px] leading-tight font-bold">
          <Bi k="rhub.clear.title" subClassName="font-sans text-[15px] font-semibold" />
        </h2>
        <p className="mt-2 text-[16px] text-ink-3">
          <Bi k="rhub.clear.body" sub={false} />
        </p>
        <Button asChild variant="paper" size="md" className="mt-4">
          <Link href="/m/import">
            <Upload aria-hidden />
            <Bi k="rhub.import" sub={false} />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Door(props: {
  href: string;
  icon: LucideIcon;
  title: MessageKey;
  body?: MessageKey;
  count?: number;
}) {
  const Icon = props.icon;
  return (
    <li>
      <Link
        href={props.href}
        className="group flex h-full min-h-20 items-center gap-4 rounded-card border border-border bg-paper px-4 py-3.5 shadow-warm-sm transition-[box-shadow,translate,border-color] duration-200 hover:-translate-y-0.5 hover:border-clay/40 hover:shadow-warm"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-chip bg-sage text-ink-2">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[18px] leading-snug font-bold">
            <Bi k={props.title} sub={false} />
          </span>
          {props.body && (
            <span className="mt-0.5 block text-[15px] leading-snug text-ink-3">
              <Bi k={props.body} sub={false} />
            </span>
          )}
          {/* On a phone the count sits under the title, so a long Kannada title keeps its width. */}
          {props.count !== undefined && (
            <span
              className={cn(
                "mt-1.5 inline-block rounded-chip px-3 py-0.5 font-display text-[14px] font-bold tabular-nums sm:hidden",
                props.count ? "bg-flame/30 text-ink" : "bg-cream text-ink-3",
              )}
            >
              {props.count ? (
                <BiText text="rhub.waiting" vars={{ n: props.count }} sub={false} />
              ) : (
                <Bi k="rhub.none" sub={false} />
              )}
            </span>
          )}
        </span>
        {props.count !== undefined && (
          <span
            className={cn(
              "shrink-0 rounded-chip px-3 py-1 font-display text-[15px] font-bold tabular-nums max-sm:hidden",
              props.count ? "bg-flame/30 text-ink" : "bg-cream text-ink-3",
            )}
          >
            {props.count ? (
              <BiText text="rhub.waiting" vars={{ n: props.count }} sub={false} />
            ) : (
              <Bi k="rhub.none" sub={false} />
            )}
          </span>
        )}
        <ChevronRight
          className="size-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </li>
  );
}
