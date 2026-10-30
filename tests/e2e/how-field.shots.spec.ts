import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import changes from "../../docs/field/changes.json";

// /how "From the field": the Koppal field test counted from the database, field rows only, and
// "You said, we changed" from docs/field/changes.json. In fixture mode (no keys) there are no field
// rows, so the honest empty state shows; the populated layout is checked on /design with Sample
// numbers and a Sample badge, never the field badge.
// Run: PW_PORT=3181 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/how-field.shots.spec.ts --project=shots
const dir = "docs/demos/M6";
mkdirSync(dir, { recursive: true });

async function open(page: Page, path: string, lang: "kn" | "en", width: number) {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 800 });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

for (const lang of ["kn", "en"] as const) {
  for (const width of [390, 1280]) {
    test(`/how field test: labelled, honest when empty, names no one (${width}, ${lang})`, async ({
      page,
    }) => {
      await open(page, "/how", lang, width);
      const section = page.locator("section[aria-labelledby=field]");
      await expect(section).toBeVisible();
      // Above the evals, which stay as they were.
      const field = await section.boundingBox();
      const evals = await page.locator("section[aria-labelledby=evals]").boundingBox();
      expect(field!.y).toBeLessThan(evals!.y);

      await expect(section.locator('[data-badge="field"]').filter({ visible: true })).toContainText(
        lang === "kn" ? "ಕೊಪ್ಪಳ ಕ್ಷೇತ್ರ ಪರೀಕ್ಷೆ" : "Koppal field test",
      );
      await expect(section.locator('[data-badge="sample"]')).toHaveCount(0);
      await expect(section).toHaveAttribute("data-field", "empty");
      await expect(section.locator("[data-field-empty]").filter({ visible: true })).toContainText(
        lang === "kn" ? "ಕ್ಷೇತ್ರದಿಂದ ಇನ್ನೂ ಏನೂ ಬಂದಿಲ್ಲ" : "Nothing from the field yet",
      );
      // No invented number stands in for missing data.
      await expect(section.locator("[data-field-tile]")).toHaveCount(0);

      const list = section.locator("[data-field-changes]");
      if (changes.entries.length === 0) {
        await expect(
          list.locator("[data-field-changes-empty]").filter({ visible: true }),
        ).toBeVisible();
      } else {
        await expect(list.locator("[data-field-change]")).toHaveCount(changes.entries.length);
      }

      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await section.screenshot({ path: `${dir}/how-field-${width}-${lang}.png` });
    });

    test(`field card layout on /design: numbers, private while small, empty (${width}, ${lang})`, async ({
      page,
    }) => {
      await open(page, "/design#field", lang, width);
      const section = page.locator("section#field");
      await expect(section).toBeVisible();
      const tiles = section.locator("[data-field-tile]").filter({ visible: true });
      expect(await tiles.count()).toBe(8);
      // The populated specimen is labelled Sample; only the empty one wears the field badge.
      await expect(section.locator('[data-badge="sample"]').filter({ visible: true })).toHaveCount(
        2,
      );
      // Small groups read as words, with no number.
      await expect(section.locator('[data-field-tile="questions"]').nth(1)).toContainText(
        lang === "kn" ? "5ಕ್ಕಿಂತ ಕಡಿಮೆ ಶಿಕ್ಷಕರು" : "Fewer than 5 teachers",
      );
      // Before and after open the full picture; the thumbnails load.
      const shots = section.locator('[data-field-shot="linked"] a');
      await expect(shots).toHaveCount(2);
      for (const img of await section.locator('[data-field-shot="linked"] img').all()) {
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0);
      }
      // The gallery's sticky header would sit over a tall section screenshot.
      await page.addStyleTag({ content: ".sticky { position: static !important; }" });
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await section.screenshot({ path: `${dir}/how-field-specimen-${width}-${lang}.png` });
    });
  }
}
