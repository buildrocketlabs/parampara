// Import a recording. Who: the founder or a reviewer on a laptop (sometimes a master on a phone),
// with a 40 minute phone interview of a retired headmaster. One job: turn it into draft practice
// cards without losing a word. Feeling: careful and reassuring; every stage tells the truth.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { LanguageToggle } from "@/components/parampara/LanguageToggle";
import { SampleReviewerWarning } from "@/components/parampara/SampleReviewerWarning";
import { Wordmark } from "@/components/parampara/Wordmark";
import { ImportFlow, type MasterOption } from "@/components/import/ImportFlow";
import { getSessionFor } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";
import { FIELD_IMPORT_MAX_MS, maxImportMs } from "@/lib/import/access";
import { listMasters } from "@/lib/masters/store";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Import a recording", robots: { index: false } };

export default function Page() {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
        <Wordmark />
        <LanguageToggle />
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5 pt-6 pb-16 sm:px-8">
        <div className="flex items-start gap-4">
          <h1 className="min-w-0 flex-1 text-[30px] leading-tight font-bold sm:text-[38px]">
            <Bi k="import.title" subClassName="font-sans text-lg font-semibold" />
          </h1>
          <Hanate state="idle" size={72} label="" className="shrink-0" />
        </div>
        <p className="mt-3 max-w-2xl text-lg text-ink-3">
          <Bi k="import.sub" sub={false} />
        </p>
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
      <section className="mt-10 flex flex-col items-center rounded-card bg-paper p-8 text-center shadow-warm">
        <Hanate state="caring" size={120} label="" />
        <p className="mt-4 text-lg font-semibold">
          <Bi k="import.err.sign_in" subClassName="text-base font-normal" />
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

  let masters: MasterOption[] = [];
  const fixture = isFixtureMode();
  if (fixture) {
    masters = [
      {
        id: "00000000-0000-4000-8000-00000000a001",
        name: "Sharanappa",
        years: 32,
        district: "Koppal",
        consented: true,
        isSample: true,
      },
    ];
  } else {
    const db = createAdminClient();
    if (db) {
      masters = (await listMasters(db, session)).map((m) => ({
        id: m.id,
        name: m.displayName,
        years: m.years,
        district: m.district,
        consented: m.consented,
        isSample: m.isSample,
      }));
    }
  }

  return (
    <>
      {session.role === "reviewer" && session.isSample && (
        <SampleReviewerWarning className="mt-8" />
      )}
      <ImportFlow
        masters={masters}
        fixture={fixture}
        // Fixture mode sends nothing and spends nothing, so the Sample credit cap does not apply:
        // a 30 minute interview in seven WhatsApp notes can be rehearsed there (F-A1).
        maxMs={fixture ? FIELD_IMPORT_MAX_MS : maxImportMs(session)}
        canAddMaster={session.role === "reviewer"}
        isSampleSession={session.isSample}
      />
    </>
  );
}

function FlowSkeleton() {
  return (
    <div className="mt-8 space-y-5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-card bg-paper/70 shadow-warm-sm motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
