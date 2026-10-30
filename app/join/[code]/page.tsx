// An invite link opened on a phone, often inside WhatsApp's browser. Who: a teacher, master or
// reviewer the founder invited. One job: press Begin. Feeling: expected, welcome, safe; nothing to
// type, and the promise they will agree to is visible before they press anything.
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock, Users } from "lucide-react";
import { beginInvite } from "@/app/actions/invites";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { SampleBadge } from "@/components/parampara/Badges";
import { SiteHeader } from "@/components/parampara/SiteHeader";
import { SubmitButton } from "@/components/parampara/SubmitButton";
import type { AppRole } from "@/lib/auth/roles";
import { CONSENT_TEXT } from "@/lib/consent";
import type { MessageKey } from "@/lib/i18n";
import { isInviteCodeShape, normalizeInviteCode } from "@/lib/invites/code";
import { getInvite } from "@/lib/invites/store";
import { isGroupInvite, type Invite } from "@/lib/invites/types";
import { Closed } from "./Closed";
import { GroupJoin } from "./GroupJoin";

// A link is a bearer credential (D37): never indexed, never sent on as a referrer.
export const metadata: Metadata = {
  title: "Invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const TITLE: Record<AppRole, MessageKey> = {
  teacher: "join.title.teacher",
  master: "join.title.master",
  reviewer: "join.title.reviewer",
  officer: "join.title.officer",
};
const BODY: Record<AppRole, MessageKey> = {
  teacher: "join.body.teacher",
  master: "join.body.master",
  reviewer: "join.body.reviewer",
  officer: "join.body.officer",
};

export default function JoinPage({ params, searchParams }: PageProps<"/join/[code]">) {
  return (
    <div className="bg-dusk-gradient paper-grain flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-4 pb-14 sm:pt-8">
        <Suspense fallback={<JoinSkeleton />}>
          <JoinBody params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function JoinBody({
  params,
  searchParams,
}: Pick<PageProps<"/join/[code]">, "params" | "searchParams">) {
  const { code: raw } = await params;
  const { e, s } = await searchParams;
  let code = "";
  try {
    code = normalizeInviteCode(decodeURIComponent(raw));
  } catch {
    code = "";
  }

  let invite: Invite | null = null;
  let unreachable = false;
  if (isInviteCodeShape(code)) {
    try {
      invite = await getInvite(code);
    } catch {
      unreachable = true;
    }
  }

  if (unreachable) {
    return (
      <Closed hanate="resting" title="error.title" body="login.error.network">
        <Button asChild className="w-full">
          <Link href={`/join/${encodeURIComponent(code)}`}>
            <Bi k="error.retry" sub={false} />
          </Link>
        </Button>
      </Closed>
    );
  }
  if (!invite) return <Closed hanate="caring" title="join.unknown.title" body="join.unknown.body" />;
  if (isGroupInvite(invite)) {
    return <GroupJoin group={invite} failed={e === "1"} status={typeof s === "string" ? s : undefined} />;
  }
  if (invite.revokedAt) {
    return <Closed hanate="caring" title="join.closed.title" body="join.closed.body" />;
  }

  return <Welcome invite={invite} failed={e === "1"} />;
}

function Welcome({ invite, failed }: { invite: Invite; failed: boolean }) {
  return (
    <>
      <div className="rise flex items-center justify-between gap-3">
        <span className="inline-flex h-9 items-center rounded-chip bg-paper/80 px-4 font-display text-[15px] font-bold text-clay-cta shadow-warm-sm">
          <Bi k="join.eyebrow" sub={false} />
        </span>
        {invite.isSample && <SampleBadge />}
      </div>

      <div className="relative mt-2 flex justify-center">
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame/25 blur-3xl"
        />
        <Hanate state="idle" size={112} label="Hanate" className="rise relative" />
      </div>

      <h1
        className="rise mt-3 text-center text-[28px] leading-tight font-extrabold text-ink sm:text-[34px]"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Bi k={TITLE[invite.role]} subClassName="mt-2 font-sans text-lg font-semibold text-ink-3" />
      </h1>
      <p
        className="rise mt-3 text-center text-lg text-ink-3"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <Bi k={BODY[invite.role]} subClassName="text-base" />
      </p>

      {invite.label && (
        <p
          className="rise mt-5 flex items-center justify-center gap-2 self-center rounded-chip border border-border bg-paper px-4 py-2 text-base text-ink shadow-warm-sm"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          <Users className="size-[18px] shrink-0 text-ink-3" aria-hidden />
          <span className="font-semibold text-ink-3">
            <Bi k="join.for" sub={false} className="inline" />
          </span>
          <span className="font-semibold">{invite.label}</span>
        </p>
      )}

      <div className="rise mt-4" style={{ "--i": 4 } as React.CSSProperties}>
        {failed && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-3 rounded-card border border-border bg-paper p-3 pr-4 shadow-warm-sm"
          >
            <Hanate state="caring" size={44} label="" className="shrink-0" />
            <p className="text-base leading-snug">
              <Bi k="join.failed" subClassName="text-[14px]" />
            </p>
          </div>
        )}
        {/* On a short phone (WhatsApp's in-app browser) Begin stays in the thumb zone. */}
        <div
          data-cta-tray
          className="z-10 -mx-5 px-5 pt-4 pb-4 max-md:sticky max-md:bottom-0 max-md:bg-linear-to-t max-md:from-dusk max-md:from-75% max-md:to-dusk/0"
        >
          <p className="mx-auto mb-3 flex w-fit items-start gap-2 text-center text-[15px] text-ink-3">
            <Lock className="mt-1 size-4 shrink-0" aria-hidden />
            <Bi k="join.private" sub={false} />
          </p>
          <form action={beginInvite.bind(null, invite.code)}>
            <SubmitButton pendingLabel="join.pending" className="h-16 w-full text-xl">
              <Bi k="join.begin" sub={false} />
              <ArrowRight aria-hidden />
            </SubmitButton>
          </form>
        </div>
      </div>

      <section
        aria-labelledby="join-preview"
        className="rise mt-9 rounded-card border border-border bg-paper/90 p-5 shadow-warm-sm sm:p-6"
        style={{ "--i": 5 } as React.CSSProperties}
      >
        <h2 id="join-preview" className="font-display text-[17px] font-bold text-clay-cta">
          <Bi k="join.preview" sub={false} />
        </h2>
        <p className="mt-2 text-[17px] text-ink">
          <Bi k={CONSENT_TEXT[invite.role]} subClassName="mt-3 text-[15px]" />
        </p>
      </section>
    </>
  );
}

function JoinSkeleton() {
  return (
    <div aria-hidden className="flex flex-col items-center">
      <span className="h-9 w-48 self-start animate-breathe rounded-chip bg-paper/80" />
      <Hanate state="idle" size={148} label="" className="mt-4" />
      <span className="mt-5 h-9 w-72 animate-breathe rounded-chip bg-paper/80" />
      <span className="mt-3 h-5 w-80 max-w-full animate-breathe rounded-chip bg-paper/70" />
      <span className="mt-8 h-16 w-full animate-breathe rounded-button bg-paper/80" />
      <span className="mt-9 h-40 w-full animate-breathe rounded-card bg-paper/70" />
    </div>
  );
}
