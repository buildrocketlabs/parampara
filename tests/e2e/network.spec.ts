import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// Law 9 on the live site: evaluators will throttle the network. A 390 px phone, the Sample teacher,
// Chrome DevTools' own throttling presets through CDP, cold (nothing cached) and warm (the service
// worker installed, D52). Then offline. Writes docs/evals/network.md.
//
//   PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=network --workers=1
//
// Every account and row it touches is Sample. The chip and the queued question are the letters
// sample question in English, so the live site answers both from its cache (D35), not a model.

const BASE = process.env.PW_BASE_URL;
test.skip(!BASE, "network checks run against a deployment: set PW_BASE_URL");
test.describe.configure({ timeout: 420_000 });

/**
 * Chrome DevTools presets, as devtools-frontend defines them (github.com/ChromeDevTools/
 * devtools-frontend/blob/main/front_end/core/sdk/NetworkManager.ts, read 24 Oct 2026). Throughput
 * in bytes per second, latency in milliseconds:
 *   Slow 3G (Slow3GConditions, titled "3G" in today's DevTools): download 500 * 1000 / 8 * .8 =
 *     50,000 B/s, upload the same, latency 400 * 5 = 2,000 ms.
 *   Fast 3G (renamed "Slow 4G", Slow4GConditions, May 2024, crbug.com/342406608, same numbers):
 *     download 1.6 * 1000 * 1000 / 8 * .9 = 180,000 B/s, upload 750 * 1000 / 8 * .9 = 84,375 B/s,
 *     latency 150 * 3.75 = 562.5 ms.
 */
const PRESETS = {
  "Slow 3G": {
    latency: 400 * 5,
    download: ((500 * 1000) / 8) * 0.8,
    upload: ((500 * 1000) / 8) * 0.8,
  },
  "Fast 3G": {
    latency: 150 * 3.75,
    download: ((1.6 * 1000 * 1000) / 8) * 0.9,
    upload: ((750 * 1000) / 8) * 0.9,
  },
} as const;
type Preset = keyof typeof PRESETS;

const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "en-IN",
  timezoneId: "Asia/Kolkata",
};
const LETTERS =
  "A child in Class 1 still cannot recognise letters after six months. What can I do tomorrow?";
const SLATE = readFileSync("evals/images/photo-01-slate-ba-da.png");

type Row = {
  check: string;
  preset: string;
  mode: string;
  value: string;
  ok: boolean;
  note?: string;
};
const rows: Row[] = [];
const record = (r: Row) => rows.push(r);
const s = (ms: number | null) => (ms === null ? "n/a" : `${(ms / 1000).toFixed(1)} s`);

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────

/** Notes when the load event has passed and the main thread first goes idle: "interactive". */
const INTERACTIVE_PROBE = () => {
  const w = window as Window & { __ppInteractive?: number };
  const ric = (window as { requestIdleCallback?: Window["requestIdleCallback"] })
    .requestIdleCallback;
  const idle = (cb: () => void) => (ric ? ric(cb, { timeout: 15_000 }) : setTimeout(cb, 1));
  window.addEventListener("load", () => idle(() => (w.__ppInteractive = performance.now())), {
    once: true,
  });
};

async function phone(
  browser: Browser,
  storageState?: string | Awaited<ReturnType<BrowserContext["storageState"]>>,
) {
  const ctx = await browser.newContext({ ...PHONE, baseURL: BASE, storageState });
  await ctx.addInitScript(() => window.localStorage.setItem("parampara.lang", "en"));
  await ctx.addInitScript(INTERACTIVE_PROBE);
  // A step that cannot happen fails in under a minute instead of holding the run.
  ctx.setDefaultTimeout(45_000);
  return ctx;
}

const conditions = (preset: Preset) => ({
  offline: false,
  latency: PRESETS[preset].latency,
  downloadThroughput: PRESETS[preset].download,
  uploadThroughput: PRESETS[preset].upload,
});

async function throttle(page: Page, preset: Preset) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", conditions(preset));
  return cdp;
}

/**
 * The page's throttle does not reach the service worker's own fetches (a navigation it answers
 * from the network would come in at full speed), so the worker's target is throttled too, as
 * DevTools does when it inspects one. Returns how many workers were throttled.
 */
