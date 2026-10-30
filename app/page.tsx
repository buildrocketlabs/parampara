// Story landing. Who: a juror or evaluator, on a laptop or phone, about to judge in 30 seconds.
// One job: feel "one lamp lights another", then tap into a role. Feeling: warm, crafted, trustworthy.
import { Suspense } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, BookMarked, EyeOff, Keyboard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AreaMessages } from "@/components/parampara/AreaMessages";
import { Bi } from "@/components/parampara/Bi";
import { EnterNotice } from "@/components/parampara/EnterNotice";
import { HeroLamps } from "@/components/parampara/HeroLamps";
import { HeroLine } from "@/components/parampara/HeroLine";
import { LanguageToggle } from "@/components/parampara/LanguageToggle";
import { EnterAs } from "@/components/parampara/EnterAs";
import { RoleDoor } from "@/components/parampara/RoleDoor";
import { Wordmark } from "@/components/parampara/Wordmark";
import type { MessageKey } from "@/lib/i18n";

const DOORS = [
  // `preview` keeps the honest "Opening soon" chip until a room is really built (Law 7).
  { role: "teacher", body: "door.teacher.body", featured: true, preview: false },
  { role: "master", body: "door.master.body", preview: false },
  { role: "reviewer", body: "door.reviewer.body", preview: false },
  { role: "officer", body: "door.officer.body", preview: false },
] as const;

const BEATS: ReadonlyArray<{ title: MessageKey; body: MessageKey }> = [
  { title: "how.1.title", body: "how.1.body" },
  { title: "how.2.title", body: "how.2.body" },
  { title: "how.3.title", body: "how.3.body" },
  { title: "how.4.title", body: "how.4.body" },
];

const PROMISES = [
  { icon: EyeOff, k: "promise.watch" },
  { icon: ShieldCheck, k: "promise.children" },
  { icon: BookMarked, k: "promise.source" },
] as const;

