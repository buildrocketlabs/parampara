import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { Hanate } from "./hanate/Hanate";

// A room's route loading (DESIGN §2.7): the room's header in outline, then Hanate thinking beside
// one honest line of what is coming, above skeletons shaped like the room, so the page settles
// into place instead of jumping. A server component whose only client parts are Hanate and Bi,
// which app/loading.tsx already ships, so a room's loading adds no JS (D70, D90). The header is
// drawn, not rendered: the real wordmark link and language toggle would cost a separate 8 KB chunk
// on every room (measured). Skeletons breathe and hold still under reduced motion.
export function RoomLoading({
  line,
  chrome,
  width = "wide",
  surface = "dusk",
  children,
}: {
  /** What is being fetched, in Hanate's words. A `loading.` key (core area). */
  line: MessageKey;
  /** A signed in room has the session bar's two rows (SessionBar); public pages one (SiteHeader). */
  chrome: "session" | "site";
  width?: "narrow" | "wide";
  surface?: "dusk" | "cream";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "paper-grain flex min-h-dvh flex-col",
        surface === "dusk" ? "bg-dusk-gradient" : "bg-cream",
      )}
    >
      <div
        aria-hidden
        className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 px-5 pt-4 sm:px-8 sm:pt-6 md:grid-cols-[auto_1fr_auto]"
      >
        <span className="flex min-h-12 items-center gap-2.5">
          <span className="h-9 w-8 animate-breathe rounded-chip bg-flame/40" />
          <span className="h-6 w-28 animate-breathe rounded-chip bg-ink/[0.12]" />
        </span>
        {chrome === "session" && (
          <span className="order-last col-span-2 flex h-14 w-full items-center gap-3 rounded-chip border border-border bg-paper/60 px-1.5 md:order-none md:col-span-1 md:w-72 md:justify-self-end">
            <span className="size-11 animate-breathe rounded-chip bg-sage" />
            <span className="flex flex-1 flex-col gap-1.5">
              <span className="h-3.5 w-24 animate-breathe rounded-chip bg-sage" />
              <span className="h-3 w-16 animate-breathe rounded-chip bg-sage/70" />
            </span>
          </span>
        )}
        <span className="h-12 w-40 animate-breathe rounded-chip bg-paper shadow-warm-sm" />
      </div>
      <main
        id="main"
        aria-busy="true"
        className={cn(
          "mx-auto flex w-full flex-1 flex-col px-5 pt-5 pb-16 sm:px-8",
          width === "narrow" ? "max-w-xl" : "max-w-6xl",
        )}
      >
        <div role="status" className="flex min-h-14 items-center gap-3">
          <Hanate state="thinking" size={48} label="" className="shrink-0" />
          <p className="text-lg text-ink-2">
            <Bi k={line} subClassName="text-[15px]" />
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}