async function throttleWorkers(browser: Browser, preset: Preset): Promise<number> {
  const cdp = await browser.newBrowserCDPSession();
  const { targetInfos } = (await cdp.send("Target.getTargets")) as {
    targetInfos: Array<{ targetId: string; type: string; url: string }>;
  };
  let n = 0;
  for (const t of targetInfos.filter(
    (x) => x.type === "service_worker" && x.url.startsWith(BASE!),
  )) {
    const { sessionId } = (await cdp.send("Target.attachToTarget", {
      targetId: t.targetId,
      flatten: false,
    })) as { sessionId: string };
    let id = 0;
    for (const [method, params] of [
      ["Network.enable", {}],
      ["Network.emulateNetworkConditions", conditions(preset)],
    ] as const) {
      await cdp.send("Target.sendMessageToTarget", {
        sessionId,
        message: JSON.stringify({ id: ++id, method, params }),
      });
    }
    n++;
  }
  return n;
}

/** First contentful paint and interactive, in ms from the navigation's start. */
async function timings(page: Page) {
  await page.waitForFunction(
    () => typeof (window as Window & { __ppInteractive?: number }).__ppInteractive === "number",
    undefined,
    { timeout: 180_000 },
  );
  return page.evaluate(() => ({
    fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
    interactive: (window as Window & { __ppInteractive?: number }).__ppInteractive ?? null,
    sw: Boolean(navigator.serviceWorker?.controller),
  }));
}

/** Waits until the service worker controls the page (it registers once the page is idle). */
async function swInstalled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 60_000,
  });
}

