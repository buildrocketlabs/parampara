import { z } from "zod";
import { findDisclosures, findUnsafe } from "@/ai";
import library from "@/evals/library.json";

// Open data (docs/BUILD.md M5.5, docs/open/README.md): approved practice cards of consented masters,
// under CC BY 4.0, for DIKSHA style systems. Only the words of each practice and the master's
// credit as they chose it. Never a transcript, segment text, evidence id, reviewer or teacher.
// This zod schema mirrors docs/open/parampara-card.schema.json; lib/open/cards.test.ts keeps them
// in step.

export const OPEN_SCHEMA_VERSION = "1.0";
export const LICENCE = {
  id: "CC-BY-4.0",
  name: "Creative Commons Attribution 4.0 International",
  url: "https://creativecommons.org/licenses/by/4.0/",
} as const;
export const ATTRIBUTION =
  "Parampara (Team Namma Shaale) and the master teachers named on each card";

const Bilingual = z.object({ kn: z.string(), en: z.string() }).strict();

export const OpenCard = z
  .object({
    id: z.string().min(1),
    title: Bilingual,
    problem: Bilingual,
    steps: z.array(Bilingual).min(1),
    materials: z.array(Bilingual),
    why: Bilingual.nullable(),
    gradeBand: z.string().nullable(),
    subject: z.string().nullable(),
    topic: z.string().nullable(),
    languages: z.tuple([z.literal("kn"), z.literal("en")]),
    master: z
      .object({
        name: z.string().nullable(),
        district: z.string().nullable(),
        yearsTeaching: z.number().int().nullable(),
        anonymous: z.boolean(),
      })
      .strict(),
    credit: z.string().min(1),
    licence: z.literal(LICENCE.id),
    licenceUrl: z.literal(LICENCE.url),
    reviewed: z.literal(true),
    isSample: z.boolean(),
    approvedAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type OpenCard = z.infer<typeof OpenCard>;

export const OpenCards = z
  .object({
    schemaVersion: z.literal(OPEN_SCHEMA_VERSION),
    name: z.string(),
    description: z.string(),
    licence: z
      .object({ id: z.literal(LICENCE.id), name: z.string(), url: z.literal(LICENCE.url) })
      .strict(),
    attribution: z.string(),
    generatedAt: z.iso.datetime({ offset: true }),
    count: z.number().int().nonnegative(),
    cards: z.array(OpenCard),
  })
  .strict();
export type OpenCards = z.infer<typeof OpenCards>;

/** A row of public.open_cards() (0006). */
export const OpenCardRow = z.object({
  id: z.string(),
  title_kn: z.string(),
  title_en: z.string(),
  problem_kn: z.string(),
  problem_en: z.string(),
  steps: z.array(Bilingual),
  materials: z.array(Bilingual),
  why_kn: z.string().nullable(),
  why_en: z.string().nullable(),
  grade_band: z.string().nullable(),
  subject: z.string().nullable(),
  topic: z.string().nullable(),
  is_sample: z.boolean(),
  approved_at: z.string(),
  updated_at: z.string(),
  master_name: z.string().nullable(),
  master_district: z.string().nullable(),
  master_years: z.number().int().nullable(),
});
export type OpenCardRow = z.infer<typeof OpenCardRow>;

const iso = (s: string) => new Date(s).toISOString();

export function creditLine(name: string | null, district: string | null): string {
  const who = name ? `${name}, master teacher` : "A master teacher who chose not to be named";
  return `${who}${district ? `, ${district}` : ""}. Shared through Parampara under CC BY 4.0.`;
}

export function toOpenCard(r: OpenCardRow): OpenCard {
  return {
    id: r.id,
    title: { kn: r.title_kn, en: r.title_en },
    problem: { kn: r.problem_kn, en: r.problem_en },
    steps: r.steps,
    materials: r.materials,
    why: r.why_kn || r.why_en ? { kn: r.why_kn ?? "", en: r.why_en ?? "" } : null,
    gradeBand: r.grade_band,
    subject: r.subject,
    topic: r.topic,
    languages: ["kn", "en"],
    master: {
      name: r.master_name,
      district: r.master_district,
      yearsTeaching: r.master_name === null ? null : r.master_years,
      anonymous: r.master_name === null,
    },
    credit: creditLine(r.master_name, r.master_district),
    licence: LICENCE.id,
    licenceUrl: LICENCE.url,
    reviewed: true,
    isSample: r.is_sample,
    approvedAt: iso(r.approved_at),
    updatedAt: iso(r.updated_at),
  };
}

/**
 * The deterministic safety backstop (D44) on anything we publish: a card whose words involve
 * punishment, threats, shaming or the like is left out of open data even if it was approved.
 */
export function safeToPublish(card: OpenCard): boolean {
  const text = [
    card.title.kn,
    card.title.en,
    card.problem.kn,
    card.problem.en,
    ...card.steps.flatMap((s) => [s.kn, s.en]),
    ...card.materials.flatMap((m) => [m.kn, m.en]),
    card.why?.kn ?? "",
    card.why?.en ?? "",
  ].join("\n");
  return (
    findUnsafe(text).length === 0 &&
    findDisclosures(text).length === 0 &&
    !INSTRUCTION.test(text) &&
    !CONTACT.test(text)
  );
}

const INSTRUCTION = /ignore (all |the )?(previous|prior|above) (instructions|rules)/i;
// A phone number, an email address or a link has no place in a public practice card.
const CONTACT =
  /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|[\w.+-]+@[\w-]+\.[\w.]+|https?:\/\/|www\./i;

export function buildOpenCards(rows: OpenCardRow[], now = new Date()): OpenCards {
  const cards = rows.map(toOpenCard).filter(safeToPublish);
  return {
    schemaVersion: OPEN_SCHEMA_VERSION,
    name: "Parampara practice cards",
    description:
      "Classroom practices from Karnataka's master teachers for foundational literacy and numeracy, in Kannada and English. Each card was approved by a human reviewer, and every step cites the master's own recorded words (kept private). Cards marked isSample are synthetic, for demonstration.",
    licence: { ...LICENCE },
    attribution: ATTRIBUTION,
    generatedAt: now.toISOString(),
    count: cards.length,
    cards,
  };
}

// ── Fixture mode (no database yet): the approved Sample library, honestly marked Sample ──
const SAMPLE_APPROVED = new Set([
  "sample-card-01",
  "sample-card-02",
  "sample-card-03",
  "sample-card-06",
  "sample-card-07",
  "sample-card-09",
]);
const SAMPLE_MASTERS: Record<string, string> = {
  ಶಂಕರಪ್ಪ: "Sharanappa",
  ಶಾರದಾ: "Sharada",
  ಗೀತಾ: "Geetha",
  ಮಲ್ಲಿಕಾರ್ಜುನ: "Mallikarjun",
};
const SAMPLE_YEARS: Record<string, number> = { ಶಂಕರಪ್ಪ: 32, ಶಾರದಾ: 28, ಗೀತಾ: 24, ಮಲ್ಲಿಕಾರ್ಜುನ: 35 };
const SAMPLE_SEEDED_AT = "2026-10-23T00:00:00.000Z";

export function sampleOpenCardRows(): OpenCardRow[] {
  return library.cards
    .filter((c) => SAMPLE_APPROVED.has(c.id))
    .map((c) => ({
      id: c.id,
      title_kn: c.title.kn,
      title_en: c.title.en,
      problem_kn: c.problem.kn,
      problem_en: c.problem.en,
      steps: c.steps.map((s) => ({ kn: s.kn, en: s.en })),
      materials: c.materials.map((m) => ({ kn: m.kn, en: m.en })),
      why_kn: c.why?.kn ?? null,
      why_en: c.why?.en ?? null,
      grade_band: c._index?.gradeBand ?? null,
      subject: c._index?.subject ?? null,
      topic: c._index?.topic ?? null,
      is_sample: true,
      approved_at: SAMPLE_SEEDED_AT,
      updated_at: SAMPLE_SEEDED_AT,
      master_name: SAMPLE_MASTERS[c.masterName] ?? null,
      master_district: "Koppal",
      master_years: SAMPLE_YEARS[c.masterName] ?? null,
    }));
}
