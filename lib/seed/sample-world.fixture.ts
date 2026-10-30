import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findUnsafe } from "@/ai/safety/patterns";
import { buildLibraryPlan, cardDistricts, type LibraryPlan, type SourceCard } from "./library-plan";
import { PULSE_TEACHERS, type PulseCard } from "./pulse-plan";
import { SAMPLE_MASTERS } from "./sample-world";

// The whole Sample world as the seeds would write it, with stand in ids, for the unit tests.
// Same files and the same adversarial filter as scripts/sample-world.mjs.

const read = (path: string) => JSON.parse(readFileSync(join(process.cwd(), path), "utf8"));
const INJECTION = /ignore (all )?(previous|prior) instructions|system prompt|you are now/i;

export function isAdversarial(c: SourceCard): boolean {
  const text = JSON.stringify([c.title, c.problem, c.steps, c.materials, c.why]);
  return INJECTION.test(text) || findUnsafe(text).length > 0;
}

export function loadPlan(): LibraryPlan {
  return buildLibraryPlan({
    evalCards: read("evals/library.json").cards,
    worldCards: read("lib/seed/sample-world-cards.json").cards,
    isAdversarial,
  });
}

export function sampleWorld() {
  const plan = loadPlan();
  const masterDbId = (key: string) => `master-${key}`;
  const approved = plan.cards.filter((c) => c.status === "approved");
  const pulseCards: Record<string, PulseCard> = Object.fromEntries(
    approved.map((c) => [
      c.libraryId,
      {
        id: c.dbId,
        master_id: masterDbId(c.masterKey),
        title_kn: c.title.kn,
        title_en: c.title.en,
        steps: c.steps,
        materials: c.materials,
        why_kn: c.why?.kn ?? null,
        why_en: c.why?.en ?? null,
      },
    ]),
  );
  const approvedOf: Record<string, number> = {};
  for (const c of approved) approvedOf[c.masterKey] = (approvedOf[c.masterKey] ?? 0) + 1;
  return {
    plan,
    pulseCards,
    /** Card database id → master key. */
    masterOfCard: Object.fromEntries(approved.map((c) => [c.dbId, c.masterKey])),
    /** Card database id → the master's (stand in) database id. */
    masterIdOfCard: Object.fromEntries(approved.map((c) => [c.dbId, masterDbId(c.masterKey)])),
    approvedOf,
    cardDistricts: cardDistricts(plan),
    teacherIds: Object.fromEntries(PULSE_TEACHERS.map((t) => [t.key, `profile-${t.key}`])),
    teacherDistrict: Object.fromEntries(
      PULSE_TEACHERS.map((t) => [`profile-${t.key}`, t.district]),
    ),
    masterNames: SAMPLE_MASTERS.flatMap((m) => [m.nameKn, m.nameEn.replace(/ \(Sample\)$/, "")]),
  };
}