async function teacherState(browser: Browser) {
  const ctx = await browser.newContext({ ...PHONE, baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto("/?lang=en");
  await page.locator('form[data-door="teacher"] button[type="submit"]').click();
  await page.waitForURL(/\/t$/, { timeout: 60_000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

/** The first line of a failure, for the report (never a stack). */
const why = (e: unknown) =>
  (e instanceof Error ? e.message : String(e))
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split("\n")[0]!
    .replace(/\|/g, "/")
    .slice(0, 160);

/** What was changed for a check that failed on the deployed build, until the fix is deployed. */
const FIXES: Record<string, string> = {
  "offline, Ask another on a saved answer opens the ask screen":
    "the worker did not keep /t/ask. Fixed in public/sw.js (KEEP has /t/ask), tested in tests/sw.test.ts; passes once deployed",
};

const seen = (page: Page, selector: string, text?: string | RegExp) =>
  (text ? page.locator(selector).filter({ hasText: text }) : page.locator(selector))
    .filter({ visible: true })
    .first();

// ── Throttled: cold and warm loads, a warm chip, text before voice ─────────────────────────────

for (const preset of Object.keys(PRESETS) as Preset[]) {
  test(`${preset}: / and /t load, cold then warm`, async ({ browser }) => {
    const state = await teacherState(browser);
    for (const [path, signedIn] of [
      ["/", false],
      ["/t", true],
    ] as const) {
      const ctx = await phone(browser, signedIn ? state : undefined);
      const page = await ctx.newPage();
      await throttle(page, preset);
      await page.goto(path, { waitUntil: "commit", timeout: 180_000 });
      const cold = await timings(page);
      record({
        check: `${path} first contentful paint`,
        preset,
        mode: "cold",
        value: s(cold.fcp),
        ok: cold.fcp !== null,
      });
      record({
        check: `${path} interactive`,
        preset,
        mode: "cold",
        value: s(cold.interactive),
        ok: true,
      });

      await swInstalled(page);
      const workers = await throttleWorkers(browser, preset);
      await page.reload({ waitUntil: "commit", timeout: 180_000 });
      const warm = await timings(page);
      record({
        check: `${path} first contentful paint`,
        preset,
        mode: "warm",
        value: s(warm.fcp),
        ok: warm.fcp !== null && warm.sw && workers > 0,
        note: !warm.sw
          ? "service worker not in control"
          : workers > 0
            ? "service worker in control, and throttled too"
            : "service worker in control but not throttled",
      });
      record({
        check: `${path} interactive`,
        preset,
        mode: "warm",
        value: s(warm.interactive),
        ok: true,
      });
      await ctx.close();
    }
  });

  test(`${preset}: a warm chip opens its answer, text first, voice only on tap`, async ({
    browser,
  }) => {
    const ctx = await phone(browser, await teacherState(browser));
    const page = await ctx.newPage();
    // Warm the phone first (assets and worker), then throttle.
    await page.goto("/t/ask");
    await swInstalled(page);
    await page.reload();
    await throttle(page, preset);
    await throttleWorkers(browser, preset);
    const voice: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (/^\/api\/(voice|audio)\//.test(u.pathname) || r.resourceType() === "media")
        voice.push(u.pathname);
    });
    const started = Date.now();
    await page.getByTestId("sample-letters").click();
    await page.waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 180_000 });
    const navigated = Date.now() - started;
    const firstStep = seen(page, "ol li");
    await expect(firstStep).toBeVisible({ timeout: 120_000 });
    const readable = Date.now() - started;
    record({
      check: "warm chip tap to answer page",
      preset,
      mode: "warm",
      value: s(navigated),
      ok: true,
    });
    record({
      check: "warm chip tap to first step readable",
      preset,
      mode: "warm",
      value: s(readable),
      ok: true,
    });
    const before = voice.length;
    record({
      check: "answer readable before any audio is fetched",
      preset,
      mode: "warm",
      value: before === 0 ? "yes" : `no: ${voice.slice(0, 3).join(", ")}`,
      ok: before === 0,
      note: "voice is fetched only when tapped",
    });
    await ctx.close();
  });
}

// ── Offline ────────────────────────────────────────────────────────────────────────────────────

test("offline: saved answer, /offline, a queued question that sends on reconnect, Show me", async ({
  browser,
}) => {
  const ctx = await phone(browser, await teacherState(browser));
  const page = await ctx.newPage();
  // A teacher's day starts on her home, /t, which the worker keeps for her.
  await page.goto("/t");
  await swInstalled(page);
  await page.reload();
  await page.goto("/t/ask");
  await page.getByTestId("sample-letters").click();
  await page.waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 180_000 });
  const answerPath = new URL(page.url()).pathname;
  await seen(page, "button[aria-pressed]", /Save(?!d)/).click();
  await page.goto("/t/saved");
  const ready = await expect(page.getByText("Ready offline").filter({ visible: true }).first())
    .toBeVisible({ timeout: 45_000 })
    .then(() => true)
    .catch(() => false);

  // 1. A saved answer opens from /t/saved with no network.
  await ctx.setOffline(true);
  let saved = false;
  try {
    await page.reload();
    await seen(page, `a[href="${answerPath}"]`).click();
    await expect(seen(page, "ol li")).toBeVisible({ timeout: 20_000 });
    saved = true;
  } catch {
    saved = false;
  }
  record({
    check: "a saved answer opens offline from /t/saved",
    preset: "offline",
    mode: "warm",
    value: saved ? "yes" : "no",
    ok: saved,
    note: ready ? "Ready offline shown first" : "Ready offline never showed",
  });

  // 1b. From that saved answer, "Ask another" still opens the ask screen (it waits on the phone).
  let askAnother = false;
  let askNote: string | undefined;
  try {
    await seen(page, 'a[href="/t/ask"]', /Ask another/).click();
    await expect(seen(page, "button", /Type it instead/)).toBeVisible({ timeout: 20_000 });
    askAnother = true;
  } catch (e) {
    askNote = why(e);
  }
  record({
    check: "offline, Ask another on a saved answer opens the ask screen",
    preset: "offline",
    mode: "warm",
    value: askAnother ? "yes" : "no",
    ok: askAnother,
    note: askAnother ? undefined : askNote,
  });

  // 2. A page this phone never opened shows /offline.
  let fallback = false;
  try {
    await page.goto("/i/lamps");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("No network", {
      timeout: 20_000,
    });
    fallback = true;
  } catch {
    fallback = false;
  }
  record({
    check: "a page never visited shows /offline",
    preset: "offline",
    mode: "warm",
    value: fallback ? "yes" : "no",
    ok: fallback,
  });

  // 3. A typed question waits with an honest message, then sends on reconnect.
  let queued = false;
  let sent = false;
  let sentAfter: number | null = null;
  let queueNote: string | undefined;
  try {
    await page.goto("/t");
    await seen(page, "button", /Type it instead/).click();
    await seen(page, "textarea").fill(LETTERS);
    await page.getByRole("button", { name: "Ask", exact: true }).filter({ visible: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Your question is saved" }),
    ).toBeVisible({ timeout: 15_000 });
    queued = true;
    const back = Date.now();
    await ctx.setOffline(false);
    await page.waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 180_000 });
    await expect(seen(page, "ol li")).toBeVisible({ timeout: 60_000 });
    sent = true;
    sentAfter = Date.now() - back;
  } catch (e) {
    queueNote = why(e);
  }
  record({
    check: "a typed question is queued offline with an honest message",
    preset: "offline",
    mode: "warm",
    value: queued ? "yes" : "no",
    ok: queued,
    note: queued ? undefined : queueNote,
  });
  record({
    check: "the queued question sends on reconnect and its answer opens",
    preset: "offline",
    mode: "warm",
    value: sent ? `yes, ${s(sentAfter)}` : "no",
    ok: sent,
    note: sent || !queued ? undefined : queueNote,
  });

  // 4. Show me says a photo needs the network.
  let photo = false;
  let photoNote: string | undefined;
  let step = "";
  try {
    step = "open /t/ask online";
    await ctx.setOffline(false);
    await page.goto("/t/ask");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3_000); // Show me's code is fetched once the page is idle
    await ctx.setOffline(true);
    step = "open Show me";
    await seen(page, '[data-testid="show-me-open"]').click();
    step = "choose the slate";
    await seen(page, '[data-testid="show-me"]')
      .locator('[data-testid="photo-gallery"]')
      .setInputFiles({ name: "slate.png", mimeType: "image/png", buffer: SLATE });
    await expect(seen(page, '[data-testid="photo-preview"]')).toBeVisible({ timeout: 20_000 });
    step = "tick no faces";
    await seen(page, '[data-testid="show-me"]')
      .getByText(/no faces in this photo/)
      .filter({ visible: true })
      .first()
      .click();
    step = "use the photo";
    await seen(page, '[data-testid="photo-use"]').click();
    step = "type the question";
    await seen(page, "button", /Type it instead/).click();
    await seen(page, "textarea").fill("A child swaps ba and da when writing.");
    step = "ask";
    await seen(page, 'button[type="submit"]').click();
    step = "the message";
    await expect(
      page
        .getByText(/A photo needs the network/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    photo = true;
  } catch (e) {
    photoNote = `${step}: ${why(e)}`;
    await page
      .screenshot({ path: "test-results/network-show-me-offline.png" })
      .catch(() => undefined);
  }
  record({
    check: "Show me says a photo needs the network",
    preset: "offline",
    mode: "warm",
    value: photo ? "yes" : "no",
    ok: photo,
    note: photoNote,
  });
  await ctx.setOffline(false);
  await ctx.close();
});

