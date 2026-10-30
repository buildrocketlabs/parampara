import type { Bilingual } from "@/lib/domain/fln";

// Karnataka's 31 districts for the Lamps of Karnataka tile map (docs/BUILD.md M5.2). A hand laid
// hex cartogram, roughly geographic: row 0 is Bidar in the far north, row 8 Chamarajanagar in the
// south; `x2` is twice the column, so odd rows sit half a tile to the right. Not a survey map.
// Keys match public.insights_district() in supabase/migrations/0006_insights.sql (a test checks).

export type District = {
  key: string;
  name: Bilingual;
  row: number;
  x2: number;
};

export const DISTRICTS = [
  { key: "bidar", name: { kn: "ಬೀದರ್", en: "Bidar" }, row: 0, x2: 8 },
  { key: "vijayapura", name: { kn: "ವಿಜಯಪುರ", en: "Vijayapura" }, row: 1, x2: 5 },
  { key: "kalaburagi", name: { kn: "ಕಲಬುರಗಿ", en: "Kalaburagi" }, row: 1, x2: 7 },
  { key: "yadgir", name: { kn: "ಯಾದಗಿರಿ", en: "Yadgir" }, row: 1, x2: 9 },
  { key: "belagavi", name: { kn: "ಬೆಳಗಾವಿ", en: "Belagavi" }, row: 2, x2: 2 },
  { key: "bagalkote", name: { kn: "ಬಾಗಲಕೋಟೆ", en: "Bagalkote" }, row: 2, x2: 4 },
  { key: "koppal", name: { kn: "ಕೊಪ್ಪಳ", en: "Koppal" }, row: 2, x2: 6 },
  { key: "raichur", name: { kn: "ರಾಯಚೂರು", en: "Raichur" }, row: 2, x2: 8 },
  { key: "dharwad", name: { kn: "ಧಾರವಾಡ", en: "Dharwad" }, row: 3, x2: 3 },
  { key: "gadag", name: { kn: "ಗದಗ", en: "Gadag" }, row: 3, x2: 5 },
  { key: "vijayanagara", name: { kn: "ವಿಜಯನಗರ", en: "Vijayanagara" }, row: 3, x2: 7 },
  { key: "ballari", name: { kn: "ಬಳ್ಳಾರಿ", en: "Ballari" }, row: 3, x2: 9 },
  { key: "uttara_kannada", name: { kn: "ಉತ್ತರ ಕನ್ನಡ", en: "Uttara Kannada" }, row: 4, x2: 2 },
  { key: "haveri", name: { kn: "ಹಾವೇರಿ", en: "Haveri" }, row: 4, x2: 4 },
  { key: "davanagere", name: { kn: "ದಾವಣಗೆರೆ", en: "Davanagere" }, row: 4, x2: 6 },
  { key: "chitradurga", name: { kn: "ಚಿತ್ರದುರ್ಗ", en: "Chitradurga" }, row: 4, x2: 8 },
  { key: "udupi", name: { kn: "ಉಡುಪಿ", en: "Udupi" }, row: 5, x2: 1 },
  { key: "shivamogga", name: { kn: "ಶಿವಮೊಗ್ಗ", en: "Shivamogga" }, row: 5, x2: 3 },
  { key: "chikkamagaluru", name: { kn: "ಚಿಕ್ಕಮಗಳೂರು", en: "Chikkamagaluru" }, row: 5, x2: 5 },
  { key: "tumakuru", name: { kn: "ತುಮಕೂರು", en: "Tumakuru" }, row: 5, x2: 7 },
  { key: "chikkaballapur", name: { kn: "ಚಿಕ್ಕಬಳ್ಳಾಪುರ", en: "Chikkaballapur" }, row: 5, x2: 9 },
  { key: "kolar", name: { kn: "ಕೋಲಾರ", en: "Kolar" }, row: 5, x2: 11 },
  { key: "dakshina_kannada", name: { kn: "ದಕ್ಷಿಣ ಕನ್ನಡ", en: "Dakshina Kannada" }, row: 6, x2: 2 },
  { key: "hassan", name: { kn: "ಹಾಸನ", en: "Hassan" }, row: 6, x2: 4 },
  { key: "mandya", name: { kn: "ಮಂಡ್ಯ", en: "Mandya" }, row: 6, x2: 6 },
  {
    key: "bengaluru_rural",
    name: { kn: "ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ", en: "Bengaluru Rural" },
    row: 6,
    x2: 8,
  },
  { key: "bengaluru_urban", name: { kn: "ಬೆಂಗಳೂರು ನಗರ", en: "Bengaluru Urban" }, row: 6, x2: 10 },
  { key: "kodagu", name: { kn: "ಕೊಡಗು", en: "Kodagu" }, row: 7, x2: 3 },
  { key: "mysuru", name: { kn: "ಮೈಸೂರು", en: "Mysuru" }, row: 7, x2: 5 },
  // Renamed Bengaluru South (Bengaluru Dakshina) in 2025; the key keeps the older name.
  { key: "ramanagara", name: { kn: "ಬೆಂಗಳೂರು ದಕ್ಷಿಣ", en: "Bengaluru South" }, row: 7, x2: 7 },
  { key: "chamarajanagar", name: { kn: "ಚಾಮರಾಜನಗರ", en: "Chamarajanagar" }, row: 8, x2: 6 },
] as const satisfies readonly District[];

export type DistrictKey = (typeof DISTRICTS)[number]["key"];

const BY_KEY = new Map<string, District>(DISTRICTS.map((d) => [d.key, d]));

export function districtByKey(key: string | null | undefined): District | null {
  return key ? (BY_KEY.get(key) ?? null) : null;
}

/** A district key from the database ('other' and null included) as words to show. */
export function districtName(key: string | null): Bilingual {
  const d = districtByKey(key);
  if (d) return d.name;
  if (key === "elsewhere") return { kn: "ಇತರ ಜಿಲ್ಲೆಗಳು, ಒಟ್ಟಾಗಿ", en: "Other districts, counted together" };
  if (key === "other") return { kn: "ಇತರೆ ಸ್ಥಳ", en: "Somewhere else" };
  return { kn: "ಜಿಲ್ಲೆ ಹೇಳಿಲ್ಲ", en: "District not given" };
}

// ── Tile geometry (pointy top hexagons) in SVG user units ──────────────────
export const TILE_W = 100;
export const TILE_H = (TILE_W * 2) / Math.sqrt(3);
export const ROW_STEP = TILE_H * 0.75;
export const MAP_W = TILE_W * 6;
export const MAP_H = Math.ceil(TILE_H + ROW_STEP * 8);

export function tileCentre(d: Pick<District, "row" | "x2">): { x: number; y: number } {
  return { x: (d.x2 / 2) * TILE_W, y: TILE_H / 2 + d.row * ROW_STEP };
}

/** The hexagon's points around its centre, for an SVG polygon (a hair smaller so tiles breathe). */
export function hexPoints(cx: number, cy: number, inset = 4): string {
  const r = TILE_H / 2 - inset;
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}
