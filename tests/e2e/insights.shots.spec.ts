import { mkdirSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Teacher Pulse (/i) and Lamps of Karnataka (/i/lamps), docs/BUILD.md M5, in fixture mode: no keys,
// a small labelled Sample week, field honestly empty. Screenshots to docs/demos/M5/.
// Run: PW_PORT=3181 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/insights.shots.spec.ts --project=shots
const dir = "docs/demos/M5";
mkdirSync(dir, { recursive: true });

const port = process.env.PW_PORT ?? "3123";
const seen = (page: Page, selector: string) => page.locator(selector).filter({ visible: true });

async function as(
  role: "officer" | "teacher",
  context: BrowserContext,
  page: Page,
  lang: "kn" | "en",
  width = 390,
  height = 844,
) {
  await context.addCookies([
    { name: "pp_fixture_role", value: role, url: `http://localhost:${port}` },
  ]);
  await page.setViewportSize({ width, height });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900); // entrances (rise, lamps lighting) settle
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}

for (const lang of ["kn", "en"] as const) {
  for (const width of [390, 1280]) {
    test(`Teacher Pulse: what to do first, then the numbers (${width}, ${lang})`, async ({
      page,
      context,
    }) => {
      await as("officer", context, page, lang, width, width < 600 ? 844 : 800);
      await page.goto("/i");
      const actions = page.locator("[data-actions]");
      await expect(actions).toBeVisible();
      const items = actions.locator("ol > li");
      expect(await items.count()).toBeGreaterThanOrEqual(2);
      expect(await items.count()).toBeLessThanOrEqual(3);
      // Action before any number: the board sits above the funnel.
      const board = await actions.boundingBox();
      const funnel = await page.locator("#funnel-title").boundingBox();
      expect(board!.y).toBeLessThan(funnel!.y);
      await expect(seen(page, '[data-badge="sample"]').first()).toBeVisible();
      await expect(seen(page, '[data-funnel="asked"]')).toContainText("46");
      // A group under 5 has words, never a number or a bar length.
      const hidden = page.locator("[data-bar][data-suppressed]");
      expect(await hidden.count()).toBeGreaterThan(0);
      await expect(hidden.first()).toContainText(
        lang === "kn" ? "5ಕ್ಕಿಂತ ಕಡಿಮೆ ಶಿಕ್ಷಕರು" : "Fewer than 5 teachers",
      );
      expect(await hidden.first().locator("[style*='width']").count()).toBe(0);
      await shot(page, `pulse-${width}-${lang}`);
    });

    test(`Lamps of Karnataka: honest Sample, tap a lamp to see whose wisdom helped (${width}, ${lang})`, async ({
      page,
      context,
    }) => {
      await as("officer", context, page, lang, width, width < 600 ? 844 : 800);
      await page.goto("/i/lamps");
      await expect(page.locator('[data-notice="no-field"]')).toContainText(
        lang === "kn" ? "ಮಾದರಿ ತೋರಿಸುತ್ತಿದ್ದೇವೆ" : "No field data yet; showing Sample.",
      );
      await expect(page.locator("[data-district]")).toHaveCount(31);
      await expect(page.locator('[data-district="koppal"]')).toHaveAttribute("data-lit", "true");
      await expect(page.locator('[data-district="bidar"]')).not.toHaveAttribute("data-lit", "true");
      await shot(page, `lamps-${width}-${lang}`);

      await page.locator('[data-district="koppal"]').click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText("Sharanappa");
      await expect(sheet).toContainText(lang === "kn" ? "8 ಬಾರಿ ಫಲ ಕೊಟ್ಟಿತು" : "Worked 8 times");
      await expect(sheet.locator('[data-badge="sample"]')).toBeVisible();
      await page.waitForTimeout(500);
      await shot(page, `lamps-sheet-${width}-${lang}`, false);
    });
  }
}

for (const [width, lang] of [
  [390, "kn"],
  [1280, "en"],
] as const) {
  test(`an unlit district says so kindly, and Escape closes the sheet (${width}, ${lang})`, async ({
    page,
    context,
  }) => {
    await as("officer", context, page, lang, width, width < 600 ? 844 : 800);
    await page.goto("/i/lamps");
    await page.locator('[data-district="bidar"]').click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.locator('[data-sheet="unlit"]')).toContainText(
      lang === "kn" ? "ಇಲ್ಲಿ ಇನ್ನೂ ದೀಪ ಹಚ್ಚಿಲ್ಲ" : "No lamp is lit here yet",
    );
    await page.waitForTimeout(500);
    await shot(page, `lamps-sheet-unlit-${width}-${lang}`, false);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });
}

