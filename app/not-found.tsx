import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";

export default function NotFound() {
  return (
    <main id="main" className="bg-dusk-gradient paper-grain flex min-h-dvh flex-col items-center justify-center px-5 py-10 text-center">
      <Hanate state="caring" size={160} label="Hanate" />
      <h1 className="mt-6 text-[30px] leading-tight font-bold">
        <Bi k="notfound.title" subClassName="font-sans text-lg font-semibold text-ink-3" />
      </h1>
      <p className="mt-3 max-w-sm text-lg text-ink-3">
        <Bi k="notfound.body" subClassName="text-base" />
      </p>
      <Button asChild className="mt-10 w-full max-w-sm">
        <Link href="/">
          <Bi k="room.back" sub={false} />
        </Link>
      </Button>
    </main>
  );
}
