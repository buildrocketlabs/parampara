import { mkdirSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// The master's room (docs/BUILD.md M4.2) in fixture mode: a labelled Sample room.
// Run: PW_PORT=3157 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/master.shots.spec.ts --project=shots
const dir = "docs/demos/M4";
mkdirSync(dir, { recursive: true });

async function asMaster(
  context: BrowserContext,
  page: Page,
  lang: "kn" | "en",
  width = 390,
  height = 844,
) {
  const port = process.env.PW_PORT ?? "3123";
  await context.addCookies([
    { name: "pp_fixture_role", value: "master", url: `http://localhost:${port}` },
  ]);
  await page.setViewportSize({ width, height });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1600); // the lamps light, the entrance settles
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}

for (const lang of ["kn", "en"] as const) {
  test(`master room speaks first, one big button, true numbers (${lang})`, async ({
    page,
    context,
  }) => {
    await asMaster(context, page, lang);
    await page.goto("/m");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      main.getByRole("link", { name: /ಹೊಸ ಕಥೆ ಹೇಳಿ|Record a new story/ }),
    ).toHaveAttribute("href", "/m/talk");
    await expect(
      main.getByRole("link", { name: /ಧ್ವನಿಮುದ್ರಣ ತನ್ನಿ|Bring in a recording/ }),
    ).toHaveAttribute("href", "/m/import");
    await expect(
      main.locator('[data-badge="sample"]').filter({ visible: true }).first(),
    ).toBeVisible();
    // The one button is on the first screen, in thumb reach.
    const record = await main
      .getByRole("link", { name: /ಹೊಸ ಕಥೆ ಹೇಳಿ|Record a new story/ })
      .boundingBox();
    expect((record?.y ?? 900) + (record?.height ?? 0)).toBeLessThanOrEqual(844);
    await shot(page, `master-home-390-${lang}`, false);
    await shot(page, `master-home-390-${lang}-full`);
  });
}

test("numbers, thanks and evidence read right in English", async ({ page, context }) => {
  await asMaster(context, page, "en");
  await page.goto("/m");
  const main = page.getByRole("main");
  await expect(
    main.getByText("Your wisdom reached 14 teachers").filter({ visible: true }),
  ).toBeVisible();
  await expect(main.getByText("9 said it worked").filter({ visible: true })).toBeVisible();
  await expect(
    main.getByText("Worked for 9 of 12 teachers").filter({ visible: true }),
  ).toBeVisible();
  await expect(
    main.getByText("A few teachers have tried it").filter({ visible: true }),
  ).toBeVisible();
  await expect(main.getByText("Not tried yet").filter({ visible: true })).toBeVisible();
  await expect(main.getByText("1 more with the reviewer").filter({ visible: true })).toBeVisible();
  await expect(main.locator('li:has-text("From a teacher")').filter({ visible: true })).toHaveCount(
    3,
  );
  // Law 6: no teacher is ever named or identified here.
  await expect(main).not.toContainText(/Deepa|teacher id/i);
});

test("desktop composition at 1280 in Kannada", async ({ page, context }) => {
  await asMaster(context, page, "kn", 1280, 800);
  await page.goto("/m");
  await shot(page, "master-home-1280-kn", false);
});

test("reduced motion: the lamps are simply lit", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await asMaster(context, page, "en");
  await page.goto("/m");
  await shot(page, "master-home-390-reduced", false);
});

test("a visitor without a master session gets the way in, not a dead end", async ({ page }) => {
  await page.goto("/m");
  await expect(
    page.getByRole("link", { name: /ಮುಖಪುಟಕ್ಕೆ|Back to home|ಒಳಗೆ|Enter/ }).first(),
  ).toBeVisible();
});
