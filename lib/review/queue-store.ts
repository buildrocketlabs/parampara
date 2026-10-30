import type { ServerClient } from "@/lib/supabase/server";
import { FIXTURE_QUEUE, fixtureQueueAnswers } from "./fixture";
import type { QueueRowLike } from "./queue-groups";

// Reads the reviewer queue through the reviewer's own client, so RLS decides what is visible
// (0001, 0003: reviewers only; a demo reviewer sees Sample rows only, D38). Field and Sample rows
// are read apart, so however many Sample rows juror taps add, they never push a field row past the
// limit (D98).

export type QueueRow = QueueRowLike & { resolution_note: string | null };

export type QueueText = Map<
  string,
  {
    id: string;
    text_redacted: string;
    /** An English rendering when one exists (the Sample questions); real questions are her words. */
    text_en?: string;
    topic: string | null;
    grade_band: string | null;
  }
>;

const COLUMNS = "id, question_id, reason, urgent, status, is_sample, created_at, resolution_note";

export async function loadQueue(
  db: ServerClient,
  isSample: boolean,
  opts: { openOnly?: boolean } = {},
): Promise<{ rows: QueueRow[]; text: QueueText }> {
  const read = (sample: boolean, limit: number) => {
    let q = db
      .from("human_queue")
      .select(COLUMNS)
      .eq("is_sample", sample)
      .order("status")
      .order("urgent", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (opts.openOnly) q = q.neq("status", "resolved");
    return q;
  };
  const [field, sample] = await Promise.all([
    isSample ? Promise.resolve({ data: [] as QueueRow[] }) : read(false, 300),
    read(true, 500),
  ]);
  const rows = [...((field.data ?? []) as QueueRow[]), ...((sample.data ?? []) as QueueRow[])];
  const ids = [...new Set(rows.map((r) => r.question_id))];
  const text: QueueText = new Map();
  // In slices, so a long Sample queue stays within a URL's length.
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await db
      .from("v_review_questions")
      .select("id, text_redacted, topic, grade_band")
      .in("id", ids.slice(i, i + 150));
    for (const x of data ?? []) {
      text.set(x.id as string, {
        id: x.id as string,
        text_redacted: x.text_redacted as string,
        topic: (x.topic as string | null) ?? null,
        grade_band: (x.grade_band as string | null) ?? null,
      });
    }
  }
  return { rows, text };
}

/** Fixture mode (no keys): the Sample queue in memory, so it can be seen and tested. */
export function fixtureQueue(now = new Date()): { rows: QueueRow[]; text: QueueText } {
  const answered = fixtureQueueAnswers();
  const rows = FIXTURE_QUEUE.map((r) => {
    const createdAt =
      r.hoursAgo !== undefined
        ? new Date(now.getTime() - r.hoursAgo * 3_600_000).toISOString()
        : r.created_at;
    const base: QueueRow = {
      id: r.id,
      question_id: r.question_id,
      reason: r.reason,
      urgent: r.urgent,
      status: r.status,
      is_sample: r.is_sample,
      created_at: createdAt,
      resolution_note: r.resolution_note,
    };
    return answered.has(r.id)
      ? {
          ...base,
          status: "resolved",
          resolution_note: `Answered with the card "${answered.get(r.id)}".`,
        }
      : base;
  });
  const text: QueueText = new Map(
    FIXTURE_QUEUE.map((r) => [
      r.question_id,
      {
        id: r.question_id,
        text_redacted: r.text,
        text_en: r.textEn,
        topic: r.topic,
        grade_band: r.grade_band,
      },
    ]),
  );
  return { rows, text };
}
