// Sign in by typing. Who: an evaluator who would rather use the README credentials than a door.
// One job: email, password, in. Feeling: calm and quick, with one tap entry a link away.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { LoginForm } from "@/components/parampara/LoginForm";
import { SiteHeader } from "@/components/parampara/SiteHeader";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="bg-dusk-gradient paper-grain flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pt-6 pb-12 sm:pt-8">
        <Hanate state="idle" size={72} label="Hanate" className="rise md:hidden" />
        <Hanate state="idle" size={56} label="" className="rise max-md:hidden" />
        <h1
          className="rise mt-3 text-center text-[30px] leading-tight font-bold"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <Bi k="login.title" subClassName="font-sans text-lg font-semibold text-ink-3" />
        </h1>
        <p
          className="rise mt-2 text-center text-base text-ink-3"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <Bi k="login.sub" subClassName="text-[15px]" />
        </p>
        <div
          className="rise mt-5 w-full rounded-card border border-border bg-paper/90 p-5 shadow-warm sm:p-7"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          <LoginForm />
        </div>
        <Button
          asChild
          variant="paper"
          size="md"
          className="rise mt-4 h-auto min-h-12 w-full py-2 whitespace-normal"
          style={{ "--i": 5 } as React.CSSProperties}
        >
          <Link href="/#doors">
            <ArrowLeft aria-hidden />
            <Bi k="login.oneTap" sub={false} />
          </Link>
        </Button>
      </main>
    </div>
  );
}
