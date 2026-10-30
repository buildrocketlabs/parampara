// Teacher Pulse. Who: a block or district officer (BRC, BEO, DIET faculty), or a reviewer, on a
// laptop or a phone. One job: know what to do this week for the teachers in their care, then see
// the numbers behind it. Feeling: informed and trusted, never watching anyone: aggregates only,
// groups under 5 hidden, field and Sample apart (Laws 6 and 7).
import type { Metadata } from "next";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { ActionsCard, type DigestView } from "@/components/insights/ActionsCard";
import { KindSwitch, type DataKind } from "@/components/insights/KindSwitch";
import {
  CostCard,
  DistrictBars,
  Funnel,
  LampsLink,
  NeedsList,
  PracticeList,
  TopicBars,
} from "@/components/insights/PulseSections";
import { FieldBadge, SampleBadge } from "@/components/parampara/Badges";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { EmptyState } from "@/components/parampara/EmptyState";
import { ErrorState } from "@/components/parampara/ErrorState";
import { RoomSoon } from "@/components/parampara/RoomSoon";
import { SessionBar } from "@/components/parampara/SessionBar";
import { SkeletonLine } from "@/components/parampara/Skeleton";
import { getSession } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";

import { fill } from "@/lib/i18n/fill";
import { deriveActions, REVIEWER_LINKS } from "@/lib/insights/actions";
import {
  digestForPage,
  readDigest,
  refreshDigest,
  type CachedDigest,
  type DigestForPage,
} from "@/lib/insights/digest";
import { samplePulse } from "@/lib/insights/fixture";
import { dayOf, weekRange } from "@/lib/insights/format";
import { loadPulse } from "@/lib/insights/load";
import { hasPulse, type Pulse } from "@/lib/insights/types";
import { createClient } from "@/lib/supabase/server";
import { messages } from "@/lib/i18n/messages";

export const metadata: Metadata = { title: "Teacher Pulse" };

export default function Page({ searchParams }: PageProps<"/i">) {
  return (
    <Suspense fallback={<PulseSkeleton />}>
      <PulseRoom searchParams={searchParams} />
    </Suspense>
  );
}

function kindParam(v: string | string[] | undefined): DataKind | null {
  return v === "field" || v === "sample" ? v : null;
}

function digestView(cached: CachedDigest): DigestView {
  const at = dayOf(cached.at);
  return {
    headline: { kn: cached.digest.headlineKn, en: cached.digest.headlineEn },
    actions: cached.digest.actions,
    watch: cached.digest.watch,
    byline: {
      kn: fill(messages.kn["pulse.digest.by"], { date: at.kn }),
      en: fill(messages.en["pulse.digest.by"], { date: at.en }),
    },
  };
}