test("the lamps list opens the same sheet, and a small number is words", async ({
  page,
  context,
}) => {
  await as("officer", context, page, "en", 1280, 800);
  await page.goto("/i/lamps");
  // Districts with fewer than 5 teachers are never named or lit on their own (0006).
  await expect(page.locator('[data-district="vijayanagara"]')).not.toHaveAttribute(
    "data-lit",
    "true",
  );
  await page.locator('[data-lamp-row="elsewhere"]').click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Fewer than 5 teachers said it worked");
  await expect(sheet).toContainText("counted together");
  await expect(sheet).not.toContainText(/Worked [1-4] times/);
});

test("field data, when there is none yet, is an honest empty state with a way to the Sample", async ({
  page,
  context,
}) => {
  await as("officer", context, page, "en", 1280, 800);
  await page.goto("/i?data=field");
  await expect(page.getByRole("heading", { name: /No field data yet/ })).toBeVisible();
  await expect(seen(page, '[data-badge="field"]').first()).toBeVisible();
  await shot(page, "pulse-field-empty-1280-en", false);
  await page.getByRole("link", { name: "See the Sample" }).click();
  await expect(page).toHaveURL(/data=sample/);
  await expect(page.locator("[data-actions]")).toBeVisible();
});

test("reduced motion: every lamp is lit at once, nothing waits on an animation", async ({
  page,
  context,
}) => {
  await as("officer", context, page, "en", 1280, 800);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/i/lamps");
  const lamp = page.locator('[data-district="raichur"] [data-lamp-lit]');
  await expect(lamp).toHaveCSS("opacity", "1");
});

test("every action and practice leads somewhere: the Tomorrow card for the meeting", async ({
  page,
  context,
}) => {
  await as("officer", context, page, "en", 1280, 800);
  await page.goto("/i");
  const card = page.locator('[data-practice="sample-card-03"] [data-card-image]');
  await expect(card).toHaveAttribute("href", "/api/cards/sample-card-03/image");
  await expect(page.locator("[data-actions] a").first()).toBeVisible();
  // What an officer cannot do in Parampara can still be passed on, in both languages.
  await expect(page.locator("[data-actions] [data-share-line]").first()).toBeVisible();
});

test("lamps with no field data yet: Hanate rests and the map waits, never a dead end", async ({
  page,
  context,
}) => {
  await as("officer", context, page, "en", 1280, 800);
  await page.goto("/i/lamps?data=field");
  await expect(page.getByRole("heading", { name: /No lamps yet/ })).toBeVisible();
  await expect(page.locator("[data-district][data-lit]")).toHaveCount(0);
  await expect(page.locator('[data-badge="field"]').first()).toBeVisible();
  await shot(page, "lamps-field-empty-1280-en", false);
});

for (const path of ["/i", "/i/lamps"]) {
  test(`offline on ${path}: what was loaded stays, and the page says so kindly`, async ({
    page,
    context,
  }) => {
    await as("officer", context, page, "en");
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await context.setOffline(true);
    await expect(page.locator("[data-offline-banner]")).toBeVisible();
    await expect(page.locator("main h1")).toBeVisible();
    await shot(page, `${path === "/i" ? "pulse" : "lamps"}-offline-390-en`, false);
    await context.setOffline(false);
  });
}

test("a teacher never sees the officer's numbers", async ({ page, context }) => {
  await as("teacher", context, page, "en");
  await page.goto("/i");
  await expect(page.locator("[data-actions]")).toHaveCount(0);
  await expect(page.locator("[data-funnel]")).toHaveCount(0);
  await page.goto("/i/lamps");
  await expect(page.locator("[data-district]")).toHaveCount(0);
});

test("open data and the Tomorrow card answer without sign in", async ({ request }) => {
  const res = await request.get("/api/open/cards");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.licence.id).toBe("CC-BY-4.0");
  expect(body.count).toBe(body.cards.length);
  const img = await request.get(`/api/cards/${body.cards[0].id}/image`);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");
  const missing = await request.get("/api/cards/sample-card-09/image");
  expect(missing.status()).toBe(404);
});
