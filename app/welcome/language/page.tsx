// First open, step 2: language. Who: the same teacher, a moment after agreeing. One job: tap the
// language answers should come in. Feeling: glad (Hanate is happy she agreed), and done in a tap.
import { Suspense } from "react";
import type { Metadata } from "next";
import { Baloo_2 } from "next/font/google";
import { Info } from "lucide-react";
import { chooseLanguage } from "@/app/actions/welcome";
import { Bi } from "@/components/parampara/Bi";
import { HanateMoment } from "@/components/parampara/HanateMoment";
import { LanguageCards } from "@/components/parampara/LanguageCards";
import { WelcomeSteps } from "@/components/parampara/WelcomeSteps";
import { getSession } from "@/lib/auth/session";
import { NoSession, StepError, StepSkeleton, WelcomeShell } from "../WelcomeShell";

export const metadata: Metadata = { title: "Language" };

// Baloo 2 is Baloo Tamma 2's Devanagari sibling, so हिन्दी matches the Kannada card. Loaded only
// here, and not preloaded: two words do not justify a font on every page.
// Two weights, so the class does not pin one weight on both the name and the greeting.
const devanagari = Baloo_2({
  subsets: ["devanagari"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

export default function LanguagePage({ searchParams }: PageProps<"/welcome/language">) {
  return (
    <WelcomeShell>
      <Suspense fallback={<StepSkeleton />}>
        <LanguageStep searchParams={searchParams} />
      </Suspense>
    </WelcomeShell>
  );
}

async function LanguageStep({ searchParams }: Pick<PageProps<"/welcome/language">, "searchParams">) {
  const [session, query] = await Promise.all([getSession(), searchParams]);
  if (!session) return <NoSession />;

  return (
    <div className="pb-12">
      <WelcomeSteps step={2} sample={session.isSample} />
      <div className="relative mt-3 flex justify-center">
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame/30 blur-3xl"
        />
        <HanateMoment moment="happy" forSeconds={1.8} size={84} label="Hanate" className="rise relative" />
      </div>
      <h1
        className="rise mt-3 text-center text-[28px] leading-tight font-extrabold sm:text-[34px]"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Bi k="welcome.lang.title" subClassName="mt-1 font-sans text-lg font-semibold text-ink-3" />
      </h1>
      {query.e === "1" && <StepError k="welcome.lang.error" />}

      <form action={chooseLanguage} className="mt-5">
        <LanguageCards devanagari={devanagari.className} />
      </form>

      <p
        className="rise mt-5 flex items-start gap-2.5 text-[15px] text-ink-3"
        style={{ "--i": 6 } as React.CSSProperties}
      >
        <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden />
        <span>
          <Bi k="welcome.lang.hiNote" sub={false} className="inline" />{" "}
          <Bi k="welcome.lang.body" sub={false} className="inline" />
        </span>
      </p>
    </div>
  );
}
