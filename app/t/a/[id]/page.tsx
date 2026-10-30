// An answer. Who: the teacher who asked, tonight and again tomorrow morning before class.
// One job: know exactly what to try tomorrow, and from whom it comes. Feeling: the best teacher
// Karnataka ever had just answered her.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { SessionBar } from "@/components/parampara/SessionBar";
import { Bi } from "@/components/parampara/Bi";
import { EmptyState } from "@/components/parampara/EmptyState";
import { SkeletonCard } from "@/components/parampara/Skeleton";
import { AnswerScreen } from "@/components/teacher/AnswerScreen";
import { fixtureAnswerView } from "@/lib/answers/fixture";
import { getAnswerView } from "@/lib/answers/store";
import { isFixtureMode } from "@/lib/env";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Answer", robots: { index: false } };

export default function Page({ params }: PageProps<"/t/a/[id]">) {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <SessionBar home="/t" compact />
      <main
        id="main"
        className="mx-auto w-full max-w-xl flex-1 px-5 pt-2 pb-32 md:pb-16 lg:max-w-6xl lg:px-8"
      >
        <Link
          href="/t/ask"
          className="inline-flex min-h-12 items-center gap-2 font-display text-lg font-bold text-ink-3 hover:text-ink"
        >
          <ArrowLeft className="size-5" aria-hidden />
          <Bi k="ask.again" sub={false} />
        </Link>
        <Suspense fallback={<SkeletonCard lines={6} className="mt-4" />}>
          <Answer params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Answer({ params }: { params: PageProps<"/t/a/[id]">["params"] }) {
  const { id } = await params;
  const session = await getSession();
  // Invited and not yet agreed: back to the consent text first (D37).
  if (session && !session.consentedAt) redirect("/welcome");
  // Fixture mode (no keys): the Sample answer, so the page can be seen and tested.
  // A field teacher is never shown the Sample answer as hers (D64).
  if (session?.isSample && isFixtureMode()) {
    const sample = fixtureAnswerView(id);
    if (sample) return <AnswerScreen answer={sample} />;
  }
  const db = await createClient();
  if (!session || !db) {
    return (
      <EmptyState
        className="mt-10"
        hanate="caring"
        title="answer.sign_in"
        action={{ label: "room.back", href: "/#doors" }}
      />
    );
  }
  const answer = await getAnswerView(db, session, id);
  if (!answer) {
    return (
      <EmptyState
        className="mt-10"
        hanate="caring"
        title="review.card.notfound"
        action={{ label: "ask.again", href: "/t/ask" }}
      />
    );
  }
  return <AnswerScreen answer={answer} />;
}
