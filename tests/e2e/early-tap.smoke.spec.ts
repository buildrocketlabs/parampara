import { expect, test } from "@playwright/test";

// F-P1, Law 9: on Slow 3G the ask screen's chips are on screen seconds before React can answer a
// tap (the jury lost a tap this way on 28 Oct). A tap that early is held and replayed once the
// page is ready (lib/ask/early-tap), so the question still goes and the answer stages start.
// Fixture mode (no keys): /api/ask is held open here, as a live answer would be while it is made.

// Chrome DevTools' Slow 3G, as tests/e2e/network.spec.ts defines it (devtools-frontend
// NetworkManager.ts): 50,000 B/s each way, 2,000 ms latency.
const SLOW_3G = {
  offline: false,
  latency: 400 * 5,
  downloadThroughput: ((500 * 1000) / 8) * 0.8,
  uploadThroughput: ((500 * 1000) / 8) * 0.8,
};

test("a sample chip tapped before the page is ready still asks its question", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180_000);
  await context.addCookies([{ name: "pp_fixture_role", value: "teacher", url: baseURL! }]);
  await page.addInitScript(() => window.localStorage.setItem("parampara.lang", "en"));

  let asked: string | null = null;
  let release: () => void = () => undefined;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/ask", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    asked = route.request().postData() ?? "";
    await held;
    await route.fulfill({ status: 503, body: '{"error":"not_configured"}' }).catch(() => undefined);
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", SLOW_3G);

  await page.goto("/t/ask", { waitUntil: "commit" });
  const chip = page.getByTestId("sample-letters");
  await chip.waitFor({ state: "visible", timeout: 120_000 });
  // As early as possible: the chip is drawn, the page's script has not taken over yet.
  const early = await page.evaluate(() => !(window as { __ppReady?: boolean }).__ppReady);
  await chip.tap({ timeout: 10_000 });
  expect(early, "the tap came before hydration, which is the case under test").toBe(true);

  // Seen at once: "getting ready", so the tap is never silently lost.
  if (!(await page.evaluate(() => (window as { __ppReady?: boolean }).__ppReady))) {
    await expect(page.getByRole("status").filter({ hasText: "getting ready" })).toBeVisible();
  }

  // Once hydrated, the held tap is replayed: the question goes and the stages start.
  await expect(page.getByTestId("ask-stages")).toBeVisible({ timeout: 120_000 });
  await expect.poll(() => asked, { timeout: 30_000 }).toContain("recognise letters");
  release();
});
