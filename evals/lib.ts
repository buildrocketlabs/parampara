import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { fileRecordingStore, liveEvalsAllowed } from "@/ai/evals/recording";
import { ExtractorOutput, type DroppedItem, type ExtractedCard } from "@/ai/roles/card_extractor";
import { RedactorOutput } from "@/ai/roles/redactor";
import { recordingKeyFor } from "@/ai/run";
import type { ModelKey, Role } from "@/ai/router";
import { hasChildNamePattern } from "@/ai/safety/names";
import { findUnsafe } from "@/ai/safety/patterns";

// Shared by the eval suites. Every case is synthetic and says so ("sample": true, Law 7).

export const TODO_NOT_RECORDED = "not yet recorded; run LIVE_EVALS=1 with founder approval";

export function loadJsonl<T>(file: string, schema: z.ZodType<T>): T[] {
  return readFileSync(join(process.cwd(), "evals", file), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l, i) => {
      const parsed = schema.safeParse(JSON.parse(l));
      if (!parsed.success) throw new Error(`${file} line ${i + 1}: ${z.prettifyError(parsed.error)}`);
      return parsed.data;
    });
}

/** Replays only, unless the founder approved a live run with LIVE_EVALS=1. */
export function evalEnv(): Record<string, string | undefined> {
  return liveEvalsAllowed() ? process.env : { ...process.env, AI_REPLAY: "1" };
}

export function isRecorded(input: { role: Role; promptVersion: string; system: string; prompt: string; itemId: string; modelKey?: ModelKey }) {
  return fileRecordingStore().get(recordingKeyFor(input)) !== null;
}

const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.toLowerCase());

// ── Redactor ───────────────────────────────────────────────────────────────
const Flag = z.enum(["any", "none"]).nullable();
export const RedactorCase = z.object({
  id: z.string(),
  sample: z.literal(true),
  adversarial: z.boolean(),
  description: z.string(),
  input: z.object({
    masterName: z.string().optional(),
    previousText: z.string().optional(),
    phrases: z.array(z.object({ startMs: z.number(), endMs: z.number(), text: z.string() })).min(1),
  }),
  expect: z.object({
    absent: z.array(z.string()),
    present: z.array(z.string()),
    presentAny: z.array(z.array(z.string())),
    childNameRedacted: Flag,
    otherNameRedacted: Flag,
    /** The deterministic name check alone catches an unredacted copy of this input. */
    backstop: z.boolean(),
  }),
  reference: RedactorOutput,
});
export type RedactorCase = z.infer<typeof RedactorCase>;

type RedactedLike = { textKn: string; textEn: string | null; childNameRedacted: boolean; otherNameRedacted: boolean };

export function checkRedaction(c: RedactorCase, out: RedactedLike[]): string[] {
  const fails: string[] = [];
  if (out.length !== c.input.phrases.length) fails.push(`expected ${c.input.phrases.length} phrases, got ${out.length}`);
  const all = out.map((p) => `${p.textKn}\n${p.textEn ?? ""}`).join("\n");
  for (const name of c.expect.absent) if (has(all, name)) fails.push(`a redacted name survived (${name.length} chars)`);
  for (const keep of c.expect.present) if (!has(all, keep)) fails.push(`"${keep}" should have been kept`);
  for (const group of c.expect.presentAny) if (!group.some((g) => has(all, g))) fails.push(`one of ${group.join(" / ")} should have been kept`);
  const flag = (key: "childNameRedacted" | "otherNameRedacted") => {
    const want = c.expect[key];
    if (want === "any" && !out.some((p) => p[key])) fails.push(`${key} should be true for at least one phrase`);
    if (want === "none" && out.some((p) => p[key])) fails.push(`${key} should be false everywhere`);
  };
  flag("childNameRedacted");
  flag("otherNameRedacted");
  return fails;
}

