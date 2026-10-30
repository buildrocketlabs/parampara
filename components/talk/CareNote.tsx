import { HeartHandshake, Phone } from "lucide-react";
import { Bi } from "@/components/parampara/Bi";
import { helplines, type Care } from "@/lib/talk/care";
import { cn } from "@/lib/utils";

// Beside Hanate's next question when the last answer spoke of a child in danger (Childline 1098)
// or of the speaker's own despair (Tele MANAS 14416), or both. Warm, never alarming, one tap to
// call (Law 5). Hanate does not ask about it; the helper or the master decides what to do.
export function CareNote({ care }: { care: Care }) {
  const lines = helplines(care);
  return (
    <div role="note" data-testid="talk-care" className="mt-4 rounded-card bg-flame/20 px-4 py-4 sm:px-5">
      {lines.map((line) => (
        <p key={line} className="flex items-start gap-3 text-[19px] leading-[1.6] text-ink [&+p]:mt-3">
          <HeartHandshake className="mt-1 size-6 shrink-0 text-clay" aria-hidden />
          <span className="min-w-0 flex-1">
            <Bi k={line === "child" ? "talk.care.child" : "talk.care.self"} subClassName="text-base text-ink-3" />
          </span>
        </p>
      ))}
      <div className={cn("mt-4 grid gap-3", lines.length > 1 && "sm:grid-cols-2")}>
        {lines.map((line) => (
          <a
            key={line}
            href={line === "child" ? "tel:1098" : "tel:14416"}
            className={
              line === "child"
                ? "flex min-h-14 items-center gap-3 rounded-card bg-flame px-5 py-3 font-display font-bold text-ink shadow-flame focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-clay"
                : "flex min-h-14 items-center gap-3 rounded-card bg-moss px-5 py-3 font-display font-bold text-white shadow-warm focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-clay"
            }
          >
            <Phone className="size-6 shrink-0" aria-hidden />
            <span className="text-[18px] leading-tight">
              <Bi k={line === "child" ? "talk.care.call_child" : "talk.care.call_self"} sub={false} />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
