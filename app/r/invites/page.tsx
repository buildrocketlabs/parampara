// Invite generator. Who: the founder or a reviewer, on a laptop or a phone, sending field links.
// One job: make links, then send each to one person on WhatsApp. Feeling: quick, exact, in
// control; every number is the database's, and sample links say Sample.
import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, MessageCircle, PartyPopper, QrCode, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { EnterAs } from "@/components/parampara/EnterAs";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { HanateMoment } from "@/components/parampara/HanateMoment";
import { CopyButton, RevokeControl } from "@/components/parampara/InviteActions";
import { InviteForm } from "@/components/parampara/InviteForm";
import { ROLE_ICON, ROLE_NAME } from "@/components/parampara/role-meta";
import { SampleBadge } from "@/components/parampara/Badges";
import { ScrollHere } from "@/components/parampara/ScrollHere";
import { SessionBar } from "@/components/parampara/SessionBar";
import { originFromHeaders, shareBaseUrl } from "@/lib/app-url";
import { getSessionFor } from "@/lib/auth/session";
import { formatInviteCode } from "@/lib/invites/code";
import { inviteLink, shareMessage, whatsappHref } from "@/lib/invites/share";
import { listInvitesBy } from "@/lib/invites/store";
import {
  groupState,
  inviteStatus,
  isGroupInvite,
  isInvitableRole,
  type Invite,
} from "@/lib/invites/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Invite links",
  robots: { index: false, follow: false },
};

