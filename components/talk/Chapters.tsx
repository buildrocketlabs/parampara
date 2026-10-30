import { BookOpen, Clock3 } from "lucide-react";
import { SampleBadge } from "@/components/parampara/Badges";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { PLAN_BY_ID, type InterviewTopic } from "@/lib/domain/interview";
import { cn } from "@/lib/utils";

// The master's stories as chapters (DESIGN §8 /m/talk): a header per topic, under it each question
// Hanate asked and what the master said, in the redacted words the server kept. No hooks, so it
// renders in server and client trees alike.

export type ChapterEntry = {
  topic: InterviewTopic;
  question: { kn: string; en: string };
  lines: Array<{ kn: string; en: string | null }>;
  /** Kept as voice only (speech to text not connected), or still being read. */
  state?: "pending" | "audio_only";
};

export function Chapters({ entries, sample = false, className }: { entries: ChapterEntry[]; sample?: boolean; className?: string }) {
  const groups: Array<{ topic: InterviewTopic; items: ChapterEntry[] }> = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.topic === e.topic) last.items.push(e);
    else groups.push({ topic: e.topic, items: [e] });
  }
  return (
    <section aria-labelledby="talk-chapters" className={cn("rounded-card bg-paper p-5 shadow-warm-sm sm:p-6", className)}>
      <h2 id="talk-chapters" className="flex items-center gap-2 font-display text-xl font-bold">
        <BookOpen className="size-5 text-clay" aria-hidden />
        <Bi k="talk.chapters" sub={false} />
        {sample && <SampleBadge className="ml-auto" />}
      </h2>
      {groups.length === 0 ? (
        <p className="mt-3 text-lg text-ink-3">
          <Bi k="talk.chapters.empty" subClassName="text-base" />
        </p>
      ) : (
        <ol className="mt-4 space-y-6">
          {groups.map((g, gi) => (
            <li key={`${g.topic}-${gi}`}>
              <h3 className="flex items-baseline gap-2 font-display text-lg font-bold text-clay-cta">
                <span aria-hidden className="text-base text-ink-3">
                  {gi + 1}.
                </span>
                <BiText text={PLAN_BY_ID.get(g.topic)!.label} subClassName="text-sm font-semibold" />
              </h3>
              <ul className="mt-2 space-y-4 border-l-2 border-flame/60 pl-4">
                {g.items.map((item, i) => (
                  <li key={i}>
                    <p className="text-base text-ink-3">
                      <BiText text={item.question} subClassName="text-sm" />
                    </p>
                    {item.lines.length > 0 && (
                      <div className="mt-2 space-y-1 text-[22px] leading-[1.65]">
                        {item.lines.map((l, k) => (
                          <p key={k}>
                            <span lang="kn" className="block">
                              {l.kn}
                            </span>
                            {l.en && (
                              <span lang="en" className="mt-0.5 block text-[15px] leading-normal text-ink-3">
                                {l.en}
                              </span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                    {item.state && (
                      <p className="mt-2 flex items-center gap-2 text-[15px] text-ink-3">
                        <Clock3 className="size-4" aria-hidden />
                        <Bi k={item.state === "pending" ? "talk.chapters.pending" : "talk.chapters.audio_only"} sub={false} />
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
