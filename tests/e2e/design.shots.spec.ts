import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The /design gallery in the `shots` project: every section at 390x844 and 1280x800, in Kannada and
// English, plus opened sheets, a playing voice and a reduced motion pass, into docs/demos/M1/.
// Run: PW_PORT=3157 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/design.shots.spec.ts --project=shots
const dir = "docs/demos/M1";
mkdirSync(dir, { recursive: true });

const SECTIONS = [
  "loader",
  "stages",
  "answer",
  "trace",
  "sheet",
  "mic",
  "celebration",
  "voice",
  "medallion",
  "transcript",
  "states",
  "badges",
  "chips",
  "toast",
  "skeleton",
  "dots",
] as const;

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
] as const;

async function open(page: Page, lang: "kn" | "en", width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
  await page.goto("/design");
  // The gallery header is sticky; let element shots show each section without it on top.
  await page.addStyleTag({ content: "header.sticky{position:static!important}" });
  await page.evaluate(() => document.fonts.ready);
}

test("the gallery is not indexed and lists every section", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "en", 1280, 800);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  for (const id of SECTIONS) await expect(page.locator(`#${id}`)).toBeVisible();
  expect(errors).toEqual([]);
});

for (const vp of VIEWPORTS) {
  for (const lang of ["kn", "en"] as const) {
    test(`design sections ${vp.name} ${lang}`, async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, lang, vp.width, vp.height);
      await page.waitForTimeout(4500); // loaders advance, the answer unfolds, lamps light
      for (const id of SECTIONS) {
        const section = page.locator(`#${id}`);
        await section.scrollIntoViewIfNeeded();
        if (id === "celebration") {
          await section
            .getByRole("button", { name: /Replay|ಮತ್ತೆ ತೋರಿಸಿ/ })
            .first()
            .click();
          await page.waitForTimeout(900); // mid moment: lamps lit, petals falling
        }
        await section.screenshot({ path: `${dir}/design-${id}-${vp.name}-${lang}.png` });
      }
    });

    test(`trace drawer open ${vp.name} ${lang}`, async ({ page }) => {
      await open(page, lang, vp.width, vp.height);
      await page.locator('[data-open-trace="ready"]').click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-verdict="removed"]')).toHaveCount(1);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${dir}/design-trace-open-${vp.name}-${lang}.png` });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);

      // The states without a trace: still loading, failed, no network.
      for (const variant of ["loading", "error", "offline"] as const) {
        await page.locator(`[data-open-trace="${variant}"]`).click();
        await expect(dialog).toBeVisible();
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${dir}/design-trace-${variant}-${vp.name}-${lang}.png` });
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }
    });
  }
}

test("bottom sheet traps focus and closes on Escape", async ({ page }) => {
  await open(page, "kn", 390, 844);
  const opener = page.locator("[data-open-sheet]");
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/design-sheet-open-390-kn.png` });
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("voice player plays only the clip it was given", async ({ page }) => {
  await open(page, "en", 1280, 800);
  const players = page.locator("#voice [data-status]");
  await players.nth(0).getByRole("button", { name: "Play" }).click();
  await players.nth(1).getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(1800);
  await page.locator("#voice").screenshot({ path: `${dir}/design-voice-playing-1280-en.png` });
  await page.waitForTimeout(6000);
  const clip = await page
    .locator("#voice audio")
    .nth(1)
    .evaluate((a: HTMLAudioElement) => ({
      t: a.currentTime,
      paused: a.paused,
    }));
  expect(clip.paused).toBe(true);
  expect(clip.t).toBeGreaterThan(10.3);
  expect(clip.t).toBeLessThan(10.7);
});

test("mic orb: tap to start, tap to stop; hold to talk", async ({ page }) => {
  await open(page, "en", 1280, 800);
  const orb = page.locator("#mic [data-state]").first();
  await orb.click();
  await expect(orb).toHaveAttribute("data-state", "listening");
  await page.waitForTimeout(400);
  await page.locator("#mic").screenshot({ path: `${dir}/design-mic-listening-1280-en.png` });
  await orb.click();
  await expect(orb).toHaveAttribute("data-state", "thinking");
  await expect(orb).toHaveAttribute("data-state", "idle", { timeout: 4000 });
  const box = await orb.boundingBox();
  if (!box) throw new Error("no orb");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await expect(orb).toHaveAttribute("data-state", "listening");
  await page.mouse.up();
  await expect(orb).toHaveAttribute("data-state", "thinking");
});

for (const vp of VIEWPORTS) {
  test(`reduced motion ${vp.name}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "en", vp.width, vp.height);
    await page.waitForTimeout(600);
    // Content never waits on an animation: every answer step is fully shown at once.
    const steps = page.locator("#answer li[data-card]");
    for (const opacity of await steps.evaluateAll((els) =>
      els.map((e) => getComputedStyle(e).opacity),
    )) {
      expect(opacity).toBe("1");
    }
    for (const id of ["loader", "mic", "answer", "celebration", "skeleton"] as const) {
      const section = page.locator(`#${id}`);
      await section.scrollIntoViewIfNeeded();
      await section.screenshot({ path: `${dir}/design-${id}-${vp.name}-reduced.png` });
    }
  });
}
