"use client";

import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { OfflineState } from "@/components/parampara/OfflineState";
import { isNetworkFailure } from "@/lib/page-offline";
import { useOnline } from "@/lib/use-online";

// Never a raw error (BRIEF §7.6). Hanate cares, says what to do, offers one action. A page that
// could not load because the network is gone is not an error: it says so calmly (F-P2).
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const online = useOnline();
  if (isNetworkFailure(error, online)) return <OfflineState reset={reset} />;
  return (
    <main
      id="main"
      className="paper-grain flex min-h-dvh flex-col items-center justify-center bg-dusk-gradient px-5 py-10 text-center"
    >
      <Hanate state="caring" size={160} label="Hanate" />
      <h1 className="mt-6 text-[30px] leading-tight font-bold">
        <Bi k="error.title" subClassName="font-sans text-lg font-semibold text-ink-3" />
      </h1>
      <p className="mt-3 max-w-sm text-lg text-ink-3">
        <Bi k="error.body" subClassName="text-base" />
      </p>
      <Button onClick={reset} className="mt-10 w-full max-w-sm">
        <Bi k="error.retry" sub={false} />
      </Button>
    </main>
  );
}
