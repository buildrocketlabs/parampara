import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";

// `pnpm e2e:shots` writes 390x844 and 1280x800 screenshots, in Kannada and English, to
// docs/demos/<TICKET>/. Choose routes with SHOTS=/,/t (default "/").
const ticket = process.env.TICKET ?? "T0";
const routes = (process.env.SHOTS ?? "/").split(",").map((r) => r.trim());
const viewports = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
];
const dir = `docs/demos/${ticket}`;
mkdirSync(dir, { recursive: true });

for (const route of routes) {
  for (const vp of viewports) {
    for (const lang of ["kn", "en"] as const) {
      const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
      test(`${slug} ${vp.name} ${lang}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(4200); // let the flame pass and every lamp light
        await page.screenshot({ path: `${dir}/${slug}-${vp.name}-${lang}.png` });
        await page.screenshot({ path: `${dir}/${slug}-${vp.name}-${lang}-full.png`, fullPage: true });
      });
    }
  }
}

// State shots for the landing: reduced motion, and offline with the banner.
for (const vp of viewports) {
  test(`home ${vp.name} reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?lang=en");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/home-${vp.name}-reduced-motion.png` });
  });

  test(`home ${vp.name} offline`, async ({ page, context }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/?lang=en");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3600); // let the lamps finish lighting first
    await context.setOffline(true);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${dir}/home-${vp.name}-offline.png` });
  });
}
