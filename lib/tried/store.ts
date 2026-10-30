import type { Session } from "@/lib/auth/session";
import { getAnswerView } from "@/lib/answers/store";
import type { AdminClient } from "@/lib/supabase/admin";
import type { ServerClient } from "@/lib/supabase/server";
import type { TriedAnswer, TriedOutcome, TriedRecord } from "./types";

// tried and thanks on Supabase with the teacher's own client, so RLS is the guard (0001):
// tried_own_insert only accepts her own answer; thanks_teacher_insert only a master whose card
// was used in that answer. The master never learns who sent the thanks (Law 6).

export async function getTriedAnswer(
  db: ServerClient,
  session: Session,
  answerId: string,
): Promise<TriedAnswer | null> {
  const view = await getAnswerView(db, session, answerId);
  if (!view || view.status !== "answered") return null;
  const first = view.steps[0];
  return {
    id: view.id,
    title: view.title,
    firstStep: first ? { kn: first.kn, en: first.en, hi: first.hi } : null,
    master: view.master,
    isSample: view.isSample,
  };
}

export async function getTriedRecord(
  db: ServerClient,
  session: Session,
  answerId: string,
): Promise<TriedRecord | null> {
  const { data } = await db
    .from("tried")
    .select("id, outcome")
    .eq("answer_id", answerId)
    .eq("teacher_id", session.userId)
    .maybeSingle();
  if (!data) return null;
  const { count } = await db
    .from("thanks")
    .select("id", { count: "exact", head: true })
    .eq("tried_id", data.id as string);
  return { outcome: data.outcome as TriedOutcome, thanked: (count ?? 0) > 0 };
}

/** Upsert, so a change of mind replaces the first answer (unique per answer and teacher). */
export async function upsertTried(
  db: ServerClient,
  session: Session,
  answerId: string,
  outcome: TriedOutcome,
  note: string | null,
): Promise<"ok" | "denied" | "failed"> {
  const { error } = await db.from("tried").upsert(
    {
      answer_id: answerId,
      teacher_id: session.userId,
      outcome,
      note_redacted: note,
      is_sample: session.isSample,
    },
    { onConflict: "answer_id,teacher_id" },
  );
  if (!error) return "ok";
  // 42501: row level security said no (not her answer). 23503: the answer does not exist.
  return error.code === "42501" || error.code === "23503" ? "denied" : "failed";
}

/** One thank you per tried answer, to the master of the answer's first card. */
export async function insertThanks(
  db: ServerClient,
  session: Session,
  answerId: string,
  text: string,
): Promise<"ok" | "already" | "not_tried" | "denied" | "failed"> {
  const { data: tried } = await db
    .from("tried")
    .select("id")
    .eq("answer_id", answerId)
    .eq("teacher_id", session.userId)
    .maybeSingle();
  if (!tried) return "not_tried";

  const { count } = await db
    .from("thanks")
    .select("id", { count: "exact", head: true })
    .eq("tried_id", tried.id as string);
  if ((count ?? 0) > 0) return "already";

  const { data: answer } = await db
    .from("answers")
    .select("steps, card_ids")
    .eq("id", answerId)
    .maybeSingle();
  const steps = (answer?.steps ?? []) as Array<{ card_id?: string }>;
  const cardIds = (answer?.card_ids ?? []) as string[];
  const firstCard = steps[0]?.card_id ?? cardIds[0];
  if (!firstCard) return "denied";
  const { data: card } = await db
    .from("cards")
    .select("master_id")
    .eq("id", firstCard)
    .maybeSingle();
  if (!card) return "denied";

  const { error } = await db.from("thanks").insert({
    tried_id: tried.id,
    master_id: card.master_id,
    text,
    is_sample: session.isSample,
  });
  if (!error) return "ok";
  return error.code === "42501" ? "denied" : "failed";
}

/**
 * A free text note hinted that a child may be at risk (Law 5): the teacher was shown Childline 1098,
 * and her question goes to the human queue, urgent. The note itself is never stored. The answer is
 * read with her own client first, so only her own question can be queued.
 */
export async function escalateWelfare(
  db: ServerClient,
  admin: AdminClient,
  session: Session,
  answerId: string,
): Promise<boolean> {
  const { data } = await db.from("answers").select("question_id").eq("id", answerId).maybeSingle();
  const questionId = data?.question_id as string | undefined;
  if (!questionId) return false;
  const { error } = await admin.from("human_queue").insert({
    question_id: questionId,
    reason: "safety",
    urgent: true,
    is_sample: session.isSample,
  });
  return !error;
}
