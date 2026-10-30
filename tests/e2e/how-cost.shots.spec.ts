import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import report from "../../docs/evals/latest.json";

// /how "What it costs": rupees per question, per teacher per month and per 1,000 teachers, worked
// out at build time from docs/evals/latest.json and the D63 prices (lib/costs/model.ts), with the
// usage assumptions marked, hosting tiers, and who pays as a plan.
// Run: PW_PORT=3181 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/how-cost.shots.spec.ts --project=shots
const dir = "docs/demos/M6";
mkdirSync(dir, { recursive: true });

const gate = report.gates.find((g) => g.id === "cost_per_question")!;

for (const lang of ["kn", "en"] as const) {
  for (const width of [390, 1280]) {
    test(`/how what it costs (${width}, ${lang})`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 800 });
      await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
      await page.goto("/how");
      await page.evaluate(() => document.fonts.ready);
      const section = page.locator("section[aria-labelledby=cost]");
      await expect(section).toBeVisible();
      // Its own section, after the evals and apart from the field panel.
      const cost = await section.boundingBox();
      const evals = await page.locator("section[aria-labelledby=evals]").boundingBox();
      expect(cost!.y).toBeGreaterThan(evals!.y);

      if (gate.basis === "recorded") {
        await expect(section.locator("[data-cost-question]")).toContainText(
          `$${(gate.value as number).toFixed(4)}`,
        );
        // The answer first, rounded because it rests on assumptions; paise only in the breakdown.
        const lead = section.locator("[data-cost-lead]");
        await expect(lead).toContainText(/₹\d+(?![\d.])/);
        const leadBox = await lead.boundingBox();
        const breakdownBox = await section.locator("[data-cost-question]").boundingBox();
        expect(leadBox!.y).toBeLessThan(breakdownBox!.y);
        await expect(
          section.locator(`[data-cost-teacher] dd span[lang="${lang}"]`).filter({ visible: true }).first(),
        ).toHaveText(lang === "kn" ? /^ಸುಮಾರು ₹\d+$/ : /^About ₹\d+$/);
        await expect(
          section.locator(`[data-cost-scale] dd span[lang="${lang}"]`).filter({ visible: true }).first(),
        ).toHaveText(lang === "kn" ? /^ಸುಮಾರು ₹[\d,]+00$/ : /^About ₹[\d,]+00$/);
        await expect(section.locator("[data-measured]").filter({ visible: true })).toHaveCount(1);
        // Usage we cannot measure yet is marked, never passed off as data.
        expect(
          await section.locator("[data-assumption]").filter({ visible: true }).count(),
        ).toBeGreaterThanOrEqual(3);
      }
      await expect(section.locator("[data-cost-payer]")).toContainText(
        lang === "kn" ? "ನಮ್ಮ ಯೋಜನೆ" : "Our plan",
      );
      await expect(section.locator("[data-cost-hosting]")).toContainText("₹0");

      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await section.screenshot({ path: `${dir}/how-cost-${width}-${lang}.png` });
    });
  }
}
