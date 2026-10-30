"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markPageOffline } from "@/lib/page-offline";
import { Bi } from "./Bi";
import { Hanate } from "./hanate/Hanate";

// A page that could not open because the network is gone (F-P2). Offline is a mode, not a failure
// (DESIGN §4): Hanate rests, the words are calm and true, nothing says "went wrong". The page opens
// by itself the moment the network is back; until then the reader can go back to what they had,
// and a teacher gets her saved and lately opened answers one tap away (F-P1).
export function OfflineState({ reset }: { reset?: () => void }) {
  const [room, setRoom] = useState<"teacher" | "officer" | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const path = window.location.pathname;
      setRoom(/^\/t(\/|$)/.test(path) ? "teacher" : /^\/i(\/|$)/.test(path) ? "officer" : null);
      setCanGoBack(window.history.length > 1);
    });
    const unmark = markPageOffline();
    // A full load, so a page whose code never reached the phone loads whole once it can.
    const reopen = () => window.location.reload();
    // Back to a view the phone already has: show it again (the boundary does not reset by itself
    // when only the query changed, as with the Pulse's Field and Sample switch).
    const back = () => reset?.();
    window.addEventListener("online", reopen);
    window.addEventListener("popstate", back);
    return () => {
      unmark();
      window.removeEventListener("online", reopen);
      window.removeEventListener("popstate", back);
    };
  }, [reset]);

  return (
    <main
      id="main"
      data-offline-state
      data-offline-page
      className="paper-grain flex min-h-dvh flex-col items-center justify-center bg-dusk-gradient px-5 py-10 text-center"
    >
      <Hanate state="resting" size={140} label="" />
      <h1 className="mt-6 text-[30px] leading-tight font-bold">
        <Bi k="offline.page.title" subClassName="font-sans text-lg font-semibold text-ink-3" />
      </h1>
      <p className="mt-3 max-w-sm text-lg text-ink-3" role="status">
        <Bi
          k={
            room === "teacher"
              ? "error.offline.body"
              : room === "officer"
                ? "offline.page.body.officer"
                : "offline.page.body"
          }
          subClassName="text-base"
        />
      </p>
      <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
        {room === "teacher" && (
          <Button asChild className="w-full">
            {/* A plain link: a full navigation the service worker can answer from its cache (F-P1). */}
            <a href="/t/saved">
              <BookOpenText aria-hidden />
              <Bi k="error.offline.saved" sub={false} />
            </a>
          </Button>
        )}
        {/* Opening it again is the way through; it leads unless a teacher has her answers to go to. */}
        <Button
          variant={room === "teacher" ? "paper" : "clay"}
          className="w-full"
          onClick={() => window.location.reload()}
        >
          <Bi k="offline.page.reopen" sub={false} />
        </Button>
        {canGoBack && (
          <Button
            variant={room === "teacher" ? "ghost" : "paper"}
            className="w-full"
            onClick={() => window.history.back()}
          >
            <ArrowLeft aria-hidden />
            <Bi k="offline.page.back" sub={false} />
          </Button>
        )}
      </div>
    </main>
  );
}
