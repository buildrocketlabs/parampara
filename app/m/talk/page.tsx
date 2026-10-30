// Talk with Hanate. Who: a retired headmaster on his phone, or the founder holding it for him, or
// a reviewer on his behalf. One job: tell real classroom stories, one question at a time, in his
// own voice. Feeling: an unhurried, respectful conversation; the app talks first, nothing to learn.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionBar } from "@/components/parampara/SessionBar";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { TalkFlow, type TalkMaster } from "@/components/talk/TalkFlow";
import { getSessionFor } from "@/lib/auth/session";
import { hasSarvam, isFixtureMode } from "@/lib/env";
import { listMasters } from "@/lib/masters/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { findResumable, type ResumeOffer } from "@/lib/talk/turns";

export const metadata: Metadata = { title: "Talk with Hanate", robots: { index: false } };

export default function Page() {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <SessionBar home="/m" compact />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-16 sm:px-8">
        {/* The title and the welcome live in TalkFlow: shown before the talk, quiet during it. */}
        <Suspense fallback={<FlowSkeleton />}>
          <Gate />
        </Suspense>
      </main>
    </div>
  );
}

async function Gate() {
  const session = await getSessionFor("reviewer", "master");
  if (!session) {
    return (
      <section className="flex flex-col items-center rounded-card bg-paper p-8 text-center shadow-warm">
        <h1 className="sr-only">
          <Bi k="talk.title" sub={false} />
        </h1>
        <Hanate state="caring" size={120} label="" />
        <p className="mt-4 text-[22px] font-semibold">
          <Bi k="talk.err.sign_in" subClassName="text-base font-normal" />
        </p>
        <Button asChild variant="paper" className="mt-6">
          <Link href="/#doors">
            <ArrowLeft aria-hidden />
            <Bi k="room.back" sub={false} />
          </Link>
        </Button>
      </section>
    );
  }

  const fixture = isFixtureMode();
  let masters: TalkMaster[] = [];
  // An open talk of the last six hours, per master, from the server (Sample mode keeps its own).
  let resume: Record<string, ResumeOffer> = {};
  if (fixture) {
    masters = [{ id: "00000000-0000-4000-8000-00000000a001", name: "Sharanappa", years: 32, consented: true, isSample: true }];
  } else {
    const db = createAdminClient();
    if (db) {
      masters = (await listMasters(db, session)).map((m) => ({
        id: m.id,
        name: m.displayName,
        years: m.years,
        consented: m.consented,
        isSample: m.isSample,
      }));
      resume = await findResumable(db, masters.map((m) => m.id)).catch(() => ({}));
    }
  }
  return (
    <TalkFlow
      masters={masters}
      resume={resume}
      fixture={fixture}
      speechReady={hasSarvam()}
      canReview={session.role === "reviewer"}
    />
  );
}

function FlowSkeleton() {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="h-72 animate-pulse rounded-card bg-paper/70 shadow-warm-sm motion-reduce:animate-none" />
      ))}
    </div>
  );
}
