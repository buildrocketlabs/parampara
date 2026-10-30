// The group QR (D80, D84). Who: the founder or a headmaster reviewer, holding a phone up to 5 to 8
// teachers in a staff room, or printing it for the wall. One job: show a QR a camera reads at
// once. Feeling: calm and sure; the code is big, the line under it says what to do in Kannada,
// and the count of places left is the group's, never anyone's own (D46).
import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Clock, Users } from "lucide-react";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { EmptyState } from "@/components/parampara/EmptyState";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { PrintButton } from "@/components/parampara/PrintButton";
import { SampleBadge } from "@/components/parampara/Badges";
import { SessionBar } from "@/components/parampara/SessionBar";
import { originFromHeaders, shareBaseUrl } from "@/lib/app-url";
import { getSessionFor } from "@/lib/auth/session";
import { fill } from "@/lib/i18n/fill";
import { messages } from "@/lib/i18n/messages";
import { isInviteCodeShape, normalizeInviteCode } from "@/lib/invites/code";
import { QR_QUIET, qrDrawing } from "@/lib/invites/qr";
import { inviteLink } from "@/lib/invites/share";
import { formatWhen } from "@/lib/when";
import { getInvite } from "@/lib/invites/store";
import { groupState, isGroupInvite, type GroupState, type Invite } from "@/lib/invites/types";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The QR holds a bearer link for a group: never indexed, never sent on as a referrer.
export const metadata: Metadata = {
  title: "Group QR",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function QrPage({ params }: PageProps<"/r/invites/qr/[code]">) {
  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-dusk-gradient print:bg-white print:bg-none">
      <SessionBar home="/r" compact className="print:hidden" />
      <main
        id="main"
        className="mx-auto w-full max-w-5xl flex-1 px-5 pt-2 pb-16 sm:px-8 sm:pt-6 print:p-0"
      >
        <Link
          href="/r/invites"
          className="inline-flex min-h-12 items-center gap-2 rounded-chip pr-3 font-display text-base font-semibold text-ink-3 hover:text-ink print:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
          <Bi k="invites.title" sub={false} />
        </Link>
        <Suspense fallback={<QrSkeleton />}>
          <QrBody params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function QrBody({ params }: Pick<PageProps<"/r/invites/qr/[code]">, "params">) {
  const session = await getSessionFor("reviewer");
  if (!session) {
    return (
      <EmptyState
        className="mt-10"
        size="page"
        hanate="caring"
        title="invites.gate.title"
        body="invites.gate.body"
        action={{ label: "room.back", href: "/#doors" }}
      />
    );
  }

  const { code: raw } = await params;
  let code = "";
  try {
    code = normalizeInviteCode(decodeURIComponent(raw));
  } catch {
    code = "";
  }
  const invite = isInviteCodeShape(code) ? await getInvite(code).catch(() => null) : null;
  // A Sample reviewer (the public demo) only ever sees Sample groups (D38).
  const allowed = invite && isGroupInvite(invite) && (invite.isSample || !session.isSample);
  if (!invite || !allowed) {
    return (
      <EmptyState
        className="mt-10"
        size="page"
        hanate="caring"
        title="invites.qr.notFound.title"
        body="invites.qr.notFound.body"
        action={{ label: "invites.title", href: "/r/invites" }}
      />
    );
  }

  const link = inviteLink(shareBaseUrl(originFromHeaders(await headers())), invite.code);
  return <GroupQr invite={invite} link={link} state={groupState(invite)} />;
}

const STOPPED: Record<Exclude<GroupState["kind"], "open">, MessageKey> = {
  full: "invites.qr.full",
  expired: "invites.qr.expired",
  closed: "invites.qr.closed",
};

function GroupQr({ invite, link, state }: { invite: Invite; link: string; state: GroupState }) {
  const open = state.kind === "open";
  const until = invite.expiresAt ? untilLine(invite.expiresAt) : null;
  return (
    <div className="mt-2 grid items-start gap-8 lg:mt-2 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:gap-14 print:block">
      <section
        aria-labelledby="qr-label"
        data-testid="group-qr"
        className="mx-auto w-full max-w-md rise rounded-card border border-border bg-paper p-5 text-center shadow-warm-lg sm:p-7 lg:max-w-none print:max-w-none print:border-0 print:shadow-none"
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-chip bg-cream px-3 text-[14px] font-semibold text-ink-3">
            <Users className="size-4" aria-hidden />
            <Bi k="invites.group" sub={false} />
          </span>
          {invite.isSample && <SampleBadge />}
        </div>
        <h1
          id="qr-label"
          className="mt-3 font-display text-[28px] leading-tight font-extrabold text-ink sm:text-[32px]"
        >
          {invite.label ?? invite.code}
        </h1>

        {open ? (
          <>
            <QrSvg link={link} />
            {/* Always both lines, whatever the screen language: the teachers read Kannada. */}
            <p
              lang="kn"
              className="mt-4 font-display text-[30px] leading-tight font-extrabold text-clay sm:text-[34px]"
            >
              {messages.kn["invites.qr.scan"]}
            </p>
            <p lang="en" className="mt-1 text-lg font-semibold text-ink-3">
              {messages.en["invites.qr.scan"]}
            </p>
          </>
        ) : (
          <div className="my-6 flex flex-col items-center" data-testid={`qr-${state.kind}`}>
            <Hanate state="caring" size={120} label="" />
            <p className="mt-4 max-w-xs text-lg font-semibold text-ink">
              <Bi k={STOPPED[state.kind]} subClassName="text-base font-normal text-ink-3" />
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {/* The group's count only: how many places are left, never who used them (D46). */}
          <span
            data-testid="qr-left"
            className={cn(
              "inline-flex min-h-9 items-center rounded-chip px-3.5 font-display text-[15px] font-bold tabular-nums",
              open ? "bg-sage text-ink" : "bg-cream text-ink-3",
            )}
          >
            <BiText
              text="invites.group.left"
              vars={{ n: state.kind === "open" ? state.left : 0, m: invite.maxUses ?? 0 }}
              sub={false}
              inline
            />
          </span>
          {until && (
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-chip bg-cream px-3.5 text-[15px] font-semibold text-ink-3">
              <Clock className="size-4" aria-hidden />
              <BiText text={until} sub={false} inline />
            </span>
          )}
        </div>
      </section>

      <aside
        className="flex rise flex-col gap-5 print:hidden"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <div className="flex items-start gap-3 rounded-card border border-border bg-paper/80 p-4 shadow-warm-sm lg:p-5">
          <Hanate state="idle" size={56} label="" className="shrink-0" />
          <p className="text-lg leading-snug text-ink">
            <Bi k="invites.qr.hint" subClassName="mt-1 text-base text-ink-3" />
          </p>
        </div>
        {open && <PrintButton label="invites.qr.print" className="w-full sm:w-fit" />}
      </aside>
    </div>
  );
}

/** The QR as one SVG path, drawn on the server; dark modules on white for any camera. */
function QrSvg({ link }: { link: string }) {
  const { size, path } = qrDrawing(link);
  const box = size + QR_QUIET * 2;
  return (
    // On a laptop the code is capped by the screen's height (34vh is about 270 px at 800 px), so the
    // places left and the closing time stay in view without scrolling (F-P1); a camera still reads
    // it at arm's length. Printed, it is 12 cm.
    <div className="mx-auto mt-5 w-full max-w-[340px] rounded-[20px] bg-white p-2 shadow-warm-sm ring-1 ring-border sm:max-w-[380px] lg:max-w-[min(380px,34vh)] print:max-w-[12cm] print:shadow-none print:ring-0">
      <svg
        role="img"
        aria-label={`${messages.en["invites.qr.scan"]}: ${link}`}
        viewBox={`${-QR_QUIET} ${-QR_QUIET} ${box} ${box}`}
        shapeRendering="crispEdges"
        className="block h-auto w-full"
        data-qr-link={link}
      >
        <rect x={-QR_QUIET} y={-QR_QUIET} width={box} height={box} className="fill-white" />
        {/* The darkest token (ink), for contrast a phone camera reads at once. */}
        <path d={path} className="fill-ink" />
      </svg>
    </div>
  );
}

/** "Open until ಶುಕ್ರವಾರ, 30 ಅಕ್ಟೋಬರ್, ರಾತ್ರಿ 3:00": IST, the day part in words (F-P1). */
function untilLine(iso: string): { kn: string; en: string } | null {
  const kn = formatWhen(iso, "kn");
  const en = formatWhen(iso, "en");
  if (!kn || !en) return null;
  return {
    kn: fill(messages.kn["invites.qr.until"], { t: kn }),
    en: fill(messages.en["invites.qr.until"], { t: en }),
  };
}

function QrSkeleton() {
  return (
    <div
      aria-hidden
      className="mx-auto mt-4 flex max-w-md flex-col items-center rounded-card bg-paper/80 p-7"
    >
      <span className="h-8 w-48 animate-breathe rounded-chip bg-cream" />
      <span className="mt-5 aspect-square w-full max-w-[340px] animate-breathe rounded-[20px] bg-cream" />
      <span className="mt-5 h-8 w-64 animate-breathe rounded-chip bg-cream" />
    </div>
  );
}
