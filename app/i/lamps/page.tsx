// Lamps of Karnataka. Who: an officer or reviewer, and a juror who wants to see the loop reach real
// classrooms. One job: see where the masters' wisdom is helping, and whose. Feeling: a state slowly
// lighting up, lamp by lamp. Never who was helped (Law 6); field and Sample never mixed (Law 7).
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { KindSwitch, type DataKind } from "@/components/insights/KindSwitch";
import { LampsMap } from "@/components/insights/LampsMap";
import { Bi } from "@/components/parampara/Bi";
import { ErrorState } from "@/components/parampara/ErrorState";
import { RoomSoon } from "@/components/parampara/RoomSoon";
import { SessionBar } from "@/components/parampara/SessionBar";
import { SkeletonLine } from "@/components/parampara/Skeleton";
import { getSession } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";
import { sampleLamps } from "@/lib/insights/fixture";
import { loadLamps } from "@/lib/insights/load";
import type { Lamps } from "@/lib/insights/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lamps of Karnataka" };

export default function Page({ searchParams }: PageProps<"/i/lamps">) {
  return (
    <Suspense fallback={<LampsSkeleton />}>
      <LampsRoom searchParams={searchParams} />
    </Suspense>
  );
}

async function LampsRoom({
  searchParams,
}: {
  searchParams: PageProps<"/i/lamps">["searchParams"];
}) {
  const session = await getSession();
  if (!session || !["officer", "reviewer"].includes(session.role) || !session.consentedAt) {
    return <RoomSoon role="officer" />;
  }
  await connection();
  const raw = (await searchParams).data;
  const asked: DataKind | null = raw === "field" || raw === "sample" ? raw : null;

  let lamps: Lamps;
  try {
    const db = isFixtureMode() ? null : await createClient();
    lamps = db ? await loadLamps(db) : sampleLamps();
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

  const fieldEmpty = lamps.field.length === 0;
  const kind: DataKind = asked ?? (fieldEmpty ? "sample" : "field");
  const shown = kind === "field" ? lamps.field : lamps.sample;

  return (
    <Shell>
      <Link
        href="/i"
        className="inline-flex min-h-12 items-center gap-2 rounded-button pr-3 font-display text-[16px] font-semibold text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-5" aria-hidden />
        <Bi k="lamps.back" sub={false} />
      </Link>
      <header className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-tight font-bold sm:text-[38px]">
            <Bi k="lamps.title" subClassName="font-sans text-lg font-semibold" />
          </h1>
          <p className="mt-1 max-w-2xl text-[15px] font-semibold text-ink-3">
            <Bi k="pulse.practices.since" sub={false} />
          </p>
        </div>
        <KindSwitch
          current={kind}
          hrefFor={(k) => `/i/lamps?data=${k}`}
          className="self-start lg:self-auto"
        />
      </header>

      <div className="mt-4">
        <LampsMap
          lamps={shown}
          isSample={kind === "sample"}
          noFieldYet={kind === "sample" && fieldEmpty}
        />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-cream">
      <SessionBar home="/i" />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-4 pb-16 sm:px-8">{children}</main>
    </div>
  );
}

function LampsSkeleton() {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-cream" aria-busy="true">
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-24 pb-16 sm:px-8">
        <SkeletonLine width="45%" className="h-9" />
        <SkeletonLine width="75%" className="mt-4 h-5" />
        <span
          aria-hidden
          className="mx-auto mt-8 block aspect-[600/810] w-full max-w-[680px] animate-breathe rounded-card bg-paper/70"
        />
      </main>
    </div>
  );
}
