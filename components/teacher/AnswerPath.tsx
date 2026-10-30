import { EyeOff } from "lucide-react";
import { Bi } from "@/components/parampara/Bi";
import { cn } from "@/lib/utils";

// Where her answer comes from, in four lines, beside the ask on a laptop (DESIGN §8: the story
// beside the action). A juror reads the whole loop here; a teacher on a phone never needs it.
const PATH = ["home.path.1", "home.path.2", "home.path.3", "home.path.4"] as const;

export function AnswerPath({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="path-title"
      className={cn("rounded-card border border-border bg-paper/70 p-6 shadow-warm-sm", className)}
    >
      <h2 id="path-title" className="text-[20px] leading-tight font-bold">
        <Bi k="home.path.title" subClassName="font-sans text-[15px] font-semibold" />
      </h2>
      <ol className="mt-4 space-y-3">
        {PATH.map((k, n) => (
          <li key={k} className="flex gap-3">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-chip bg-flame font-display text-[15px] font-extrabold text-ink"
            >
              {n + 1}
            </span>
            <p className="max-w-[56ch] text-[16px] leading-snug text-ink">
              <Bi k={k} subClassName="text-[14px] text-ink-3" />
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-5 flex items-center gap-2 border-t border-border/70 pt-4 text-[15px] text-ink-3">
        <EyeOff className="size-4.5 shrink-0" aria-hidden />
        <Bi k="home.path.private" sub={false} />
      </p>
    </section>
  );
}
