// Puts WhatsApp voice notes in the order they were spoken (F-A1). A master sends his interview as
// about seven notes: consent first, then one answer per question. Downloaded to a laptop, they
// arrive in whatever order the file picker lists them, so we read the time WhatsApp wrote into
// each name. Pure: the page and the tests share it.

export type NoteStamp = {
  /** YYYYMMDD as a number. */
  day: number;
  /** Seconds since midnight, when the name carries a clock time. */
  secs: number | null;
  /** WhatsApp's counter for the day (WA0003), the export's message number, or a "(1)" copy. */
  seq: number;
};

/** "whatsapp": every name carried a WhatsApp time; "partly": some did; "saved": none did. */
export type OrderBasis = "whatsapp" | "partly" | "saved";

type Named = { name: string; lastModified: number };

// Android: PTT-20261028-WA0003.opus (voice note), AUD-20261028-WA0012.opus (audio file).
const ANDROID = /^(?:PTT|AUD|VID)-(\d{4})(\d{2})(\d{2})-WA(\d+)/i;
// Desktop and web: "WhatsApp Audio 2026-10-28 at 10.41.22.ogg", "WhatsApp Ptt 2026-10-28 at
// 2.05.11 PM (1).ogg". The word in the middle varies by app and language, so any is accepted.
const DESKTOP =
  /^WhatsApp\b.*?(\d{4})-(\d{2})-(\d{2})\s+at\s+(\d{1,2})[.:_](\d{2})[.:_](\d{2})(?:\s*([AP])\.?M\.?)?(?:\s*\((\d+)\))?/i;
// iPhone chat export: 00000012-AUDIO-2026-10-28-10-41-22.opus
const IOS_EXPORT = /^(\d+)-AUDIO-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/i;

function day(y: string, m: string, d: string): number | null {
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  if (yy < 2009 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return yy * 10_000 + mm * 100 + dd;
}

function seconds(h: number, m: number, s: number, ampm?: string): number | null {
  let hour = h;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    hour = (h % 12) + (ampm.toUpperCase() === "P" ? 12 : 0);
  }
  if (hour > 23 || m > 59 || s > 59) return null;
  return hour * 3600 + m * 60 + s;
}

/** The time WhatsApp wrote into a file name, or null for any other name. */
export function parseNoteStamp(fileName: string): NoteStamp | null {
  const name = fileName.trim();
  let m = ANDROID.exec(name);
  if (m) {
    const d = day(m[1]!, m[2]!, m[3]!);
    return d === null ? null : { day: d, secs: null, seq: Number(m[4]) };
  }
  m = DESKTOP.exec(name);
  if (m) {
    const d = day(m[1]!, m[2]!, m[3]!);
    const s = seconds(Number(m[4]), Number(m[5]), Number(m[6]), m[7]);
    return d === null || s === null ? null : { day: d, secs: s, seq: Number(m[8] ?? 0) };
  }
  m = IOS_EXPORT.exec(name);
  if (m) {
    const d = day(m[2]!, m[3]!, m[4]!);
    const s = seconds(Number(m[5]), Number(m[6]), Number(m[7]));
    return d === null || s === null ? null : { day: d, secs: s, seq: Number(m[1]) };
  }
  return null;
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function compareStamps(a: NoteStamp, b: NoteStamp): number {
  if (a.day !== b.day) return a.day - b.day;
  if (a.secs !== null && b.secs !== null) return a.secs - b.secs || a.seq - b.seq;
  if (a.secs === null && b.secs === null) return a.seq - b.seq;
  return 0; // one clock time, one counter: they cannot be compared, the next rule decides
}

/**
 * Notes with a WhatsApp time come first, in that order; any other file follows, by when it was
 * saved and then by name ("note 2" before "note 10"). Ties keep the order they were chosen in.
 */
export function orderVoiceNotes<T extends Named>(
  files: readonly T[],
): { files: T[]; basis: OrderBasis } {
  const items = files.map((file, i) => ({ file, i, stamp: parseNoteStamp(file.name) }));
  items.sort((a, b) => {
    if (a.stamp && !b.stamp) return -1;
    if (!a.stamp && b.stamp) return 1;
    const byStamp = a.stamp && b.stamp ? compareStamps(a.stamp, b.stamp) : 0;
    return (
      byStamp ||
      a.file.lastModified - b.file.lastModified ||
      collator.compare(a.file.name, b.file.name) ||
      a.i - b.i
    );
  });
  const stamped = items.filter((x) => x.stamp).length;
  const basis: OrderBasis =
    stamped === items.length && items.length > 0 ? "whatsapp" : stamped > 0 ? "partly" : "saved";
  return { files: items.map((x) => x.file), basis };
}

/** The WhatsApp time on a note, short and in digits only, so it reads the same in both languages. */
export function stampLabel(stamp: NoteStamp): string {
  const d = String(stamp.day);
  const date = `${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}`;
  if (stamp.secs === null) return `${date} · WhatsApp #${stamp.seq}`;
  const hh = String(Math.floor(stamp.secs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((stamp.secs % 3600) / 60)).padStart(2, "0");
  const ss = String(stamp.secs % 60).padStart(2, "0");
  return `${date} · ${hh}:${mm}:${ss}`;
}

/** The same file chosen twice (same name, size and time) is kept once. */
export function sameFile(a: Named & { size: number }, b: Named & { size: number }): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}
