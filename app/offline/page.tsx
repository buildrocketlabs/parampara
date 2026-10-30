// The page the service worker shows when the network is gone and the page asked for was never
// kept (D52). Static, no session. One job: point to what still works. Never a red error.
import type { Metadata } from "next";
import { BookOpenText } from "lucide-react";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { LanguageToggle } from "@/components/parampara/LanguageToggle";
import { Wordmark } from "@/components/parampara/Wordmark";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

export default function Offline() {
  return (
    <div data-offline-page className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-5 pt-4">
        <Wordmark />
        <LanguageToggle />
      </header>
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
        <Hanate state="resting" size={140} label="" />
        <h1 className="mt-5 text-[30px] leading-tight font-bold">
          <Bi k="pwa.offline.title" subClassName="font-sans text-lg font-semibold" />
        </h1>
        <p className="mt-3 text-lg text-ink-3">
          <Bi k="pwa.offline.body" subClassName="text-base" />
        </p>
        {/* A plain link: a full navigation the service worker can answer from its cache. */}
        <a
          href="/t/saved"
          className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-button bg-clay-cta px-7 font-display text-lg font-bold text-white lip-clay"
        >
          <BookOpenText className="size-5" aria-hidden />
          <Bi k="pwa.saved.title" sub={false} />
        </a>
      </main>
    </div>
  );
}
