import type { DigestCount, DigestInput } from "@/ai";
import { FLN_TOPIC_LABELS } from "@/lib/domain/fln";
import { INR_PER_USD } from "./money";
import type { Count, PulseSide } from "./types";

// What the insights digest model is given: the page's own aggregates and nothing else. No teacher
// id, name, question text or school can enter, because none of them exist in a PulseSide. No
// districts either: a note that names places invites comparing them (Law 6).

const FEWER = "fewer than 5 teachers" as const;
const PRIVATE = "kept private" as const;
const TITLE_MAX = 80;

const c = (x: Count): DigestCount => (x.hidden ? (x.shield ? PRIVATE : FEWER) : x.n);

const clip = (s: string) => (s.length <= TITLE_MAX ? s : `${s.slice(0, TITLE_MAX - 1)}…`);

/** An India date (YYYY-MM-DD) for an instant. */
export function istDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** The Monday (India time) of the week an instant falls in: the digest cache key. */
export function weekStartOf(iso: string): string {
  const day = new Date(`${istDate(iso)}T00:00:00Z`);
  const back = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - back * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function digestAggregates(side: PulseSide): DigestInput {
  return {
    kind: side.isSample ? "sample" : "field",
    week: { from: istDate(side.since), to: istDate(side.until) },
    funnel: {
      asked: c(side.funnel.asked),
      answered: c(side.funnel.answered),
      tried: c(side.funnel.tried),
      worked: c(side.funnel.worked),
    },
    teachersWhoAsked: c(side.teachers),
    topics: side.topics.map((t) => ({
      topic: FLN_TOPIC_LABELS[t.topic].en,
      topicKn: FLN_TOPIC_LABELS[t.topic].kn,
      asked: c(t.asked),
      waitingForMaster: c(t.waiting),
    })),
    practices: side.practices.map((p) => ({
      title: clip(p.title.en),
      titleKn: clip(p.title.kn),
      master: p.master.name,
      tried: c(p.tried),
      worked: c(p.worked),
    })),
    costPerTeacherInr:
      side.cost.perTeacherUsd === null
        ? null
        : Math.round(side.cost.perTeacherUsd * INR_PER_USD * 100) / 100,
  };
}
