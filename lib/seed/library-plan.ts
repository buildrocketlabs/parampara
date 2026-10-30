// The plan behind `pnpm seed:library` (scripts/seed-sample-library.mjs): the Sample practice library.
// The eval library's own cards (evals/library.json, ids and words unchanged, so the sample chips and
// the eval fixtures still meet the same practices) plus the Sample world cards
// (lib/seed/sample-world-cards.json), each credited to one of the twelve Sample masters, each cited
// to a synthetic Sample interview. Every row is Sample (Law 7).
//
// Pure and import free (apart from the sample world module), so Node runs it directly and a unit
// test checks it: safety patterns, both languages, every master and topic, stable ids.
import {
  SAMPLE_DRAFTS,
  SAMPLE_LIBRARY_TAG,
  SAMPLE_MASTERS,
  sampleUuid,
  type SampleMaster,
} from "./sample-world.ts";

export type Bi = { kn: string; en: string };
type Index = { topic: string; gradeBand: string; subject: string };

/** A card as evals/library.json and lib/seed/sample-world-cards.json write it. */
export type SourceCard = {
  id: string;
  /** Eval library: the master's Kannada name. */
  masterName?: string;
  /** Sample world: the master's key in SAMPLE_MASTERS. */
  master?: string;
  title: Bi;
  problem: Bi;
  steps: Bi[];
  materials?: Bi[] | null;
  why?: Bi | null;
  _index?: Index;
  index?: Index;
};

export type PlannedCard = {
  libraryId: string;
  dbId: string;
  masterKey: string;
  status: "approved" | "draft";
  origin: "eval" | "world";
  title: Bi;
  problem: Bi;
  steps: Bi[];
  materials: Bi[];
  why: Bi | null;
  topic: string;
  gradeBand: string;
  subject: string;
};

export type LibraryPlan = {
  masters: readonly SampleMaster[];
  cards: PlannedCard[];
  /** Eval cards never seeded: adversarial on purpose (an injected line, unsafe advice). */
  skipped: string[];
};

