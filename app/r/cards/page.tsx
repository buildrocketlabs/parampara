// Reviewer queue. Who: a headmaster or the founder, on a laptop or a phone, accountable for every
// card. One job: open the next draft and check it against the recording. Feeling: calm, in control.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ChevronRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { FieldBadge, SampleBadge } from "@/components/parampara/Badges";
import { EmptyState } from "@/components/parampara/EmptyState";
import { SampleReviewerWarning } from "@/components/parampara/SampleReviewerWarning";
import { SkeletonCard } from "@/components/parampara/Skeleton";
import { SessionBar } from "@/components/parampara/SessionBar";
import { getSessionFor } from "@/lib/auth/session";
import { listDrafts } from "@/lib/review/store";
import type { DraftSummary } from "@/lib/review/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isFixtureMode } from "@/lib/env";
import { FIXTURE_DRAFTS } from "@/lib/review/fixture";

export const metadata: Metadata = { title: "Cards to review", robots: { index: false } };

export default function Page() {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <SessionBar home="/r" />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-4 pb-16 sm:px-8">
        <div className="max-w-4xl">
          <Link
            href="/r"
            className="inline-flex min-h-12 items-center gap-2 rounded-button pr-3 font-display text-lg font-bold text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="size-5" aria-hidden />
            <Bi k="room.reviewer" sub={false} />
          </Link>
          <h1 className="mt-2 text-[30px] leading-tight font-bold sm:text-[38px]">
            <Bi k="review.title" subClassName="font-sans text-lg font-semibold" />
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-3">
            <Bi k="review.sub" subClassName="text-base" />
          </p>
          <Suspense
            fallback={
              <div className="mt-8 space-y-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            }
          >
            <Queue />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function Queue() {
  const session = await getSessionFor("reviewer");
  const db = await createClient();
  const admin = createAdminClient();
  const fixture = Boolean(session) && isFixtureMode();
  if (!session || ((!db || !admin) && !fixture)) {
    return (
      <EmptyState
        className="mt-10"
        hanate="caring"
        title="review.sign_in"
        action={{ label: "room.back", href: "/#doors" }}
      />
    );
  }
  const drafts = fixture || !db || !admin ? FIXTURE_DRAFTS : await listDrafts(db, admin, session);
  if (drafts.length === 0) {
    return (
      <>
        {session.isSample && <SampleReviewerWarning className="mt-8" />}
        <EmptyState
          className="mt-10"
          size="page"
          title="review.empty.title"
          body="review.empty.body"
          action={{ label: "review.import", href: "/m/import" }}
        />
      </>
    );
  }

  const groups = new Map<string, DraftSummary[]>();
  for (const d of drafts) {
    const key = d.masterName ?? "";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  return (
    <div className="mt-8 space-y-8">
      {session.isSample && <SampleReviewerWarning />}
      <div className="flex justify-end">
        <Button asChild variant="paper" size="md">
          <Link href="/m/import">
            <Upload aria-hidden />
            <Bi k="review.import" sub={false} />
          </Link>
        </Button>
      </div>
      {[...groups.entries()].map(([name, cards]) => (
        <section key={name} aria-label={name || "master"}>
          <h2 className="flex flex-wrap items-baseline gap-x-3 text-[22px] font-bold">
            <BiText
              text={name ? "review.from" : "review.from.unknown"}
              vars={{ name }}
              sub={false}
              inline
            />
            <span className="text-base font-semibold text-ink-3">
              <BiText text="review.count" vars={{ n: cards.length }} sub={false} inline />
            </span>
          </h2>
          <ul className="mt-3 space-y-3">
            {cards.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/r/cards/${c.id}`}
                  className="group flex items-center gap-4 rounded-card border border-border bg-paper p-5 shadow-warm-sm transition-[box-shadow,translate] duration-150 hover:-translate-y-0.5 hover:shadow-warm"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      lang="kn"
                      className="block font-display text-[20px] leading-snug font-bold"
                    >
                      {c.title.kn}
                    </span>
                    <span lang="en" className="mt-0.5 block text-base text-ink-3">
                      {c.title.en}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-ink-3">
                      <BiText text="review.steps" vars={{ n: c.steps }} sub={false} inline />
                      {c.gradeBand && (
                        <span>
                          ·{" "}
                          <BiText
                            text="review.grade"
                            vars={{ g: c.gradeBand }}
                            sub={false}
                            inline
                          />
                        </span>
                      )}
                      {c.isSample ? <SampleBadge /> : <FieldBadge />}
                      {c.flags.map((f) => (
                        <span
                          key={f}
                          className="rounded-chip bg-flame/30 px-2.5 py-0.5 text-sm font-semibold text-ink"
                        >
                          <Bi
                            k={
                              f === "punishment_dropped"
                                ? "review.flag.punishment_dropped"
                                : "review.flag.other"
                            }
                            sub={false}
                          />
                        </span>
                      ))}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-6 shrink-0 text-ink-3 transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
