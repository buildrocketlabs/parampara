import { z } from "zod";
import { FlnTopic, type Bilingual } from "@/lib/domain/fln";

// The officer's numbers, exactly as public.insights_* (0006) return them: aggregates only, never a
// teacher. A Count is null with hidden = true when fewer than 5 different teachers are in it.

/** The smallest group of different teachers a number may describe (insights_min_group()). */
export const MIN_GROUP = 5;

// A shielded count is not small itself: it is kept private so that a small group's number cannot
// be worked out by subtracting the shown groups from a shown total (complementary suppression).
export type Count = { n: number; hidden: false } | { n: null; hidden: true; shield?: boolean };

export const SHOWN_ZERO: Count = { n: 0, hidden: false };

export function count(n: number | null, hidden: boolean, shield = false): Count {
  if (shield) return { n: null, hidden: true, shield: true };
  return hidden || n === null ? { n: null, hidden: true } : { n, hidden: false };
}

/** The SQL rule, for fixtures and tests: 1 to 4 different teachers are hidden, none is 0. */
export function suppress(n: number, people: number): Count {
  return people >= 1 && people < MIN_GROUP ? { n: null, hidden: true } : { n, hidden: false };
}

export type TopicRow = { topic: FlnTopic; asked: Count; waiting: Count };
export type DistrictRow = { district: string | null; asked: Count };
export type PracticeRow = {
  cardId: string;
  title: Bilingual;
  topic: FlnTopic | null;
  master: { name: string | null; years: number | null; district: string | null };
  cardIsSample: boolean;
  tried: Count;
  worked: Count;
};

export type PulseSide = {
  isSample: boolean;
  since: string;
  until: string;
  funnel: { asked: Count; answered: Count; tried: Count; worked: Count };
  teachers: Count;
  cost: { answersUsd: number | null; perAnswerUsd: number | null; perTeacherUsd: number | null };
  topics: TopicRow[];
  districts: DistrictRow[];
  practices: PracticeRow[];
};

export type PlatformCost = { since: string; until: string; aiCostUsd: number; aiCalls: number };

export type Pulse = { field: PulseSide; sample: PulseSide; platform: PlatformCost | null };

export type LampMaster = { name: string | null; years: number | null; helped: Count };
export type LampDistrict = { district: string | null; helped: Count; masters: LampMaster[] };
export type Lamps = { field: LampDistrict[]; sample: LampDistrict[] };

// ── Rows as PostgREST returns them ─────────────────────────────────────────
const num = z.union([z.number(), z.string()]).transform((v) => Number(v));
const intOrNull = z.number().int().nullable();
const topicOf = (t: string | null): FlnTopic => {
  const parsed = FlnTopic.safeParse(t);
  return parsed.success ? parsed.data : "other";
};

export const SummaryRow = z.object({
  is_sample: z.boolean(),
  since: z.string(),
  until: z.string(),
  asked: intOrNull,
  asked_suppressed: z.boolean(),
  answered: intOrNull,
  answered_suppressed: z.boolean(),
  tried: intOrNull,
  tried_suppressed: z.boolean(),
  worked: intOrNull,
  worked_suppressed: z.boolean(),
  teachers: intOrNull,
  teachers_suppressed: z.boolean(),
  answer_cost_usd: num.nullable(),
  cost_per_answer_usd: num.nullable(),
  cost_per_teacher_usd: num.nullable(),
});

export const TopicDbRow = z
  .object({
    topic: z.string().nullable(),
    asked: intOrNull,
    asked_suppressed: z.boolean(),
    asked_shielded: z.boolean().default(false),
    waiting: intOrNull,
    waiting_suppressed: z.boolean(),
  })
  .transform((r): TopicRow => ({
    topic: topicOf(r.topic),
    asked: count(r.asked, r.asked_suppressed, r.asked_shielded),
    waiting: count(r.waiting, r.waiting_suppressed),
  }));