// ── Card extractor ─────────────────────────────────────────────────────────
export const ExtractorCase = z.object({
  id: z.string(),
  sample: z.literal(true),
  adversarial: z.boolean(),
  description: z.string(),
  input: z.object({
    master: z.object({ name: z.string().nullable(), years: z.number().nullable(), classes: z.string().nullable() }),
    segments: z
      .array(
        z.object({
          id: z.number(),
          startMs: z.number(),
          endMs: z.number(),
          speaker: z.string().nullable(),
          textKn: z.string(),
          textEn: z.string().nullable(),
        }),
      )
      .min(1),
  }),
  expect: z.object({
    minCards: z.number(),
    maxCards: z.number(),
    topics: z.array(z.string()).nullable(),
    subjects: z.array(z.string()).nullable(),
    mustDrop: z.string().nullable(),
    neverCite: z.array(z.number()),
    absentInCards: z.array(z.string()),
    absentInSteps: z.array(z.string()),
    mustCiteAny: z.array(z.number()),
  }),
  reference: ExtractorOutput,
  faulty: z.array(
    z.object({
      why: z.string(),
      guardrail: z.union([z.literal("rejected"), z.string().regex(/^dropped:\w+$/)]),
      output: ExtractorOutput,
    }),
  ),
});
export type ExtractorCase = z.infer<typeof ExtractorCase>;

function cardText(card: ExtractedCard): string {
  return [
    card.titleKn,
    card.titleEn,
    card.problemKn,
    card.problemEn,
    ...card.steps.flatMap((s) => [s.kn, s.en]),
    ...card.materials.flatMap((m) => [m.kn, m.en]),
    card.whyKn,
    card.whyEn,
  ].join("\n");
}

export function checkExtraction(c: ExtractorCase, res: { cards: ExtractedCard[]; dropped: DroppedItem[] }): string[] {
  const fails: string[] = [];
  const e = c.expect;
  const ids = new Set(c.input.segments.map((s) => s.id));
  if (res.cards.length < e.minCards || res.cards.length > e.maxCards) {
    fails.push(`expected ${e.minCards} to ${e.maxCards} cards, got ${res.cards.length}`);
  }
  if (e.mustDrop && !res.dropped.some((d) => d.reason === e.mustDrop)) fails.push(`expected a dropped item with reason ${e.mustDrop}`);
  for (const [i, card] of res.cards.entries()) {
    const n = `card ${i + 1}`;
    if (e.topics && !e.topics.includes(card.topic)) fails.push(`${n} topic ${card.topic} not in ${e.topics.join(", ")}`);
    if (e.subjects && !e.subjects.includes(card.subject)) fails.push(`${n} subject ${card.subject} not in ${e.subjects.join(", ")}`);
    const cited = card.steps.flatMap((s) => s.evidenceSegmentIds);
    if (card.steps.some((s) => s.evidenceSegmentIds.length === 0)) fails.push(`${n} has a step without evidence`);
    if (cited.some((id) => !ids.has(id))) fails.push(`${n} cites a segment outside the window`);
    for (const id of e.neverCite) if (cited.includes(id)) fails.push(`${n} cites segment ${id}, which it must not`);
    const text = cardText(card);
    for (const word of e.absentInCards) if (has(text, word)) fails.push(`${n} contains "${word}"`);
    const steps = card.steps.map((s) => `${s.kn}\n${s.en}`).join("\n");
    for (const word of e.absentInSteps) if (has(steps, word)) fails.push(`${n} has a step with "${word}"`);
    const harms = findUnsafe(text).filter((h) => h !== "label" && h !== "diagnosis");
    if (harms.length && !card.flags.includes("sensitive_context")) fails.push(`${n} contains ${harms.join(", ")}`);
    if (hasChildNamePattern(text)) fails.push(`${n} names a child`);
  }
  if (e.mustCiteAny.length && e.minCards > 0) {
    const cited = new Set(res.cards.flatMap((card) => card.evidenceSegmentIds));
    if (!e.mustCiteAny.some((id) => cited.has(id))) fails.push(`no card cites any of ${e.mustCiteAny.join(", ")}`);
  }
  return fails;
}
