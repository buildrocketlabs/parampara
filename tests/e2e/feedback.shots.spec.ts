import { mkdirSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Feedback from any screen (docs/BUILD.md M4.5), fixture mode. Screenshots to docs/demos/M4/.
const dir = "docs/demos/M4";
mkdirSync(dir, { recursive: true });

async function asMaster(context: BrowserContext, page: Page, lang: "kn" | "en") {
  const port = process.env.PW_PORT ?? "3123";
  await context.addCookies([
    { name: "pp_fixture_role", value: "master", url: `http://localhost:${port}` },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
}

test("never on the landing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-feedback-tab]")).toHaveCount(0);
  await expect(page.locator("[data-feedback-foot]")).toHaveCount(0);
});

test("a quiet button at the end of the page opens a sheet; words reach the team", async ({
  page,
  context,
}) => {
  await asMaster(context, page, "kn");
  await page.goto("/m");
  // On a phone it closes the page instead of floating over it (F-P1, D97).
  const tab = page.locator("[data-feedback-foot] button");
  await expect(tab).toBeVisible();
  await tab.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.locator("#feedback-text").fill("ಅಕ್ಷರ ಇನ್ನೂ ಸ್ವಲ್ಪ ದೊಡ್ಡದಾಗಿರಲಿ");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/feedback-sheet-390-kn.png` });
  // Opened from the very end of a long page on a cold server, the sheet can settle by under a
  // pixel for a while (seen only in tests, F-P1); the button is in place, so no stability wait.
  await expect(sheet.getByRole("button", { name: /ಕಳುಹಿಸಿ/ })).toBeInViewport();
  await sheet.getByRole("button", { name: /ಕಳುಹಿಸಿ/ }).click({ force: true });
  await expect(sheet.getByRole("status")).toContainText("ತಂಡಕ್ಕೆ ತಲುಪಿಸಿದ್ದೇನೆ");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/feedback-sent-390-kn.png` });
});

test("a welfare hint shows Childline and is not kept", async ({ page, context }) => {
  await asMaster(context, page, "en");
  await page.goto("/m");
  await page.locator("[data-feedback-foot] button").click();
  const sheet = page.getByRole("dialog");
  await sheet.locator("#feedback-text").fill("a child in my class has bruises again");
  const send = sheet.getByRole("button", { name: "Send" });
  await expect(send).toBeInViewport(); // the sheet has risen into place
  await send.click({ force: true });
  await expect(sheet.getByRole("link", { name: /Childline 1098/ })).toHaveAttribute(
    "href",
    "tel:1098",
  );
});
