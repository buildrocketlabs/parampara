import { FLN_TOPIC_LABELS, type Bilingual } from "@/lib/domain/fln";
import { type Lang, type MessageKey } from "@/lib/i18n";
import { fill, type Vars } from "@/lib/i18n/fill";
import type { Count, PracticeRow, PulseSide, TopicRow } from "./types";
import { messages } from "@/lib/i18n/messages";

// "What to do this week" (DESIGN §1: an officer wants action before any number). Plain, derived
// only from the aggregates on the page, in Kannada and English. The insights digest (Claude) takes
// this place when today's digest exists; these are the honest fallback and never need a model.
// A hidden group is said as "fewer than 5 teachers", never as a number of questions: suppression
// counts different teachers, so "fewer than 5 questions" could be false.

export type PulseActionKind = "record" | "share" | "remind" | "invite" | "lamps";
export type PulseAction = { kind: PulseActionKind; text: Bilingual; href?: string };

// Three at most: the first is the one to do; the Lamps strip under the board is always there.
export const MAX_ACTIONS = 3;

/** Where an action can be done. A reviewer can record and invite; an officer arranges it. */
export type ActionLinks = { record?: string; invite?: string };

export const REVIEWER_LINKS: ActionLinks = { record: "/m/import", invite: "/r/invites" };

/** "12", or the words for a hidden group. */
export function countWords(c: Count, lang: Lang): string {
  if (!c.hidden) return String(c.n);
  return messages[lang][c.shield ? "pulse.shield.words" : "pulse.fewer"];
}

function both(key: MessageKey, vars: (lang: Lang) => Vars): Bilingual {
  return { kn: fill(messages.kn[key], vars("kn")), en: fill(messages.en[key], vars("en")) };
}

const topicName = (t: TopicRow, lang: Lang) => FLN_TOPIC_LABELS[t.topic][lang];
const shownN = (c: Count) => (c.hidden ? 0 : c.n);
const waits = (t: TopicRow) => t.waiting.hidden || shownN(t.waiting) > 0;

/** The topic most asked about this week, among topics big enough to show. */
export function topTopic(side: PulseSide): TopicRow | null {
  const shown = side.topics.filter((t) => !t.asked.hidden && shownN(t.asked) > 0);
  return shown.sort((a, b) => shownN(b.asked) - shownN(a.asked))[0] ?? null;
}

/** The topic with the most questions waiting for a master's answer (shown counts first). */
export function mostWaiting(side: PulseSide, except?: TopicRow["topic"]): TopicRow | null {
  const waiting = side.topics.filter((t) => waits(t) && t.topic !== except);
  return (
    waiting.sort(
      (a, b) =>
        Number(a.waiting.hidden) - Number(b.waiting.hidden) ||
        shownN(b.waiting) - shownN(a.waiting),
    )[0] ?? null
  );
}

/** The practice that worked most, among those tried by enough teachers to show. */
export function bestPractice(side: PulseSide): PracticeRow | null {
  const shown = side.practices.filter((p) => !p.worked.hidden && shownN(p.worked) > 0);
  return shown.sort((a, b) => shownN(b.worked) - shownN(a.worked))[0] ?? null;
}

export function deriveActions(side: PulseSide, links: ActionLinks = {}): PulseAction[] {
  const out: PulseAction[] = [];
  const asked = side.funnel.asked;
  const top = topTopic(side);

  if (top) {
    const vars = (lang: Lang) => ({
      topic: topicName(top, lang),
      n: countWords(top.asked, lang),
      total: countWords(asked, lang),
      w: countWords(top.waiting, lang),
    });
    out.push(
      waits(top)
        ? {
            kind: "record",
            text: both(top.waiting.hidden ? "pulse.do.topWaitingFew" : "pulse.do.topWaiting", vars),
            href: links.record,
          }
        : { kind: "share", text: both("pulse.do.top", vars) },
    );
  }

  const waiting = mostWaiting(side, top?.topic);
  if (waiting) {
    out.push({
      kind: "record",
      text: both(waiting.waiting.hidden ? "pulse.do.waitingFew" : "pulse.do.waiting", (lang) => ({
        topic: topicName(waiting, lang),
        w: countWords(waiting.waiting, lang),
      })),
      href: links.record,
    });
  }

  const best = bestPractice(side);
  if (best) {
    const key: MessageKey = best.master.name ? "pulse.do.share" : "pulse.do.shareAnon";
    out.push({
      kind: "share",
      text: both(key, (lang) => ({
        master: best.master.name ?? "",
        title: best.title[lang],
        tried: countWords(best.tried, lang),
        worked: countWords(best.worked, lang),
      })),
      // The Tomorrow card: a printable page of the practice for the cluster meeting.
      href: `/api/cards/${encodeURIComponent(best.cardId)}/image`,
    });
  }

  // Few teachers have said how it went: a reminder to everyone, never a word about anyone.
  const { answered, tried } = side.funnel;
  if (!answered.hidden && !tried.hidden && answered.n >= 5 && tried.n / answered.n < 0.4) {
    out.push({
      kind: "remind",
      text: both("pulse.do.remind", (lang) => ({
        answered: countWords(answered, lang),
        tried: countWords(tried, lang),
      })),
    });
  }

  if (out.length < 2 && (asked.hidden || asked.n < 10)) {
    out.push({
      kind: "invite",
      text: asked.hidden
        ? both("pulse.do.inviteFew", () => ({}))
        : asked.n === 0
          ? both("pulse.do.inviteNone", () => ({}))
          : both("pulse.do.invite", (lang) => ({ asked: countWords(asked, lang) })),
      href: links.invite,
    });
  }
  // At least two. In a quiet week the second is to grow the library, which a reviewer does.
  if (out.length < 2) {
    out.push({ kind: "record", text: both("pulse.do.askReviewer", () => ({})), href: links.record });
  }
  return out.slice(0, MAX_ACTIONS);
}
