// Saved answers. Who: the teacher, often with no network at school. One job: open an answer she
// kept, even in airplane mode. Feeling: her own small library, always there.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Bi } from "@/components/parampara/Bi";
import { RoomSoon } from "@/components/parampara/RoomSoon";
import { SessionBar } from "@/components/parampara/SessionBar";
import { SkeletonCard } from "@/components/parampara/Skeleton";
import { SavedLibrary } from "@/components/teacher/SavedLibrary";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Saved answers", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<SkeletonCard lines={3} className="mx-auto mt-24 max-w-xl" />}>
      <Saved />
    </Suspense>
  );
}

async function Saved() {
  const session = await getSession();
  if (!session || session.role !== "teacher" || !session.consentedAt)
    return <RoomSoon role="teacher" />;
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-cream">
      <SessionBar home="/t" />
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-5 pt-4 pb-16">
        <Link
          href="/t"
          className="inline-flex min-h-12 items-center gap-2 font-display text-lg font-bold text-ink-3 hover:text-ink"
        >
          <ArrowLeft className="size-5" aria-hidden />
          <Bi k="tried.home" sub={false} />
        </Link>
        <h1 className="mt-3 text-[30px] leading-tight font-bold">
          <Bi k="pwa.saved.title" subClassName="font-sans text-lg font-semibold" />
        </h1>
        <p className="mt-2 text-lg text-ink-3">
          <Bi k="pwa.saved.sub" subClassName="text-base" />
        </p>
        <SavedLibrary />
      </main>
    </div>
  );
}
