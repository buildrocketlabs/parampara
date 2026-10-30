import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";

// F-A1 screenshots in fixture mode (PW_FIXTURE=1): seven synthetic WhatsApp notes on the import
// screen at 390 and 1280 px, in Kannada and English: chosen and ordered with the consent note
// marked, reading note by note, ready on one timeline, and a browser that cannot read Ogg.
const out = "docs/demos/F-A1";
mkdirSync(out, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), "pp-notes-shots-"));
execFileSync("node", ["scripts/rehearsal-notes.mjs", "--out", dir], { stdio: "ignore" });
const notes = [7, 3, 9, 5, 4, 8, 6].map((n) =>
  join(dir, `PTT-20261028-WA${String(n).padStart(4, "0")}.opus`),
);

const viewports = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
];

async function setup(page: Page, lang: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
  await page.goto("/m/import");
  await page.addStyleTag({ content: ".sticky { position: static !important; }" });
  await page.evaluate(() => document.fonts.ready);
  await page.getByTestId("import-files").setInputFiles(notes);
  await page
    .getByRole("radio", { name: /first voice note is the consent|ಮೊದಲ ಧ್ವನಿ ಸಂದೇಶವೇ ಒಪ್ಪಿಗೆ/ })
    .click();
  await page.waitForTimeout(900);
}

for (const vp of viewports) {
  for (const lang of ["kn", "en"] as const) {
    test(`notes ${vp.name} ${lang}`, async ({ page, context, baseURL }) => {
      test.setTimeout(120_000);
      await context.addCookies([{ name: "pp_fixture_role", value: "reviewer", url: baseURL! }]);
      // Slow each decode a little so the note by note progress can be photographed.
      await page.addInitScript(() => {
        const original = BaseAudioContext.prototype.decodeAudioData;
        BaseAudioContext.prototype.decodeAudioData = function (buffer, ...rest) {
          return new Promise((r) => setTimeout(r, 1500)).then(() =>
            original.call(this, buffer, ...rest),
          );
        };
      });
      await setup(page, lang, vp.width, vp.height);
      await page.screenshot({ path: `${out}/notes-${vp.name}-${lang}-full.png`, fullPage: true });
      await page.getByTestId("import-begin").click();
      await page.getByTestId("import-run").waitFor();
      await page.waitForTimeout(3500);
      await page.getByTestId("import-run").screenshot({
        path: `${out}/reading-${vp.name}-${lang}.png`,
      });
      await page.getByTestId("import-plan").waitFor({ timeout: 90_000 });
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${out}/ready-${vp.name}-${lang}-full.png`, fullPage: true });
    });

    test(`cannot read ${vp.name} ${lang}`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "pp_fixture_role", value: "reviewer", url: baseURL! }]);
      await page.addInitScript(() => {
        BaseAudioContext.prototype.decodeAudioData = () =>
          Promise.reject(new DOMException("Decoding failed", "EncodingError"));
        // @ts-expect-error: a browser without WebCodecs
        delete window.AudioDecoder;
      });
      await setup(page, lang, vp.width, vp.height);
      await page.getByTestId("import-begin").click();
      await page.getByTestId("import-error-part").waitFor();
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${out}/error-${vp.name}-${lang}-full.png`, fullPage: true });
    });
  }
}
