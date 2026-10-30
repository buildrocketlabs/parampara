import Link from "next/link";
import { Suspense } from "react";
import { SampleBadge } from "@/components/parampara/Badges";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { MasterMedallion } from "@/components/parampara/MasterMedallion";

import { loadTried } from "@/lib/tried/load";
import { OUTCOMES, type TriedOutcome } from "@/lib/tried/types";
import { cn } from "@/lib/utils";
import { PendingTriedSync } from "./PendingTriedSync";
import { withName } from "@/lib/i18n/messages";

// "Did yesterday's idea work?" for the teacher home (DESIGN §8 /t). One card, three one tap
// answers that open /t/tried with the choice made. Shows nothing once she has answered, or when
// there is no answer to ask about, so the home never nags or dead ends.
const LABEL = { worked: "tried.worked", partly: "tried.partly", didnt: "tried.didnt" } as const;

export function TriedPrompt({ answerId, className }: { answerId: string; className?: string }) {
  return (
    <>
      <PendingTriedSync />
      <Suspense fallback={null}>
        <Prompt answerId={answerId} className={className} />
      </Suspense>
    </>
  );
}

async function Prompt({ answerId, className }: { answerId: string; className?: string }) {
  const loaded = await loadTried(answerId);
  if (loaded.kind !== "ok" || loaded.record) return null;
  const { answer } = loaded;
  const name = answer.master.name;
  return (
    <section
      aria-labelledby={`tried-prompt-${answer.id}`}
      data-tried-prompt
      className={cn("rounded-card border border-border bg-paper p-5 shadow-warm", className)}
    >
      <div className="flex items-start gap-3">
        <MasterMedallion name={name} size="sm" portraitOnly />
        <div className="min-w-0 flex-1">
          {/* Sample on its own line, so a long Kannada label never squeezes the title. */}
          {(answer.isSample || answer.master.isSample) && <SampleBadge className="mb-1.5" />}
          <h2
            id={`tried-prompt-${answer.id}`}
            className="text-[22px] leading-tight font-bold text-ink"
          >
            <Bi k="tried.title" subClassName="font-sans text-[15px] font-semibold" />
          </h2>
          <p className="mt-1 text-[15px] text-ink-3">
            <BiText
              text={name ? withName("tried.idea", name) : "tried.ideaAnon"}
              sub={false}
              inline
            />
            {": "}
            <BiText text={answer.title} sub={false} inline />
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {OUTCOMES.map((o: TriedOutcome) => (
          <Link
            key={o}
            href={`/t/tried/${answer.id}?outcome=${o}`}
            data-outcome={o}
            className="flex min-h-14 items-center justify-center rounded-button border-2 border-border bg-paper px-2 py-2 text-center font-display text-[15px] sm:text-[16px] leading-tight font-bold text-balance text-ink lip-paper transition-[translate,box-shadow,border-color] duration-100 hover:border-clay/45 active:translate-y-1 active:shadow-none"
          >
            <Bi k={LABEL[o]} sub={false} />
          </Link>
        ))}
      </div>
    </section>
  );
}
