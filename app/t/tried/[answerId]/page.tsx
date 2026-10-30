// "Did it work?" Who: the teacher, the morning after she tried a master's idea. One job: say how
// it went in one tap. Feeling: thanked, never judged; the master hears that their wisdom helped.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { SessionBar } from "@/components/parampara/SessionBar";
import { Bi } from "@/components/parampara/Bi";
import { EmptyState } from "@/components/parampara/EmptyState";
import { SkeletonCard } from "@/components/parampara/Skeleton";
import { PendingTriedSync } from "@/components/teacher/PendingTriedSync";
import { TriedFlow } from "@/components/teacher/TriedFlow";
import { loadTried } from "@/lib/tried/load";
import { isOutcome } from "@/lib/tried/types";

export const metadata: Metadata = { title: "Did it work?", robots: { index: false } };

export default function Page({ params, searchParams }: PageProps<"/t/tried/[answerId]">) {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <SessionBar home="/t" compact />
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-5 pt-2 pb-16 lg:max-w-6xl lg:px-8 lg:pt-4">
        <Link
          href="/t"
          className="inline-flex min-h-12 items-center gap-2 font-display text-lg font-bold text-ink-3 hover:text-ink"
        >
          <ArrowLeft className="size-5" aria-hidden />
          <Bi k="tried.home" sub={false} />
        </Link>
        <PendingTriedSync />
        <Suspense fallback={<SkeletonCard lines={3} className="mt-4" />}>
          <Tried params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Tried({
  params,
  searchParams,
}: Pick<PageProps<"/t/tried/[answerId]">, "params" | "searchParams">) {
  const { answerId } = await params;
  const query = await searchParams;
  const outcome = Array.isArray(query.outcome) ? query.outcome[0] : query.outcome;
  const loaded = await loadTried(answerId);

  if (loaded.kind === "sign_in") {
    return (
      <EmptyState
        className="mt-10"
        hanate="caring"
        title="tried.sign_in"
        action={{ label: "room.back", href: "/#doors" }}
      />
    );
  }
  if (loaded.kind === "not_found") {
    return (
      <EmptyState
        className="mt-10"
        hanate="caring"
        title="tried.notfound"
        action={{ label: "answer.followUp", href: "/t/ask" }}
      />
    );
  }
  return (
    <TriedFlow
      answer={loaded.answer}
      record={loaded.record}
      initialOutcome={isOutcome(outcome) ? outcome : undefined}
    />
  );
}
