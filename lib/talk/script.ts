import {
  CARE_CHILD,
  CARE_SELF,
  INTERVIEW_PLAN,
  MAX_QUESTIONS,
  NAME_REMINDER,
  PLAN_BY_ID,
  PROBES,
  SESSION_CLOSE_BY_MS,
  THANK_YOU,
  type InterviewTopic,
} from "@/lib/domain/interview";
import type { Care } from "./care";

// The interview guide as a script: the next question without any model. It serves fixture mode
// (no keys, no network) and is the honest fallback when the interviewer model is unavailable, so a
// master is never left waiting in silence. Client safe: no server imports.

export type Turn = { topic: InterviewTopic; probe: boolean };

export type ScriptedQuestion = {
  questionKn: string;
  questionEn: string;
  why: string;
  topic: InterviewTopic;
  probe: boolean;
  done: boolean;
};

/** The script follows each opening with two of the guide's probes, then moves on. */
const SCRIPT_PROBES = 2;
const TOPIC_ORDER = INTERVIEW_PLAN.map((t) => t.id).filter((id) => id !== "warmup" && id !== "close");

function trailingProbes(turns: Turn[], topic: InterviewTopic): number {
  let n = 0;
  for (let i = turns.length - 1; i >= 0 && turns[i]!.topic === topic && turns[i]!.probe; i--) n++;
  return n;
}

function opening(topic: InterviewTopic, why: string): ScriptedQuestion {
  const t = PLAN_BY_ID.get(topic)!;
  return { questionKn: t.opening.kn, questionEn: t.opening.en, why, topic, probe: false, done: false };
}

export type ScriptInput = {
  turns: Turn[];
  elapsedMs: number;
  lastAnswerHadName?: boolean;
  /** The last answer spoke of a child in danger or of the master's own despair: do not probe it. */
  care?: Care | null;
};

export function scriptedNext(input: ScriptInput): ScriptedQuestion {
  const q = pick(input.turns, input.elapsedMs, Boolean(input.care));
  if (q.done) return q;
  const prefixes = [
    ...(input.care === "child" ? [CARE_CHILD] : input.care ? [CARE_SELF] : []),
    ...(input.lastAnswerHadName ? [NAME_REMINDER] : []),
  ];
  return prefixed(q, prefixes);
}

function prefixed(q: ScriptedQuestion, prefixes: Array<{ kn: string; en: string }>): ScriptedQuestion {
  if (prefixes.length === 0) return q;
  return {
    ...q,
    questionKn: [...prefixes.map((p) => p.kn), q.questionKn].join(" "),
    questionEn: [...prefixes.map((p) => p.en), q.questionEn].join(" "),
  };
}

function pick(turns: Turn[], elapsedMs: number, care: boolean): ScriptedQuestion {
  const last = turns[turns.length - 1];
  if (!last) return opening("warmup", "The guide starts with a short warm up.");
  if (last.topic === "close") {
    return { questionKn: THANK_YOU.kn, questionEn: THANK_YOU.en, why: "The signature line is recorded.", topic: "close", probe: false, done: true };
  }
  if (elapsedMs >= SESSION_CLOSE_BY_MS || turns.length >= MAX_QUESTIONS - 1) return opening("close", "The session is at its time.");
  if (last.topic !== "warmup" && !care) {
    const n = trailingProbes(turns, last.topic);
    if (n < SCRIPT_PROBES) {
      const p = PROBES[n]!;
      return { questionKn: p.kn, questionEn: p.en, why: "The guide asks for the next step and the exact words.", topic: last.topic, probe: true, done: false };
    }
  }
  const opened = new Set(turns.filter((t) => !t.probe).map((t) => t.topic));
  const next = TOPIC_ORDER.find((id) => !opened.has(id));
  return next ? opening(next, "The next topic in the guide.") : opening("close", "Every topic is covered.");
}

// ── The script's own lines, so the server can tell a guide question from anything else ──────────

type Line = { en: string; topic: InterviewTopic | "*"; probe: boolean };

function allScripted(): Map<string, Line[]> {
  const out = new Map<string, Line[]>();
  const add = (q: { questionKn: string; questionEn: string; topic: InterviewTopic | "*"; probe: boolean }) => {
    const list = out.get(q.questionKn) ?? [];
    list.push({ en: q.questionEn, topic: q.topic, probe: q.probe });
    out.set(q.questionKn, list);
  };
  const variants: Array<Array<{ kn: string; en: string }>> = [[], [NAME_REMINDER], [CARE_CHILD], [CARE_SELF], [CARE_CHILD, NAME_REMINDER], [CARE_SELF, NAME_REMINDER]];
  for (const t of INTERVIEW_PLAN) {
    for (const v of variants) add(prefixed(opening(t.id, ""), v));
  }
  // A probe follows whichever topic is open, so its topic is checked by the caller's rule.
  for (const p of PROBES) {
    for (const v of [[], [NAME_REMINDER]]) {
      const q = prefixed({ questionKn: p.kn, questionEn: p.en, why: "", topic: "letters", probe: true, done: false }, v);
      add({ ...q, topic: "*" });
    }
  }
  return out;
}

let scripted: Map<string, Line[]> | null = null;

/** A question exactly as the interview guide words it (any topic's opening, a probe, a reminder). */
export function isScriptedQuestion(q: { kn: string; en: string; topic: InterviewTopic; probe: boolean }): boolean {
  scripted ??= allScripted();
  return (scripted.get(q.kn.trim()) ?? []).some(
    (l) => l.en === q.en.trim() && l.probe === q.probe && (l.topic === "*" ? q.topic !== "warmup" && q.topic !== "close" : l.topic === q.topic),
  );
}

/** A line Hanate may say aloud without a signature: one of the guide's own, or the thank you. */
export function isScriptedLine(kn: string): boolean {
  scripted ??= allScripted();
  return scripted.has(kn.trim()) || kn.trim() === THANK_YOU.kn;
}