export default function Home() {
  return (
    <AreaMessages route="app/page.tsx">
      <div className="paper-grain min-h-dvh bg-dusk-gradient">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
          <Wordmark />
          <LanguageToggle />
        </header>

        <main id="main">
          <section
            aria-labelledby="hero-line"
            className="mx-auto grid max-w-6xl items-center gap-4 px-5 pt-2 pb-14 sm:px-8 md:grid-cols-[1.1fr_0.9fr] md:gap-10 md:pt-4 md:pb-12 lg:pt-8"
          >
            <div className="order-2 text-center md:order-1 md:text-left">
              <p
                lang="kn"
                className="rise font-display text-[44px] leading-[1.25] font-extrabold text-clay sm:text-[52px]"
                style={{ "--i": 1 } as React.CSSProperties}
              >
                ನಮಸ್ಕಾರ
              </p>
              <h1
                id="hero-line"
                className="mt-3 rise text-[28px] leading-[1.25] font-bold text-ink sm:text-[42px]"
                style={{ "--i": 2 } as React.CSSProperties}
              >
                <HeroLine />
              </h1>
              <p
                className="mx-auto mt-4 max-w-xl rise text-lg text-ink-3 md:mx-0"
                style={{ "--i": 4 } as React.CSSProperties}
              >
                <Bi k="hero.sub" subClassName="hidden" />
              </p>
              <div
                className="mt-6 flex rise flex-col items-stretch gap-3 sm:items-center md:items-start"
                style={{ "--i": 6 } as React.CSSProperties}
              >
                {/* A juror's fastest way in: one tap to the teacher's room; the four doors below. */}
                <EnterAs role="teacher" className="sm:w-auto" />
                <Button asChild variant="ghost" size="md" className="w-full sm:w-auto">
                  <a href="#doors">
                    <Bi k="hero.cta" sub={false} />
                    <ArrowDown aria-hidden />
                  </a>
                </Button>
              </div>
            </div>

            <div className="relative order-1 flex flex-col items-center md:order-2">
              <div
                aria-hidden
                className="absolute top-1/2 left-1/2 size-[260px] -translate-x-1/2 -translate-y-[60%] rounded-full bg-flame/25 blur-3xl sm:size-[380px]"
              />
              <HeroLamps />
            </div>
          </section>

          <section
            id="doors"
            aria-labelledby="doors-title"
            className="mx-auto max-w-6xl scroll-mt-6 px-5 pb-16 sm:px-8 md:pb-24"
          >
            <h2 id="doors-title" className="text-[32px] leading-tight font-bold sm:text-[40px]">
              <Bi k="doors.title" subClassName="font-sans text-lg font-semibold" />
            </h2>
            <p className="mt-2 text-base text-ink-3">
              <Bi k="doors.hint" sub={false} />
            </p>
            <Suspense fallback={null}>
              <EnterNotice />
            </Suspense>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-5">
              {DOORS.map((d, i) => (
                <RoleDoor key={d.role} index={i} {...d} />
              ))}
            </div>
            <Link
              href="/login"
              className="group mt-5 inline-flex min-h-12 items-center gap-2.5 rounded-chip pr-3 text-base font-semibold text-ink-3 hover:text-ink"
            >
              <Keyboard className="size-5" aria-hidden />
              <Bi k="doors.typing" sub={false} />
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </section>

          <section
            aria-labelledby="how-title"
            className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 md:pb-24"
          >
            <h2 id="how-title" className="text-[28px] leading-tight font-bold sm:text-[36px]">
              <Bi k="how.title" subClassName="font-sans text-lg font-semibold" />
            </h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-4 md:gap-5">
              {BEATS.map((b, i) => (
                <li key={b.title} className="rounded-card bg-paper/80 p-6 shadow-warm-sm">
                  <span
                    aria-hidden
                    className="grid size-11 place-items-center rounded-chip bg-flame font-display text-xl font-extrabold text-ink"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-[22px] leading-snug font-bold">
                    <Bi k={b.title} subClassName="font-sans text-[15px] font-semibold" />
                  </h3>
                  <p className="mt-2 text-base text-ink-3">
                    <Bi k={b.body} subClassName="text-[15px]" />
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="promise-title"
            className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 md:pb-24"
          >
            <div className="rounded-card bg-ink p-8 text-white shadow-warm-lg sm:p-12">
              <h2
                id="promise-title"
                className="text-[28px] leading-tight font-bold text-flame sm:text-[34px]"
              >
                <Bi k="promise.title" subClassName="font-sans text-lg font-semibold text-mist" />
              </h2>
              <ul className="mt-8 grid gap-6 md:grid-cols-3">
                {PROMISES.map(({ icon: Icon, k }) => (
                  <li key={k} className="flex items-start gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-chip bg-ink-2 text-clay-glow">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <p className="pt-1 text-lg font-semibold">
                      <Bi k={k} subClassName="text-[15px] font-normal text-mist" />
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>

        <footer className="mx-auto max-w-6xl px-5 pb-10 text-[15px] text-ink-3 sm:px-8">
          {/* One quiet door for judges: the reasoning, the live numbers and the code. */}
          <p
            data-judges-link
            className="flex flex-col items-start gap-1 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5"
          >
            <Link
              href="/how"
              className="group inline-block py-3 text-base font-semibold text-ink-2 underline decoration-ink-3/40 decoration-1 underline-offset-4 hover:text-ink"
            >
              <Bi k="hero.judges" sub={false} className="inline" />
              <ArrowRight
                className="ml-1.5 inline size-4 align-[-2px] transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <a
              href="https://github.com/buildrocketlabs/parampara"
              className="inline-block py-3 text-base font-semibold text-ink-3 underline decoration-ink-3/40 decoration-1 underline-offset-4 hover:text-ink"
            >
              <Bi k="hero.judges.code" sub={false} />
            </a>
          </p>
          <div className="flex flex-col gap-1 border-t border-border pt-6 md:flex-row md:justify-between">
            <Bi k="footer.team" sub={false} className="font-semibold text-ink-3" />
            <Bi k="footer.event" sub={false} />
          </div>
        </footer>
      </div>
    </AreaMessages>
  );
}
