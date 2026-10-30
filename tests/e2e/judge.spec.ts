import { expect, test, type Page } from "@playwright/test";

// The judge's hour (.claude/skills/demo-path), against the live deployment on a phone over a slow
// network: PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=judge
// It also warms the cache for the five sample questions (D35). Needs migration 0004, the Sample
// library (pnpm seed:library) and live AI; it spends a few cents the first time, nothing after.
test.skip(!process.env.PW_BASE_URL, "the judge path runs against a live deployment");
test.describe.configure({ mode: "serial", timeout: 180_000 });

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}

async function slow3g(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
  });
}

async function enterAsTeacher(page: Page) {
  await open(page, "/?lang=en");
  await page.locator('form[data-door="teacher"] button[type="submit"]').click();
  await expect(page.getByLabel("Signed in")).toBeVisible();
}

test("the landing loads fast and tells the story", async ({ page }) => {
  await slow3g(page);
  const started = Date.now();
  await page.goto("/?lang=en", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One lamp lights another");
  expect(Date.now() - started).toBeLessThan(8_000);
  for (const role of ["teacher", "master", "reviewer", "officer"]) {
    await expect(page.locator(`form[data-door="${role}"]`)).toBeVisible();
  }
});

const CHIPS = [
  { chip: "letters", expect: "answer" },
  { chip: "numbers", expect: "answer" },
  { chip: "multilevel", expect: "answer" },
  { chip: "safety", expect: "escalated" },
  { chip: "nocard", expect: "no-card" },
] as const;

// A juror's first tap must feel instant (D87, docs/RELEASE.md step 1.2). The three answered chips
// replay from the answer cache once `pnpm warm:chips` has run after the last library change; the
// safety and no card chips are never cached by design (triage runs every time) and finish in a
// few seconds. A failure here on live means: run `pnpm warm:chips`, then this again.
const WARM_MS = { answer: 3_000, escalated: 8_000, "no-card": 8_000 } as const;

for (const { chip, expect: outcome } of CHIPS) {
  test(`sample question: ${chip} → ${outcome}`, async ({ page }) => {
    await enterAsTeacher(page);
    // The ask screen wakes the function as it opens (GET /api/ask, D85); a juror reads the chips
    // for a moment before tapping, so the tap is timed once that wake up has answered.
    const woken = page
      .waitForResponse((r) => r.request().method() === "GET" && /\/api\/ask(\?|$)/.test(r.url()), {
        timeout: 20_000,
      })
      .catch(() => null);
    await open(page, "/t/ask?lang=en");
    await woken;
    const started = Date.now();
    await page.getByTestId(`sample-${chip}`).click();
    if (outcome === "answer") {
      await expect(page).toHaveURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 120_000 });
    } else {
      await expect(page.getByTestId(`outcome-${outcome}`)).toBeVisible({ timeout: 120_000 });
    }
    const ms = Date.now() - started;
    expect(
      ms,
      `${chip} took ${(ms / 1000).toFixed(1)} s; warm needs under ${WARM_MS[outcome] / 1000} s (pnpm warm:chips)`,
    ).toBeLessThan(WARM_MS[outcome]);
    if (outcome === "answer") {
      await expect(page.getByRole("button", { name: /How this answer was made/ })).toBeVisible();
    } else {
      await expect(
        page.getByTestId(`outcome-${outcome}`).locator('a[href="tel:1098"]'),
      ).toBeVisible();
    }
  });
}

test("an answer shows how it was made, and the teacher can say it worked", async ({ page }) => {
  await enterAsTeacher(page);
  await open(page, "/t/ask?lang=en");
  await page.getByTestId("sample-letters").click();
  await expect(page).toHaveURL(/\/t\/a\/([0-9a-f-]{36})$/, { timeout: 120_000 });
  const answerId = /\/t\/a\/([0-9a-f-]{36})$/.exec(page.url())![1]!;
  await page.getByRole("button", { name: /How this answer was made/ }).click();
  await expect(
    page
      .getByText(/Every step checked/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await open(page, `/t/tried/${answerId}?lang=en`);
  await page
    .getByRole("radio", { name: /It worked/ })
    .first()
    .click();
  await expect(
    page
      .getByText(/You lit a lamp today/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible({ timeout: 20_000 });
});

test("the reviewer sees the question no master has answered yet", async ({ page }) => {
  await open(page, "/?lang=en");
  await page.locator('form[data-door="reviewer"] button[type="submit"]').click();
  await expect(page.getByLabel("Signed in")).toBeVisible();
  await open(page, "/r/queue?lang=en");
  await expect(page.getByText(/computer coding/i).first()).toBeVisible();
});

// /how is where a judge checks the numbers (F-T11): signed out, nothing may read as a placeholder,
// every rupee sign carries its amount, and one real shipped answer is shown with its trace.
test("/how, signed out, shows real numbers and a real answer, never a placeholder", async ({
  page,
}) => {
  for (const lang of ["en", "kn"] as const) {
    await open(page, `/how?lang=${lang}`);
    await expect(page.locator("[data-showcase]")).toBeVisible();
    await expect(page.locator("[data-total-spend]")).toBeVisible();
    await expect(page.locator("[data-field-heard-item]").first()).toBeVisible();
    const text = await page.locator("main").innerText();
    for (const placeholder of [
      "will be written here",
      "No answer yet",
      "ಮೊದಲ ಬದಲಾವಣೆ ಇಲ್ಲಿ ಬರುತ್ತದೆ",
      "ಇನ್ನೂ ಯಾವ ಉತ್ತರವೂ ಇಲ್ಲ",
    ]) {
      expect(text, `${lang}: ${placeholder}`).not.toContain(placeholder);
    }
    expect(text.match(/₹(?!\s?\d)/g), `${lang}: a ₹ with no amount`).toBeNull();
  }
});
