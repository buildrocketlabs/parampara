import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import type { MessageKey } from "@/lib/i18n";

/**
 * A door that does not open (unknown, closed, full, over, not ready): Hanate, a kind main line,
 * why, and one way on. A group QR's page (F-P1) leads with what to do ("please ask your
 * headmaster"), says why underneath, and offers Try again (a plain reload, so it works before the
 * page's script arrives) instead of a home page that is not hers.
 */
export function Closed({
  hanate,
  title,
  body,
  children,
  testId,
  retryHref,
}: {
  hanate: "caring" | "resting";
  title: MessageKey;
  body: MessageKey;
  children?: React.ReactNode;
  testId?: string;
  /** This same page: "Try again" reloads it, in place of "Back to home". */
  retryHref?: string;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center py-8 text-center"
      data-testid={testId}
    >
      <Hanate state={hanate} size={160} label="Hanate" className="rise" />
      <h1
        className="mt-6 max-w-md rise text-[30px] leading-tight font-bold text-balance"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Bi k={title} subClassName="mt-1 font-sans text-lg font-semibold text-ink-3" />
      </h1>
      <p
        className="mt-3 max-w-sm rise text-lg text-ink-3"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <Bi k={body} subClassName="text-base" />
      </p>
      <div
        className="mt-10 flex w-full max-w-sm rise flex-col gap-3"
        style={{ "--i": 4 } as React.CSSProperties}
      >
        {children}
        {retryHref ? (
          <Button asChild variant="paper" className="w-full">
            {/* A plain link: a full reload of this page, which asks the server again. */}
            <a href={retryHref} data-testid="closed-retry">
              <RotateCcw aria-hidden />
              <Bi k="join.group.retry" sub={false} />
            </a>
          </Button>
        ) : (
          <Button asChild variant={children ? "paper" : "clay"} className="w-full">
            <Link href="/">
              <ArrowLeft aria-hidden />
              <Bi k="room.back" sub={false} />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
