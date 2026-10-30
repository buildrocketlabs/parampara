import { describe, expect, it } from "vitest";
import { loadFieldSummary, type FieldSummary } from "@/lib/field/summary";
import { cardRow } from "./library-plan";
import { buildPulseRows, PULSE_TEACHERS } from "./pulse-plan";
import { sampleWorld } from "./sample-world.fixture";
import { SAMPLE_MASTERS } from "./sample-world";

// Law 7 at the unit level: /how "From the field" (D67) reads the field totals with the real
// loadFieldSummary over an in memory database. The totals must be the same before and after the
// whole Sample world is written beside a small field test. supabase/tests/sample_world_check.sql
// checks the same at the SQL level (field functions and views) on a throwaway Postgres.

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** Just enough of the Supabase query builder for loadFieldSummary: select, eq, not is null, order, limit. */
function fakeDb(tables: Tables) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      let head = false;
      let counted = false;
      const query = {
        select(_columns: string, opts?: { count?: string; head?: boolean }) {
          head = Boolean(opts?.head);
          counted = opts?.count === "exact";
          return query;
        },
        eq(column: string, value: unknown) {
          rows = rows.filter((r) => r[column] === value);
          return query;
        },
        not(column: string, op: string, value: unknown) {
          if (op !== "is" || value !== null) throw new Error("unsupported filter");
          rows = rows.filter((r) => r[column] !== null && r[column] !== undefined);
          return query;
        },
        order(column: string, opts: { ascending: boolean }) {
          rows.sort((a, b) => {
            const x = String(a[column]);
            const y = String(b[column]);
            return (x < y ? -1 : x > y ? 1 : 0) * (opts.ascending ? 1 : -1);
          });
          return query;
        },
        limit(n: number) {
          rows = rows.slice(0, n);
          return query;
        },
        then(resolve: (v: { data: Row[] | null; count: number | null; error: null }) => void) {
          resolve({ data: head ? null : rows, count: counted ? rows.length : null, error: null });
        },
      };
      return query;
    },
  } as unknown as Parameters<typeof loadFieldSummary>[0];
}

const day = (d: number) => new Date(Date.UTC(2026, 9, 20 + d, 14)).toISOString();

/** A small Koppal field test: real rows (is_sample = false). */
function fieldTest(): Tables {
  const teachers = Array.from({ length: 7 }, (_, i) => `f-teacher-${i}`);
  return {
    profiles: [
      ...teachers.map((id, i) => ({
        id,
        role: "teacher",
        is_sample: false,
        district: "Koppal",
        consented_at: day(i),
      })),
      { id: "f-teacher-unconsented", role: "teacher", is_sample: false, consented_at: null },
      { id: "f-master-p1", role: "master", is_sample: false, consented_at: day(0) },
      { id: "f-master-p2", role: "master", is_sample: false, consented_at: day(1) },
    ],
    masters: [
      { id: "f-master-1", profile_id: "f-master-p1", is_sample: false, consented_at: day(0) },
      { id: "f-master-2", profile_id: "f-master-p2", is_sample: false, consented_at: day(1) },
      { id: "f-master-3", profile_id: "f-master-p3", is_sample: false, consented_at: null },
    ],
    cards: [
      ...[1, 2, 3].map((i) => ({ id: `f-card-${i}`, status: "approved", is_sample: false })),
      { id: "f-card-draft", status: "draft", is_sample: false },
    ],
    questions: teachers
      .slice(0, 6)
      .flatMap((t, i) =>
        [0, 1].map((k) => ({ id: `f-q-${i}-${k}`, teacher_id: t, is_sample: false })),
      ),
    tried: teachers.slice(0, 5).map((t, i) => ({
      id: `f-t-${i}`,
      teacher_id: t,
      outcome: i < 3 ? "worked" : i < 4 ? "partly" : "didnt",
      is_sample: false,
    })),
  };
}

