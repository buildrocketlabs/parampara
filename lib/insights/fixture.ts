import library from "@/evals/library.json";
import {
  emptySide,
  suppress,
  type Lamps,
  type PracticeRow,
  type Pulse,
  type PulseSide,
} from "./types";

// Fixture mode (no database yet, D48): a small, labelled Sample week so /i and /i/lamps can be
// seen and tested before the founder's keys exist. Every number here is Sample and is shown under
// the Sample badge; field is empty, as it truly is until Koppal teachers start asking (Law 7).
// Practices are cards from the Sample library (evals/library.json) with their Sample masters.

const DAY = 24 * 60 * 60 * 1000;

const MASTER_EN: Record<string, { name: string; years: number }> = {
  ಶಂಕರಪ್ಪ: { name: "Sharanappa", years: 32 },
  ಶಾರದಾ: { name: "Sharada", years: 28 },
  ಗೀತಾ: { name: "Geetha", years: 24 },
  ಮಲ್ಲಿಕಾರ್ಜುನ: { name: "Mallikarjun", years: 35 },
};

type LibraryCard = (typeof library.cards)[number];

function practice(id: string, tried: number, worked: number, people: number): PracticeRow {
  const card = library.cards.find((c: LibraryCard) => c.id === id);
  if (!card) throw new Error(`fixture card ${id} missing`);
  const master = MASTER_EN[card.masterName] ?? { name: null, years: null };
  return {
    cardId: card.id,
    title: card.title,
    topic: (card._index?.topic as PracticeRow["topic"]) ?? null,
    master: { name: master.name, years: master.years, district: "Koppal" },
    cardIsSample: true,
    tried: suppress(tried, people),
    worked: suppress(worked, people),
  };
}

export function samplePulse(now = Date.now()): Pulse {
  const until = new Date(now).toISOString();
  const since = new Date(now - 7 * DAY).toISOString();
  const sample: PulseSide = {
    isSample: true,
    since,
    until,
    funnel: {
      asked: suppress(46, 19),
      answered: suppress(41, 18),
      tried: suppress(23, 14),
      worked: suppress(16, 11),
    },
    teachers: suppress(19, 19),
    cost: { answersUsd: 0.984, perAnswerUsd: 0.024, perTeacherUsd: 0.0518 },
    topics: [
      { topic: "multi_level", asked: suppress(14, 9), waiting: suppress(6, 5) },
      { topic: "letters", asked: suppress(11, 8), waiting: suppress(0, 0) },
      { topic: "number_sense", asked: suppress(8, 6), waiting: suppress(2, 2) },
      { topic: "reading", asked: suppress(6, 5), waiting: suppress(0, 0) },
      { topic: "engagement", asked: suppress(3, 3), waiting: suppress(0, 0) },
      { topic: "home_language", asked: suppress(2, 2), waiting: suppress(0, 0) },
      { topic: "parents", asked: suppress(2, 2), waiting: suppress(2, 2) },
    ],
    districts: [
      { district: "koppal", asked: suppress(31, 12) },
      { district: "raichur", asked: suppress(7, 5) },
      { district: "gadag", asked: suppress(5, 5) },
      // Districts with fewer than 5 teachers are counted together and never named (0006).
      { district: "elsewhere", asked: suppress(3, 3) },
    ],
    practices: [
      // So far (all weeks). The lamps below add up to the same 40 times, by the same masters:
      // Sharanappa 12 + 7, Sharada 9, Geetha 6 + 5, and one anonymous master's card (1, not top 5).
      practice("sample-card-03", 15, 12, 15),
      practice("sample-card-02", 12, 9, 12),
      practice("sample-card-01", 10, 7, 10),
      practice("sample-card-06", 8, 6, 8),
      practice("sample-card-07", 6, 5, 6),
    ],
  };
  return { field: emptySide(false, since, until), sample, platform: null };
}

export function sampleLamps(): Lamps {
  // Districts with 5 or more teachers get their own lamp; the rest share "elsewhere" (0006).
  // Per master: Sharanappa 8 + 8 + 1 + 2 = 19, Sharada 5 + 4 = 9, Geetha 6 + 3 + 2 = 11, and one
  // anonymous master 1: 40 times in all, the same as the practices above.
  return {
    field: [],
    sample: [
      {
        district: "koppal",
        helped: suppress(13, 11),
        masters: [
          { name: "Sharanappa", years: 32, helped: suppress(8, 7) },
          { name: "Sharada", years: 28, helped: suppress(5, 5) },
        ],
      },
      {
        district: "ballari",
        helped: suppress(8, 7),
        masters: [{ name: "Sharanappa", years: 32, helped: suppress(8, 7) }],
      },
      {
        district: "gadag",
        helped: suppress(6, 6),
        masters: [{ name: "Geetha", years: 24, helped: suppress(6, 6) }],
      },
      {
        district: "raichur",
        helped: suppress(5, 5),
        masters: [
          { name: "Sharada", years: 28, helped: suppress(4, 4) },
          { name: "Sharanappa", years: 32, helped: suppress(1, 1) },
        ],
      },
      {
        district: "bagalkote",
        helped: suppress(5, 5),
        masters: [
          { name: "Geetha", years: 24, helped: suppress(3, 3) },
          { name: "Sharanappa", years: 32, helped: suppress(2, 2) },
        ],
      },
      {
        district: "elsewhere",
        helped: suppress(3, 3),
        masters: [
          { name: "Geetha", years: 24, helped: suppress(2, 2) },
          { name: null, years: null, helped: suppress(1, 1) },
        ],
      },
    ],
  };
}
