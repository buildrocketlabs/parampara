// First open, step 1: consent. Who: a teacher who just tapped her invite (masters and reviewers get
// their short text). One job: read or hear the promise, press I agree. Feeling: respected; nothing
// is hidden, nothing is recorded before she agrees, and saying "not now" is fine.
import { Suspense } from "react";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { agreeToConsent } from "@/app/actions/welcome";
import { Bi } from "@/components/parampara/Bi";
import { BiPair } from "@/components/parampara/BiPair";
import { ConsentReader } from "@/components/parampara/ConsentReader";
import { NotNow } from "@/components/parampara/NotNow";
import { SubmitButton } from "@/components/parampara/SubmitButton";
import { WelcomeSteps } from "@/components/parampara/WelcomeSteps";
import { getSession } from "@/lib/auth/session";
import { CONSENT_AUDIO, CONSENT_TEXT } from "@/lib/consent";

import { NoSession, StepError, StepSkeleton, WelcomeShell } from "./WelcomeShell";
import { messages } from "@/lib/i18n/messages";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <WelcomeShell wide>
      <Suspense fallback={<StepSkeleton />}>
        <ConsentStep searchParams={searchParams} />
      </Suspense>
    </WelcomeShell>
  );
}

async function ConsentStep({ searchParams }: Pick<PageProps<"/welcome">, "searchParams">) {
  const [session, query] = await Promise.all([getSession(), searchParams]);
  if (!session) return <NoSession />;
  const text = CONSENT_TEXT[session.role];

  return (
    <>
      <WelcomeSteps step={1} sample={session.isSample} />
      <div className="mt-3">
        <ConsentReader
          speech={messages.kn[text]}
          audioUrl={CONSENT_AUDIO[session.role]}
          clampOnPhone
          title={
            <h1
              className="mt-2 rise text-center text-[28px] leading-tight font-extrabold sm:text-[34px]"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              <Bi
                k="welcome.title"
                subClassName="mt-1 font-sans text-lg font-semibold text-ink-3"
              />
            </h1>
          }
        >
          <p className="text-[21px] leading-relaxed text-ink md:grid md:grid-cols-2 md:gap-8 md:text-[19px]">
            <Bi
              k={text}
              subClassName="mt-4 border-t border-border pt-4 text-base leading-relaxed text-ink-3 md:mt-0 md:border-t-0 md:border-l md:pt-0 md:pl-8"
            />
          </p>
        </ConsentReader>
      </div>

      {query.e === "1" && <StepError k="welcome.error" />}

      {/* Thumb zone: on a phone the one action stays in reach while she reads (DESIGN §2.10).
          data-cta-tray lifts the offline banner above it (globals.css). */}
      <div
        data-cta-tray
        className="z-10 -mx-5 mt-6 rise px-5 pt-5 pb-4 max-md:sticky max-md:bottom-0 max-md:bg-linear-to-t max-md:from-dusk max-md:from-75% max-md:to-dusk/0 md:mx-auto md:mt-4 md:w-full md:max-w-lg md:px-0"
        style={{ "--i": 5 } as React.CSSProperties}
      >
        <form action={agreeToConsent}>
          <SubmitButton pendingLabel="welcome.agreeing" className="h-16 w-full gap-2.5 text-xl">
            <Check aria-hidden className="size-6" strokeWidth={2.6} />
            <BiPair k="welcome.agree" />
          </SubmitButton>
        </form>
      </div>
      <NotNow summary={<Bi k="welcome.notNow" sub={false} />}>
        <p className="mx-auto mt-1 max-w-sm rounded-card bg-paper/80 p-4 text-base text-ink-3">
          <Bi k="welcome.notNow.body" subClassName="text-[14px]" />
        </p>
      </NotNow>
    </>
  );
}
