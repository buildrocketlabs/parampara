// A group QR scanned on a teacher's own phone (D80, D83). Who: one of 5 to 8 teachers sitting with
// the headmaster, camera just opened the link. One job: read (or hear) the promise and press I agree;
// that one tap gives this phone its own anonymous place and opens the mic. Feeling: welcome, safe,
// quick; nothing to type, no name asked, and the promise is the page itself.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Lock, Users } from "lucide-react";
import { joinGroupInvite } from "@/app/actions/invites";
import { Bi } from "@/components/parampara/Bi";
import { ConsentReader } from "@/components/parampara/ConsentReader";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { SampleBadge } from "@/components/parampara/Badges";
import { SubmitButton } from "@/components/parampara/SubmitButton";
import { FIXTURE_INVITE_COOKIE, getSession } from "@/lib/auth/session";
import { CONSENT_AUDIO, CONSENT_TEXT } from "@/lib/consent";
import { isFixtureMode } from "@/lib/env";
import { messages } from "@/lib/i18n/messages";
import { rememberedGroupChild } from "@/lib/invites/group-cookie";
import { findGroupChildOf, getInvite } from "@/lib/invites/store";
import { groupState, type Invite } from "@/lib/invites/types";
import { Closed } from "./Closed";

export async function GroupJoin({
  group,
  failed,
  status,
}: {
  group: Invite;
  failed: boolean;
  /** Why the last press did not get a place (?s=…), when the page alone cannot tell. */
  status: string | undefined;
}) {
  // 1. Already in, through this very QR: straight back to asking (no second place taken).
  if (await signedInThroughGroup(group.code)) redirect("/t");

  // 2. This phone joined before but its session ended: one tap back into its own account.
  const remembered = await rememberedGroupChild(group.code);
  const mine = remembered ? await getInvite(remembered).catch(() => null) : null;
  if (mine && mine.parentCode === group.code && !mine.revokedAt) {
    return <Returning group={group} failed={failed} />;
  }

  // 3. A new phone: is there a place? If not, the main line is what to do (ask the headmaster),
  // the reason sits under it, and Try again reloads this page (F-P1: never a home page that is
  // not hers). Reloading drops ?s=, so the page asks the server afresh.
  const retryHref = `/join/${encodeURIComponent(group.code)}`;
  if (status === "not_ready")
    return (
      <Closed
        hanate="caring"
        title="join.group.notReady.body"
        body="join.group.notReady.title"
        testId="group-not-ready"
        retryHref={retryHref}
      />
    );
  const state = groupState(group);
  if (state.kind !== "open") {
    const why = {
      closed: "join.group.closed.title",
      expired: "join.group.expired.title",
      full: "join.group.full.title",
    } as const;
    return (
      <Closed
        hanate="caring"
        title="join.group.ask"
        body={why[state.kind]}
        testId={`group-${state.kind}`}
        retryHref={retryHref}
      />
    );
  }

  return <Welcome group={group} failed={failed} />;
}

async function signedInThroughGroup(groupCode: string): Promise<boolean> {
  const session = await getSession().catch(() => null);
  if (!session || session.role !== "teacher" || !session.consentedAt) return false;
  if (isFixtureMode()) {
    const code = (await cookies()).get(FIXTURE_INVITE_COOKIE)?.value;
    const invite = code ? await getInvite(code).catch(() => null) : null;
    return Boolean(invite && invite.parentCode === groupCode && !invite.revokedAt);
  }
  const mine = await findGroupChildOf(groupCode, session.userId).catch(() => null);
  return mine !== null;
}

