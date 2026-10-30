import { mkdirSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// D72: a child who comes hungry is a classroom question. The answer, or the honest "no master has
// answered this yet", carries one calm line about the headmaster and the mid day meal, and the line
// itself never names a helpline. Fixture mode; the ask route is answered in the test, so nothing is
// called. Screenshots to docs/demos/M6/hunger-note-*.
// Run: PW_PORT=3163 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/hunger-note.shots.spec.ts --project=shots
const dir = "docs/demos/M6";
mkdirSync(dir, { recursive: true });

const seen = (page: Page, selector: string) => page.locator(selector).filter({ visible: true });
const EN = "If a child often comes hungry, tell your headmaster; the mid day meal and the school can help.";
const KN = "ಮಗು ಆಗಾಗ ಹಸಿವಿನಿಂದ ಬಂದರೆ ಮುಖ್ಯ ಶಿಕ್ಷಕರಿಗೆ ತಿಳಿಸಿ; ಮಧ್ಯಾಹ್ನದ ಊಟ ಮತ್ತು ಶಾಲೆ ನೆರವಾಗಬಹುದು.";

async function setUp(context: BrowserContext, page: Page, lang: "kn" | "en", width: number) {
  const port = process.env.PW_PORT ?? "3123";
  await context.addCookies([
    { name: "pp_fixture_role", value: "teacher", url: `http://localhost:${port}` },
  ]);
  await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
}

async function shot(page: Page, name: string, target?: ReturnType<Page["locator"]>) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1600); // the steps and the note rise in one after another
  if (!target) {
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
    return;
  }
  // A gallery element shot: the sticky header and the feedback tab stay out of the picture.
  await page.addStyleTag({
    content: "header.sticky{position:static!important} button.fixed.right-0{display:none!important}",
  });
  await target.screenshot({ path: `${dir}/${name}.png` });
}

for (const [lang, width] of [
  ["kn", 390],
  ["en", 390],
  ["en", 1280],
] as const) {
  test(`no master has answered yet: the gentle note, ${width} ${lang}`, async ({ page, context }) => {
    await setUp(context, page, lang, width);
    await page.route("**/api/ask*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ outcome: { kind: "no_card", answerId: "fixture-answer", note: "hunger" } }),
      }),
    );
    await page.goto("/t/ask");
    await seen(page, '[data-testid^="sample-"]').first().click();
    const panel = seen(page, '[data-testid="outcome-no-card"]');
    await expect(panel).toBeVisible();
    const note = panel.getByTestId("note-hunger");
    await expect(note).toContainText(lang === "kn" ? KN : EN);
    // The note is a line about the school, never a helpline.
    await expect(note.locator("a")).toHaveCount(0);
    await expect(note).not.toContainText("1098");
    await shot(page, `hunger-note-no-card-${width}-${lang}`);
  });
}

test("a plain no card outcome has no hunger note", async ({ page, context }) => {
  await setUp(context, page, "en", 390);
  await page.route("**/api/ask*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ outcome: { kind: "no_card", answerId: "fixture-answer" } }),
    }),
  );
  await page.goto("/t/ask");
  await seen(page, '[data-testid^="sample-"]').first().click();
  await expect(seen(page, '[data-testid="outcome-no-card"]')).toBeVisible();
  await expect(page.getByTestId("note-hunger")).toHaveCount(0);
});

for (const [lang, width] of [
  ["kn", 390],
  ["en", 1280],
] as const) {
  test(`an answer with the gentle note under its steps, ${width} ${lang}`, async ({ page, context }) => {
    await setUp(context, page, lang, width);
    await page.goto("/design#answer");
    const card = seen(page, "#answer article").nth(2);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toContainText(lang === "kn" ? KN : EN);
    await expect(card.locator('a[href^="tel:"]')).toHaveCount(0);
    await shot(page, `hunger-note-answer-${width}-${lang}`, card);
  });
}
