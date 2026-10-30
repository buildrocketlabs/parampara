import { expect, test } from "@playwright/test";

test("landing tells the story and offers four role doors", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ಒಂದು ದೀಪ");
  await expect(page.getByRole("img", { name: /ಹಣತೆ|Hanate/ }).first()).toBeVisible();
  for (const role of ["teacher", "master", "reviewer", "officer"]) {
    await expect(page.locator(`form[data-door="${role}"] button[type="submit"]`)).toBeVisible();
  }
});

test("English is one tap away and remembered", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One lamp lights another");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One lamp lights another");
});

test("a ?lang=en link opens in English with no Kannada lead line", async ({ page }) => {
  await page.goto("/?lang=en", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-lang", "en");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1.locator('[data-lang-mode="en"]')).toBeVisible();
  await expect(h1.locator('[data-lang-mode="kn"] >> nth=0')).toBeHidden();
});

test("every door leads to a room, never a dead end", async ({ page }) => {
  for (const href of ["/t", "/m", "/r", "/i"]) {
    await page.goto(href);
    await expect(page.getByRole("link", { name: /ಮುಖಪುಟಕ್ಕೆ|Back to home/ })).toBeVisible();
  }
});

test("unknown routes get a kind page with a way home", async ({ page }) => {
  const res = await page.goto("/nowhere");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /ಮುಖಪುಟಕ್ಕೆ|Back to home/ })).toBeVisible();
});

test("reduced motion shows every lamp lit at once and offers no inert replay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-lamp]")).toHaveCount(7);
  await expect(page.getByRole("button", { name: /ಮತ್ತೆ|again/i })).toHaveCount(0);
  await expect(page.locator("main button[disabled]").first()).toBeVisible();
});

test("going offline shows a calm banner, and it leaves when the network returns", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  const banner = page.getByRole("status").filter({ hasText: /No network|ನೆಟ್‌ವರ್ಕ್/ });
  await expect(banner).toBeVisible();
  await context.setOffline(false);
  await expect(banner).toBeHidden();
});
