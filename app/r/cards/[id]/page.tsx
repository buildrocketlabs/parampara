// One draft card beside its evidence. Who: a headmaster reviewer, laptop or phone, one hand free.
// One job: decide (approve, fix, set aside) with the master's own words and voice in view.
// Feeling: trustworthy; nothing is hidden, every claim is one tap from the recording.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { CardReview } from "@/components/review/CardReview";
import { Bi } from "@/components/parampara/Bi";
import { EmptyState } from "@/components/parampara/EmptyState";
import { SkeletonCard } from "@/components/parampara/Skeleton";
import { SessionBar } from "@/components/parampara/SessionBar";
import { getSessionFor } from "@/lib/auth/session";
import { getReviewCard, listDrafts } from "@/lib/review/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isFixtureMode } from "@/lib/env";
import { fixtureReviewCard } from "@/lib/review/fixture";

export const metadata: Metadata = { title: "Review a card", robots: { index: false } };

export default function Page({ params }: PageProps<"/r/cards/[id]">) {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <SessionBar home="/r" compact />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-4 pb-32 sm:px-8">
        <Link
          href="/r/cards"
          className="inline-flex min-h-12 items-center gap-2 rounded-button pr-3 font-display text-lg font-bold text-ink-3 hover:text-ink"
        >
          <ArrowLeft className="size-5" aria-hidden />
          <Bi k="review.card.back" sub={false} />
        </Link>
        <Suspense
          fallback={
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <SkeletonCard lines={6} />
              <SkeletonCard lines={8} />
            </div>
          }
        >
          <Review params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Review({ params }: { params: PageProps<"/r/cards/[id]">["params"] }) {
  const { id } = await params;
  const session = await getSessionFor("reviewer");
  // Fixture mode (no keys): the Sample draft beside its transcript, so the page can be seen.
  if (session && isFixtureMode()) {
    const sample = fixtureReviewCard(id);
    if (sample) return <CardReview card={sample.card} segments={sample.segments} nextId={null} />;
  }
  const db = await createClient();
  const admin = createAdminClient();
  if (!session || !db || !admin) {
    return (
      <EmptyState
        className="mt-10"
        hanate="caring"
        title="review.sign_in"
        action={{ label: "room.back", href: "/#doors" }}
      />
    );
  }
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await getReviewCard(db, admin, session, id) : null;
  if (!found) {
    return (
      <EmptyState
        className="mt-10"
        hanate="caring"
        title="review.card.notfound"
        action={{ label: "review.card.back", href: "/r/cards" }}
      />
    );
  }
  const drafts = await listDrafts(db, admin, session);
  const next =
    drafts.find((d) => d.id !== id && d.createdAt >= found.card.createdAt) ??
    drafts.find((d) => d.id !== id);
  return <CardReview card={found.card} segments={found.segments} nextId={next?.id ?? null} />;
}
