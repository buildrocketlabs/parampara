import type { TriedOutcome } from "./types";

// Law 9: an answer given with no network is kept on the phone and sent when the network is back
// (PendingTriedSync). Browser only; every access is guarded for private mode.
const KEY = "parampara.tried.pending";

export type PendingTried = { answerId: string; outcome: TriedOutcome; note: string };

export function readPending(): PendingTried[] {
  try {
    const list: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? (list as PendingTried[]) : [];
  } catch {
    return [];
  }
}

function write(list: PendingTried[]) {
  try {
    if (list.length) window.localStorage.setItem(KEY, JSON.stringify(list));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private mode: the queued answer lasts for this visit only.
  }
}

/** The latest answer wins: a change of mind while offline replaces the queued one. */
export function queueTried(item: PendingTried) {
  write([...readPending().filter((p) => p.answerId !== item.answerId), item]);
}

export function removePending(answerId: string) {
  write(readPending().filter((p) => p.answerId !== answerId));
}