export default function InvitesPage({ searchParams }: PageProps<"/r/invites">) {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient">
      <SessionBar home="/r" />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-16 sm:px-8 sm:pt-10">
        <Suspense fallback={<InvitesSkeleton />}>
          <InvitesBody searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function InvitesBody({ searchParams }: Pick<PageProps<"/r/invites">, "searchParams">) {
  const [session, query] = await Promise.all([getSessionFor("reviewer"), searchParams]);
  if (!session) return <Gate />;

  const base = shareBaseUrl(originFromHeaders(await headers()));
  let all: Invite[] | null = null;
  try {
    all = await listInvitesBy(session.userId, { fieldGroups: !session.isSample });
  } catch {
    all = null;
  }
  // People who joined through a group QR are listed under their group, not as links of their own.
  const invites = all?.filter((i) => !i.parentCode) ?? null;
  const joined = new Map<string, Invite[]>();
  for (const i of all ?? []) {
    if (i.parentCode) joined.set(i.parentCode, [...(joined.get(i.parentCode) ?? []), i]);
  }
  const made = Math.max(0, Math.min(50, Number(query.made) || 0));
  const fresh = invites?.filter((i) => !i.revokedAt).slice(0, made) ?? [];
  const freshCodes = new Set(fresh.map((i) => i.code));

  return (
    <>
      <Link
        href="/r"
        className="inline-flex min-h-12 rise items-center gap-2 rounded-chip pr-3 font-display text-base font-semibold text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-5" aria-hidden />
        <Bi k="room.reviewer" sub={false} />
      </Link>
      <h1 className="mt-2 rise text-[34px] leading-tight font-extrabold sm:text-[42px]">
        <Bi k="invites.title" subClassName="font-sans text-lg font-semibold text-ink-3" />
      </h1>
      <p
        className="mt-2 max-w-2xl rise text-lg text-ink-3"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Bi k="invites.sub" subClassName="text-base" />
      </p>
      {session.isSample && (
        <p
          className="mt-4 flex rise flex-col items-start gap-3 rounded-card border border-dashed border-ink-3/40 bg-paper/70 p-4 text-base text-ink-3 sm:flex-row"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <SampleBadge className="mt-0.5" />
          <Bi k="invites.sampleNote" sub={false} />
        </p>
      )}

      <div className="mt-8 grid items-start gap-6 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] md:gap-8">
        <section
          aria-labelledby="invites-make"
          className="rise rounded-card border border-border bg-paper p-5 shadow-warm sm:p-6 md:sticky md:top-6"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          <h2 id="invites-make" className="mb-5 text-[24px] leading-tight font-bold">
            <Bi k="invites.make" sub={false} />
          </h2>
          <InviteForm district={session.district ?? "Koppal"} />
        </section>

        {/* After making links, a phone shows them first: the form can wait below. */}
        <section
          aria-labelledby="invites-list"
          className={cn("min-w-0 rise", fresh.length > 0 && "max-md:order-first")}
          style={{ "--i": 4 } as React.CSSProperties}
        >
          {fresh.length > 0 && (
            <>
              <ScrollHere />
              <MadeNotice invites={fresh} base={base} />
            </>
          )}
          {query.closed && <Notice tone="calm" k="invites.closed" />}
          {query.e === "revoke" && <Notice tone="caring" k="invites.error.revoke" />}

          <div className="flex items-baseline justify-between gap-3">
            <h2 id="invites-list" className="text-[24px] leading-tight font-bold">
              <Bi k="invites.list" sub={false} />
            </h2>
            {invites && invites.length > 0 && <OpenedOf invites={invites} />}
          </div>

          {invites === null ? (
            <Notice tone="caring" k="invites.error.load" className="mt-4" />
          ) : invites.length === 0 ? (
            <Empty />
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {invites.map((invite) => (
                <InviteRow
                  key={invite.code}
                  invite={invite}
                  base={base}
                  fresh={freshCodes.has(invite.code)}
                  people={joined.get(invite.code) ?? []}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function InviteRow({
  invite,
  base,
  fresh,
  people,
}: {
  invite: Invite;
  base: string;
  fresh: boolean;
  people: Invite[];
}) {
  if (isGroupInvite(invite)) return <GroupRow invite={invite} base={base} people={people} />;
  const link = inviteLink(base, invite.code);
  const status = inviteStatus(invite);
  const Icon = ROLE_ICON[invite.role];
  const revoked = status.kind === "revoked";
  const share = isInvitableRole(invite.role) ? shareMessage(invite.role, link) : link;

  return (
    <li
      data-invite={invite.code}
      className={cn(
        "rounded-card border bg-paper p-4 shadow-warm-sm sm:p-5",
        fresh ? "border-flame-deep shadow-flame" : "border-border",
        revoked && "bg-paper/60 shadow-none",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2.5">
            <span
              className={cn(
                "font-display text-[22px] leading-none font-extrabold tracking-[0.08em]",
                revoked ? "text-ink-3 line-through decoration-2" : "text-ink",
              )}
            >
              {formatInviteCode(invite.code)}
            </span>
            {fresh && (
              <span className="rounded-chip bg-flame px-2.5 py-0.5 font-display text-[14px] font-bold text-ink">
                <Bi k="invites.new" sub={false} />
              </span>
            )}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[15px] text-ink-3">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink-2">
              <Icon className="size-4" strokeWidth={2.2} aria-hidden />
              <Bi k={ROLE_NAME[invite.role]} sub={false} />
            </span>
            {invite.label && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{invite.label}</span>
              </>
            )}
            {invite.district && (
              <>
                <span aria-hidden>·</span>
                <span>{invite.district}</span>
              </>
            )}
            {invite.isSample && <SampleBadge className="ml-1" />}
          </p>
        </div>
        <StatusPill invite={invite} />
      </div>

      {!revoked && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild variant={fresh ? "clay" : "paper"} size={fresh ? "lg" : "md"}>
            <a
              href={whatsappHref(share)}
              target="_blank"
              rel="noopener noreferrer"
              data-share="whatsapp"
            >
              <MessageCircle aria-hidden />
              <Bi k="invites.whatsapp" sub={false} />
            </a>
          </Button>
          <CopyButton text={link} />
          <RevokeControl code={invite.code} />
        </div>
      )}
    </li>
  );
}

const GROUP_STOPPED = {
  closed: "invites.status.revoked",
  full: "invites.group.full",
  expired: "invites.group.expired",
} as const;

/**
 * A group QR (D80): shown on a phone or printed, never forwarded (no WhatsApp share). The count is
 * the group's places left; the people who joined appear only as their codes, so one can be closed
 * if it must stop (D81).
 */
function GroupRow({ invite, base, people }: { invite: Invite; base: string; people: Invite[] }) {
  const state = groupState(invite);
  const live = state.kind === "open";
  const revoked = state.kind === "closed";
  return (
    <li
      data-invite={invite.code}
      data-group
      className={cn(
        "rounded-card border bg-paper p-4 shadow-warm-sm sm:p-5",
        live ? "border-flame-deep/60" : "border-border",
        revoked && "bg-paper/60 shadow-none",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2.5">
            <span
              className={cn(
                "font-display text-[22px] leading-none font-extrabold",
                revoked ? "text-ink-3 line-through decoration-2" : "text-ink",
              )}
            >
              {invite.label ?? formatInviteCode(invite.code)}
            </span>
            <span className="inline-flex h-7 items-center gap-1 rounded-chip bg-cream px-2.5 text-[14px] font-semibold text-ink-3">
              <QrCode className="size-4" aria-hidden />
              <Bi k="invites.group" sub={false} />
            </span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[15px] text-ink-3">
            <span className="font-display tracking-[0.08em]">{formatInviteCode(invite.code)}</span>
            {invite.district && (
              <>
                <span aria-hidden>·</span>
                <span>{invite.district}</span>
              </>
            )}
            {invite.isSample && <SampleBadge className="ml-1" />}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-chip px-3 text-[14px] font-semibold tabular-nums",
            live ? "bg-sage text-ink" : "border border-dashed border-ink-3/50 text-ink-3",
          )}
        >
          {state.kind === "open" ? (
            <BiText
              text="invites.group.left"
              vars={{ n: state.left, m: invite.maxUses ?? 0 }}
              sub={false}
              inline
            />
          ) : (
            <Bi k={GROUP_STOPPED[state.kind]} sub={false} />
          )}
        </span>
      </div>

      {!revoked && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild variant={live ? "clay" : "paper"} size="md">
            <Link href={`/r/invites/qr/${encodeURIComponent(invite.code)}`} data-testid="show-qr">
              <QrCode aria-hidden />
              <Bi k="invites.qr.open" sub={false} />
            </Link>
          </Button>
          <CopyButton text={inviteLink(base, invite.code)} />
          <RevokeControl code={invite.code} />
        </div>
      )}

      {people.length > 0 && (
        <details className="mt-4 border-t border-border pt-3">
          <summary className="flex min-h-12 w-fit cursor-pointer list-none items-center gap-2 rounded-chip font-display text-[15px] font-bold text-ink-3 hover:text-ink [&::-webkit-details-marker]:hidden">
            <Users className="size-4" aria-hidden />
            <BiText text="invites.group.people" vars={{ n: people.length }} sub={false} inline />
          </summary>
          <p className="mt-1 text-[15px] text-ink-3">
            <Bi k="invites.group.peopleNote" sub={false} />
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {people.map((p) => (
              <li
                key={p.code}
                data-invite={p.code}
                className="flex flex-wrap items-center justify-between gap-2 rounded-button bg-cream/70 px-3 py-2"
              >
                <span
                  className={cn(
                    "font-display text-[17px] font-bold tracking-[0.08em]",
                    p.revokedAt ? "text-ink-3 line-through" : "text-ink",
                  )}
                >
                  {formatInviteCode(p.code)}
                </span>
                {p.revokedAt ? (
                  <span className="text-[14px] font-semibold text-ink-3">
                    <Bi k="invites.status.revoked" sub={false} />
                  </span>
                ) : (
                  <RevokeControl code={p.code} />
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function StatusPill({ invite }: { invite: Invite }) {
  const status = inviteStatus(invite);
  const base =
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-chip px-3 text-[14px] font-semibold";
  if (status.kind === "revoked") {
    return (
      <span className={cn(base, "border border-dashed border-ink-3/50 text-ink-3")}>
        <Bi k="invites.status.revoked" sub={false} />
      </span>
    );
  }
  if (status.kind === "unopened") {
    return (
      <span className={cn(base, "bg-cream text-ink-3")}>
        <span aria-hidden className="size-2 rounded-full bg-ink/25" />
        <Bi k="invites.status.unopened" sub={false} />
      </span>
    );
  }
  // Opened or not is enough to follow up. How often one person opens their link is theirs alone
  // (Law 6: teachers are never monitored), so counts appear only as the total in the header.
  return (
    <span className={cn(base, "bg-sage text-ink")}>
      <span aria-hidden className="size-2 rounded-full bg-moss" />
      <Bi k="invites.status.opened" sub={false} />
    </span>
  );
}

function OpenedOf({ invites }: { invites: Invite[] }) {
  const live = invites.filter((i) => !i.revokedAt);
  const opened = live.filter((i) => i.useCount > 0).length;
  return (
    <span className="font-display text-base font-semibold text-ink-3">
      <BiText text="invites.openedOf" vars={{ n: opened, m: live.length }} sub={false} />
    </span>
  );
}

function MadeNotice({ invites, base }: { invites: Invite[]; base: string }) {
  const lines = invites
    .map((i) => [i.label, inviteLink(base, i.code)].filter(Boolean).join("  "))
    .join("\n");
  const first = invites[0];
  return (
    <div
      id="made"
      role="status"
      className="mb-6 scroll-mt-6 rounded-card bg-ink p-4 text-white shadow-warm-lg sm:p-5"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-chip bg-ink-2">
          <HanateMoment moment="happy" size={34} label="" />
        </span>
        <p className="flex-1 text-lg font-semibold">
          {invites.length === 1 ? (
            <Bi k="invites.made.one" sub={false} />
          ) : (
            <BiText text="invites.made.many" vars={{ n: invites.length }} sub={false} />
          )}
        </p>
        <PartyPopper className="hidden size-6 text-flame sm:block" aria-hidden />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton text={lines} label="invites.copyAll" variant="paper" />
      </div>
      {first && isInvitableRole(first.role) && (
        <details className="group mt-3">
          <summary className="flex min-h-12 w-fit cursor-pointer list-none items-center rounded-chip text-[15px] font-semibold text-mist hover:text-white [&::-webkit-details-marker]:hidden">
            <Bi k="invites.preview" sub={false} />
          </summary>
          <p
            lang="kn"
            className="mt-1 rounded-button bg-ink-2 p-4 text-[15px] whitespace-pre-line text-white"
          >
            {shareMessage(first.role, inviteLink(base, first.code))}
          </p>
        </details>
      )}
    </div>
  );
}

function Notice({
  tone,
  k,
  className,
}: {
  tone: "calm" | "caring";
  k: "invites.closed" | "invites.error.revoke" | "invites.error.load";
  className?: string;
}) {
  return (
    <div
      role={tone === "caring" ? "alert" : "status"}
      className={cn(
        "mb-5 flex items-center gap-3 rounded-card border border-border bg-paper p-3 pr-4 shadow-warm-sm",
        className,
      )}
    >
      <Hanate
        state={tone === "caring" ? "caring" : "idle"}
        size={40}
        label=""
        className="shrink-0"
      />
      <p className="text-base leading-snug">
        <Bi k={k} sub={false} />
      </p>
    </div>
  );
}

function Empty() {
  return (
    <div className="mt-4 flex flex-col items-center rounded-card border border-dashed border-ink-3/30 bg-paper/60 px-6 py-10 text-center">
      <Hanate state="idle" size={96} label="" />
      <p className="mt-4 font-display text-[22px] font-bold">
        <Bi k="invites.empty.title" sub={false} />
      </p>
      <p className="mt-1 text-base text-ink-3">
        <Bi k="invites.empty.body" sub={false} />
      </p>
    </div>
  );
}

function Gate() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-10 text-center">
      <Hanate state="idle" size={160} label="Hanate" className="rise" />
      <h1
        className="mt-6 rise text-[30px] leading-tight font-bold"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Bi k="invites.gate.title" subClassName="font-sans text-lg font-semibold text-ink-3" />
      </h1>
      <p className="mt-3 rise text-lg text-ink-3" style={{ "--i": 2 } as React.CSSProperties}>
        <Bi k="invites.gate.body" subClassName="text-base" />
      </p>
      <div
        className="mt-10 flex w-full rise flex-col gap-3"
        style={{ "--i": 4 } as React.CSSProperties}
      >
        <EnterAs role="reviewer" next="/r/invites" />
        <Button asChild variant="paper" className="w-full">
          <Link href="/">
            <ArrowLeft aria-hidden />
            <Bi k="room.back" sub={false} />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function InvitesSkeleton() {
  return (
    <div aria-hidden>
      <span className="block h-10 w-64 animate-breathe rounded-chip bg-paper/80" />
      <span className="mt-3 block h-5 w-96 max-w-full animate-breathe rounded-chip bg-paper/70" />
      <div className="mt-8 grid gap-6 md:grid-cols-[380px_1fr] md:gap-8">
        <span className="h-[480px] animate-breathe rounded-card bg-paper/80" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-36 animate-breathe rounded-card bg-paper/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