async function PulseRoom({ searchParams }: { searchParams: PageProps<"/i">["searchParams"] }) {
  const session = await getSession();
  if (!session || !["officer", "reviewer"].includes(session.role) || !session.consentedAt) {
    return <RoomSoon role="officer" />;
  }
  await connection();

  let pulse: Pulse;
  let board: DigestForPage = { show: "derived", stale: false };
  const db = isFixtureMode() ? null : await createClient();
  const asked = kindParam((await searchParams).data);
  try {
    pulse = db ? await loadPulse(db) : samplePulse();
  } catch {
    return (
      <Shell>
        <ErrorState
          size="page"
          title="pulse.error.title"
          body="pulse.error.body"
          className="mt-10"
        />
      </Shell>
    );
  }

  const kind: DataKind = asked ?? (hasPulse(pulse.field) ? "field" : "sample");
  const side = kind === "field" ? pulse.field : pulse.sample;
  const other: DataKind = kind === "field" ? "sample" : "field";

  if (db && hasPulse(side)) {
    // A note is shown only beside the numbers it was written from (lib/insights/digest.ts).
    board = digestForPage(await readDigest(db, side), side);
    // The page never waits on a model: a refresh (once a day, or an hour after the numbers
    // changed) runs after the response is sent and shows on the next visit.
    after(() => refreshDigest(side));
  }

  const actions = deriveActions(side, session.role === "reviewer" ? REVIEWER_LINKS : {});
  const isSample = kind === "sample";

  return (
    <Shell>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-tight font-bold sm:text-[38px]">
            <Bi k="pulse.title" subClassName="font-sans text-lg font-semibold" />
          </h1>
          {/* On a phone the promise moves to the foot of the page, so the board is in the first view. */}
          <p className="mt-2 hidden max-w-2xl text-lg text-ink-3 sm:block">
            {/* The reader's language only: the board itself should start high (English one tap away). */}
            <Bi k="pulse.sub" sub={false} />
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <KindSwitch current={kind} hrefFor={(k) => `/i?data=${k}`} />
          {/* The lamps map, the page's moment of delight, in the first view on a laptop. */}
          <LampsLink className="hidden w-[24rem] py-3 lg:flex" />
        </div>
      </header>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[15px] text-ink-3">
        <span className="font-display text-[17px] font-semibold text-ink">
          <BiText text={weekRange(side.since, side.until)} sub={false} />
        </span>
        <span className="hidden max-w-[68ch] sm:inline">
          <Bi
            k={isSample ? "pulse.sampleNote" : "pulse.fieldNote"}
            sub={false}
            className="inline"
          />
        </span>
      </p>

      <ActionsCard
        actions={actions}
        digest={board.show === "digest" ? digestView(board.digest) : null}
        freshNoteComing={board.show === "derived" && board.stale}
        isSample={isSample}
        hasNumbers={hasPulse(side)}
        className="mt-4 rise"
      />
      <LampsLink className="mt-4 lg:hidden" />

      {!hasPulse(side) ? (
        <EmptyState
          className="mt-6 rounded-card border border-border bg-paper px-5 shadow-warm-sm"
          title={isSample ? "pulse.empty.sample.title" : "pulse.empty.field.title"}
          body={isSample ? "pulse.empty.sample.body" : "pulse.empty.field.body"}
          action={{
            label: other === "sample" ? "pulse.empty.seeSample" : "pulse.empty.seeField",
            href: `/i?data=${other}`,
          }}
        />
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[24px] font-bold">
              <Bi k="pulse.numbers" subClassName="font-sans text-[15px] font-semibold" />
            </h2>
            {isSample ? <SampleBadge /> : <FieldBadge />}
          </div>
          {/* Two columns from lg; on a phone they stack in reading order: what happened, what is
              waiting, what worked, then the detail. */}
          {/* A phone reads in order: what happened, what is waiting, what worked, then the detail.
              A laptop sets the short cards in two columns of about equal height and gives the
              long list of practices the full width beneath. */}
          <div className="mt-4 flex flex-col gap-5">
            <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
              <div className="contents lg:flex lg:flex-col lg:gap-5">
                <div className="order-1 min-w-0">
                  <Funnel side={side} />
                </div>
                <div className="order-5 min-w-0">
                  <DistrictBars side={side} />
                </div>
                <div className="order-6 min-w-0">
                  <CostCard side={side} platform={pulse.platform} />
                </div>
              </div>
              <div className="contents lg:flex lg:flex-col lg:gap-5">
                <div className="order-2 min-w-0">
                  <NeedsList side={side} />
                </div>
                <div className="order-4 min-w-0">
                  <TopicBars side={side} />
                </div>
              </div>
            </div>
            <div className="order-3 min-w-0">
              <PracticeList side={side} />
            </div>
          </div>
        </>
      )}

      <p className="mx-auto mt-10 max-w-2xl text-center text-[15px] text-ink-3">
        <Bi k="pulse.privacy" subClassName="text-[14px]" />
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-cream">
      <SessionBar home="/i" />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-16 sm:px-8">
        {children}
      </main>
    </div>
  );
}

function PulseSkeleton() {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-cream" aria-busy="true">
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-24 pb-16 sm:px-8">
        <SkeletonLine width="40%" className="h-9" />
        <SkeletonLine width="70%" className="mt-4 h-5" />
        <span aria-hidden className="mt-8 block h-64 animate-breathe rounded-card bg-ink/80" />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              aria-hidden
              className="block h-56 animate-breathe rounded-card bg-paper shadow-warm-sm"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
