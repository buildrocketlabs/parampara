import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findDisclosures,
  findTeacherCrisis,
  findUnsafe,
  findWelfareSignals,
} from "@/ai/safety/patterns";
import { FLN_TOPICS, GRADE_BANDS } from "@/lib/domain/fln";
import { kn } from "@/lib/i18n/kn";
import { sampleWorld } from "./sample-world.fixture";
import {
  buildPulseRows,
  previewPulse,
  PULSE_EMAIL_RE,
  PULSE_QUESTIONS,
  PULSE_TEACHERS,
  PULSE_THANKS_KN,
  pulseEmail,
} from "./pulse-plan";

// The rules the database applies (0005, 0006): an insight about fewer than 5 different teachers is
// hidden; a master's reach of 1 or 2 teachers reads "a few".
const MIN = 5;
const DAY = 86_400_000;
const IST = 330 * 60_000;
const now = new Date("2026-10-28T15:30:00Z"); // a Wednesday, 9 pm in Karnataka

const world = sampleWorld();
const build = (at: Date) => {
  let seq = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  return buildPulseRows({
    now: at,
    teacherIds: world.teacherIds,
    cards: world.pulseCards,
    cardDistricts: world.cardDistricts,
    uuid,
  });
};
const rows = build(now);
const preview = (r = rows) =>
  previewPulse(r, world.teacherDistrict, world.masterOfCard, world.approvedOf);

const distinct = (xs: unknown[]) => new Set(xs).size;
const questionById = new Map(rows.questions.map((q) => [q.id as string, q]));
const answerById = new Map(rows.answers.map((a) => [a.id as string, a]));
const triedById = new Map(rows.tried.map((t) => [t.id as string, t]));

// The lead may run the seed at any hour of any day: the screens must light up every time.
const RUNS = Array.from({ length: 14 }, (_, i) => new Date(now.getTime() + i * 13 * 3_600_000));