test.afterAll(() => {
  if (!BASE || rows.length === 0) return;
  const failed = rows.filter((r) => !r.ok);
  const lines = [
    "# Network check (Law 9)",
    "",
    `Run on ${new Date().toISOString().slice(0, 10)} against ${BASE} by \`tests/e2e/network.spec.ts\``,
    "(Playwright project `network`, Chromium, a 390 × 844 phone, the Sample teacher, English).",
    "",
    "Presets are Chrome DevTools' own (devtools-frontend `front_end/core/sdk/NetworkManager.ts`),",
    "applied with CDP `Network.emulateNetworkConditions`:",
    "",
    "| Preset | Latency | Download | Upload |",
    "|---|---:|---:|---:|",
    ...(Object.keys(PRESETS) as Preset[]).map(
      (p) =>
        `| ${p} | ${PRESETS[p].latency} ms | ${Math.round(PRESETS[p].download).toLocaleString("en-IN")} B/s | ${Math.round(PRESETS[p].upload).toLocaleString("en-IN")} B/s |`,
    ),
    "",
    "Cold: a fresh phone, nothing cached. Warm: the same phone after the service worker (D52) took",
    "control, then a reload. Interactive: the load event has passed and the main thread first goes",
    "idle (requestIdleCallback). Times are from the start of the navigation, or from the tap.",
    "The page's throttle does not reach the service worker's own fetches, so the worker is",
    "throttled too (its CDP target), or a warm page would arrive at full speed and flatter us.",
    "The chip and the queued question are a sample question the site answers from its cache.",
    "One run: a server cold start can move a single cold number by seconds between runs.",
    "First contentful paint is the first words on screen, not a full load: a stopwatch on the whole",
    "page lands between it and interactive. Answer speed on an ordinary network (fresh questions,",
    "warm chips) is measured in `docs/evals/latency.md`; the chip times here add 3G transfer to it.",
    "",
    "| Check | Preset | Mode | Result | Pass | Note |",
    "|---|---|---|---:|:---:|---|",
    ...rows.map(
      (r) =>
        `| ${r.check} | ${r.preset} | ${r.mode} | ${r.value} | ${r.ok ? "yes" : "**no**"} | ${r.note ?? ""} |`,
    ),
    "",
    "## What failed",
    "",
    ...(failed.length
      ? failed.map(
          (r) =>
            `- ${r.check} (${r.preset}, ${r.mode}): ${r.value}${FIXES[r.check] ? `. Cause: ${FIXES[r.check]}.` : ""}`,
        )
      : ["Nothing."]),
    "",
  ];
  writeFileSync("docs/evals/network.md", lines.join("\n"));
});
