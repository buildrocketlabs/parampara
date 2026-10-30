import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findDisclosures,
  findTeacherCrisis,
  findUnsafe,
  findWelfareSignals,
  scanUnsafe,
} from "@/ai/safety/patterns";
import { GRADE_BANDS, FLN_TOPICS, SUBJECTS } from "@/lib/domain/fln";
import { buildSegments, cardRow, interviewIdFor, libraryCounts } from "./library-plan";
import { loadPlan } from "./sample-world.fixture";
import { SAMPLE_DRAFTS, SAMPLE_LIBRARY_TAG, SAMPLE_MASTERS, sampleUuid } from "./sample-world";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const plan = loadPlan();
const approved = plan.cards.filter((c) => c.status === "approved");
const world = plan.cards.filter((c) => c.origin === "world");
const evalLibrary = JSON.parse(read("evals/library.json")) as {
  cards: Array<{ id: string; title: { en: string }; steps: Array<{ kn: string; en: string }> }>;
};

/** Every string a teacher could hear or read from a card. */
const strings = (c: (typeof plan.cards)[number]) => [
  c.title.kn,
  c.title.en,
  c.problem.kn,
  c.problem.en,
  ...c.steps.flatMap((s) => [s.kn, s.en]),
  ...c.materials.flatMap((m) => [m.kn, m.en]),
  ...(c.why ? [c.why.kn, c.why.en] : []),
];

describe("seed:library plan: twelve Sample masters", () => {
  it("are twelve, in six districts of Kalyana Karnataka and Kittur Karnataka, all labelled Sample", () => {
    expect(SAMPLE_MASTERS.length).toBe(12);
    const districts = new Set(SAMPLE_MASTERS.map((m) => m.district));
    expect(districts.size).toBe(6);
    const kalyana = ["Koppal", "Ballari", "Raichur", "Kalaburagi"];
    const kittur = ["Dharwad", "Vijayapura"];
    expect([...districts].sort()).toEqual([...kalyana, ...kittur].sort());
    for (const m of SAMPLE_MASTERS) {
      expect(m.nameEn).toMatch(/^[A-Z][a-z]+ \(Sample\)$/);
      expect(m.nameKn).toMatch(/^[ಀ-೿]+$/);
      expect(m.school).toMatch(/^Sample school/);
      expect(m.email).toMatch(/@demo\.parampara\.invalid$/);
      expect(m.years).toBeGreaterThanOrEqual(20);
      expect(m.years).toBeLessThanOrEqual(40);
    }
    expect(new Set(SAMPLE_MASTERS.map((m) => m.key)).size).toBe(12);
    expect(new Set(SAMPLE_MASTERS.map((m) => m.email)).size).toBe(12);
    // The demo master account (seed:demo) speaks for Sharanappa, as before.
    expect(SAMPLE_MASTERS[0]!.email).toBe("master@demo.parampara.invalid");
  });

  it("each have at least four approved cards", () => {
    const { approvedByMaster } = libraryCounts(plan);
    for (const m of SAMPLE_MASTERS) expect(approvedByMaster[m.key] ?? 0).toBeGreaterThanOrEqual(4);
  });
});

