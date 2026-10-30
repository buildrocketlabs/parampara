// The labelled Sample world behind `pnpm seed:library` and `pnpm seed:pulse` (Law 7, D7, D88).
// Twelve synthetic Sample master teachers in six districts of Kalyana Karnataka and Kittur
// Karnataka. Names are common first names, invented for the demo, and every display name carries
// "(Sample)". No photos, no voices: these are not real people.
//
// Import free apart from node:crypto, so Node runs it directly (type stripping) and the seeds, the
// unit tests and `--dry-run` share one plan.
import { createHash } from "node:crypto";

/** The seed's own accounts live on this reserved domain, which can never receive mail. */
export const SAMPLE_EMAIL_DOMAIN = "demo.parampara.invalid";
/** prompt_version of every card the library seed writes: how a re run finds its own cards. */
export const SAMPLE_LIBRARY_TAG = "sample-library@v1";
/** Title of every synthetic interview the library seed writes. */
export const SAMPLE_INTERVIEW_TITLE = "Sample interview (synthetic, for the demo)";

export type SampleDistrict =
  "Koppal" | "Ballari" | "Raichur" | "Kalaburagi" | "Dharwad" | "Vijayapura";

export type SampleMaster = {
  key: string;
  /** Shown name; "(Sample)" is part of it, as for every demo account. */
  nameEn: string;
  nameKn: string;
  email: string;
  district: SampleDistrict;
  school: string;
  years: number;
  classes: string;
  /** The masterName the eval library (evals/library.json) uses for this master's cards, if any. */
  evalName?: string;
};

const master = (m: Omit<SampleMaster, "email"> & { email?: string }): SampleMaster => ({
  ...m,
  email: m.email ?? `sample-${m.key}@${SAMPLE_EMAIL_DOMAIN}`,
});

// The first four are the original Sample library masters (D66); the demo master account
// (seed:demo) speaks for Sharanappa, whose eval key has always been ಶಂಕರಪ್ಪ.
export const SAMPLE_MASTERS: readonly SampleMaster[] = [
  master({
    key: "sharanappa",
    nameEn: "Sharanappa (Sample)",
    nameKn: "ಶರಣಪ್ಪ",
    email: `master@${SAMPLE_EMAIL_DOMAIN}`,
    district: "Koppal",
    school: "Sample school, Koppal",
    years: 32,
    classes: "1 to 4",
    evalName: "ಶಂಕರಪ್ಪ",
  }),
  master({
    key: "sharada",
    nameEn: "Sharada (Sample)",
    nameKn: "ಶಾರದಾ",
    district: "Koppal",
    school: "Sample school, Kushtagi",
    years: 28,
    classes: "1 to 4",
    evalName: "ಶಾರದಾ",
  }),
  master({
    key: "geetha",
    nameEn: "Geetha (Sample)",
    nameKn: "ಗೀತಾ",
    district: "Koppal",
    school: "Sample school, Yelburga",
    years: 24,
    classes: "1 to 4",
    evalName: "ಗೀತಾ",
  }),
  master({
    key: "mallikarjun",
    nameEn: "Mallikarjun (Sample)",
    nameKn: "ಮಲ್ಲಿಕಾರ್ಜುನ",
    district: "Koppal",
    school: "Sample school, Gangavathi",
    years: 35,
    classes: "1 to 4",
    evalName: "ಮಲ್ಲಿಕಾರ್ಜುನ",
  }),
  master({
    key: "hanumanthappa",
    nameEn: "Hanumanthappa (Sample)",
    nameKn: "ಹನುಮಂತಪ್ಪ",
    district: "Ballari",
    school: "Sample school (Government Higher Primary), Siruguppa",
    years: 30,
    classes: "1 to 5",
  }),
  master({
    key: "lakshmi",
    nameEn: "Lakshmi (Sample)",
    nameKn: "ಲಕ್ಷ್ಮಿ",
    district: "Ballari",
    school: "Sample school (Government Lower Primary), Sandur",
    years: 26,
    classes: "1 to 3",
  }),
  master({
    key: "nagamma",
    nameEn: "Nagamma (Sample)",
    nameKn: "ನಾಗಮ್ಮ",
    district: "Raichur",
    school: "Sample school (Government Higher Primary), Sindhanur",
    years: 29,
    classes: "1 to 4",
  }),
  master({
    key: "ameena",
    nameEn: "Ameena (Sample)",
    nameKn: "ಅಮೀನಾ",
    district: "Raichur",
    school: "Sample school (Government Lower Primary), Manvi",
    years: 22,
    classes: "1 to 3",
  }),
  master({
    key: "siddappa",
    nameEn: "Siddappa (Sample)",
    nameKn: "ಸಿದ್ದಪ್ಪ",
    district: "Kalaburagi",
    school: "Sample school (Government Higher Primary), Aland",
    years: 34,
    classes: "1 to 5",
  }),
  master({
    key: "kavitha",
    nameEn: "Kavitha (Sample)",
    nameKn: "ಕವಿತಾ",
    district: "Kalaburagi",
    school: "Sample school (Government Lower Primary), Sedam",
    years: 25,
    classes: "1 to 3",
  }),
  master({
    key: "suma",
    nameEn: "Suma (Sample)",
    nameKn: "ಸುಮಾ",
    district: "Dharwad",
    school: "Sample school (Government Model Primary), Kalghatgi",
    years: 27,
    classes: "1 to 4",
  }),
  master({
    key: "rajashekhar",
    nameEn: "Rajashekhar (Sample)",
    nameKn: "ರಾಜಶೇಖರ",
    district: "Vijayapura",
    school: "Sample school (Government Higher Primary), Indi",
    years: 31,
    classes: "1 to 5",
  }),
];

/** Eval library cards kept as reviewer drafts, so the reviewer always has Sample work (D66). */
export const SAMPLE_DRAFTS: ReadonlySet<string> = new Set([
  "sample-card-04",
  "sample-card-05",
  "sample-card-08",
]);

/**
 * A stable uuid for a Sample row the seed owns, from its library id. The same card keeps the same
 * database id on every run, so a re run updates it in place and answers that cite it stay valid.
 */
export function sampleUuid(seed: string): string {
  const h = createHash("sha256").update(`parampara-sample:${seed}`).digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** A small seeded random number generator (mulberry32): the same plan on every run. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick from weighted choices with a random number in [0, 1). */
export function pickWeighted<T>(items: readonly T[], weight: (t: T) => number, r: number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let x = r * total;
  for (const t of items) {
    x -= weight(t);
    if (x < 0) return t;
  }
  return items[items.length - 1]!;
}
