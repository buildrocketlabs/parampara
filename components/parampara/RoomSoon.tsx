import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/auth/roles";
import type { MessageKey } from "@/lib/i18n";
import { getSession } from "@/lib/auth/session";
import { Bi } from "./Bi";
import { EnterAs } from "./EnterAs";
import { Hanate } from "./hanate/Hanate";
import { HanateMoment } from "./HanateMoment";
import { LampsLighting } from "./LampsLighting";
import { ROLE_ROOM } from "./role-meta";
import { SessionBar } from "./SessionBar";

// A role's room before it is built. Never a dead end: the session bar says who you are, and a
// visitor without the right session gets the one tap way in instead of a closed door.
export function RoomSoon({ role }: { role: AppRole }) {
  return (
    <div className="bg-dusk-gradient paper-grain flex min-h-dvh flex-col">
      <SessionBar />
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <p className="rise font-display text-lg font-semibold text-ink-3">
          <Bi k={ROLE_ROOM[role]} sub={false} />
        </p>
        <Suspense fallback={<RoomSkeleton />}>
          <RoomBody role={role} />
        </Suspense>
      </main>
    </div>
  );
}

async function RoomBody({ role }: { role: AppRole }) {
  const session = await getSession();
  // The landing's doors swap a session for a Sample account, so a real (invited) person is not
  // sent there; their own link is their way back.
  const exit =
    !session || session.isSample ? (
      <Button asChild variant="paper" className="rise mt-3 w-full" style={{ "--i": 5 } as React.CSSProperties}>
        <Link href="/">
          <ArrowLeft aria-hidden />
          <Bi k="room.back" sub={false} />
        </Link>
      </Button>
    ) : (
      <p className="rise mt-4 text-base text-ink-3" style={{ "--i": 5 } as React.CSSProperties}>
        <Bi k="room.keepLink" subClassName="text-[14px]" />
      </p>
    );

  if (session?.role === role && !session.consentedAt) {
    return (
      <>
        <Body hanate="idle" title="room.consent.title" body="room.consent.body">
          <Button asChild className="w-full">
            <Link href="/welcome">
              <Bi k="room.consent.cta" sub={false} />
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </Body>
        {exit}
      </>
    );
  }

  if (session?.role === role) {
    return (
      <>
        <Body hanate="glad" title="room.soon.title" body="room.soon.body">
          {role === "reviewer" && (
            <Button asChild variant="ink" className="w-full">
              <Link href="/r/invites">
                <Link2 aria-hidden />
                <Bi k="room.invites" sub={false} />
              </Link>
            </Button>
          )}
        </Body>
        {exit}
      </>
    );
  }

  return (
    <>
      <Body
        hanate="idle"
        title={session ? "room.switch.title" : "room.enter.title"}
        body={session ? "room.switch.body" : "room.enter.body"}
      >
        <EnterAs role={role} />
      </Body>
      {exit}
    </>
  );
}

function Body({
  hanate,
  title,
  body,
  children,
}: {
  /** glad: Hanate is happy you came in, then settles to idle. */
  hanate: "idle" | "glad";
  title: MessageKey;
  body: MessageKey;
  children?: React.ReactNode;
}) {
  return (
    <>
      {hanate === "glad" ? (
        <>
          <HanateMoment moment="happy" forSeconds={1.8} size={152} label="Hanate" className="rise mt-4" />
          <LampsLighting count={3} className="mt-2" />
        </>
      ) : (
        <Hanate state="idle" size={168} label="Hanate" className="rise mt-4" />
      )}
      <h1
        className="rise mt-6 text-[30px] leading-tight font-bold"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Bi k={title} subClassName="font-sans text-lg font-semibold text-ink-3" />
      </h1>
      <p className="rise mt-3 text-lg text-ink-3" style={{ "--i": 2 } as React.CSSProperties}>
        <Bi k={body} subClassName="text-base" />
      </p>
      {children && (
        <div className="rise mt-10 w-full" style={{ "--i": 4 } as React.CSSProperties}>
          {children}
        </div>
      )}
      {!children && <div className="mt-10" />}
    </>
  );
}

function RoomSkeleton() {
  return (
    <div aria-hidden className="mt-4 flex w-full flex-col items-center">
      <Hanate state="idle" size={168} label="" />
      <span className="mt-6 h-8 w-64 animate-breathe rounded-chip bg-paper/80" />
      <span className="mt-4 h-5 w-72 animate-breathe rounded-chip bg-paper/70" />
      <span className="mt-10 h-14 w-full animate-breathe rounded-button bg-paper/70" />
    </div>
  );
}