describe("seed:library plan: 68 approved Sample cards", () => {
  it("are 68 approved and the three reviewer drafts; the adversarial eval card is never seeded", () => {
    const counts = libraryCounts(plan);
    expect(counts.approved).toBe(68); // 60 (D88) plus 8 from the typed question probe (D99)
    expect(counts.drafts).toBe(3);
    expect(
      plan.cards
        .filter((c) => c.status === "draft")
        .map((c) => c.libraryId)
        .sort(),
    ).toEqual([...SAMPLE_DRAFTS].sort());
    expect(counts.skipped).toEqual(["sample-card-09"]);
    expect(world.length).toBe(63);
    expect(world.map((c) => c.libraryId)).toEqual(
      Array.from({ length: 63 }, (_, i) => `sample-world-${String(i + 1).padStart(2, "0")}`),
    );
  });

  it("keep the eval library's cards word for word, so the sample chips meet the same practices", () => {
    for (const c of plan.cards.filter((c) => c.origin === "eval")) {
      const src = evalLibrary.cards.find((e) => e.id === c.libraryId)!;
      expect(c.title.en).toBe(src.title.en);
      expect(c.steps).toEqual(src.steps);
    }
    const ids = approved.filter((c) => c.origin === "eval").map((c) => c.libraryId);
    expect(ids.sort()).toEqual([
      "sample-card-01",
      "sample-card-02",
      "sample-card-03",
      "sample-card-06",
      "sample-card-07",
    ]);
  });

  it("cover every FLN topic the app knows, Classes 1 to 3", () => {
    const { approvedByTopic } = libraryCounts(plan);
    for (const t of [
      "letters",
      "reading",
      "writing",
      "oral_language",
      "number_sense",
      "operations",
      "multi_level",
      "engagement",
      "classroom",
    ]) {
      expect(approvedByTopic[t] ?? 0).toBeGreaterThanOrEqual(5);
    }
    expect(approvedByTopic.other ?? 0).toBeGreaterThanOrEqual(3); // shapes and measuring
    // Home language and parents stay gaps on purpose: only reviewer drafts answer them.
    expect(approvedByTopic.home_language ?? 0).toBe(0);
    expect(approvedByTopic.parents ?? 0).toBe(0);
    for (const c of plan.cards) {
      expect((FLN_TOPICS as readonly string[]).includes(c.topic)).toBe(true);
      expect((GRADE_BANDS as readonly string[]).includes(c.gradeBand)).toBe(true);
      expect((SUBJECTS as readonly string[]).includes(c.subject)).toBe(true);
    }
  });

  it("are in Kannada and English (D6), three to five steps, a reason, no em dashes", () => {
    const kannada = /[ಀ-೿]/;
    for (const c of world) {
      expect(c.steps.length).toBeGreaterThanOrEqual(3);
      expect(c.steps.length).toBeLessThanOrEqual(5);
      expect(c.why).not.toBeNull();
      for (const bi of [c.title, c.problem, ...c.steps, ...c.materials, c.why!]) {
        expect(bi.kn.trim().length).toBeGreaterThan(0);
        expect(bi.en.trim().length).toBeGreaterThan(0);
        expect(bi.kn).toMatch(kannada);
        // The English is a rendering, not a copy of the Kannada.
        expect(bi.en.replace(/[ಀ-೿]/g, "").trim().length).toBeGreaterThan(0);
      }
      for (const s of strings(c)) expect(s).not.toMatch(/[—–]/);
    }
  });

  it("pass every deterministic safety pattern (Law 5): no punishment, shame, labels, diagnosis", () => {
    for (const c of approved) {
      for (const s of [...strings(c), JSON.stringify(strings(c))]) {
        expect(findUnsafe(s), `${c.libraryId}: ${s}`).toEqual([]);
        expect(findDisclosures(s), `${c.libraryId}: ${s}`).toEqual([]);
        expect(findWelfareSignals(s), `${c.libraryId}: ${s}`).toEqual([]);
        expect(findTeacherCrisis(s), `${c.libraryId}: ${s}`).toBe(false);
      }
    }
    // The Sample world cards do not even name a harm to forbid it.
    for (const c of world) {
      expect(scanUnsafe(strings(c).join("\n")), c.libraryId).toEqual([]);
    }
  });

  it("name no one: no person, no master, no injected instruction, no contact", () => {
    const names = SAMPLE_MASTERS.flatMap((m) => [m.nameKn, m.nameEn.replace(/ \(Sample\)$/, "")]);
    for (const c of world) {
      const text = strings(c).join("\n");
      for (const n of names) expect(text).not.toContain(n);
      expect(text).not.toMatch(/ignore (all )?(previous|prior)|system prompt|https?:|www\.|@|\d{6,}/i);
    }
  });

  it("are distinct practices: no two cards share a title or a problem", () => {
    const titles = plan.cards.map((c) => c.title.en.toLowerCase());
    const problems = plan.cards.map((c) => c.problem.en.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(problems).size).toBe(problems.length);
  });
});

describe("seed:library plan: stable rows", () => {
  it("gives every card and interview the same id on every run", () => {
    const again = loadPlan();
    expect(again.cards.map((c) => c.dbId)).toEqual(plan.cards.map((c) => c.dbId));
    expect(new Set(plan.cards.map((c) => c.dbId)).size).toBe(plan.cards.length);
    for (const c of plan.cards) {
      expect(c.dbId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(c.dbId).toBe(sampleUuid(`card:${c.libraryId}`));
    }
    expect(interviewIdFor("sharanappa")).toBe(interviewIdFor("sharanappa"));
    expect(interviewIdFor("sharanappa")).not.toBe(interviewIdFor("sharada"));
  });

  it("cites every step to the moment it was said in its Sample interview", () => {
    for (const m of SAMPLE_MASTERS) {
      const mine = plan.cards.filter((c) => c.masterKey === m.key);
      const segs = buildSegments(interviewIdFor(m.key), mine);
      expect(new Set(segs.map((s) => s.idx)).size).toBe(segs.length);
      for (const s of segs) expect(s.end_ms).toBeGreaterThan(s.start_ms);
      const ids = new Map(segs.map((s, i) => [`${s.card}|${s.kind}`, 1000 + i]));
      for (const c of mine) {
        const row = cardRow(c, {
          masterId: "m",
          interviewId: interviewIdFor(m.key),
          reviewerId: "r",
          now: "2026-10-28T00:00:00Z",
          segmentId: (card, kind) => ids.get(`${card}|${kind}`)!,
        });
        const steps = row.steps as Array<{ evidence_segment_ids: number[] }>;
        expect(steps.length).toBe(c.steps.length);
        for (const s of steps) expect(s.evidence_segment_ids[0]).toBeGreaterThan(0);
        expect((row.evidence_segment_ids as number[]).length).toBeGreaterThan(0);
        expect(row.is_sample).toBe(true);
        expect(row.prompt_version).toBe(SAMPLE_LIBRARY_TAG);
        expect(row.flags).toEqual(["sample_synthetic"]);
        expect(row.id).toBe(c.dbId);
        expect(row.status).toBe(c.status);
        expect(row.reviewer_id).toBe(c.status === "approved" ? "r" : null);
      }
    }
  });
});

describe("the Sample world tells no grandfather story", () => {
  it("has none of the dropped story names in any seed, plan or Sample card", () => {
    for (const path of [
      "lib/seed/sample-world.ts",
      "lib/seed/sample-world-cards.json",
      "lib/seed/library-plan.ts",
      "lib/seed/pulse-plan.ts",
      "scripts/seed-demo.mjs",
      "scripts/seed-sample-library.mjs",
      "scripts/seed-pulse.mjs",
      "scripts/sample-world.mjs",
      "evals/library.json",
    ]) {
      expect(read(path), path).not.toMatch(/irappa|halyal|ajja|grandfather|ಅಜ್ಜ|ಈರಪ್ಪ/i);
    }
  });
});
