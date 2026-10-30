import { test, type Page } from "@playwright/test";

// T11 release polish: the home page's quiet link for judges and /how as a signed out judge reads
// it, at 390 and 1280, in Kannada and English, into docs/demos/T11/. Run against a deployment:
// PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=shots t11-release
test.skip(!process.env.PW_BASE_URL, "T11 screenshots are taken from a running deployment");

const SIZES = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
] as const;
const DIR = "docs/demos/T11";

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
  await page.emulateMedia({ reducedMotion: "reduce" });
}

for (const size of SIZES) {
  for (const lang of ["kn", "en"] as const) {
    test(`home and /how at ${size.name}, ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await open(page, `/?lang=${lang}`);
      const link = page.locator("[data-judges-link]");
      await link.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${DIR}/home-judges-link-${size.name}-${lang}.png` });
      await open(page, `/how?lang=${lang}`);
      for (const [part, selector] of [
        ["numbers", "#numbers"],
        ["trace", "#trace"],
        ["field", "#field"],
        ["evals", "#evals"],
        ["offline", "#offline"],
      ] as const) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await page.locator(selector).evaluate((el) => el.scrollIntoView({ block: "start" }));
        // Let the section nav catch up with the scroll before the picture.
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${DIR}/how-${part}-${size.name}-${lang}.png` });
      }
    });
  }
}
