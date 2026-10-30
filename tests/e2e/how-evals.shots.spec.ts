import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import report from "../../docs/evals/latest.json";

// /how shows the eval gates exactly as `pnpm evals` last wrote them (docs/evals/latest.json): a
// number only for a gate measured from recorded model outputs, otherwise "not measured yet".
const dir = "docs/demos/M6";
mkdirSync(dir, { recursive: true });

for (const lang of ["en", "kn"] as const) {
  test(`the eval gates on /how follow docs/evals/latest.json (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
    await page.goto("/how");
    const section = page.locator("section[aria-labelledby=evals]");
    await expect(section.locator("li[data-gate]")).toHaveCount(report.gates.length);
    for (const g of report.gates) {
      const row = section.locator(`li[data-gate=${g.id}]`);
      if (g.basis === "recorded") await expect(row).toContainText(g.display);
      else await expect(row.getByText(lang === "en" ? "Not measured yet (no recordings)" : "ಇನ್ನೂ ಅಳೆದಿಲ್ಲ (ರೆಕಾರ್ಡಿಂಗ್ ಇಲ್ಲ)")).toBeVisible();
    }
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: `${dir}/how-evals-390-${lang}.png` });
  });
}
