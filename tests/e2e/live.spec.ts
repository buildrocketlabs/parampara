import { expect, test, type Locator, type Page } from "@playwright/test";

// Live checks against a deployment with real Supabase (PW_BASE_URL=https://… pnpm exec playwright
// test --project=live). Everything they create is Sample: the demo reviewer can only make Sample
// links (D38), and each run revokes the link it made.
test.skip(!process.env.PW_BASE_URL, "live checks need PW_BASE_URL");

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}
const seen = (l: Locator) => l.filter({ visible: true }).first();

test("a real invite link signs a new phone in, through consent and language, then can be revoked", async ({
  browser,
}) => {
  const reviewerCtx = await browser.newContext();
  const reviewer = await reviewerCtx.newPage();
  await open(reviewer, "/r/invites?lang=en");
  await reviewer.getByRole("button", { name: /Enter as reviewer/ }).click();
  await expect(reviewer).toHaveURL(/\/r\/invites$/);
  const label = `Live check ${new Date().toISOString().slice(0, 16)}`;
  await reviewer.getByLabel("How many links").fill("1");
  await reviewer.getByLabel(/Label/).fill(label);
  await reviewer.getByRole("button", { name: /Make one link|Make 1 link/ }).click();
  const row = reviewer.locator("li[data-invite]").filter({ hasText: label }).first();
  const code = await row.getAttribute("data-invite");
  expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);

  // A teacher's phone: a fresh browser that has never seen Parampara, opening the link lowercased
  // as WhatsApp sometimes does.
  const phoneCtx = await browser.newContext();
  const phone = await phoneCtx.newPage();
  await open(phone, `/join/${code!.toLowerCase()}`);
  await phone.getByRole("button", { name: /ಆರಂಭಿಸಿ|Begin/ }).click();
  await expect(phone).toHaveURL(/\/welcome$/);
  await phone.getByRole("button", { name: /ನಾನು ಒಪ್ಪುತ್ತೇನೆ/ }).click();
  await expect(phone).toHaveURL(/\/welcome\/language$/);
  await phone.getByRole("button", { name: /English/ }).click();
  await expect(phone).toHaveURL(/\/t$/);
  await expect(
    seen(phone.getByLabel("Signed in").getByText(/^(ಮಾದರಿ ದತ್ತಾಂಶ|Sample)$/)),
  ).toBeVisible();

  // The same link on a second phone goes straight in: the agreement is remembered (D37).
  const secondCtx = await browser.newContext();
  const second = await secondCtx.newPage();
  await open(second, `/join/${code}`);
  await second.getByRole("button", { name: /ಆರಂಭಿಸಿ|Begin/ }).click();
  await expect(second).toHaveURL(/\/t$/);

  await reviewer.reload();
  const again = reviewer.locator(`li[data-invite="${code}"]`);
  await again.getByRole("button", { name: "Revoke" }).click();
  await again.getByRole("button", { name: "Yes, revoke" }).click();
  await expect(reviewer).toHaveURL(/closed=/);
  await open(second, `/join/${code}?lang=en`);
  await expect(second.getByRole("heading", { level: 1 })).toContainText(
    "This link has been closed",
  );
  await Promise.all([reviewerCtx.close(), phoneCtx.close(), secondCtx.close()]);
});

test("health is live and every door signs in to its seeded demo account", async ({
  page,
  request,
}) => {
  const health = await (await request.get("/api/health")).json();
  expect(health).toMatchObject({ ok: true, db: "ok", mode: "live" });
  for (const [role, path] of [
    ["teacher", "/t"],
    ["master", "/m"],
    ["reviewer", "/r"],
    ["officer", "/i"],
  ] as const) {
    await open(page, "/");
    await page.locator(`form[data-door="${role}"] button[type="submit"]`).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("import as the demo reviewer: the interview is created and the original is kept in private storage", async ({
  page,
}) => {
  const { encodeWav16 } = await import("../../lib/audio/wav");
  const samples = new Float32Array(16_000 * 40).map((_, i) =>
    Math.sin(i / 300) > 0 ? 0.2 * Math.sin(i / 9) : 0,
  );
  const file = {
    name: "live-check.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from(encodeWav16(samples, 16_000)),
  };

  await open(page, "/r?lang=en");
  await page.getByRole("button", { name: /Enter as reviewer/ }).click();
  await expect(page.getByLabel("Signed in")).toBeVisible();
  await open(page, "/m/import?lang=en");
  await page.getByTestId("import-files").setInputFiles([file]);
  await page
    .locator('[role="radio"]')
    .filter({ hasText: /Sharanappa/ })
    .first()
    .click();
  await page
    .locator('[role="radio"]')
    .filter({ hasText: /consent line is at the start/ })
    .first()
    .click();
  await page.getByTestId("import-begin").click();

  // Without a speech key the page must say so kindly; with one it moves on to listening.
  const run = page.getByTestId("import-run");
  await expect(run).toBeVisible({ timeout: 30_000 });
  await expect(run).toContainText(
    /listening service is not ready|Writing down every word|Finding|Writing practice cards/,
    {
      timeout: 60_000,
    },
  );
  // The original part reaches private storage (the page says so once it is verified there).
  await expect(
    page.getByText("The original voice is safely stored").filter({ visible: true }).first(),
  ).toBeVisible({
    timeout: 60_000,
  });
});

test("every built page opens for its demo role without the error screen", async ({ page }) => {
  const visits: Array<[string, string[]]> = [
    ["teacher", ["/t", "/t/ask", "/t/saved", "/how"]],
    ["master", ["/m", "/m/talk"]],
    ["officer", ["/i", "/i/lamps"]],
    ["reviewer", ["/r", "/r/cards", "/r/queue", "/r/invites", "/m/import"]],
  ];
  for (const [role, paths] of visits) {
    await open(page, "/");
    await page.locator(`form[data-door="${role}"] button[type="submit"]`).click();
    await expect(page.getByLabel("Signed in")).toBeVisible();
    for (const path of paths) {
      await open(page, `${path}?lang=en`);
      await expect(page.getByRole("heading", { name: /Something went wrong/ }), path).toHaveCount(
        0,
      );
      await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
    }
  }
});
