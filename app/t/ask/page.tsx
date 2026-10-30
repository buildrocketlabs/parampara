// Ask. Who: a young teacher, often alone at 9 pm, Kannada first, on a phone. One action: speak the
// problem (or type it). Feeling: someone experienced is listening, and nobody is watching her.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { SessionBar } from "@/components/parampara/SessionBar";
import { Bi } from "@/components/parampara/Bi";
import { EmptyState } from "@/components/parampara/EmptyState";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { AnswerPath } from "@/components/teacher/AnswerPath";
import { AskFlow } from "@/components/teacher/AskFlow";
import { redirect } from "next/navigation";
import { EARLY_TAP_SCRIPT } from "@/lib/ask/early-tap";
import { chipsFor } from "@/lib/ask/field-chips-server";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ask" };

export default function Page() {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      {/* Holds a tap that comes before the page's script, so it is never lost (F-P1). */}
      <script dangerouslySetInnerHTML={{ __html: EARLY_TAP_SCRIPT }} />
      <SessionBar home="/t" compact />
      {/* A laptop (lg): asking on the left, where the answer comes from on the right. */}
      <main
        id="main"
        className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pt-2 pb-12 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:items-start lg:gap-x-16 lg:px-8 lg:pt-6"
      >
        <div className="flex flex-col">
          <Link
            href="/t"
            className="inline-flex min-h-12 w-fit items-center gap-2 rounded-button pr-3 font-display text-lg font-bold text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="size-5" aria-hidden />
            <Bi k="tried.home" sub={false} />
          </Link>
          <div className="mt-2 flex items-center gap-4">
            <Hanate state="idle" size={72} label="" className="lg:h-[96px] lg:w-[83px]" />
            <h1 className="text-[28px] leading-tight font-bold">
              <Bi k="ask.title" subClassName="font-sans text-base font-semibold" />
            </h1>
          </div>
          <p className="mt-3 text-lg text-ink-3 lg:mt-2">
            <Bi k="ask.sub" subClassName="text-base" />
          </p>
          <Suspense fallback={<FlowSkeleton />}>
            <Flow />
          </Suspense>
        </div>
        <AnswerPath className="mt-10 hidden lg:sticky lg:top-6 lg:mt-14 lg:block" />
      </main>
    </div>
  );
}

// Shaped like what comes: the orb, its caption and the sample chips.
function FlowSkeleton() {
  return (
    <div aria-hidden className="mt-10 flex flex-col items-center gap-4">
      <span className="size-28 animate-breathe rounded-full bg-clay-cta/25" />
      <span className="h-5 w-56 animate-breathe rounded-chip bg-paper/80" />
      <span className="mt-6 h-11 w-72 animate-breathe rounded-chip bg-paper/70" />
    </div>
  );
}

async function Flow() {
  const session = await getSession();
  // Invited and not yet agreed: back to the consent text first (D37).
  if (session && !session.consentedAt) redirect("/welcome");
  if (!session) {
    return (
      <EmptyState
        className="mt-10"
        hanate="caring"
        title="ask.sign_in"
        action={{ label: "room.back", href: "/#doors" }}
      />
    );
  }
  return <AskFlow profileLang={session.lang} fieldChips={await chipsFor(session)} />;
}
