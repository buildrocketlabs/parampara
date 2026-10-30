import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveActions, MAX_ACTIONS } from "./actions";
import { digestAggregates, istDate, weekStartOf } from "./digest-input";
import { DISTRICTS, districtName, MAP_W, TILE_W } from "./districts";
import { samplePulse } from "./fixture";
import { emptySide, hasPulse, MIN_GROUP, suppress, type PulseSide } from "./types";

const KANNADA = /[ಀ-೿]/;

describe("suppression mirrors the database rule", () => {
  it("hides 1 to 4 different teachers, shows none and 5 or more", () => {
    expect(suppress(0, 0)).toEqual({ n: 0, hidden: false });
    for (const p of [1, 2, 3, 4]) expect(suppress(12, p)).toEqual({ n: null, hidden: true });
    expect(suppress(7, MIN_GROUP)).toEqual({ n: 7, hidden: false });
    expect(MIN_GROUP).toBe(5);
  });

  it("uses the same smallest group as the migration", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0006_insights.sql"), "utf8");
    expect(sql).toMatch(
      /insights_min_group\(\) returns int\s+language sql immutable as \$\$ select 5 \$\$/,
    );
  });
});

describe("what to do this week", () => {
  const sample = samplePulse(Date.parse("2026-10-24T06:00:00Z")).sample;

  it("gives 2 to 4 plain actions in Kannada and English", () => {
    const actions = deriveActions(sample);
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions.length).toBeLessThanOrEqual(MAX_ACTIONS);
    for (const a of actions) {
      expect(a.text.kn).toMatch(KANNADA);
      expect(a.text.en).not.toMatch(KANNADA);
      expect(a.text.en).not.toMatch(/[—–]|\{\w+\}/);
      expect(a.text.kn).not.toMatch(/\{\w+\}/);
    }
  });

  it("leads with the most asked topic and its waiting questions", () => {
    const [first] = deriveActions(sample);
    expect(first?.kind).toBe("record");
    expect(first?.text.en).toContain("Multi level class (14 of 46)");
    expect(first?.text.en).toContain("6 questions on it are still waiting");
  });

  it("credits the practice that worked most, as the master chose", () => {
    const share = deriveActions(sample).find((a) => a.kind === "share");
    expect(share?.text.en).toContain("Sharanappa's");
    expect(share?.text.en).toContain("worked 12 of the 15 times");
    expect(share?.href).toBe("/api/cards/sample-card-03/image");
  });

  it("never prints a number for a group under 5", () => {
    const small: PulseSide = {
      ...sample,
      topics: [{ topic: "parents", asked: suppress(3, 3), waiting: suppress(2, 2) }],
      practices: [],
      funnel: { ...sample.funnel, asked: suppress(3, 3) },
    };
    const text = deriveActions(small)
      .map((a) => `${a.text.en} ${a.text.kn}`)
      .join(" ");
    expect(text).toContain("fewer than 5");
    expect(text).not.toMatch(/\b[1-4]\b/);
  });

  it("asks for a reminder to everyone when few teachers said how it went", () => {
    const quiet = {
      ...sample,
      practices: [],
      funnel: { ...sample.funnel, answered: suppress(20, 10), tried: suppress(5, 5) },
    };
    const remind = deriveActions(quiet).find((a) => a.kind === "remind");
    expect(remind?.text.en).toContain("only 5 of 20 answers");
  });

  it("still offers a way forward with no data", () => {
    const empty = emptySide(false, "2026-10-17T00:00:00Z", "2026-10-24T00:00:00Z");
    expect(hasPulse(empty)).toBe(false);
    expect(deriveActions(empty).map((a) => a.kind)).toEqual(["invite", "record"]);
  });
});

describe("the digest's input", () => {
  it("carries only aggregates, with small groups as words", () => {
    const input = digestAggregates(samplePulse(Date.parse("2026-10-24T06:00:00Z")).sample);
    const text = JSON.stringify(input);
    expect(text).not.toMatch(/teacher_?id|profile|user|email|@/i);
    expect(input.kind).toBe("sample");
    expect(input.topics.find((t) => t.topic === "Attendance and interest")?.asked).toBe(
      "fewer than 5 teachers",
    );
    expect(input.funnel.asked).toBe(46);
    // No places at all: a note that names districts invites comparing them (Law 6).
    expect(text).not.toMatch(/district|koppal|raichur/i);
  });

  it("says kept private for a shielded group, never its number", () => {
    const side = samplePulse(Date.parse("2026-10-24T06:00:00Z")).sample;
    const shielded = {
      ...side,
      topics: [{ ...side.topics[0]!, asked: { n: null, hidden: true, shield: true } as const }],
    };
    expect(digestAggregates(shielded).topics[0]?.asked).toBe("kept private");
  });

  it("keys the cache by the India week", () => {
    expect(weekStartOf("2026-10-24T10:00:00Z")).toBe("2026-10-19"); // Saturday
    expect(weekStartOf("2026-10-25T20:00:00Z")).toBe("2026-10-26"); // Monday 01:30 in India
    expect(istDate("2026-10-23T19:00:00Z")).toBe("2026-10-24");
  });
});

describe("Lamps of Karnataka tiles", () => {
  it("has Karnataka's 31 districts, each in its own place", () => {
    expect(DISTRICTS).toHaveLength(31);
    expect(new Set(DISTRICTS.map((d) => d.key)).size).toBe(31);
    expect(new Set(DISTRICTS.map((d) => `${d.row}:${d.x2}`)).size).toBe(31);
    for (const d of DISTRICTS) {
      expect(d.x2 % 2, d.key).toBe(d.row % 2); // odd rows sit half a tile over
      expect((d.x2 / 2) * TILE_W + TILE_W / 2, d.key).toBeLessThanOrEqual(MAP_W);
      expect(d.name.kn, d.key).toMatch(KANNADA);
    }
  });

  it("uses exactly the district keys the database folds names into", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0006_insights.sql"), "utf8");
    const fn = sql.slice(
      sql.indexOf("function public.insights_district("),
      sql.indexOf("-- ── Teacher Pulse"),
    );
    const keys = new Set([...fn.matchAll(/\('[^']+', '([a-z_]+)'\)/g)].map((m) => m[1]));
    expect([...keys].sort()).toEqual(DISTRICTS.map((d) => d.key).sort());
  });

  it("names unknown and missing districts honestly", () => {
    expect(districtName("koppal").en).toBe("Koppal");
    expect(districtName("other").en).toBe("Somewhere else");
    expect(districtName(null).en).toBe("District not given");
  });
});
