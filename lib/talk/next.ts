import { nextInterviewQuestion, type InterviewerInput, type InterviewerResult, type NextQuestion, type Span } from "@/ai";
import { MAX_QUESTIONS } from "@/lib/domain/interview";
import type { ImportStore } from "@/lib/import/types";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Care } from "./care";
import { scriptedNext, type Turn } from "./script";
import { activeElapsedMs, listTurns, type LiveInterview, type PartMeta, type TurnView } from "./turns";

// Hanate's next question (docs/BUILD.md M4.3): the interviewer model reads the redacted
// conversation so far; if it cannot answer in time, the interview guide's own next question is
// asked instead, so the master never waits in silence. The trace says which one it was.
//
// When the last answer spoke of a child in danger or of the master's own despair, no model is
// asked at all: the guide thanks them and moves to the next topic (Law 5), and `care` tells the
// screen which helpline to show. Such an answer is never shown to the model afterwards either, and
// while the last answer's words are still on their way, the guide asks instead of the model. Each
// interview has a bound on questions and on model calls.

export type TalkAi = { next(input: InterviewerInput): Promise<InterviewerResult> };
export const talkAi: TalkAi = { next: (input) => nextInterviewQuestion(input) };

export type NextResult = { question: NextQuestion; source: "model" | "script"; care: Care | null; span?: Span };


/** Up to three attempts per question, and a little room for retries on a bad network. */
const MODEL_ROWS_PER_QUESTION = 3;
const MODEL_ROWS_SLACK = 9;

/** Answered and skipped questions, in the order they were asked (both are parts of the talk). */
export function askedInOrder(parts: PartMeta[]): Turn[] {
  return parts.flatMap((p) => (p.kind !== "consent" && p.topic ? [{ topic: p.topic, probe: Boolean(p.probe) }] : []));
}

/** What the model reads: each question and its answer, with any answer that needed care left out. */
export function transcriptFor(turns: TurnView[]): InterviewerInput["transcript"] {
  return turns.flatMap((t) => [
    ...(t.question ? [{ speaker: "interviewer", textKn: t.question.kn, textEn: t.question.en }] : []),
    ...(t.care
      ? [{ speaker: null, textKn: "(An answer about a child's safety or the master's wellbeing is left out here. Do not ask about it.)", textEn: null }]
      : t.lines.map((l) => ({ speaker: "master", textKn: l.kn, textEn: l.en }))),
  ]);
}

async function modelRows(db: AdminClient, interviewId: string): Promise<number> {
  const { count } = await db
    .from("ai_calls")
    .select("id", { count: "exact", head: true })
    .eq("trace_id", interviewId)
    .eq("role", "interviewer");
  return count ?? 0;
}

export async function nextQuestion(
  db: AdminClient,
  store: ImportStore,
  live: LiveInterview,
  ai: TalkAi,
  traceId: string,
  opts: { now?: number } = {},
): Promise<NextResult> {
  const now = opts.now ?? Date.now();
  const asked = askedInOrder(live.parts);
  const turns = await listTurns(db, live);
  const last = turns[turns.length - 1];
  // Only the answer just given counts: a question skipped after it means the moment has passed.
  const lastIsAnswer = last?.kind === "answer" || last?.kind === "typed";
  const care = lastIsAnswer ? (last?.care ?? null) : null;
  const lastAnswerHadName = lastIsAnswer ? Boolean(last?.nameRedacted) : false;
  const elapsedMs = activeElapsedMs(live, now);
  const script = (): NextResult => ({ question: scriptedNext({ turns: asked, elapsedMs, lastAnswerHadName, care }), source: "script", care });

  if (care) return script();
  // Words of the last answer still missing (a chunk failed or is late): they may hold a disclosure.
  if (lastIsAnswer && (last?.pending ?? 0) > 0) return script();
  if (asked.length >= MAX_QUESTIONS - 1) return script();
  if ((await modelRows(db, live.id)) >= MODEL_ROWS_PER_QUESTION * asked.length + MODEL_ROWS_SLACK) return script();

  const [master, cards] = await Promise.all([
    store.getMasterContext(live.masterId),
    db.from("cards").select("title_en").eq("master_id", live.masterId).order("created_at", { ascending: false }).limit(30),
  ]);
  const res = await ai.next({
    master,
    transcript: transcriptFor(turns),
    turns: asked,
    cardsCaptured: (cards.data ?? []).map((c) => c.title_en as string),
    elapsedMs,
    lastAnswerHadName,
    traceId,
  });
  if (res.status === "ok") return { question: res.question, source: "model", care: null, span: res.span };
  return { ...script(), span: res.span };
}
