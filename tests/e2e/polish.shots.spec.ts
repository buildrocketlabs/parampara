import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// F-P2 screenshots in fixture mode (PW_FIXTURE=1), at 390 and 1280 px:
// - the import screen: WhatsApp notes known by time and length, "keep this page open" above the
//   progress, ready with steps 1 to 3 folded into one line, an error with its retry right under it;
// - the reviewer's room and queue: Sample copies of one question as one item, urgent counts apart;
// - /i and /how offline: calm words, never "something went wrong".
const out = "docs/demos/F-P2";
mkdirSync(out, { recursive: true });

let notes: string[] = [];
try {
  const dir = mkdtempSync(join(tmpdir(), "pp-polish-notes-"));
  execFileSync("node", ["scripts/rehearsal-notes.mjs", "--out", dir], { stdio: "ignore" });
  notes = [7, 3, 9, 5].map((n) => join(dir, `PTT-20261028-WA${String(n).padStart(4, "0")}.opus`));
} catch {
  notes = [];
}

const viewports = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
];

async function importPage(page: Page, lang: string, width: number, height: number) {
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
  for (const lang of ["en", "kn"] as const) {
    test.describe(`import ${vp.name} ${lang}`, () => {
      test.skip(notes.length === 0, "needs ffmpeg with libopus to make the synthetic notes");
      test.beforeEach(async ({ context, baseURL }) => {
        await context.addCookies([{ name: "pp_fixture_role", value: "reviewer", url: baseURL! }]);
      });

      test("chosen, reading, ready", async ({ page }) => {
        test.setTimeout(150_000);
        await page.addInitScript(() => {
          const original = BaseAudioContext.prototype.decodeAudioData;
          BaseAudioContext.prototype.decodeAudioData = function (buffer, ...rest) {
            return new Promise((r) => setTimeout(r, 1500)).then(() =>
              original.call(this, buffer, ...rest),
            );
          };
        });
        await importPage(page, lang, vp.width, vp.height);
        // Each WhatsApp note: its time and length first, the file name below.
        await expect(page.getByTestId("import-file").first()).toContainText(
          /WhatsApp #\d+ · \d+:\d\d/,
        );
        await page.getByTestId("import-file-list").screenshot({
          path: `${out}/import-notes-${vp.name}-${lang}.png`,
        });
        await page.locator("#import-step-3").screenshot({
          path: `${out}/import-consent-${vp.name}-${lang}.png`,
        });
        await page.getByTestId("import-begin").click();
        await page.getByTestId("import-run").waitFor();
        await expect(page.getByTestId("import-keep-open")).toBeVisible();
        await page.waitForTimeout(2500);
        await page.getByTestId("import-run").screenshot({
          path: `${out}/import-reading-${vp.name}-${lang}.png`,
        });
        await page.getByTestId("import-plan").waitFor({ timeout: 120_000 });
        await expect(page.getByTestId("import-summary")).toBeVisible();
        await expect(page.locator("#import-step-1")).toHaveCount(0);
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${out}/import-ready-${vp.name}-${lang}.png` });
        // "Change" opens the steps again.
        await page.getByTestId("import-change").click();
        await expect(page.locator("#import-step-1")).toBeVisible();
      });

      test("an error, with its retry right under it", async ({ page }) => {
        await page.addInitScript(() => {
          BaseAudioContext.prototype.decodeAudioData = () =>
            Promise.reject(new DOMException("Decoding failed", "EncodingError"));
          // @ts-expect-error: a browser without WebCodecs
          delete window.AudioDecoder;
        });
        await importPage(page, lang, vp.width, vp.height);
        await page.getByTestId("import-begin").click();
        await page.getByTestId("import-error-part").waitFor();
        const alert = page.getByTestId("import-run").getByRole("alert");
        await expect(alert.getByTestId("import-retry")).toBeVisible();
        await expect(page.getByTestId("import-begin")).toHaveCount(0);
        await page.waitForTimeout(600);
        await page.getByTestId("import-run").screenshot({
          path: `${out}/import-error-${vp.name}-${lang}.png`,
        });
      });
    });
  }

  test(`reviewer room and queue ${vp.name}`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "pp_fixture_role", value: "reviewer", url: baseURL! }]);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/r?lang=en");
    await expect(page.getByTestId("urgent-sample")).toContainText("1 urgent");
    await expect(page.getByTestId("urgent-field")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${out}/r-hub-${vp.name}-en.png` });
    await page.goto("/r/queue?lang=en");
    await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
    await expect(page.getByTestId("queue-asked-times")).toBeVisible();
    await expect(page.getByTestId("queue-asked-times")).toContainText("Asked 3 times");
    await expect(page.locator('li[data-queue-row="safety"]')).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/r-queue-${vp.name}-en.png`, fullPage: true });
  });
}

for (const path of ["/i", "/how"]) {
  test(`${path} offline is calm at 390`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "pp_fixture_role", value: "officer", url: baseURL! }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/i?lang=en`);
    // The service worker registers after the page is idle (D52); a reload puts it in control.
    await page.waitForFunction(() => navigator.serviceWorker?.ready.then(() => true), undefined, {
      timeout: 20_000,
    });
    await page.reload();
    await page.waitForTimeout(1500);
    await context.setOffline(true);
    if (path === "/i") {
      await page.locator('a[href*="/i?data="]').first().click();
    } else {
      await page.goto("/how").catch(() => {});
    }
    await expect(page.locator("[data-offline-state]")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Something went wrong/)).toHaveCount(0);
    await expect(page.locator("[data-offline-banner]")).toHaveCount(0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/offline${path.replace("/", "-")}-390-en.png` });
    await context.setOffline(false);
  });
}