export function buildLibraryPlan(input: {
  evalCards: SourceCard[];
  worldCards: SourceCard[];
  /** True for a card that must never be seeded (the seed passes the safety patterns here). */
  isAdversarial: (card: SourceCard) => boolean;
}): LibraryPlan {
  const byEvalName = new Map(
    SAMPLE_MASTERS.filter((m) => m.evalName).map((m) => [m.evalName!, m.key]),
  );
  const keys = new Set(SAMPLE_MASTERS.map((m) => m.key));
  const cards: PlannedCard[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  const add = (c: SourceCard, origin: "eval" | "world") => {
    if (seen.has(c.id)) throw new Error(`duplicate library id ${c.id}`);
    seen.add(c.id);
    if (input.isAdversarial(c)) {
      skipped.push(c.id);
      return;
    }
    const masterKey = origin === "eval" ? byEvalName.get(c.masterName ?? "") : c.master;
    if (!masterKey || !keys.has(masterKey)) throw new Error(`no Sample master for ${c.id}`);
    const index = c.index ?? c._index;
    if (!index) throw new Error(`no topic, class and subject for ${c.id}`);
    cards.push({
      libraryId: c.id,
      dbId: sampleUuid(`card:${c.id}`),
      masterKey,
      status: SAMPLE_DRAFTS.has(c.id) ? "draft" : "approved",
      origin,
      title: c.title,
      problem: c.problem,
      steps: c.steps,
      materials: c.materials ?? [],
      why: c.why ?? null,
      topic: index.topic,
      gradeBand: index.gradeBand,
      subject: index.subject,
    });
  };
  for (const c of input.evalCards) add(c, "eval");
  for (const c of input.worldCards) add(c, "world");
  return { masters: SAMPLE_MASTERS, cards, skipped };
}

/** The interview the library seed writes for one master: a stable id. */
export function interviewIdFor(masterKey: string): string {
  return sampleUuid(`interview:${masterKey}`);
}

export type SegmentRow = {
  /** Bookkeeping for the seed, dropped before insert. */
  card: string;
  kind: string;
  interview_id: string;
  idx: number;
  chunk_idx: number;
  start_ms: number;
  end_ms: number;
  text_kn: string;
  text_en: string;
  speaker: "interviewer" | "master";
  redacted: boolean;
};

/**
 * A synthetic transcript for one master's cards: the interviewer's question, then the master's
 * words for each step and the reason, so every step cites the moment it was "said".
 */
export function buildSegments(interviewId: string, cards: PlannedCard[]): SegmentRow[] {
  let t = 0;
  let idx = 0;
  const rows: SegmentRow[] = [];
  for (const c of cards) {
    const say = (kind: string, text: Bi, speaker: SegmentRow["speaker"]) => {
      const len = Math.max(6000, Math.min(20000, text.kn.length * 140));
      rows.push({
        card: c.libraryId,
        kind,
        interview_id: interviewId,
        idx: idx++,
        chunk_idx: Math.floor(t / 25000),
        start_ms: t,
        end_ms: t + len,
        text_kn: text.kn,
        text_en: text.en,
        speaker,
        redacted: false,
      });
      t += len + 1200;
    };
    say(
      "q",
      { kn: `${c.problem.kn} ಆಗ ನೀವು ಏನು ಮಾಡಿದಿರಿ?`, en: `${c.problem.en} What did you do then?` },
      "interviewer",
    );
    c.steps.forEach((s, i) => say(`s${i}`, s, "master"));
    if (c.why) say("why", c.why, "master");
  }
  return rows;
}

/** The cards row to upsert, once the segments have their database ids. */
export function cardRow(
  c: PlannedCard,
  ctx: {
    masterId: string;
    interviewId: string;
    reviewerId: string;
    now: string;
    segmentId: (libraryId: string, kind: string) => number;
  },
): Record<string, unknown> {
  const steps = c.steps.map((s, i) => ({
    kn: s.kn,
    en: s.en,
    evidence_segment_ids: [ctx.segmentId(c.libraryId, `s${i}`)],
  }));
  const evidence = steps.flatMap((s) => s.evidence_segment_ids);
  const draft = c.status === "draft";
  return {
    id: c.dbId,
    master_id: ctx.masterId,
    interview_id: ctx.interviewId,
    is_sample: true,
    status: c.status,
    reviewer_id: draft ? null : ctx.reviewerId,
    reviewed_at: draft ? null : ctx.now,
    title_kn: c.title.kn,
    title_en: c.title.en,
    problem_kn: c.problem.kn,
    problem_en: c.problem.en,
    steps,
    materials: c.materials,
    why_kn: c.why?.kn ?? null,
    why_en: c.why?.en ?? null,
    grade_band: c.gradeBand,
    subject: c.subject,
    topic: c.topic,
    evidence_segment_ids: evidence,
    quote_segment_id: evidence[0] ?? null,
    flags: ["sample_synthetic"],
    prompt_version: SAMPLE_LIBRARY_TAG,
    edited_by_reviewer: false,
  };
}

export type LibraryCounts = {
  masters: number;
  mastersByDistrict: Record<string, number>;
  approved: number;
  drafts: number;
  approvedByTopic: Record<string, number>;
  approvedByMaster: Record<string, number>;
  skipped: string[];
};

export function libraryCounts(plan: LibraryPlan): LibraryCounts {
  const tally = (xs: string[]) =>
    xs.reduce<Record<string, number>>((o, x) => ((o[x] = (o[x] ?? 0) + 1), o), {});
  const approved = plan.cards.filter((c) => c.status === "approved");
  return {
    masters: plan.masters.length,
    mastersByDistrict: tally(plan.masters.map((m) => m.district)),
    approved: approved.length,
    drafts: plan.cards.length - approved.length,
    approvedByTopic: tally(approved.map((c) => c.topic)),
    approvedByMaster: tally(approved.map((c) => c.masterKey)),
    skipped: plan.skipped,
  };
}

/** Library card id → its master's district, for seed:pulse (a practice is tried near home first). */
export function cardDistricts(plan: LibraryPlan): Record<string, string> {
  const districtOf = new Map(plan.masters.map((m) => [m.key, m.district]));
  return Object.fromEntries(plan.cards.map((c) => [c.libraryId, districtOf.get(c.masterKey)!]));
}

/** A segment as the table takes it, without the seed's own bookkeeping (card, kind). */
export function segmentInsertRow(r: SegmentRow & { id?: number }): Record<string, unknown> {
  const row: Record<string, unknown> = { ...r };
  delete row.card;
  delete row.kind;
  return row;
}
