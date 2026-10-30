// Resumable chunk uploads for bad networks (Law 9). Isomorphic logic; in a browser it follows
// navigator.onLine and the window "online" event unless the caller injects its own.

export type OnlineEvents = { subscribe(onOnline: () => void): () => void };

export type UploadQueueOptions = {
  /** Chunk indexes, uploaded in this order. */
  items: number[];
  /** Indexes the server already has (resume after a reload); never uploaded again. */
  alreadyDone?: Iterable<number>;
  /**
   * Upload one chunk; throw to retry. Throw an error with `retryable: false` (an auth or a
   * validation failure) to give up on that chunk at once.
   */
  upload: (idx: number, signal: AbortSignal) => Promise<void>;
  concurrency?: number;
  /** Retries after the first attempt. Failures while offline do not count. */
  maxRetries?: number;
  onProgress?: (done: number, total: number) => void;
  isOnline?: () => boolean;
  onlineEvents?: OnlineEvents;
  backoff?: BackoffOptions;
  /** Injectable for tests: resolve after `ms`, reject when `signal` aborts. */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
};

export type UploadQueue = {
  /** Resolves when every item is uploaded; rejects with UploadQueueError otherwise. Idempotent. */
  start(): Promise<void>;
  /** No new upload starts until resume(); uploads in flight finish. */
  pause(): void;
  resume(): void;
  /** Cancels uploads in flight through their AbortSignal. */
  abort(): void;
};

export class UploadQueueError extends Error {
  readonly kind: "gave_up" | "aborted";
  /** Indexes that did not upload, ascending. */
  readonly failed: number[];

  constructor(kind: "gave_up" | "aborted", failed: number[]) {
    super(
      kind === "aborted" ? "upload was cancelled" : `chunks ${failed.join(", ")} did not upload`,
    );
    this.name = "UploadQueueError";
    this.kind = kind;
    this.failed = failed;
  }
}

export type BackoffOptions = { baseMs?: number; maxMs?: number };

/** Exponential with equal jitter: half the step is fixed, half random. `attempt` starts at 1. */
export function backoffDelayMs(
  attempt: number,
  random: () => number = Math.random,
  { baseMs = 2_000, maxMs = 30_000 }: BackoffOptions = {},
): number {
  const step = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
  return Math.round(step / 2 + random() * (step / 2));
}

export function createUploadQueue(opts: UploadQueueOptions): UploadQueue {
  const items = [...new Set(opts.items)];
  const wanted = new Set(items);
  const done = new Set([...(opts.alreadyDone ?? [])].filter((idx) => wanted.has(idx)));
  const todo = items.filter((idx) => !done.has(idx));
  const concurrency = Math.max(1, Math.floor(opts.concurrency ?? 2));
  const maxRetries = Math.max(0, Math.floor(opts.maxRetries ?? 5));
  const isOnline = opts.isOnline ?? browserIsOnline;
  const onlineEvents = opts.onlineEvents ?? windowOnlineEvents();
  const wait = opts.wait ?? abortableWait;
  const random = opts.random ?? Math.random;
  const controller = new AbortController();
  const failed: number[] = [];

  let paused = false;
  let aborted = false;
  let next = 0;
  let running: Promise<void> | undefined;
  let sleepers: Array<() => void> = [];

  function wake() {
    const woken = sleepers;
    sleepers = [];
    for (const resume of woken) resume();
  }

  async function ready() {
    while (!aborted && (paused || !isOnline())) {
      await new Promise<void>((resolve) => sleepers.push(resolve));
    }
  }

  async function uploadWithRetry(idx: number): Promise<boolean> {
    let failures = 0;
    for (;;) {
      await ready();
      if (aborted) return false;
      try {
        await opts.upload(idx, controller.signal);
        return true;
      } catch (err) {
        if (aborted) return false;
        if (!isOnline()) continue; // ready() waits for the network; this try is not held against it
        if (isPermanent(err) || failures >= maxRetries) return false;
        failures++;
        await wait(backoffDelayMs(failures, random, opts.backoff), controller.signal).catch(
          () => {},
        );
      }
    }
  }

  async function worker() {
    for (let idx = todo[next++]; idx !== undefined && !aborted; idx = todo[next++]) {
      const ok = await uploadWithRetry(idx);
      if (aborted) return;
      if (ok) {
        done.add(idx);
        opts.onProgress?.(done.size, items.length);
      } else {
        failed.push(idx);
      }
    }
  }

  async function run() {
    if (aborted) throw new UploadQueueError("aborted", [...todo]);
    const unsubscribe = onlineEvents?.subscribe(wake);
    try {
      opts.onProgress?.(done.size, items.length);
      const workers = Math.min(concurrency, todo.length);
      await Promise.all(Array.from({ length: workers }, worker));
    } finally {
      unsubscribe?.();
    }
    if (aborted)
      throw new UploadQueueError(
        "aborted",
        items.filter((idx) => !done.has(idx)),
      );
    if (failed.length > 0)
      throw new UploadQueueError(
        "gave_up",
        failed.sort((a, b) => a - b),
      );
  }

  return {
    start() {
      running ??= run();
      return running;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      wake();
    },
    abort() {
      aborted = true;
      controller.abort();
      wake();
    },
  };
}

function isPermanent(err: unknown): boolean {
  return (
    typeof err === "object" && err !== null && (err as { retryable?: unknown }).retryable === false
  );
}

function browserIsOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function windowOnlineEvents(): OnlineEvents | undefined {
  if (typeof window === "undefined") return undefined;
  return {
    subscribe(onOnline) {
      window.addEventListener("online", onOnline);
      return () => window.removeEventListener("online", onOnline);
    },
  };
}

function abortableWait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
