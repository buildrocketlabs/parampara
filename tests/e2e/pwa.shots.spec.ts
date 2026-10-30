import { mkdirSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// The installable, offline app (docs/BUILD.md M4.4, DECISIONS D52) on a production build in fixture
// mode. Run: PW_PORT=3157 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/pwa.shots.spec.ts --project=shots
const dir = "docs/demos/M4";
mkdirSync(dir, { recursive: true });

const SAVED = "11111111-1111-4111-8111-111111111111";

async function asTeacher(context: BrowserContext, page: Page, lang: "kn" | "en" = "en") {
  const port = process.env.PW_PORT ?? "3123";
  await context.addCookies([
    { name: "pp_fixture_role", value: "teacher", url: `http://localhost:${port}` },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
}

/** Wait until the service worker controls this page (it registers when the page is idle). */
async function controlled(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, {
    timeout: 15_000,
  });
}

async function swReady(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await controlled(page);
}

test("the app is installable: manifest and Hanate icons", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = (await res.json()) as {
    name: string;
    start_url: string;
    display: string;
    icons: Array<{ src: string; purpose?: string }>;
  };
  expect(m.name).toContain("Parampara");
  expect(m.start_url).toBe("/t");
  expect(m.display).toBe("standalone");
  expect(m.icons.some((i) => i.purpose === "maskable")).toBe(true);
  for (const icon of m.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});

test("saved answers open in airplane mode; an unknown page falls back calmly", async ({
  page,
  context,
}) => {
  await asTeacher(context, page);
  await page.addInitScript((id) => {
    window.localStorage.setItem("parampara.saved", JSON.stringify([id]));
    window.localStorage.setItem(
      "parampara.saved.meta",
      JSON.stringify({
        [id]: {
          title: { kn: "ಹತ್ತರ ಕಟ್ಟು", en: "Bundles of ten" },
          createdAt: "2026-10-23T09:00:00.000Z",
        },
      }),
    );
  }, SAVED);
  await page.goto("/t/saved");
  await swReady(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Saved answers");

  // The worker keeps the saved page ready while online; wait until it says so.
  await expect(page.getByText("Ready offline").filter({ visible: true })).toBeVisible({
    timeout: 15_000,
  });
  await context.setOffline(true);
  await page.goto("/t/saved");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Saved answers");
  await expect(page.getByText("Bundles of ten").filter({ visible: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/pwa-saved-offline-390-en.png` });

  // A page the phone never kept: the calm offline page, pointing to what still works.
  await page.goto("/r");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("No network");
  await expect(page.getByRole("link", { name: /Saved answers/ })).toHaveAttribute(
    "href",
    "/t/saved",
  );
  await page.screenshot({ path: `${dir}/pwa-offline-fallback-390-en.png` });
  await context.setOffline(false);
});

test("a question typed offline waits on the phone, then goes when the network returns", async ({
  page,
  context,
}) => {
  await asTeacher(context, page, "en");
  await page.goto("/t");
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: /Type it instead/ })
    .filter({ visible: true })
    .first()
    .click();
  await page
    .getByRole("textbox")
    .filter({ visible: true })
    .fill("Children lose count after twenty. What can I try tomorrow?");
  await page.getByRole("button", { name: "Ask", exact: true }).filter({ visible: true }).click();
  const queued = page.getByRole("status").filter({ hasText: "Your question is saved" });
  await expect(queued).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/pwa-question-queued-390-en.png` });
  const waiting = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open("parampara-offline", 1);
        req.onsuccess = () => {
          const c = req.result.transaction("questions").objectStore("questions").count();
          c.onsuccess = () => resolve(c.result);
        };
      }),
  );
  expect(waiting).toBe(1);

  // Back online: the question leaves the phone by itself (fixture mode has no AI, so the honest
  // "not ready" reply comes back; with keys it opens as a normal answer page).
  await context.setOffline(false);
  await expect(queued).toBeHidden({ timeout: 15_000 });
  const left = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open("parampara-offline", 1);
        req.onsuccess = () => {
          const c = req.result.transaction("questions").objectStore("questions").count();
          c.onsuccess = () => resolve(c.result);
        };
      }),
  );
  expect(left).toBe(0);
});

test("Leave clears the pages kept on this phone", async ({ page, context }) => {
  await asTeacher(context, page);
  await page.goto("/t/saved");
  await swReady(page);
  await page.goto("/t/saved");
  const kept = async () =>
    page.evaluate(async () => {
      const names = await caches.keys();
      let n = 0;
      for (const name of names.filter((x) => x.startsWith("pp-pages-"))) {
        for (const req of await (await caches.open(name)).keys()) {
          if (!new URL(req.url).pathname.startsWith("/offline")) n++;
        }
      }
      return n;
    });
  expect(await kept()).toBeGreaterThan(0);
  await page.locator("form[data-leave] button").first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/t/saved"), { timeout: 10_000 });
  await expect.poll(kept, { timeout: 10_000 }).toBe(0);
});

test("offline on the master's room: the banner never covers the one button", async ({
  page,
  context,
}) => {
  const port = process.env.PW_PORT ?? "3123";
  await context.addCookies([
    { name: "pp_fixture_role", value: "master", url: `http://localhost:${port}` },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/m");
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  const banner = page.locator("[data-offline-banner]");
  await expect(banner).toBeVisible();
  await page.waitForTimeout(700);
  const b = await banner.boundingBox();
  const button = await page
    .getByRole("link", { name: /ಹೊಸ ಕಥೆ ಹೇಳಿ|Record a new story/ })
    .filter({ visible: true })
    .boundingBox();
  expect(b).not.toBeNull();
  expect(button).not.toBeNull();
  expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual((button?.y ?? 0) + 1);
  await page.screenshot({ path: `${dir}/pwa-master-offline-390-kn.png` });
  await context.setOffline(false);
});
