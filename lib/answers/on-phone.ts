// The answers kept on her phone (localStorage), for /t/saved and offline (D52, F-P1):
// - saved: the ones she pressed Save on (up to 100), kept until she unsaves them;
// - recent: the last few she opened, kept without a tap, so an answer she has just seen still
//   opens with no network. "Leave" forgets the recent list (components/parampara/ServiceWorker).
// Titles for both live in META_KEY, so the list reads well offline.

export const SAVED_KEY = "parampara.saved";
export const RECENT_KEY = "parampara.recent";
export const META_KEY = "parampara.saved.meta";
export const SAVED_MAX = 100;
export const RECENT_MAX = 10;

export type AnswerMeta = Record<string, { title: { kn: string; en: string }; createdAt: string }>;

/** This answer first, no repeats, at most `max`. */
export function pushRecent(list: readonly string[], id: string, max = RECENT_MAX): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

/** A stored id list, or [] for anything that is not one (old formats, private mode, tampering). */
export function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function readIds(key: string): string[] {
  try {
    return parseIds(window.localStorage.getItem(key));
  } catch {
    return [];
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full store: it lasts for this visit only.
  }
}

export function readSaved(): string[] {
  return readIds(SAVED_KEY);
}

export function writeSaved(ids: string[]) {
  write(SAVED_KEY, ids.slice(0, SAVED_MAX));
}

export function readMeta(): AnswerMeta {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(META_KEY) ?? "{}");
    return v && typeof v === "object" ? (v as AnswerMeta) : {};
  } catch {
    return {};
  }
}

export function writeMeta(meta: AnswerMeta) {
  write(META_KEY, meta);
}

/**
 * She has just opened this answer: keep it among the recent ones, with its title, and ask the
 * service worker to keep its page (a client navigation never passes through the worker's cache).
 */
export function rememberOpened(
  id: string,
  title: { kn: string; en: string },
  createdAt: string,
): void {
  const recent = readIds(RECENT_KEY);
  const next = pushRecent(recent, id);
  write(RECENT_KEY, next);
  const meta = readMeta();
  // Titles of answers no longer on either list are let go, so the store never only grows.
  const keep = new Set([...readSaved(), ...next]);
  const trimmed: AnswerMeta = {};
  for (const [k, v] of Object.entries(meta)) if (keep.has(k)) trimmed[k] = v;
  trimmed[id] = { title, createdAt };
  writeMeta(trimmed);
  navigator.serviceWorker?.controller?.postMessage({ type: "CACHE_PAGES", urls: [`/t/a/${id}`] });
}
