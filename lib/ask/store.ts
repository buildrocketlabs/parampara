import { createHash } from "node:crypto";
import type { AdminClient } from "@/lib/supabase/admin";
import type { AskStore, CardIndexEntry, FullCard } from "./types";

// AskStore on Supabase through the service role. The route has already checked the teacher;
// retrieval only ever sees approved cards, and master names come from v_master_credit, which
// honours each master's show_name choice (Law 6 for masters too).

function fail(what: string, error: { code?: string } | null): never {
  throw new Error(`${what} failed${error?.code ? ` (${error.code})` : ""}`);
}

type Bi = { kn: string; en: string };

export function createAskStore(db: AdminClient): AskStore {
  return {
    async insertQuestion(q) {
      const { data, error } = await db
        .from("questions")
        .insert({
          teacher_id: q.teacherId,
          text_redacted: q.textRedacted,
          lang: q.lang,
          topic: q.topic,
          grade_band: q.gradeBand,
          safety_flags: q.safetyFlags,
          is_sample: q.isSample,
        })
        .select("id")
        .single();
      if (error || !data) fail("store question", error);
      return data.id as string;
    },

    async insertAnswer(a) {
      const { data, error } = await db
        .from("answers")
        .insert({
          question_id: a.questionId,
          status: a.status,
          outcome: a.outcome,
          lang: a.lang,
          raw_key: a.rawKey,
          title_kn: a.title?.kn ?? null,
          title_en: a.title?.en ?? null,
          title_hi: null,
          steps: a.steps.map((s) => ({
            kn: s.kn,
            en: s.en,
            hi: s.hi ?? null,
            card_id: s.cardId,
            verdict: s.verdict,
          })),
          materials: a.materials,
          why: a.why,
          card_ids: a.cardIds,
          verdict: a.steps.length ? "supported" : null,
          trace: a.trace,
          cost_usd: a.costUsd,
          latency_ms: a.latencyMs,
          cache_key: a.cacheKey,
          replayed: a.replayedFrom !== null,
          replayed_from: a.replayedFrom,
          is_sample: a.isSample,
        })
        .select("id")
        .single();
      if (error || !data) fail("store answer", error);
      return data.id as string;
    },

    async queue(questionId, reason, urgent, isSample) {
      const { error } = await db
        .from("human_queue")
        .insert({ question_id: questionId, reason, urgent, is_sample: isSample });
      if (error) fail("queue for a human", error);
    },

    async cardIndex(pool): Promise<CardIndexEntry[]> {
      let q = db
        .from("cards")
        .select("id, master_id, title_en, problem_en, topic, grade_band, subject")
        .eq("status", "approved");
      if (pool === "field") q = q.eq("is_sample", false);
      const { data, error } = await q.limit(2000);
      if (error) fail("read card index", error);
      // Only masters whose consent is on record (v_master_credit lists exactly those): a master who
      // withdraws consent stops answering at once.
      const { data: credited } = await db.from("v_master_credit").select("master_id");
      const consented = new Set((credited ?? []).map((m) => m.master_id as string));
      return (data ?? [])
        .filter((c) => consented.has(c.master_id as string))
        .map((c) => ({
          id: c.id,
          titleEn: c.title_en,
          problemEn: c.problem_en,
          topic: c.topic,
          gradeBand: c.grade_band,
          subject: c.subject,
        }));
    },

    async fullCards(ids, pool): Promise<FullCard[]> {
      if (ids.length === 0) return [];
      let q = db
        .from("cards")
        .select(
          "id, master_id, title_kn, title_en, problem_kn, problem_en, steps, materials, why_kn, why_en, quote_segment_id, is_sample",
        )
        .in("id", ids)
        .eq("status", "approved");
      if (pool === "field") q = q.eq("is_sample", false);
      const { data, error } = await q;
      if (error) fail("read cards", error);
      const masterIds = [...new Set((data ?? []).map((c) => c.master_id as string))];
      const { data: credit } = await db
        .from("v_master_credit")
        .select("master_id, display_name")
        .in("master_id", masterIds);
      const names = new Map(
        (credit ?? []).map((m) => [
          m.master_id as string,
          (m.display_name as string | null) ?? null,
        ]),
      );
      const order = new Map(ids.map((id, i) => [id, i]));
      return (data ?? [])
        .map((c) => ({
          id: c.id as string,
          masterId: c.master_id as string,
          masterName: names.get(c.master_id) ?? null,
          title: { kn: c.title_kn, en: c.title_en },
          problem: { kn: c.problem_kn, en: c.problem_en },
          steps: ((c.steps as Bi[]) ?? []).map((s) => ({ kn: s.kn, en: s.en })),
          materials: (c.materials as Bi[]) ?? [],
          why: c.why_kn && c.why_en ? { kn: c.why_kn, en: c.why_en } : null,
          quoteSegmentId: c.quote_segment_id == null ? null : Number(c.quote_segment_id),
          isSample: c.is_sample as boolean,
        }))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },

    async libraryVersion(pool) {
      // Changes whenever a card is approved, edited or withdrawn, and whenever a master gives or
      // withdraws consent, so no cached answer outlives either (safety audit re check, 24 Oct).
      // The pool is part of it, so a field teacher never replays an answer built for the demo (D64).
      let latest = db
        .from("cards")
        .select("id, updated_at")
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(1);
      let counted = db
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved");
      if (pool === "field") {
        latest = latest.eq("is_sample", false);
        counted = counted.eq("is_sample", false);
      }
      const [{ data }, { count }, { data: credited }] = await Promise.all([
        latest,
        counted,
        db.from("v_master_credit").select("master_id"),
      ]);
      const masters = (credited ?? [])
        .map((m) => m.master_id as string)
        .sort()
        .join(",");
      return createHash("sha256")
        .update(`${pool}:${count ?? 0}:${data?.[0]?.updated_at ?? ""}:${masters}`)
        .digest("hex")
        .slice(0, 16);
    },

    async findCachedRaw(rawKey) {
      const { data } = await db
        .from("answers")
        .select("id, question_id, created_at")
        .eq("raw_key", rawKey)
        .eq("status", "answered")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const { data: q } = await db
        .from("questions")
        .select("text_redacted, topic, grade_band, safety_flags")
        .eq("id", data.question_id)
        .maybeSingle();
      if (!q) return null;
      return {
        answerId: data.id as string,
        question: {
          textRedacted: q.text_redacted as string,
          topic: (q.topic as string | null) ?? null,
          gradeBand: (q.grade_band as string | null) ?? null,
          safetyFlags: (q.safety_flags as string[] | null) ?? [],
        },
      };
    },

    async findCached(cacheKey) {
      const { data } = await db
        .from("answers")
        .select("id, created_at")
        .eq("cache_key", cacheKey)
        .eq("status", "answered")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data ? { answerId: data.id as string, createdAt: data.created_at as string } : null;
    },

    async copyAnswer(fromAnswerId, questionId, now) {
      const { data: src, error } = await db
        .from("answers")
        .select("*")
        .eq("id", fromAnswerId)
        .single();
      if (error || !src) fail("read cached answer", error);
      const trace = src.trace as { steps: unknown[]; totals: unknown };
      const { data, error: insErr } = await db
        .from("answers")
        .insert({
          question_id: questionId,
          status: src.status,
          outcome: src.outcome,
          lang: src.lang,
          title_kn: src.title_kn,
          title_en: src.title_en,
          title_hi: src.title_hi,
          steps: src.steps,
          materials: src.materials,
          why: src.why,
          card_ids: src.card_ids,
          verdict: src.verdict,
          audio_path: src.audio_path,
          trace: {
            ...trace,
            steps: [
              // The replay's own time and spend, and when the first answer was made; the totals
              // below stay the first answer's, and the drawer says which is which (F-P1).
              {
                kind: "cache",
                title: { kn: "ಹಿಂದೆ ಕೊಟ್ಟ ಉತ್ತರ", en: "Answered before" },
                detail: "Same question, same checked cards",
                at: src.created_at,
                ...(now ? { latencyMs: now.latencyMs, costUsd: now.costUsd } : {}),
              },
              ...(trace?.steps ?? []),
            ],
          },
          cost_usd: 0,
          latency_ms: 0,
          replayed: true,
          replayed_from: fromAnswerId,
          is_sample: src.is_sample,
        })
        .select("id")
        .single();
      if (insErr || !data) fail("replay answer", insErr);
      return data.id as string;
    },
  };
}

/**
 * Questions this teacher asked in the last hour that were not replays (rate limit, docs/AI.md §7).
 * A replayed answer (D35) costs nothing or one triage call, so it does not use up the hour: on the
 * shared one tap demo account, many jurors tapping the same sample questions never see "limited".
 * The total and daily dollar caps still count every call.
 */
export async function questionsLastHour(db: AdminClient, teacherId: string): Promise<number> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const [asked, replays] = await Promise.all([
    db
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .gte("created_at", since),
    db
      .from("answers")
      .select("id, questions!answers_question_id_fkey!inner(teacher_id)", {
        count: "exact",
        head: true,
      })
      .eq("replayed", true)
      .eq("questions.teacher_id", teacherId)
      .gte("created_at", since),
  ]);
  return Math.max(0, (asked.count ?? 0) - (replays.count ?? 0));
}
