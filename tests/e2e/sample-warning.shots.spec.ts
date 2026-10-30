import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// F-A (29 Oct): a Sample reviewer sees a clear warning on /m/import and /r/cards, so field notes
// are never brought in as Sample again. 390 and 1280 px, Kannada and English, fixture mode.
const dir = "docs/demos/F-A-sample-warning";
mkdirSync(dir, { recursive: true });
const origin = process.env.PW_BASE_URL ?? `http://localhost:${process.env.PW_PORT ?? "3123"}`;

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}

for (const lang of ["kn", "en"] as const) {
  for (const width of [390, 1280]) {
    for (const [path, name] of [
      ["/m/import", "import"],
      ["/r/cards", "cards"],
    ] as const) {
      test(`Sample reviewer warning on ${path}, ${width} px, ${lang}`, async ({
        page,
        context,
      }) => {
        await context.addCookies([{ name: "pp_fixture_role", value: "reviewer", url: origin }]);
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
        await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
        await open(page, path);
        const warning = page.locator('[data-warning="sample-reviewer"]');
        await expect(warning).toBeVisible();
        await expect(
          warning
            .getByText(
              lang === "kn"
                ? "ನೀವು ಮಾದರಿ ಪರಿಶೀಲಕರಾಗಿ ಒಳಗಿದ್ದೀರಿ"
                : "You are signed in as a Sample reviewer",
            )
            .filter({ visible: true })
            .first(),
        ).toBeVisible();
        // Nothing spills sideways at 390.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${dir}/${name}-${width}-${lang}.png` });
      });
    }
  }
}
