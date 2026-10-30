import type { createAdminClient } from "@/lib/supabase/admin";

// The Koppal field test in numbers, for /how. Field rows only (is_sample = false), never summed
// with Sample (Law 7). Totals only, never a row about a person (Law 6): question and outcome counts
// are hidden while fewer than 5 different teachers stand behind them, as on the officer's Pulse.

export const FIELD_MIN_TEACHERS = 5;

export type FieldCount = { n: number; hidden: false } | { n: null; hidden: true };

export type FieldSummary = {
  /** Field master teachers whose consent is on record. */
  masters: number;
  approvedCards: number;
  /** Field teachers who joined and agreed. */
  teachers: number;
  questions: FieldCount;
  tried: FieldCount;
  worked: FieldCount;
  partly: FieldCount;
  didnt: FieldCount;
  /** When the first consent was recorded (a master or a teacher), ISO, or null. */
  since: string | null;
};

export type FieldRows = {
  masters: number;
  approvedCards: number;
  teachers: number;
  /** One entry per field question: who asked (an id that never leaves the server). */
  askers: string[];
  /** One entry per field tried row. */
  tried: Array<{ teacher: string; outcome: string }>;
  firstConsent: string | null;
};

function guarded(n: number, people: number): FieldCount {
  return people >= 1 && people < FIELD_MIN_TEACHERS
    ? { n: null, hidden: true }
    : { n, hidden: false };
}

export function summarizeField(rows: FieldRows): FieldSummary {
  const askers = new Set(rows.askers).size;
  const triers = new Set(rows.tried.map((t) => t.teacher)).size;
  const count = (o: string) => rows.tried.filter((t) => t.outcome === o).length;
  return {
    masters: rows.masters,
    approvedCards: rows.approvedCards,
    teachers: rows.teachers,
    questions: guarded(rows.askers.length, askers),
    tried: guarded(rows.tried.length, triers),
    // The split is kept private with the total: three small numbers would point at people.
    worked: guarded(count("worked"), triers),
    partly: guarded(count("partly"), triers),
    didnt: guarded(count("didnt"), triers),
    since: rows.firstConsent,
  };
}

/** True when the field test has nothing on record yet: the screen shows its empty state. */
export function fieldIsEmpty(s: FieldSummary): boolean {
  return (
    s.masters === 0 &&
    s.approvedCards === 0 &&
    s.teachers === 0 &&
    s.questions.n === 0 &&
    s.tried.n === 0
  );
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Reads the field totals with the service role, on the server. Null when a read fails. */
export async function loadFieldSummary(db: Admin): Promise<FieldSummary | null> {
  const head = { count: "exact" as const, head: true };
  const [masters, cards, teachers, questions, tried, firstMaster, firstTeacher] = await Promise.all(
    [
      db.from("masters").select("id", head).eq("is_sample", false).not("consented_at", "is", null),
      db.from("cards").select("id", head).eq("is_sample", false).eq("status", "approved"),
      db
        .from("profiles")
        .select("id", head)
        .eq("is_sample", false)
        .eq("role", "teacher")
        .not("consented_at", "is", null),
      db.from("questions").select("teacher_id").eq("is_sample", false).limit(50000),
      db.from("tried").select("teacher_id, outcome").eq("is_sample", false).limit(50000),
      db
        .from("masters")
        .select("consented_at")
        .eq("is_sample", false)
        .not("consented_at", "is", null)
        .order("consented_at", { ascending: true })
        .limit(1),
      db
        .from("profiles")
        .select("consented_at")
        .eq("is_sample", false)
        .eq("role", "teacher")
        .not("consented_at", "is", null)
        .order("consented_at", { ascending: true })
        .limit(1),
    ],
  );
  if (
    [masters, cards, teachers, questions, tried, firstMaster, firstTeacher].some((r) => r.error)
  ) {
    return null;
  }
  const firsts = [firstMaster.data?.[0]?.consented_at, firstTeacher.data?.[0]?.consented_at]
    .filter((d): d is string => typeof d === "string")
    .sort();
  return summarizeField({
    masters: masters.count ?? 0,
    approvedCards: cards.count ?? 0,
    teachers: teachers.count ?? 0,
    askers: (questions.data ?? []).map((q) => String(q.teacher_id)),
    tried: (tried.data ?? []).map((t) => ({
      teacher: String(t.teacher_id),
      outcome: String(t.outcome),
    })),
    firstConsent: firsts[0] ?? null,
  });
}
