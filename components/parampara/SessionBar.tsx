import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/session";
import { plainName } from "@/lib/auth/demo";
import { getSession } from "@/lib/auth/session";

import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { LanguageToggle } from "./LanguageToggle";
import { ROLE_ICON, ROLE_NAME } from "./role-meta";
import { SampleBadge } from "./Badges";
import { SubmitButton } from "./SubmitButton";
import { Wordmark } from "./Wordmark";
import { messages } from "@/lib/i18n/messages";

// The slim header of every room: who you are (and that it is Sample), the language, a way out.
// The wordmark and toggle are static; only the identity waits for the session, behind Suspense,
// so the shell paints at once on a slow network. At 390 px the identity drops to its own row; on a
// task screen (compact) it waits for md, so the task stays high on a phone and Leave lives at home.
export function SessionBar({
  className,
  home = "/",
  compact = false,
}: {
  className?: string;
  /** Where the wordmark leads: this room's home. */
  home?: string;
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        "mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 px-5 pt-4 sm:px-8 sm:pt-6 md:grid-cols-[auto_1fr_auto]",
        className,
      )}
    >
      <Wordmark href={home} />
      <div
        className={cn(
          "order-last col-span-2 md:order-none md:col-span-1 md:justify-self-end",
          compact && "max-md:hidden",
        )}
      >
        <Suspense fallback={<IdentitySkeleton />}>
          <Identity />
        </Suspense>
      </div>
      <LanguageToggle />
    </header>
  );
}

async function Identity() {
  const session = await getSession();
  if (!session) return null;
  const Icon = ROLE_ICON[session.role];
  const role = ROLE_NAME[session.role];
  // An invited teacher has no name here (Law 6): "You". The demo reviewer and officer are named
  // after their role, so the role is said once with the district beneath.
  const named = plainName(session.displayName);
  const roleOnly = named !== null && named.toLowerCase() === messages.en[role].toLowerCase();
  const name = roleOnly ? null : named;

  return (
    <div
      aria-label="Signed in"
      className="flex min-h-14 w-full items-center gap-3 rounded-[28px] border border-border bg-paper/90 py-1.5 pr-1.5 pl-1.5 shadow-warm-sm md:w-auto"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-chip bg-sage text-ink-2">
        <Icon className="size-5" strokeWidth={2.2} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="sr-only">
          <Bi k="session.label" sub={false} />
        </span>
        <span className="truncate font-display text-[17px] font-bold text-ink">
          {name ?? <Bi k={roleOnly ? role : "session.you"} sub={false} />}
        </span>
        {/* The Sample badge rides on the second line so a long Kannada role name never clips. */}
        {/* Wraps rather than clips: a long Kannada role and the Sample label both stay whole at 390. */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] text-ink-3">
          {session.isSample && <SampleBadge className="h-6 px-2" />}
          <span>{roleOnly ? session.district : <Bi k={role} sub={false} />}</span>
        </span>
      </span>
      {/* data-leave: the service worker forgets this person's cached pages (D52) */}
      <form action={signOut} className="shrink-0" data-leave>
        <SubmitButton
          variant="ghost"
          size="md"
          pendingLabel="session.leaving"
          labelClassName="max-sm:sr-only"
          className="rounded-chip px-3.5 text-[15px] text-ink-3 hover:text-ink max-sm:w-12 max-sm:px-0"
        >
          <LogOut aria-hidden className="size-[18px]" />
          <span className="max-sm:sr-only">
            <Bi k="session.leave" sub={false} />
          </span>
        </SubmitButton>
      </form>
    </div>
  );
}

function IdentitySkeleton() {
  return (
    <div
      aria-hidden
      className="flex h-14 w-full items-center gap-3 rounded-chip border border-border bg-paper/60 px-1.5 md:w-72"
    >
      <span className="size-11 animate-breathe rounded-chip bg-sage" />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="h-3.5 w-24 animate-breathe rounded-chip bg-sage" />
        <span className="h-3 w-16 animate-breathe rounded-chip bg-sage/70" />
      </span>
    </div>
  );
}
