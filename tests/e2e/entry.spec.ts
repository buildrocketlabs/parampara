import { expect, test, type Locator, type Page } from "@playwright/test";

/** Full page load of a streamed page: wait until React has revealed every Suspense segment, so a
 * query never sees the hidden copy that waits in a `div[hidden][id^="S:"]` for a moment. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}

// M1 entry and access, in fixture mode (no Supabase keys): one tap doors, /login, invite links,
// consent and language, the invite generator. Everything here is Sample.

const SAMPLE = /^(ಮಾದರಿ ದತ್ತಾಂಶ|Sample)$/;

// Bilingual lines render in both orders and CSS hides one, so match the one a person sees.
const seen = (l: Locator) => l.filter({ visible: true }).first();

async function enterByDoor(page: Page, role: string) {
  await open(page, "/");
  await page.locator(`form[data-door="${role}"] button[type="submit"]`).click();
}

function sessionBar(page: Page) {
  return page.getByLabel("Signed in");
}

test("each door enters its room, signed in as a Sample account", async ({ page }) => {
  const rooms = { teacher: "/t", master: "/m", reviewer: "/r", officer: "/i" } as const;
  for (const [role, path] of Object.entries(rooms)) {
    await enterByDoor(page, role);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    const bar = sessionBar(page);
    await expect(bar).toBeVisible();
    await expect(seen(bar.getByText(SAMPLE))).toBeVisible();
    await expect(bar.getByRole("button", { name: /ಹೊರಗೆ ಹೋಗಿ|Leave/ })).toBeVisible();
  }
});

test("Leave signs out, and the room then offers the one tap way in", async ({ page }) => {
  await enterByDoor(page, "teacher");
  await expect(page).toHaveURL(/\/t$/);
  await sessionBar(page).getByRole("button", { name: /ಹೊರಗೆ ಹೋಗಿ|Leave/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await open(page, "/t");
  await expect(page.getByRole("button", { name: /ಶಿಕ್ಷಕರಾಗಿ ಒಳಗೆ ಬನ್ನಿ|Enter as teacher/ })).toBeVisible();
});

test("a room visited without a session offers the one tap way in, and it works", async ({ page }) => {
  await open(page, "/m");
  await expect(sessionBar(page)).toHaveCount(0);
  const enter = page.getByRole("button", { name: /ಹಿರಿಯ ಶಿಕ್ಷಕರಾಗಿ ಒಳಗೆ ಬನ್ನಿ|Enter as master teacher/ });
  await expect(enter).toBeVisible();
  await enter.click();
  await expect(page).toHaveURL(/\/m$/);
  await expect(seen(sessionBar(page).getByText(SAMPLE))).toBeVisible();
});

test("/login takes the README credentials, and says kindly when they do not match", async ({ page }) => {
  await open(page, "/login?lang=en");
  await page.getByLabel(/Email/).fill("reviewer@demo.parampara.invalid");
  await page.getByLabel(/Password/, { exact: false }).first().fill("wrong-password");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "do not match" })).toBeVisible();
  await expect(page.getByLabel(/Email/)).toHaveValue("reviewer@demo.parampara.invalid");

  await page.getByRole("button", { name: /Show password/ }).click();
  const password = page.locator("#login-password");
  await expect(password).toHaveAttribute("type", "text");
  await password.fill("Hanate-reviewer-2026");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/r$/);
  await expect(seen(sessionBar(page).getByText(SAMPLE))).toBeVisible();
});

test("an invite link leads through consent and language into the teacher's room", async ({ page }) => {
  await open(page, "/join/sample-t1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ಹಿರಿಯ ಶಿಕ್ಷಕರ ಅನುಭವ");
  await expect(seen(page.getByText("Sample teachers of Koppal"))).toBeVisible();
  await expect(seen(page.getByText(/ಒಂದು ಮಗು/))).toBeVisible();
  await page.getByRole("button", { name: /ಆರಂಭಿಸಿ|Begin/ }).click();

  await expect(page).toHaveURL(/\/welcome$/);
  await expect(seen(page.getByText(/ಪರಂಪರೆ ಒಂದು ಪರೀಕ್ಷಾ ಆಪ್/))).toBeVisible();
  await expect(seen(page.locator("main").getByText(SAMPLE))).toBeVisible();
  await seen(page.getByText(/^ಈಗ ಬೇಡ$/)).click();
  await expect(seen(page.getByText(/ಏನನ್ನೂ ರೆಕಾರ್ಡ್ ಮಾಡುವುದಿಲ್ಲ/))).toBeVisible();
  await page.getByRole("button", { name: /ನಾನು ಒಪ್ಪುತ್ತೇನೆ/ }).click();

  await expect(page).toHaveURL(/\/welcome\/language$/);
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page).toHaveURL(/\/t$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Namaskara");

  // The same link again goes straight in: the agreement is remembered.
  await open(page, "/join/SAMPLE-T1");
  await page.getByRole("button", { name: /ಆರಂಭಿಸಿ|Begin/ }).click();
  await expect(page).toHaveURL(/\/t$/);
});

test("offline, I agree is held and sent by itself when the network returns", async ({ page, context }) => {
  await open(page, "/join/SAMPLE-T1");
  await page.getByRole("button", { name: /ಆರಂಭಿಸಿ|Begin/ }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await context.setOffline(true);
  await page.getByRole("button", { name: /ನಾನು ಒಪ್ಪುತ್ತೇನೆ/ }).click();
  await expect(page.getByRole("button", { name: /ನೆಟ್‌ವರ್ಕ್ ಬಂದಾಗ ಕಳುಹಿಸುತ್ತೇನೆ/ })).toBeVisible();
  await expect(page).toHaveURL(/\/welcome$/);
  await context.setOffline(false);
  await expect(page).toHaveURL(/\/welcome\/language$/);
});

test("Not now lets go of an agreement pressed offline: nothing is sent later", async ({ page, context }) => {
  await open(page, "/join/SAMPLE-T1");
  await page.getByRole("button", { name: /ಆರಂಭಿಸಿ|Begin/ }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await context.setOffline(true);
  await page.getByRole("button", { name: /ನಾನು ಒಪ್ಪುತ್ತೇನೆ/ }).click();
  await expect(page.getByRole("button", { name: /ನೆಟ್‌ವರ್ಕ್ ಬಂದಾಗ/ })).toBeVisible();
  await seen(page.getByText(/^ಈಗ ಬೇಡ$/)).click();
  await expect(page.getByRole("button", { name: /ನಾನು ಒಪ್ಪುತ್ತೇನೆ/ })).toBeVisible();
  await context.setOffline(false);
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/welcome$/);
  // And the room still asks for consent first.
  await open(page, "/t");
  await expect(page.getByRole("link", { name: /ಮುಂದುವರಿಯಿರಿ|Continue/ })).toBeVisible();
});

test("a held press can be taken back by pressing again", async ({ page, context }) => {
  await open(page, "/join/SAMPLE-T1");
  await page.getByRole("button", { name: /ಆರಂಭಿಸಿ|Begin/ }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await context.setOffline(true);
  await page.getByRole("button", { name: /ನಾನು ಒಪ್ಪುತ್ತೇನೆ/ }).click();
  await page.getByRole("button", { name: /ನೆಟ್‌ವರ್ಕ್ ಬಂದಾಗ/ }).click();
  await expect(page.getByRole("button", { name: /ನಾನು ಒಪ್ಪುತ್ತೇನೆ/ })).toBeVisible();
  await context.setOffline(false);
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/welcome$/);
});

test("a revoked or unknown link gets a kind page with a way home", async ({ page }) => {
  await open(page, "/join/SAMPLE-X1?lang=en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("This link has been closed");
  await expect(page.getByRole("button", { name: /Begin/ })).toHaveCount(0);
  await open(page, "/join/ZZZZ2345?lang=en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("We could not find this link");
  await expect(page.getByRole("link", { name: /Back to home/ })).toBeVisible();
});

test("a reviewer makes three links, each with a WhatsApp share, and can revoke one", async ({ page }) => {
  await open(page, "/r/invites?lang=en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("This page is for reviewers");
  await page.getByRole("button", { name: /Enter as reviewer/ }).click();
  await expect(page).toHaveURL(/\/r\/invites$/);
  await expect(seen(page.getByText(/links you make are Sample links/))).toBeVisible();

  const label = `E2E batch ${Date.now()}`;
  await page.getByLabel("How many links").fill("3");
  await page.getByLabel(/Label/).fill(label);
  await page.getByRole("button", { name: /Make 3 links/ }).click();
  await expect(page).toHaveURL(/made=3/);
  await expect(page.getByRole("status").filter({ hasText: "3 new links are ready" })).toBeVisible();

  const rows = page.locator("li[data-invite]").filter({ hasText: label });
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) {
    const code = await row.getAttribute("data-invite");
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    await expect(seen(row.getByText("Not opened yet"))).toBeVisible();
    const href = await row.locator('a[data-share="whatsapp"]').getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/);
    const text = decodeURIComponent(href!.slice("https://wa.me/?text=".length));
    expect(text).toContain(`/join/${code}`);
    expect(text).toMatch(/ನಮಸ್ಕಾರ/);
  }

  const first = rows.first();
  const code = await first.getAttribute("data-invite");
  await first.getByRole("button", { name: "Revoke" }).click();
  await first.getByRole("button", { name: "Yes, revoke" }).click();
  await expect(page).toHaveURL(/closed=/);
  await expect(seen(page.locator(`li[data-invite="${code}"]`).getByText("Revoked"))).toBeVisible();
  await open(page, `/join/${code}?lang=en`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("This link has been closed");
});

test("nothing scrolls sideways at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const noSideScroll = async (path: string) => {
    await open(page, path);
    await page.waitForLoadState("networkidle");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, path).toBeLessThanOrEqual(390);
  };
  for (const path of ["/", "/login", "/join/SAMPLE-T1", "/t", "/r/invites"]) await noSideScroll(path);
  await open(page, "/join/SAMPLE-T1");
  await page.getByRole("button", { name: /ಆರಂಭಿಸಿ|Begin/ }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await noSideScroll("/welcome");
  await noSideScroll("/welcome/language");
  await enterByDoor(page, "reviewer");
  await noSideScroll("/r/invites");
  await noSideScroll("/t");
});
