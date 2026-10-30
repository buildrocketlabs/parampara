import { devices, expect, test, type Page } from "@playwright/test";

// Warms the five sample chips on a deployment (D35, D87), in English and in Kannada, as the one tap
// Sample teacher: each chip is asked once (a cache miss spends about 2 to 3 US cents, so at most
// about 30 cents for all ten when the library has changed, and nothing when it has not), its voice
// is made and kept, then it is asked again and must come back from the cache.
// Run it after every change to the Sample library or a prompt (both change the cache key):
//
//   pnpm warm:chips                       (the live site)
//   PW_BASE_URL=https://… pnpm warm:chips (another deployment)
test.skip(!process.env.PW_BASE_URL, "warming needs a deployment (PW_BASE_URL)");
test.describe.configure({ mode: "serial", timeout: 600_000 });

const CHIPS = ["letters", "numbers", "multilevel", "safety", "nocard"] as const;
const ANSWERED = new Set<string>(["letters", "numbers", "multilevel"]);

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}

/** Taps a chip; returns what came back, how long it took, and whether the voice is ready. */
async function tap(page: Page, chip: string, lang: "en" | "kn") {
  await open(page, `/t/ask?lang=${lang}`);
  const started = Date.now();
  const voice = page
    .waitForResponse((r) => /\/api\/answers\/[0-9a-f-]{36}\/voice/.test(r.url()), {
      timeout: 90_000,
    })
    .then((r) => r.status())
    .catch(() => null);
  await page.getByTestId(`sample-${chip}`).filter({ visible: true }).first().click();
  const answer = page
    .waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 120_000 })
    .then(() => "answered");
  const panel = page
    .locator('[data-testid^="outcome-"]')
    .first()
    .waitFor({ timeout: 120_000 })
    .then(async () =>
      (
        (await page.locator('[data-testid^="outcome-"]').first().getAttribute("data-testid")) ?? ""
      ).replace("outcome-", ""),
    );
  const outcome = await Promise.race([answer, panel]).catch(() => "timeout");
  const ms = Date.now() - started;
  let replayed = false;
  let voiceStatus: number | null = null;
  if (outcome === "answered") {
    await page.locator("li[data-card]").first().waitFor({ timeout: 30_000 });
    replayed =
      (await page
        .getByText(/First answered|Answered before|ಮೊದಲು ಉತ್ತರಿಸಿದ್ದು|ಮೊದಲೇ ಉತ್ತರಿಸಿದ್ದು/)
        .count()) > 0;
    voiceStatus = await voice;
  }
  return { chip, lang, outcome, ms, replayed, voiceStatus };
}

test("warm the sample chips: ask, keep the voice, then confirm the cache", async ({ browser }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
  const page = await context.newPage();
  await open(page, "/?lang=en");
  await page.locator('form[data-door="teacher"] button[type="submit"]').click();
  await expect(page.getByLabel("Signed in")).toBeVisible({ timeout: 60_000 });

  const rows: Array<Awaited<ReturnType<typeof tap>> & { pass: string }> = [];
  for (const pass of ["warm", "check"] as const) {
    for (const lang of ["en", "kn"] as const) {
      for (const chip of CHIPS) rows.push({ pass, ...(await tap(page, chip, lang)) });
    }
  }
  await context.close();

  console.log(
    [
      "pass  | lang | chip       | outcome    | seconds | replayed | voice",
      ...rows.map(
        (r) =>
          `${r.pass.padEnd(5)} | ${r.lang.padEnd(4)} | ${r.chip.padEnd(10)} | ${r.outcome.padEnd(10)} | ${(r.ms / 1000).toFixed(1).padStart(7)} | ${String(r.replayed).padEnd(8)} | ${r.voiceStatus ?? "n/a"}`,
      ),
    ].join("\n"),
  );
  for (const r of rows.filter((x) => x.pass === "check")) {
    if (ANSWERED.has(r.chip)) {
      expect.soft(r.outcome, `${r.lang} ${r.chip}`).toBe("answered");
      expect.soft(r.replayed, `${r.lang} ${r.chip} replayed from the cache`).toBe(true);
      expect.soft(r.voiceStatus, `${r.lang} ${r.chip} voice ready`).toBe(200);
      expect.soft(r.ms, `${r.lang} ${r.chip} under 3 s`).toBeLessThan(3_000);
    } else {
      // The safety and no card chips are never cached by design (triage runs every time).
      expect.soft(r.ms, `${r.lang} ${r.chip} under 8 s`).toBeLessThan(8_000);
    }
  }
});
