import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "@playwright/test";
import { encodeWav16 } from "../../lib/audio/wav";

// M2 screenshots of the import screen in fixture mode (PW_FIXTURE=1): empty, files chosen, ready.
const dir = "docs/demos/M2";
mkdirSync(dir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "pp-shots-"));
const wav = join(tmp, "master-interview-part-1.wav");
const samples = new Float32Array(16_000 * 50).map((_, i) =>
  Math.sin(i / 400) > 0 ? 0.2 * Math.sin(i / 7) : 0,
);
writeFileSync(wav, encodeWav16(samples, 16_000));

const viewports = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
];

for (const vp of viewports) {
  for (const lang of ["kn", "en"] as const) {
    test(`import ${vp.name} ${lang}`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "pp_fixture_role", value: "reviewer", url: baseURL! }]);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
      await page.goto("/m/import");
      // Full page shots stitch the viewport; a sticky bar would be drawn mid page.
      await page.addStyleTag({ content: ".sticky { position: static !important; }" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(900); // entrance choreography settles
      await page.screenshot({ path: `${dir}/import-${vp.name}-${lang}-full.png`, fullPage: true });
      await page
        .locator('[role="radio"][aria-checked]')
        .filter({ hasText: /consent line is at the start|ಆರಂಭದಲ್ಲೇ ಇದೆ/ })
        .first()
        .click();
      await page.getByTestId("import-files").setInputFiles([wav]);
      await page.getByTestId("import-begin").click();
      await page.getByTestId("import-plan").waitFor();
      await page.waitForTimeout(900);
      await page.screenshot({
        path: `${dir}/import-ready-${vp.name}-${lang}-full.png`,
        fullPage: true,
      });
    });
  }
}
