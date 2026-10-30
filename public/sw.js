/* Parampara service worker (DECISIONS D52). Hand written, no dependencies.
 *
 * - GET only. Never server actions (POST), never /api/* (signed voice URLs expire), never
 *   cross origin.
 * - Hashed build assets (/_next/static, icons, illustrations) are cache first.
 * - Navigations are network first. With a cached copy, a slow network (over 4 s) gets the copy
 *   while the network keeps refreshing it; with none, the network is awaited, then /offline.
 * - Only a short list of pages is kept: answers (/t/a/<id>), /t, /t/ask, /t/saved, /m and /. The
 *   ask screen is kept so "Ask another" on a saved answer still opens offline and the question
 *   waits on the phone (Law 9, docs/evals/network.md). Never a redirect, never a response whose
 *   session cookie was rotated (x-pp-cookies, see proxy.ts). Checked by tests/sw.test.ts.
 * - Cache names carry the build id from the registration URL (?v=), and old caches are deleted on
 *   activate, so a deploy never serves stale pages.
 * - "Leave" (sign out) posts CLEAR_PAGES; /t/saved posts CACHE_PAGES to keep saved answers ready.
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC = `pp-static-${VERSION}`;
const PAGES = `pp-pages-${VERSION}`;
const OFFLINE = "/offline";
const NAV_TIMEOUT_MS = 4000;
const KEEP = [
  /^\/$/,
  /^\/t$/,
  /^\/t\/ask$/,
  /^\/t\/saved$/,
  /^\/t\/a\/[0-9a-f-]{36}$/i,
  /^\/m$/,
  /^\/offline$/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES);
      await cache.add(new Request(OFFLINE, { cache: "reload" }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("pp-") && n !== STATIC && n !== PAGES)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CLEAR_PAGES") event.waitUntil(clearPages());
  if (data.type === "CACHE_PAGES" && Array.isArray(data.urls)) {
    const reply = event.ports && event.ports[0];
    event.waitUntil(
      cachePages(data.urls.slice(0, 100)).then(() => reply && reply.postMessage({ type: "KEPT" })),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  if (req.headers.has("Next-Action")) return;

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/illustrations/")
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") event.respondWith(navigate(event, url));
});

function keepable(url, res) {
  return (
    KEEP.some((re) => re.test(url.pathname)) &&
    res.ok &&
    res.status === 200 &&
    !res.redirected &&
    res.type === "basic" &&
    !res.headers.has("x-pp-cookies")
  );
}

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") await cache.put(req, res.clone());
  return res;
}

async function navigate(event, url) {
  const cache = await caches.open(PAGES);
  const network = fetch(event.request).then(async (res) => {
    if (keepable(url, res)) await cache.put(url.pathname, res.clone());
    return res;
  });
  event.waitUntil(network.then(noop, noop));

  const cached = await cache.match(url.pathname);
  if (cached) {
    const slow = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS));
    const first = await Promise.race([network.catch(() => null), slow]);
    return first || cached;
  }
  try {
    return await network;
  } catch {
    return (await cache.match(OFFLINE)) || Response.error();
  }
}

async function cachePages(paths) {
  const cache = await caches.open(PAGES);
  await Promise.all(
    paths.map(async (path) => {
      try {
        const url = new URL(path, self.location.origin);
        if (url.origin !== self.location.origin) return;
        const res = await fetch(url.pathname, { credentials: "same-origin", cache: "no-store" });
        if (keepable(url, res)) await cache.put(url.pathname, res);
      } catch {
        // Offline or refused: the page stays as it was.
      }
    }),
  );
}

async function clearPages() {
  const cache = await caches.open(PAGES);
  for (const req of await cache.keys()) {
    if (new URL(req.url).pathname !== OFFLINE) await cache.delete(req);
  }
}

function noop() {}
