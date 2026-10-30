import Link from "next/link";
import { FlaskConical, MapPin } from "lucide-react";
import { Bi } from "@/components/parampara/Bi";

import { cn } from "@/lib/utils";
import { messages } from "@/lib/i18n/messages";

// Field or Sample, one at a time and never summed (Law 7). Links, so it works before hydration and
// the choice is in the URL a juror can share. Each half is a 48 px target.
export type DataKind = "field" | "sample";

export function KindSwitch({
  current,
  hrefFor,
  className,
}: {
  current: DataKind;
  hrefFor: (kind: DataKind) => string;
  className?: string;
}) {
  return (
    <nav
      aria-label={`${messages.kn["pulse.kind.label"]} · ${messages.en["pulse.kind.label"]}`}
      className={cn(
        "inline-flex max-w-full rounded-chip border border-border bg-paper p-1 shadow-warm-sm",
        className,
      )}
    >
      {(["field", "sample"] as const).map((kind) => {
        const active = kind === current;
        const Icon = kind === "field" ? MapPin : FlaskConical;
        return (
          <Link
            key={kind}
            href={hrefFor(kind)}
            scroll={false}
            aria-current={active ? "page" : undefined}
            data-kind={kind}
            className={cn(
              "inline-flex min-h-12 items-center gap-2 rounded-chip px-3 font-display text-[15px] leading-tight font-semibold transition-colors duration-150 sm:px-4 sm:text-[16px] sm:whitespace-nowrap",
              active
                ? kind === "field"
                  ? "bg-moss text-white shadow-warm-sm"
                  : "bg-ink text-white shadow-warm-sm"
                : "text-ink-3 hover:bg-sage hover:text-ink",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            <Bi k={kind === "field" ? "badge.field" : "badge.sample"} sub={false} />
          </Link>
        );
      })}
    </nav>
  );
}
