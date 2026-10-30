import { fill } from "@/lib/i18n/fill";
import { cn } from "@/lib/utils";
import { messages } from "@/lib/i18n/messages";

// How far along, at a glance (DESIGN §4): finished dots clay, the current one a larger flame dot,
// the rest quiet. Sizes change by transform only.
export type ProgressDotsProps = {
  count: number;
  /** 0 based index of the current step. */
  current: number;
  onDark?: boolean;
  className?: string;
};

export function ProgressDots({ count, current, onDark = false, className }: ProgressDotsProps) {
  const now = Math.min(Math.max(current, 0), Math.max(count - 1, 0));
  const vars = { n: now + 1, total: count };
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={now + 1}
      aria-valuetext={`${fill(messages.kn["loader.step"], vars)} · ${fill(messages.en["loader.step"], vars)}`}
      className={cn("flex items-center gap-2.5 px-2 py-2", className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          data-state={i < now ? "done" : i === now ? "current" : "pending"}
          className={cn(
            "block size-2.5 rounded-chip transition-[transform,background-color] duration-300 ease-gentle",
            i < now && (onDark ? "bg-clay-glow" : "bg-clay"),
            i === now && "scale-[1.6] bg-flame-deep shadow-flame",
            i > now && (onDark ? "bg-mist/75" : "bg-ink/50"),
          )}
        />
      ))}
    </div>
  );
}
