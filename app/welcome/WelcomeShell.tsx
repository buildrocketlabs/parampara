import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { SiteHeader } from "@/components/parampara/SiteHeader";

// Shared frame of the two welcome steps: a slim header on the dusk canvas and a phone width
// column. No identity row here: the steps row carries the Sample badge, so the content (and the
// one action) stays high on a phone.
export function WelcomeShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="bg-dusk-gradient paper-grain flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className={`mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-4 sm:pt-8 ${wide ? "md:max-w-3xl" : ""}`}>{children}</main>
    </div>
  );
}

/** /welcome without a session: the invite link is the way in, so say that and offer home. */
export function NoSession() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
      <Hanate state="caring" size={160} label="Hanate" className="rise" />
      <h1 className="rise mt-6 text-[30px] leading-tight font-bold" style={{ "--i": 1 } as React.CSSProperties}>
        <Bi k="welcome.noSession.title" subClassName="font-sans text-lg font-semibold text-ink-3" />
      </h1>
      <p className="rise mt-3 max-w-sm text-lg text-ink-3" style={{ "--i": 2 } as React.CSSProperties}>
        <Bi k="welcome.noSession.body" subClassName="text-base" />
      </p>
      <Button asChild className="rise mt-10 w-full max-w-sm" style={{ "--i": 4 } as React.CSSProperties}>
        <Link href="/">
          <ArrowLeft aria-hidden />
          <Bi k="room.back" sub={false} />
        </Link>
      </Button>
    </div>
  );
}

/** Kind inline error with Hanate caring; the same button below is the retry. */
export function StepError({ k }: { k: "welcome.error" | "welcome.lang.error" }) {
  return (
    <div
      role="alert"
      className="mt-5 flex items-center gap-3 rounded-card border border-border bg-paper p-3 pr-4 shadow-warm-sm"
    >
      <Hanate state="caring" size={44} label="" className="shrink-0" />
      <p className="text-base leading-snug">
        <Bi k={k} subClassName="text-[14px]" />
      </p>
    </div>
  );
}

export function StepSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <span className="h-5 w-40 animate-breathe rounded-chip bg-paper/80" />
      <Hanate state="idle" size={124} label="" className="mt-6 self-center" />
      <span className="mt-5 h-9 w-72 self-center animate-breathe rounded-chip bg-paper/80" />
      <span className="mt-6 h-64 w-full animate-breathe rounded-card bg-paper/70" />
    </div>
  );
}
