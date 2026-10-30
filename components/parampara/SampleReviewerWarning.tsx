import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";

// On /m/import and /r/cards when the signed-in reviewer is Sample: anything brought in or approved
// there is Sample and never reaches a field teacher, so real Koppal notes need the reviewer's own
// link (a field import under the Sample reviewer made a Sample duplicate on 29 Oct). Calm ink and
// flame, never alarm red (DESIGN §2). On a phone the body shows in one language only, so the
// page's own action stays on the first screen.
export function SampleReviewerWarning({ className }: { className?: string }) {
  return (
    <div
      role="note"
      data-warning="sample-reviewer"
      className={cn(
        "flex items-start gap-3 rounded-card border border-flame-deep bg-flame/25 p-3 pr-4 sm:gap-4 sm:p-5",
        className,
      )}
    >
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full bg-flame/70"
        aria-hidden
      >
        <FlaskConical className="size-5 text-ink" />
      </span>
      <div className="min-w-0">
        <Bi
          k="session.sample_reviewer.title"
          className="font-display text-lg leading-snug font-bold text-ink"
          subClassName="text-base font-semibold text-ink-2"
        />
        <Bi
          k="session.sample_reviewer.body"
          className="mt-1.5 text-base leading-snug text-ink"
          subClassName="hidden text-[15px] text-ink-2 sm:block"
        />
      </div>
    </div>
  );
}
