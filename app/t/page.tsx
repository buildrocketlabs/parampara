// Teacher home. Who: a young teacher, Kannada first, often alone at 9 pm, wary of being watched.
// One action: speak the problem (the orb is right here, no extra tap). Then, quietly: did
// yesterday's idea work, and her own recent answers, which only she can see (Law 6).
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bookmark, Check, ChevronRight, Minus, X } from "lucide-react";
import { SampleBadge } from "@/components/parampara/Badges";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { RoomSoon } from "@/components/parampara/RoomSoon";
import { SessionBar } from "@/components/parampara/SessionBar";
import { SkeletonCard } from "@/components/parampara/Skeleton";
import { AnswerPath } from "@/components/teacher/AnswerPath";
import { AskFlow } from "@/components/teacher/AskFlow";
import { TriedPrompt } from "@/components/teacher/TriedPrompt";
import {
  answerToFollowUp,
  partOfDay,
  recentAnswers,
  type RecentAnswer,
} from "@/lib/answers/recent";
import { fixtureRecent } from "@/lib/answers/fixture";
import { chipsFor } from "@/lib/ask/field-chips-server";
import { getSession } from "@/lib/auth/session";
import type { MessageKey } from "@/lib/i18n";
import { isFixtureMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Teacher" };

export default function Page() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <Home />
    </Suspense>
  );
}

const OUTCOME: Record<
  NonNullable<RecentAnswer["outcome"]> | "none",
  { key: MessageKey; icon: typeof Check; tone: string }
> = {
  worked: { key: "home.outcome.worked", icon: Check, tone: "bg-sage text-moss" },
  partly: { key: "home.outcome.partly", icon: Minus, tone: "bg-flame/25 text-ink" },
  didnt: { key: "home.outcome.didnt", icon: X, tone: "bg-cream text-ink-3" },
  none: { key: "home.outcome.none", icon: ChevronRight, tone: "bg-cream text-ink-3" },
};

async function Home() {
  const session = await getSession();
  // No session, another role, or an invitee who has not agreed yet: the room explains the way in.
  if (!session || session.role !== "teacher" || !session.consentedAt)
    return <RoomSoon role="teacher" />;

  const db = isFixtureMode() ? null : await createClient();
  // Fixture mode: the Sample answer as yesterday's, so the "Did it work?" bridge can be seen; a
  // field teacher is never shown a Sample answer as hers (D64), so hers starts empty.
  const [recent, fieldChips] = await Promise.all([
    db
      ? recentAnswers(db, session.userId)
      : Promise.resolve(session.isSample ? fixtureRecent() : []),
    chipsFor(session),
  ]);
  const followUp = answerToFollowUp(recent);
  const part = partOfDay();

  return (
    // One canvas through the whole teacher path (home, ask, answer, tried); the greeting carries
    // the time of day.
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <SessionBar home="/t" />
      {/* A phone: one column, the orb near the thumb. A laptop (lg): asking on the left; did it
          work, saved and recent answers, and where answers come from on the right. The two
          wrappers are "contents" on a phone, so the order classes keep the phone's order. */}
      <main
        id="main"
        className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pt-4 pb-16 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:items-start lg:gap-x-16 lg:px-8 lg:pt-8"
      >
        <div className="contents lg:block">
          <section aria-labelledby="hello" className="order-1 flex items-center gap-4">
            <Hanate state="idle" size={84} label="" className="lg:h-[140px] lg:w-[120px]" />
            <div className="min-w-0">
              <h1
                id="hello"
                className="font-display text-[34px] leading-tight font-extrabold text-clay"
              >
                <Bi k="home.hello" subClassName="hidden" />
              </h1>
              <p className="mt-1 text-lg text-ink-3">
                <Bi k={`home.greeting.${part}`} subClassName="text-base" />
              </p>
            </div>
          </section>

          <section aria-labelledby="ask-title" className="order-3 mt-8">
            <h2 id="ask-title" className="text-center text-[26px] leading-tight font-bold">
              <Bi k="ask.title" subClassName="font-sans text-base font-semibold" />
            </h2>
            <p className="mt-2 text-center text-base text-ink-3">
              <Bi k="ask.sub" sub={false} />
            </p>
            <AskFlow profileLang={session.lang} fieldChips={fieldChips} />
          </section>
        </div>

        <div className="contents lg:sticky lg:top-6 lg:block">
          {followUp && <TriedPrompt answerId={followUp.id} className="order-4 mt-10 lg:mt-0" />}

          <Link
            href="/t/saved"
            className="order-5 mt-10 flex min-h-16 items-center gap-3 rounded-card border border-border bg-paper/80 px-4 py-3 shadow-warm-sm hover:shadow-warm"
          >
            <Bookmark className="size-6 shrink-0 text-clay" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-bold">
                <Bi k="home.saved" sub={false} />
              </span>
              <span className="block text-[15px] text-ink-3">
                <Bi k="home.saved.note" sub={false} />
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
          </Link>

          {recent.length > 0 && (
            <section aria-labelledby="recent-title" className="order-6 mt-12 lg:mt-8">
              <h2
                id="recent-title"
                className="flex flex-wrap items-baseline justify-between gap-2 text-[20px] font-bold"
              >
                <Bi k="home.recent" sub={false} />
                <span className="text-[15px] font-normal text-ink-3">
                  <Bi k="home.recent.note" sub={false} />
                </span>
              </h2>
              <ul className="mt-3 space-y-2">
                {recent.map((a) => {
                  const o = OUTCOME[a.outcome ?? "none"];
                  const Icon = o.icon;
                  return (
                    <li key={a.id}>
                      <Link
                        href={a.outcome ? `/t/a/${a.id}` : `/t/tried/${a.id}`}
                        className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-border bg-paper px-4 py-3 shadow-warm-sm transition-[box-shadow,translate] hover:-translate-y-px hover:shadow-warm sm:max-lg:flex-nowrap"
                      >
                        {/* The title has the row to itself in the narrow laptop column, and the
                            reader's language leads (two lines, never cut mid letter). */}
                        <span className="min-w-0 basis-full sm:max-lg:flex-1 sm:max-lg:basis-auto">
                          <BiText
                            text={a.title}
                            className="line-clamp-2 font-display text-lg leading-snug font-bold"
                            subClassName="line-clamp-1 text-[15px] text-ink-3"
                          />
                        </span>
                        {/* A Sample account's answers are Sample (Law 7). */}
                        {session.isSample && <SampleBadge className="shrink-0" />}
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-chip px-3 py-1 text-sm font-semibold",
                            o.tone,
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                          <Bi k={o.key} sub={false} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <AnswerPath className="order-7 mt-8 hidden lg:block" />
        </div>
      </main>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-cream">
      <div className="mx-auto w-full max-w-xl px-5 pt-6">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={4} className="mt-6" />
      </div>
    </div>
  );
}
