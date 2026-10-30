import type { AnswerLang } from "./types";

// Questions asked with no network (Law 9): kept on the phone in IndexedDB (a spoken question keeps
// its 16 kHz WAV, never uploaded until the network is back) and sent, oldest first, when it
// returns. The audio never leaves the phone before then, and is deleted once taken. Browser only.

export type QueuedQuestion =
  | { id?: number; kind: "text"; text: string; lang: AnswerLang; at: number }
  | { id?: number; kind: "audio"; wav: Blob; lang: AnswerLang; at: number };

const DB = "parampara-offline";
const STORE = "questions";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function queueQuestion(q: QueuedQuestion): Promise<void> {
  const item: QueuedQuestion = { ...q };
  delete item.id; // the store assigns it
  await run("readwrite", (s) => s.add(item));
}

/** The oldest waiting question, removed from the queue as it is taken. */
export async function takeQuestion(): Promise<QueuedQuestion | null> {
  if (typeof indexedDB === "undefined") return null;
  const first = await run<IDBCursorWithValue | null>("readonly", (s) => s.openCursor());
  if (!first) return null;
  const item = first.value as QueuedQuestion;
  if (item.id !== undefined) await run("readwrite", (s) => s.delete(item.id as number));
  return item;
}

export async function countQuestions(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  return run<number>("readonly", (s) => s.count());
}