/** Every row seed:demo, seed:library and seed:pulse write, with stand in ids. */
function sampleRows(): Tables {
  const world = sampleWorld();
  let seq = 0;
  const uuid = () => `s-${++seq}`;
  const teacherIds = Object.fromEntries(PULSE_TEACHERS.map((t) => [t.key, `s-teacher-${t.key}`]));
  const pulse = buildPulseRows({
    now: new Date("2026-10-28T15:30:00Z"),
    teacherIds,
    cards: world.pulseCards,
    cardDistricts: world.cardDistricts,
    uuid,
  });
  const now = "2026-10-28T00:00:00Z";
  return {
    profiles: [
      ...["teacher", "master", "reviewer", "officer"].map((role) => ({
        id: `s-demo-${role}`,
        role,
        is_sample: true,
        consented_at: now,
      })),
      ...SAMPLE_MASTERS.map((m) => ({
        id: `s-profile-${m.key}`,
        role: "master",
        is_sample: true,
        district: m.district,
        consented_at: now,
      })),
      ...PULSE_TEACHERS.map((t) => ({
        id: teacherIds[t.key],
        role: "teacher",
        is_sample: true,
        district: t.district,
        consented_at: now,
      })),
    ],
    masters: SAMPLE_MASTERS.map((m) => ({
      id: `master-${m.key}`,
      profile_id: `s-profile-${m.key}`,
      is_sample: true,
      consented_at: now,
    })),
    cards: world.plan.cards.map((c) =>
      cardRow(c, {
        masterId: `master-${c.masterKey}`,
        interviewId: "s-interview",
        reviewerId: "s-demo-reviewer",
        now,
        segmentId: () => 1,
      }),
    ),
    questions: pulse.questions,
    answers: pulse.answers,
    tried: pulse.tried,
    thanks: pulse.thanks,
    human_queue: pulse.queue,
  };
}

const merge = (a: Tables, b: Tables): Tables =>
  Object.fromEntries(
    [...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [
      k,
      [...(a[k] ?? []), ...(b[k] ?? [])],
    ]),
  );

describe("the Sample world never reaches a field number (Law 7, D67)", () => {
  it("writes only rows marked Sample", () => {
    for (const [table, rows] of Object.entries(sampleRows())) {
      for (const r of rows) expect(r.is_sample, table).toBe(true);
    }
  });

  it("leaves /how's field totals exactly as they were", async () => {
    const field = fieldTest();
    const before = (await loadFieldSummary(fakeDb(field))) as FieldSummary;
    const after = (await loadFieldSummary(fakeDb(merge(field, sampleRows())))) as FieldSummary;
    expect(before).toEqual({
      masters: 2,
      approvedCards: 3,
      teachers: 7,
      questions: { n: 12, hidden: false },
      tried: { n: 5, hidden: false },
      worked: { n: 3, hidden: false },
      partly: { n: 1, hidden: false },
      didnt: { n: 1, hidden: false },
      since: day(0),
    });
    expect(after).toEqual(before);
  });

  it("would have changed them if a Sample row were ever counted (the check has teeth)", async () => {
    const field = fieldTest();
    const leaked = sampleRows();
    for (const rows of Object.values(leaked)) for (const r of rows) r.is_sample = false;
    const before = (await loadFieldSummary(fakeDb(field))) as FieldSummary;
    const after = (await loadFieldSummary(fakeDb(merge(field, leaked)))) as FieldSummary;
    expect(after.approvedCards).toBe(before.approvedCards + 68);
    expect(after.masters).toBe(before.masters + 12);
    expect(after.teachers).toBeGreaterThan(before.teachers + 120);
    expect(after.questions.n).toBeGreaterThan(300);
  });

  it("leaves the empty field test empty", async () => {
    const empty = (await loadFieldSummary(fakeDb(sampleRows()))) as FieldSummary;
    expect(empty.masters).toBe(0);
    expect(empty.approvedCards).toBe(0);
    expect(empty.teachers).toBe(0);
    expect(empty.questions).toEqual({ n: 0, hidden: false });
    expect(empty.tried).toEqual({ n: 0, hidden: false });
    expect(empty.since).toBeNull();
  });
});
