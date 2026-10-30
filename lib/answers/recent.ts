import type { ServerClient } from "@/lib/supabase/server";

// The teacher's own recent answers for her home screen, read with her own client (RLS answers_own,
// tried_own_select): nobody else's questions, and nothing here is ever shown to anyone else.

export type RecentAnswer = {
  id: string;
  title: { kn: string; en: string };
  createdAt: string;
  outcome: "worked" | "partly" | "didnt" | null;
};

/** Untried answers this old or older get "Did it work?" on the home screen (not minutes after asking). */
export const ASK_IF_TRIED_AFTER_MS = 6 * 60 * 60_000;

export async function recentAnswers(
  db: ServerClient,
  teacherId: string,
  limit = 6,
): Promise<RecentAnswer[]> {
  const { data: qs } = await db
    .from("questions")
    .select("id")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false })
    .limit(40);
  const qIds = (qs ?? []).map((q) => q.id as string);
  if (qIds.length === 0) return [];
  const { data: answers } = await db
    .from("answers")
    .select("id, title_kn, title_en, created_at")
    .in("question_id", qIds)
    .eq("status", "answered")
    .order("created_at", { ascending: false })
    .limit(limit);
  const ids = (answers ?? []).map((a) => a.id as string);
  const { data: tried } = ids.length
    ? await db.from("tried").select("answer_id, outcome").in("answer_id", ids)
    : { data: [] as Array<{ answer_id: string; outcome: RecentAnswer["outcome"] }> };
  const outcome = new Map(
    (tried ?? []).map((t) => [t.answer_id as string, t.outcome as RecentAnswer["outcome"]]),
  );
  return (answers ?? []).map((a) => ({
    id: a.id as string,
    title: { kn: (a.title_kn as string | null) ?? "", en: (a.title_en as string | null) ?? "" },
    createdAt: a.created_at as string,
    outcome: outcome.get(a.id as string) ?? null,
  }));
}

/** The answer to ask about: the newest one she has not marked, old enough to have been tried. */
export function answerToFollowUp(recent: RecentAnswer[], now = Date.now()): RecentAnswer | null {
  return (
    recent.find(
      (a) => a.outcome === null && now - Date.parse(a.createdAt) >= ASK_IF_TRIED_AFTER_MS,
    ) ?? null
  );
}

/** Greeting by the hour in Karnataka, so 9 pm feels like 9 pm wherever the server runs. */
export function partOfDay(now = new Date()): "morning" | "afternoon" | "evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(now),
  );
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}
