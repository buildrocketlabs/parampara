// Master teacher's room. Who: a retired headmaster, not a tech user, proud of his craft. One job:
// tell a new story; around it, quietly, what his wisdom already did. Feeling: honoured, never
// measured against anyone (Law 6), and every number true (Law 7).
import type { Metadata } from "next";
import { Suspense } from "react";
import { MasterRoom } from "@/components/master/MasterRoom";
import { RoomSoon } from "@/components/parampara/RoomSoon";
import { SessionBar } from "@/components/parampara/SessionBar";
import { SkeletonLine, SkeletonMedallion } from "@/components/parampara/Skeleton";
import { getSession } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";
import { getMasterHome, sampleMasterHome } from "@/lib/masters/home";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Master teacher" };

export default function Page() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const session = await getSession();
  // No session, another role, or a master who has not agreed yet: the room explains the way in.
  if (!session || session.role !== "master" || !session.consentedAt)
    return <RoomSoon role="master" />;

  const db = isFixtureMode() ? null : await createClient();
  const data = db ? await getMasterHome(db, session) : sampleMasterHome(session);

  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <SessionBar home="/m" />
      <MasterRoom data={data} />
    </div>
  );
}

// Shaped like the room: the greeting, the impact card and the one button.
function RoomSkeleton() {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <div aria-busy="true" className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pt-24">
        <div className="flex items-center gap-3 rounded-card bg-paper px-5 py-5 shadow-warm-sm">
          <SkeletonMedallion size="lg" />
          <div className="flex-1 space-y-3">
            <SkeletonLine width="70%" className="h-6" />
            <SkeletonLine width="90%" />
          </div>
        </div>
        <span aria-hidden className="mt-5 block h-56 animate-breathe rounded-card bg-ink/80" />
        <span
          aria-hidden
          className="mt-auto mb-6 block h-[76px] animate-breathe rounded-button bg-clay-cta/40"
        />
      </div>
    </div>
  );
}
