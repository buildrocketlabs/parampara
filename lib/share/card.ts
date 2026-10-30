// Sharing a Tomorrow card (docs/BUILD.md M5.4): the words that travel with the image. Kannada
// first, the master credited exactly as they chose (open data's credit), and a Sample card always
// says Sample (Law 7). Pure, so the teacher's answer page and the reviewer's card share the same.

export const SHARE_LINE = "ಪರಂಪರೆ · ಹಿರಿಯ ಶಿಕ್ಷಕರ ಅನುಭವ";
export const SAMPLE_LINE = "ಮಾದರಿ ದತ್ತಾಂಶ (Sample)";

type Bi = { kn: string; en: string };

export type ShareMeta = {
  id: string;
  title: Bi;
  /** The master's name as they chose to be credited, or null for a master who stays anonymous. */
  credit: string | null;
  isSample: boolean;
  /** The rest of the practice, for the card drawn in the browser (open data's words only). */
  problem: Bi;
  steps: Bi[];
  materials: Bi[];
  topic: string | null;
  gradeBand: string | null;
  master: { years: number | null; district: string | null };
  /** Where the rest lives, printed on the card (the production host, D36). */
  host: string;
};

export function shareText(meta: Pick<ShareMeta, "title" | "credit" | "isSample">): string {
  const who = meta.credit ? `${meta.credit} ಅವರ ಅನುಭವ` : "ಒಬ್ಬ ಹಿರಿಯ ಶಿಕ್ಷಕರ ಅನುಭವ";
  return [meta.title.kn, SHARE_LINE, who, meta.isSample ? SAMPLE_LINE : null]
    .filter(Boolean)
    .join("\n");
}

export function cardImagePath(id: string): string {
  return `/api/cards/${encodeURIComponent(id)}/image`;
}

export function cardImageFileName(meta: Pick<ShareMeta, "id" | "isSample">): string {
  const safe = meta.id.replace(/[^\w-]/g, "").slice(0, 40);
  return `parampara-${meta.isSample ? "sample-" : ""}${safe}.png`;
}

/** WhatsApp's own share link: the Kannada words, then the card's image link on its own line. */
export function whatsappUrl(text: string, imageUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${imageUrl}`)}`;
}