function Welcome({ group, failed }: { group: Invite; failed: boolean }) {
  const text = CONSENT_TEXT.teacher;
  return (
    <div data-testid="group-welcome">
      <div className="flex rise items-center justify-between gap-3">
        <span className="inline-flex h-9 items-center rounded-chip bg-paper/80 px-4 font-display text-[15px] font-bold text-clay-cta shadow-warm-sm">
          <Bi k="join.group.eyebrow" sub={false} />
        </span>
        {group.isSample && <SampleBadge />}
      </div>

      <ConsentReader
        speech={messages.kn[text]}
        audioUrl={CONSENT_AUDIO.teacher}
        title={
          <>
            <h1
              className="mt-2 rise text-center text-[26px] leading-tight font-extrabold sm:text-[32px]"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              <Bi
                k="join.title.teacher"
                subClassName="mt-1 font-sans text-base font-semibold text-ink-3"
              />
            </h1>
            {group.label && (
              <p
                className="mx-auto mt-3 flex w-fit max-w-full rise items-center gap-2 rounded-chip border border-border bg-paper px-4 py-1.5 text-[15px] text-ink shadow-warm-sm"
                style={{ "--i": 2 } as React.CSSProperties}
              >
                <Users className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="font-semibold text-ink-3">
                  <Bi k="join.for" sub={false} className="inline" />
                </span>
                <span className="truncate font-semibold">{group.label}</span>
              </p>
            )}
          </>
        }
        // "Read or hear" only when this phone can read it aloud (F-P1). On a phone the consent
        // text itself carries both languages, so the lead keeps one.
        lead={{
          hear: "join.group.lead",
          read: "join.group.leadRead",
          subClassName: "text-[15px] max-sm:hidden",
        }}
        clampOnPhone
      >
        <p className="text-[19px] leading-relaxed text-ink">
          <Bi
            k={text}
            subClassName="mt-4 border-t border-border pt-4 text-base leading-relaxed text-ink-3"
          />
        </p>
      </ConsentReader>

      <p className="mx-auto mt-4 flex w-fit items-start gap-2 text-center text-[15px] text-ink-3">
        <Lock className="mt-1 size-4 shrink-0" aria-hidden />
        <Bi k="join.group.private" sub={false} />
      </p>

      {failed && <Failed />}

      {/* Thumb zone: the one action stays in reach while she reads (DESIGN §2.10). */}
      <div
        data-cta-tray
        className="z-10 -mx-5 mt-3 rise px-5 pt-6 pb-4 max-md:sticky max-md:bottom-0 max-md:bg-linear-to-t max-md:from-dusk max-md:from-75% max-md:to-dusk/0"
        style={{ "--i": 5 } as React.CSSProperties}
      >
        <form action={joinGroupInvite.bind(null, group.code)}>
          <SubmitButton
            pendingLabel="join.pending"
            className="h-16 w-full gap-2.5 text-xl"
            data-testid="group-agree"
          >
            <Check aria-hidden className="size-6" strokeWidth={2.6} />
            {/* Too long for both languages in one line: the reader's own language only. */}
            <Bi k="join.group.agree" sub={false} />
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

function Returning({ group, failed }: { group: Invite; failed: boolean }) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center py-8 text-center"
      data-testid="group-returning"
    >
      <Hanate state="happy" size={140} label="Hanate" className="rise" />
      <h1
        className="mt-6 rise text-[30px] leading-tight font-bold"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Bi k="join.group.back.title" subClassName="font-sans text-lg font-semibold text-ink-3" />
      </h1>
      <p
        className="mt-3 max-w-sm rise text-lg text-ink-3"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <Bi k="join.group.back.body" subClassName="text-base" />
      </p>
      {failed && <Failed />}
      <form
        action={joinGroupInvite.bind(null, group.code)}
        className="mt-10 w-full max-w-sm rise"
        style={{ "--i": 3 } as React.CSSProperties}
      >
        <SubmitButton pendingLabel="join.pending" className="h-16 w-full text-xl">
          <Bi k="join.group.back.go" sub={false} />
          <ArrowRight aria-hidden />
        </SubmitButton>
      </form>
    </div>
  );
}

function Failed() {
  return (
    <div
      role="alert"
      className="mt-5 flex items-center gap-3 rounded-card border border-border bg-paper p-3 pr-4 text-left shadow-warm-sm"
    >
      <Hanate state="caring" size={44} label="" className="shrink-0" />
      <p className="text-base leading-snug">
        <Bi k="join.group.failed" subClassName="text-[14px]" />
      </p>
    </div>
  );
}