describe("seed:pulse plan: the Sample fortnight", () => {
  it("is 120 Sample teachers in seven districts, not all equal, and about 370 questions over 14 days", () => {
    expect(PULSE_TEACHERS.length).toBe(120);
    const per = new Map<string, number>();
    for (const t of PULSE_TEACHERS) per.set(t.district, (per.get(t.district) ?? 0) + 1);
    expect([...per.keys()].sort()).toEqual(
      ["Ballari", "Dharwad", "Gadag", "Kalaburagi", "Koppal", "Raichur", "Vijayapura"].sort(),
    );
    expect(new Set(per.values()).size).toBeGreaterThanOrEqual(6);
    expect(rows.questions.length).toBeGreaterThanOrEqual(320);
    expect(rows.questions.length).toBeLessThanOrEqual(420);
    for (const q of rows.questions) {
      const age = now.getTime() - Date.parse(q.created_at as string);
      expect(age).toBeGreaterThan(10 * 60_000);
      expect(age).toBeLessThan(15 * DAY);
    }
    // Teachers ask different amounts: some once, a few many times.
    const perTeacher = new Map<string, number>();
    for (const q of rows.questions) {
      const t = q.teacher_id as string;
      perTeacher.set(t, (perTeacher.get(t) ?? 0) + 1);
    }
    expect(Math.min(...perTeacher.values())).toBe(1);
    expect(Math.max(...perTeacher.values())).toBeGreaterThanOrEqual(6);
  });

  it("has a believable weekly rhythm: weekday evenings are busiest, Sunday is quiet", () => {
    const byDay = [0, 0, 0, 0, 0, 0, 0];
    let evening = 0;
    for (const q of rows.questions) {
      const ist = new Date(Date.parse(q.created_at as string) + IST);
      byDay[ist.getUTCDay()]! += 1;
      if (ist.getUTCHours() >= 19 && ist.getUTCHours() < 22) evening += 1;
    }
    const weekday = byDay.slice(1, 6).reduce((a, b) => a + b, 0) / 5;
    expect(byDay[0]!).toBeLessThan(weekday / 2);
    expect(byDay[6]!).toBeLessThan(weekday);
    expect(evening / rows.questions.length).toBeGreaterThan(0.5);
    for (const q of rows.questions) {
      const h = new Date(Date.parse(q.created_at as string) + IST).getUTCHours();
      expect(h).toBeGreaterThanOrEqual(6);
      expect(h).toBeLessThan(22);
    }
  });

  it("marks every row Sample and names no one", () => {
    for (const list of Object.values(rows)) {
      for (const r of list) expect(r.is_sample).toBe(true);
    }
    for (const t of PULSE_TEACHERS) {
      expect(pulseEmail(t.key)).toMatch(/^sample-pulse-t\d{3}@demo\.parampara\.invalid$/);
      expect(pulseEmail(t.key)).toMatch(PULSE_EMAIL_RE);
    }
    // The 24 Oct accounts (t01 to t18) are recognised as the seed's own, so a re run removes them.
    expect("sample-pulse-t07@demo.parampara.invalid").toMatch(PULSE_EMAIL_RE);
    expect("teacher@demo.parampara.invalid").not.toMatch(PULSE_EMAIL_RE);
    expect("sample-pulse-t001@gmail.com").not.toMatch(PULSE_EMAIL_RE);
  });

  it("asks only plain pedagogy, from or modelled on the eval set, with no names", () => {
    const dir = join(process.cwd(), "evals");
    const evalText = readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n")
      .toLowerCase();
    const names = world.masterNames;
    for (const q of Object.values(PULSE_QUESTIONS)) {
      if (q.from !== "modelled on the eval set") {
        // Word for word (an eval case with an injected part gives only its plain question).
        expect(evalText.includes(JSON.stringify(q.text).slice(1, -1).toLowerCase())).toBe(true);
      }
      expect(findUnsafe(q.text)).toEqual([]);
      expect(findDisclosures(q.text)).toEqual([]);
      expect(findWelfareSignals(q.text)).toEqual([]);
      expect(findTeacherCrisis(q.text)).toBe(false);
      expect(q.text).not.toMatch(/ignore|system prompt|instructions|SYSTEM/i);
      expect((FLN_TOPICS as readonly string[]).includes(q.topic)).toBe(true);
      if (q.gradeBand !== null) {
        expect((GRADE_BANDS as readonly string[]).includes(q.gradeBand)).toBe(true);
      }
      for (const n of names) expect(q.text).not.toContain(n);
    }
    // Both languages, mostly Kannada.
    const kn = Object.values(PULSE_QUESTIONS).filter((q) => q.lang === "kn").length;
    const en = Object.values(PULSE_QUESTIONS).filter((q) => q.lang === "en").length;
    expect(kn).toBeGreaterThan(en * 2);
    expect(en).toBeGreaterThan(5);
  });

  it("answers only from approved Sample cards, and queues what no card fits", () => {
    const approved = new Set(Object.values(world.pulseCards).map((c) => c.id));
    for (const a of rows.answers) {
      expect(a.replayed).toBe(true);
      expect(a.cache_key).toBeNull();
      expect(a.raw_key).toBeNull();
      if (a.status === "answered") {
        expect((a.card_ids as string[]).length).toBeGreaterThan(0);
        for (const c of a.card_ids as string[]) expect(approved.has(c)).toBe(true);
        for (const s of a.steps as Array<{ card_id: string }>) {
          expect(a.card_ids).toContain(s.card_id);
        }
      } else {
        expect(a.outcome).toBe("no_card");
        expect(a.cost_usd).toBe(0);
        expect(rows.queue.some((h) => h.question_id === a.question_id)).toBe(true);
      }
    }
    expect(rows.queue.length).toBeGreaterThanOrEqual(8);
    expect(rows.queue.length).toBeLessThanOrEqual(30);
    // The gaps are real: home language and parents have only reviewer drafts; nobody has the clock.
    const gaps = new Set(rows.queue.map((h) => questionById.get(h.question_id as string)!.topic));
    expect(gaps.has("home_language")).toBe(true);
  });

  it("cites every one of the 60 approved Sample cards of D88 somewhere (the 8 of D99 are newer)", () => {
    const cited = new Set(rows.answers.flatMap((a) => a.card_ids as string[]));
    const plannedCited = new Set(Object.values(PULSE_QUESTIONS).flatMap((q) => q.cards));
    expect(plannedCited.size).toBe(60);
    expect(cited.size).toBeGreaterThanOrEqual(55);
  });

  it("has a believable mix of tried outcomes, and some answers not tried yet", () => {
    const n = rows.tried.length;
    const share = (o: string) => rows.tried.filter((t) => t.outcome === o).length / n;
    expect(share("worked")).toBeGreaterThan(0.45);
    expect(share("worked")).toBeLessThan(0.7);
    expect(share("partly")).toBeGreaterThan(0.15);
    expect(share("didnt")).toBeGreaterThan(0.08);
    const answered = rows.answers.filter((a) => a.status === "answered").length;
    expect(answered - n).toBeGreaterThan(40);
    const once = new Set<string>();
    for (const t of rows.tried) {
      expect(once.has(t.answer_id as string)).toBe(false); // unique (answer_id, teacher_id)
      once.add(t.answer_id as string);
      const a = answerById.get(t.answer_id as string)!;
      expect(a.status).toBe("answered");
      const q = questionById.get(a.question_id as string)!;
      expect(t.teacher_id).toBe(q.teacher_id);
      expect(Date.parse(t.created_at as string)).toBeGreaterThan(
        Date.parse(q.created_at as string) + 12 * 3_600_000,
      );
      expect(Date.parse(t.created_at as string)).toBeLessThan(now.getTime());
    }
  });

  it("sends only the app's own thank you lines, to the master whose card helped", () => {
    expect([...PULSE_THANKS_KN]).toEqual([
      kn["tried.thanks.p1"],
      kn["tried.thanks.p2"],
      kn["tried.thanks.p3"],
    ]);
    expect(rows.thanks.length).toBeGreaterThan(20);
    for (const h of rows.thanks) {
      expect(PULSE_THANKS_KN).toContain(h.text);
      const t = triedById.get(h.tried_id as string)!;
      expect(t.outcome).toBe("worked");
      const first = (answerById.get(t.answer_id as string)!.card_ids as string[])[0]!;
      expect(h.master_id).toBe(world.masterIdOfCard[first]);
      expect(Date.parse(h.created_at as string)).toBeGreaterThan(
        Date.parse(t.created_at as string),
      );
      expect(Date.parse(h.created_at as string)).toBeLessThan(now.getTime());
    }
    const tried = new Set(rows.thanks.map((h) => h.tried_id));
    expect(tried.size).toBe(rows.thanks.length);
    // The newest notes wait for their master ("New" in the room); older ones were read.
    expect(rows.thanks.some((h) => h.delivered_at === null)).toBe(true);
    expect(rows.thanks.some((h) => h.delivered_at !== null)).toBe(true);
  });

  it.each(RUNS.map((at) => [at.toISOString(), at] as const))(
    "lights up /i, /i/lamps and /m whenever it runs (%s)",
    (_label, at) => {
      const p = preview(build(at));
      // The officer's week: six named districts; Gadag's three teachers are never named.
      const named = p.districts.filter((d) => d.district !== "elsewhere" && d.asked !== null);
      expect(named.map((d) => d.district).sort()).toEqual(
        ["Ballari", "Dharwad", "Kalaburagi", "Koppal", "Raichur", "Vijayapura"].sort(),
      );
      expect(p.districts.find((d) => d.district === "Gadag")).toBeUndefined();
      expect(p.week.teachers).toBeGreaterThanOrEqual(80);
      // Most topics show a number; at least one says "fewer than 5 teachers".
      expect(p.topics.filter((t) => t.asked !== null).length).toBeGreaterThanOrEqual(8);
      expect(p.topics.some((t) => t.asked === null && !t.shielded)).toBe(true);
      expect(p.week.waiting).toBeGreaterThanOrEqual(8);
      // Six lamps lit.
      const lit = p.lamps.filter((l) => l.district !== "elsewhere" && l.helped !== null);
      expect(lit.length).toBe(6);
      // Practices: several with a number, the rest honestly private.
      expect(p.practicesShown).toBeGreaterThanOrEqual(6);
      expect(p.practicesPrivate).toBeGreaterThanOrEqual(10);
      // Every Sample master's room shows a reach, not "a few"; the demo master's is full.
      expect(p.masters.length).toBe(12);
      for (const m of p.masters) expect(m.reached ?? 0).toBeGreaterThanOrEqual(3);
      const demo = p.masters.find((m) => m.master === "sharanappa")!;
      expect(demo.tried ?? 0).toBeGreaterThanOrEqual(10);
      expect(demo.worked ?? 0).toBeGreaterThanOrEqual(5);
      expect(demo.thanks).toBeGreaterThanOrEqual(2);
    },
  );

  it("shows numbers on most of the demo master's own cards (three or more teachers tried)", () => {
    const triers = new Map<string, Set<string>>();
    for (const t of rows.tried) {
      for (const c of answerById.get(t.answer_id as string)!.card_ids as string[]) {
        triers.set(c, (triers.get(c) ?? new Set()).add(t.teacher_id as string));
      }
    }
    const mine = Object.entries(world.masterOfCard)
      .filter(([, m]) => m === "sharanappa")
      .map(([c]) => c);
    expect(mine.length).toBe(5);
    expect(mine.filter((c) => (triers.get(c)?.size ?? 0) >= 3).length).toBeGreaterThanOrEqual(4);
  });

  it("keeps small groups apart from the shown totals (privacy, D54)", () => {
    const p = preview();
    expect(MIN).toBe(5);
    for (const t of p.topics) {
      if (t.asked !== null) expect(t.teachers).toBeGreaterThanOrEqual(MIN);
    }
    for (const d of p.districts) {
      if (d.asked !== null) expect(d.teachers).toBeGreaterThanOrEqual(MIN);
    }
  });

  it("is the same plan every run", () => {
    const again = build(now);
    const shape = (r: typeof rows) =>
      r.questions.map((q) => [q.teacher_id, q.text_redacted, q.created_at]);
    expect(shape(again)).toEqual(shape(rows));
    expect(again.tried.map((t) => [t.outcome, t.created_at])).toEqual(
      rows.tried.map((t) => [t.outcome, t.created_at]),
    );
    expect(again.thanks.map((t) => t.text)).toEqual(rows.thanks.map((t) => t.text));
    expect(distinct(rows.questions.map((q) => q.id))).toBe(rows.questions.length);
  });
});
