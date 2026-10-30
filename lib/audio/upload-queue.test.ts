import { describe, expect, it } from "vitest";
import {
  backoffDelayMs,
  createUploadQueue,
  UploadQueueError,
  type UploadQueueOptions,
} from "./upload-queue";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Instant waits that remember what was asked for, and a network we can switch off. */
function harness(overrides: Partial<UploadQueueOptions> & Pick<UploadQueueOptions, "upload">) {
  const delays: number[] = [];
  const progress: Array<[number, number]> = [];
  const listeners = new Set<() => void>();
  const network = {
    online: true,
    goOnline() {
      network.online = true;
      for (const listener of listeners) listener();
    },
  };
  const queue = createUploadQueue({
    items: [0, 1, 2, 3, 4, 5],
    wait: async (ms) => {
      delays.push(ms);
    },
    random: () => 1,
    isOnline: () => network.online,
    onlineEvents: {
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    onProgress: (done, total) => progress.push([done, total]),
    ...overrides,
  });
  return { queue, delays, progress, network, listeners };
}

async function rejection(promise: Promise<void>): Promise<UploadQueueError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof UploadQueueError) return err;
    throw err;
  }
  throw new Error("expected the queue to reject");
}

describe("createUploadQueue", () => {
  it("uploads everything with at most `concurrency` in flight", async () => {
    let inFlight = 0;
    let most = 0;
    const uploaded: number[] = [];
    const { queue, progress, listeners } = harness({
      upload: async (idx) => {
        most = Math.max(most, ++inFlight);
        await tick();
        inFlight--;
        uploaded.push(idx);
      },
    });
    await queue.start();
    expect(most).toBe(2);
    expect(uploaded.sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(progress[0]).toEqual([0, 6]);
    expect(progress.at(-1)).toEqual([6, 6]);
    expect(listeners.size).toBe(0); // unsubscribed when finished
  });

  it("retries with growing backoff, then succeeds", async () => {
    const calls: number[] = [];
    const { queue, delays } = harness({
      upload: async (idx) => {
        calls.push(idx);
        if (idx === 1 && calls.filter((c) => c === 1).length <= 2) throw new Error("503");
      },
    });
    await queue.start();
    expect(calls.filter((c) => c === 1)).toHaveLength(3);
    expect(delays).toEqual([2_000, 4_000]);
  });

  it("gives up on a chunk after maxRetries, finishes the rest and reports the failed index", async () => {
    const calls: number[] = [];
    const { queue, progress } = harness({
      maxRetries: 3,
      upload: async (idx) => {
        calls.push(idx);
        if (idx === 2) throw new Error("500");
      },
    });
    const err = await rejection(queue.start());
    expect(err).toMatchObject({ kind: "gave_up", failed: [2] });
    expect(calls.filter((c) => c === 2)).toHaveLength(4); // first try + 3 retries
    expect(progress.at(-1)).toEqual([5, 6]);
  });

  it("does not retry an error marked not retryable", async () => {
    const calls: number[] = [];
    const { queue, delays } = harness({
      items: [0],
      upload: async (idx) => {
        calls.push(idx);
        throw Object.assign(new Error("401"), { retryable: false });
      },
    });
    expect(await rejection(queue.start())).toMatchObject({ kind: "gave_up", failed: [0] });
    expect(calls).toEqual([0]);
    expect(delays).toEqual([]);
  });

  it("skips chunks the server already has (resume after a reload)", async () => {
    const calls: number[] = [];
    const { queue, progress } = harness({
      items: [0, 1, 2, 3, 4],
      alreadyDone: [0, 2, 9],
      upload: async (idx) => {
        calls.push(idx);
      },
    });
    await queue.start();
    expect(calls.sort()).toEqual([1, 3, 4]);
    expect(progress[0]).toEqual([2, 5]);
    expect(progress.at(-1)).toEqual([5, 5]);
  });

  it("waits while offline without spending retries, and resumes on the online event", async () => {
    const calls: number[] = [];
    const { queue, network } = harness({
      items: [0, 1],
      concurrency: 1,
      maxRetries: 0,
      upload: async (idx) => {
        calls.push(idx);
        if (calls.length === 1) {
          network.online = false; // the network drops during the first upload
          throw new Error("network");
        }
      },
    });
    const done = queue.start();
    await tick();
    await tick();
    expect(calls).toEqual([0]);

    network.goOnline();
    await done;
    expect(calls).toEqual([0, 0, 1]);
  });

  it("starts nothing while offline at the outset", async () => {
    const calls: number[] = [];
    const { queue, network } = harness({ upload: async (idx) => void calls.push(idx) });
    network.online = false;
    const done = queue.start();
    await tick();
    expect(calls).toEqual([]);
    network.goOnline();
    await done;
    expect(calls).toHaveLength(6);
  });

  it("pauses and resumes", async () => {
    const calls: number[] = [];
    const { queue } = harness({
      items: [0, 1, 2],
      concurrency: 1,
      upload: async (idx) => {
        calls.push(idx);
        if (idx === 0) queue.pause();
      },
    });
    const done = queue.start();
    await tick();
    await tick();
    expect(calls).toEqual([0]);
    queue.resume();
    await done;
    expect(calls).toEqual([0, 1, 2]);
  });

  it("aborts uploads in flight and reports what did not upload", async () => {
    const signals: AbortSignal[] = [];
    const { queue } = harness({
      items: [0, 1, 2],
      upload: (idx, signal) => {
        signals.push(signal);
        if (idx === 0) return Promise.resolve();
        return new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason)),
        );
      },
    });
    const done = queue.start();
    await tick();
    queue.abort();
    expect(await rejection(done)).toMatchObject({ kind: "aborted", failed: [1, 2] });
    expect(signals.every((s) => s.aborted)).toBe(true);
  });
});

describe("backoffDelayMs", () => {
  it("doubles from 2 s with equal jitter and caps at 30 s", () => {
    expect(backoffDelayMs(1, () => 0)).toBe(1_000);
    expect(backoffDelayMs(1, () => 1)).toBe(2_000);
    expect(backoffDelayMs(3, () => 1)).toBe(8_000);
    expect(backoffDelayMs(10, () => 1)).toBe(30_000);
    expect(backoffDelayMs(10, () => 0)).toBe(15_000);
  });
});