export const DistrictDbRow = z
  .object({
    district: z.string().nullable(),
    asked: intOrNull,
    suppressed: z.boolean(),
    shielded: z.boolean().default(false),
  })
  .transform(
    (r): DistrictRow => ({ district: r.district, asked: count(r.asked, r.suppressed, r.shielded) }),
  );

export const PracticeDbRow = z
  .object({
    card_id: z.string(),
    title_kn: z.string(),
    title_en: z.string(),
    topic: z.string().nullable(),
    master_name: z.string().nullable(),
    master_years: z.number().int().nullable(),
    master_district: z.string().nullable(),
    card_is_sample: z.boolean(),
    tried: intOrNull,
    worked: intOrNull,
    suppressed: z.boolean(),
  })
  .transform((r): PracticeRow => ({
    cardId: r.card_id,
    title: { kn: r.title_kn, en: r.title_en },
    topic: r.topic ? topicOf(r.topic) : null,
    master: { name: r.master_name, years: r.master_years, district: r.master_district },
    cardIsSample: r.card_is_sample,
    tried: count(r.tried, r.suppressed),
    worked: count(r.worked, r.suppressed),
  }));

export const LampDbRow = z.object({
  district: z.string().nullable(),
  helped: intOrNull,
  suppressed: z.boolean(),
});

export const LampMasterDbRow = z.object({
  district: z.string().nullable(),
  master_name: z.string().nullable(),
  master_years: z.number().int().nullable(),
  helped: intOrNull,
  suppressed: z.boolean(),
  shielded: z.boolean().default(false),
});

export const PlatformDbRow = z
  .object({ since: z.string(), until: z.string(), ai_cost_usd: num, ai_calls: z.number().int() })
  .transform((r): PlatformCost => ({
    since: r.since,
    until: r.until,
    aiCostUsd: r.ai_cost_usd,
    aiCalls: r.ai_calls,
  }));

export function sideFromSummary(
  s: z.infer<typeof SummaryRow>,
  rest: Pick<PulseSide, "topics" | "districts" | "practices">,
): PulseSide {
  return {
    isSample: s.is_sample,
    since: s.since,
    until: s.until,
    funnel: {
      asked: count(s.asked, s.asked_suppressed),
      answered: count(s.answered, s.answered_suppressed),
      tried: count(s.tried, s.tried_suppressed),
      worked: count(s.worked, s.worked_suppressed),
    },
    teachers: count(s.teachers, s.teachers_suppressed),
    cost: {
      answersUsd: s.answer_cost_usd,
      perAnswerUsd: s.cost_per_answer_usd,
      perTeacherUsd: s.cost_per_teacher_usd,
    },
    ...rest,
  };
}

/** Folds lamp rows and the masters behind them into one entry per district. */
export function joinLamps(
  lamps: Array<z.infer<typeof LampDbRow>>,
  masters: Array<z.infer<typeof LampMasterDbRow>>,
): LampDistrict[] {
  return lamps.map((l) => ({
    district: l.district,
    helped: count(l.helped, l.suppressed),
    masters: masters
      .filter((m) => m.district === l.district)
      .map((m) => ({
        name: m.master_name,
        years: m.master_years,
        helped: count(m.helped, m.suppressed, m.shielded),
      })),
  }));
}

/** Is there anything at all to show for this kind of data? */
export function hasPulse(side: PulseSide): boolean {
  const f = side.funnel;
  return (
    f.asked.hidden || (f.asked.n ?? 0) > 0 || side.topics.length > 0 || side.practices.length > 0
  );
}

export function emptySide(isSample: boolean, since: string, until: string): PulseSide {
  return {
    isSample,
    since,
    until,
    funnel: { asked: SHOWN_ZERO, answered: SHOWN_ZERO, tried: SHOWN_ZERO, worked: SHOWN_ZERO },
    teachers: SHOWN_ZERO,
    cost: { answersUsd: 0, perAnswerUsd: null, perTeacherUsd: null },
    topics: [],
    districts: [],
    practices: [],
  };
}
