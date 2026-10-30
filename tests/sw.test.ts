import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// public/sw.js (D52) run in a sandbox with a fake CacheStorage and fetch, so its rules are checked
// without a browser: what it keeps, what it never touches, and what it serves offline.

const ORIGIN = "https://parampara.test";
const SOURCE = readFileSync("public/sw.js", "utf8");
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

type Res = {
  ok: boolean;
  status: number;
  redirected: boolean;
  type: string;
  headers: Headers;
  body: string;
  clone(): Res;
};
const res = (
  body: string,
  init: Partial<Omit<Res, "clone" | "headers">> & { headers?: Record<string, string> } = {},
): Res => {
  const r: Res = {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    redirected: init.redirected ?? false,
    type: init.type ?? "basic",
    headers: new Headers(init.headers ?? {}),
    body,
    clone: () => r,
  };
  return r;
};

const path = (k: string | { url: string }) =>
  new URL(typeof k === "string" ? k : k.url, ORIGIN).pathname;

function worker(opts: { online?: boolean; respond?: (url: string) => Res } = {}) {
  const stores = new Map<string, Map<string, Res>>();
  const open = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (k: string | { url: string }) => store.get(path(k)),
      put: async (k: string | { url: string }, v: Res) => void store.set(path(k), v),
      add: async (k: string | { url: string }) => void store.set(path(k), res(`page ${path(k)}`)),
      keys: async () => [...store.keys()].map((p) => ({ url: ORIGIN + p })),
      delete: async (k: string | { url: string }) => store.delete(path(k)),
    };
  };
  const state = { online: opts.online ?? true, fetched: [] as string[] };
  const listeners: Record<string, (e: unknown) => void> = {};
  const self = {
    location: new URL(`${ORIGIN}/sw.js?v=build-1`),
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  class FakeRequest {
    url: string;
    constructor(url: string, init: Record<string, unknown> = {}) {
      this.url = new URL(url, ORIGIN).href;
      Object.assign(this, init);
    }
  }
  const fetch = async (req: string | { url: string }) => {
    const url = new URL(typeof req === "string" ? req : req.url, ORIGIN).href;
    state.fetched.push(path(url));
    if (!state.online) throw new TypeError("Failed to fetch");
    return opts.respond ? opts.respond(url) : res(`page ${path(url)}`);
  };
  runInNewContext(SOURCE, {
    self,
    caches: {
      open: async (n: string) => open(n),
      keys: async () => [...stores.keys()],
      delete: async (n: string) => stores.delete(n),
    },
    fetch,
    Request: FakeRequest,
    Response: { error: () => res("", { status: 0, type: "error" }) },
    URL,
    setTimeout,
    Promise,
  });

  /** Dispatches a fetch event; resolves to the response the worker gave, or null if it let it pass. */
  async function request(
    url: string,
    init: { method?: string; mode?: string; headers?: Record<string, string> } = {},
  ): Promise<Res | null> {
    let answer: Promise<Res> | null = null;
    const waits: Promise<unknown>[] = [];
    listeners.fetch!({
      request: {
        url: new URL(url, ORIGIN).href,
        method: init.method ?? "GET",
        mode: init.mode ?? "navigate",
        headers: new Headers(init.headers ?? {}),
      },
      respondWith: (p: Promise<Res>) => (answer = p),
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    const out = answer ? await answer : null;
    await Promise.all(waits);
    return out;
  }
  async function install() {
    const waits: Promise<unknown>[] = [];
    listeners.install!({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  }
  const kept = () => [...(stores.get("pp-pages-build-1")?.keys() ?? [])].sort();
  return { request, install, kept, state, stores };
}

describe("service worker (public/sw.js, D52)", () => {
  it("installs under the build's cache name, keeping /offline", async () => {
    const w = worker();
    await w.install();
    expect([...w.stores.keys()]).toEqual(["pp-pages-build-1"]);
    expect(w.kept()).toEqual(["/offline"]);
  });

  it("keeps only the teacher's own pages: home, ask, saved, answers, the master's room, the landing", async () => {
    const w = worker();
    await w.install();
    for (const p of ["/", "/t", "/t/ask", "/t/saved", `/t/a/${UUID}`, "/m"]) await w.request(p);
    for (const p of ["/r", "/r/cards", "/i", "/i/lamps", "/how", `/t/tried/${UUID}`, "/m/talk"]) {
      await w.request(p);
    }
    expect(w.kept()).toEqual(["/", "/m", "/offline", "/t", `/t/a/${UUID}`, "/t/ask", "/t/saved"]);
  });

  it("never keeps a redirect, an error or a page whose session cookie was rotated", async () => {
    const w = worker({
      respond: (url) => {
        const p = new URL(url).pathname;
        if (p === "/t") return res("x", { redirected: true });
        if (p === "/t/ask") return res("x", { headers: { "x-pp-cookies": "1" } });
        if (p === "/t/saved") return res("x", { status: 500 });
        return res("ok");
      },
    });
    await w.install();
    for (const p of ["/t", "/t/ask", "/t/saved"]) await w.request(p);
    expect(w.kept()).toEqual(["/offline"]);
  });

  it("lets POSTs, server actions, /api, the worker itself and other sites pass untouched", async () => {
    const w = worker();
    expect(await w.request("/t/ask", { method: "POST" })).toBeNull();
    expect(await w.request("/t", { headers: { "Next-Action": "abc" } })).toBeNull();
    expect(await w.request("/api/ask", { mode: "cors" })).toBeNull();
    expect(await w.request("/sw.js", { mode: "no-cors" })).toBeNull();
    expect(await w.request("https://elsewhere.test/t")).toBeNull();
  });

  it("offline: a kept page opens from the cache, a page never kept falls back to /offline", async () => {
    const w = worker();
    await w.install();
    await w.request("/t/ask");
    w.state.online = false;
    expect((await w.request("/t/ask"))?.body).toBe("page /t/ask");
    expect((await w.request("/r/queue"))?.body).toBe("page /offline");
  });
});
