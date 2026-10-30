"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Trace } from "@/lib/ask/types";
import { getSessionFor } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";
import {
  answerFromCard,
  reviewerTraceStep,
  type CardForAnswer,
} from "@/lib/review/answer-with-card";
import { FIXTURE_QUEUE, fixtureQueueAnswers } from "@/lib/review/fixture";
import { fixtureCardChoices } from "@/lib/review/queue-cards";
import { createAdminClient } from "@/lib/supabase/admin";

// "Answer it with a card" on /r/queue (D83). Reviewers cannot read or write teachers' answers
// through RLS (0004), so this runs with the service role after checking the reviewer here, and
// lib/review/answer-with-card decides what is allowed (D38, D64).

const Form = z.object({ id: z.uuid(), card: z.uuid() });
const Bi = z.object({ kn: z.string(), en: z.string() });

export async function answerWithCard(form: FormData) {
  const session = await getSessionFor("reviewer");
  if (!session) redirect("/r/queue");
  const parsed = Form.safeParse({ id: form.get("id"), card: form.get("card") });
  if (!parsed.success) redirect("/r/queue?e=answer");
  const { id, card: cardId } = parsed.data;

  if (isFixtureMode()) {
    // Fixture mode: the Sample queue in memory, so the path can be seen and tested.
    const row = FIXTURE_QUEUE.find((r) => r.id === id);
    const card = fixtureCardChoices().find((c) => c.id === cardId);
    if (!row || !card || fixtureQueueAnswers().has(id)) redirect("/r/queue?e=answer");
    fixtureQueueAnswers().set(id, card.title.en);
    revalidatePath("/r/queue");
    redirect(`/r/queue?sent=${id}#q-${id}`);
  }

  let ok = false;
  try {
    ok = await answerLive(id, cardId, session.userId, session.isSample);
  } catch {
    ok = false;
  }
  // The same Sample question asked again, shown as one item (D98): its copies get the same card.
  const also = form
    .getAll("also")
    .map(String)
    .filter((x) => x !== id && z.uuid().safeParse(x).success)
    .slice(0, 100);
  if (ok) {
    for (const other of also) {
      await answerLive(other, cardId, session.userId, session.isSample).catch(() => false);
    }
  }
  revalidatePath("/r/queue");
  redirect(ok ? `/r/queue?sent=${id}#q-${id}` : "/r/queue?e=answer");
}

async function answerLive(
  queueId: string,
  cardId: string,
  reviewerId: string,
  reviewerIsSample: boolean,
) {
  const db = createAdminClient();
  if (!db) return false;
  const [{ data: row }, { data: card }] = await Promise.all([
    db
      .from("human_queue")
      .select("id, question_id, reason, status, is_sample")
      .eq("id", queueId)
      .maybeSingle(),
    db
      .from("cards")
      .select(
        "id, master_id, status, is_sample, title_kn, title_en, steps, materials, why_kn, why_en",
      )
      .eq("id", cardId)
      .maybeSingle(),
  ]);
  if (!row || !card) return false;
  const { data: credit } = await db
    .from("v_master_credit")
    .select("master_id")
    .eq("master_id", card.master_id as string)
    .maybeSingle();

  const choice: CardForAnswer = {
    id: card.id as string,
    status: card.status as string,
    isSample: card.is_sample as boolean,
    masterConsented: Boolean(credit),
    titleKn: (card.title_kn as string) ?? "",
    titleEn: (card.title_en as string) ?? "",
    steps: z.array(Bi).catch([]).parse(card.steps),
    materials: z.array(Bi).catch([]).parse(card.materials),
    whyKn: (card.why_kn as string | null) ?? null,
    whyEn: (card.why_en as string | null) ?? null,
  };
  const decided = answerFromCard(
    {
      reason: row.reason as string,
      status: row.status as string,
      isSample: row.is_sample as boolean,
    },
    choice,
    { isSample: reviewerIsSample },
  );
  if (!decided.ok) return false;

  // Her "no master yet" answer becomes the card, so it opens from her recent answers.
  const { data: answer } = await db
    .from("answers")
    .select("id, trace")
    .eq("question_id", row.question_id as string)
    .eq("outcome", "no_card")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!answer) return false;
  const before = (answer.trace ?? {}) as Partial<Trace>;
  const trace: Trace = {
    steps: [...(before.steps ?? []), reviewerTraceStep(choice.titleEn)],
    totals: before.totals ?? { latencyMs: 0, costUsd: 0 },
  };
  const { error: answerError } = await db
    .from("answers")
    .update({ ...decided.update, trace })
    .eq("id", answer.id as string)
    .eq("outcome", "no_card");
  if (answerError) return false;

  const { error: queueError } = await db
    .from("human_queue")
    .update({
      status: "resolved",
      resolution_note: `Answered with the card "${choice.titleEn}".`,
      resolved_at: new Date().toISOString(),
      assignee: reviewerId,
    })
    .eq("id", queueId);
  return !queueError;
}
