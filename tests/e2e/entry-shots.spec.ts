import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";

/** Full page load of a streamed page: wait until React has revealed every Suspense segment, so a
 * query never sees the hidden copy that waits in a `div[hidden][id^="S:"]` for a moment. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}

// M1 entry and access screenshots for docs/demos/M1 (design critic, handoff). Runs only with
// TICKET=M1 so a plain `pnpm e2e:shots` for another ticket does not rewrite them:
//   TICKET=M1 PW_PORT=3141 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/entry-shots.spec.ts
test.skip(process.env.TICKET !== "M1", "M1 screenshots run with TICKET=M1");

const dir = "docs/demos/M1";
mkdirSync(dir, { recursive: true });
const viewports = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
];
const langs = ["kn", "en"] as const;

async function settle(page: Page, ms = 1200) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms); // entrance stagger finishes
}

async function shoot(page: Page, name: string, full = true) {
  await page.mouse.move(0, 0); // no leftover hover reads as a choice
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${name}.png` });
  if (full) await page.screenshot({ path: `${dir}/${name}-full.png`, fullPage: true });
}

async function asDemo(page: Page, role: string) {
  await open(page, "/");
  await page.locator(`form[data-door="${role}"] button[type="submit"]`).click();
  await page.waitForURL((u) => u.pathname !== "/");
}

async function openInvite(page: Page, agree = false) {
  await open(page, "/join/SAMPLE-T1");
  await page.getByRole("button", { name: /ಆರಂಭಿಸಿ|Begin/ }).click();
  await page.waitForURL(/\/welcome$/);
  if (agree) {
    await page.getByRole("button", { name: /ನಾನು ಒಪ್ಪುತ್ತೇನೆ|I agree/ }).click();
    await page.waitForURL(/\/welcome\/language$/);
  }
}

for (const vp of viewports) {
  for (const lang of langs) {
    const tag = `${vp.name}-${lang}`;
    test.describe(tag, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
      });

      test(`doors ${tag}`, async ({ page }) => {
        await open(page, "/#doors");
        await settle(page, 4200);
        await page.locator("#doors").scrollIntoViewIfNeeded();
        await shoot(page, `doors-${tag}`, false);
      });

      test(`login ${tag}`, async ({ page }) => {
        await open(page, "/login");
        await settle(page);
        await shoot(page, `login-${tag}`);
      });

      test(`join ${tag}`, async ({ page }) => {
        await open(page, "/join/SAMPLE-T1");
        await settle(page);
        await shoot(page, `join-${tag}`);
      });

      test(`welcome consent ${tag}`, async ({ page }) => {
        await openInvite(page);
        await settle(page);
        await shoot(page, `welcome-consent-${tag}`, false);
        // The end of the page, where the tray settles into the flow above Not now.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(300);
        await shoot(page, `welcome-consent-${tag}-end`, false);
      });

      test(`welcome language ${tag}`, async ({ page }) => {
        await openInvite(page, true);
        await settle(page);
        await shoot(page, `welcome-language-${tag}`);
      });

      test(`invites ${tag}`, async ({ page }) => {
        await asDemo(page, "reviewer");
        await open(page, "/r/invites");
        // One batch for all four shots, so the list reads like a real morning's work.
        const made = await page.locator("li[data-invite]").filter({ hasText: "Talakal GPS teachers" }).count();
        if (made < 3) {
          await page.locator("#invite-count").fill("3");
          await page.locator("#invite-label").fill("Talakal GPS teachers");
          await page.locator("form:has(#invite-count) button[type=submit]").click();
          await page.waitForURL(/made=3/);
        } else {
          await open(page, "/r/invites?made=3");
        }
        await settle(page);
        await shoot(page, `invites-${tag}`);
      });

      test(`room with session ${tag}`, async ({ page }) => {
        await asDemo(page, "teacher");
        await settle(page);
        await shoot(page, `room-teacher-${tag}`, false);
      });
    });
  }

  // States, English (jurors) at each width.
  test.describe(`states ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript(() => window.localStorage.setItem("parampara.lang", "en"));
    });

    test(`room without a session ${vp.name}`, async ({ page }) => {
      await open(page, "/m");
      await settle(page);
      await shoot(page, `state-room-no-session-${vp.name}`, false);
    });

    test(`enter failed ${vp.name}`, async ({ page }) => {
      await open(page, "/?enter=failed#doors");
      await settle(page, 4200);
      await page.getByRole("alert").filter({ hasText: "did not open" }).scrollIntoViewIfNeeded();
      await shoot(page, `state-enter-failed-${vp.name}`, false);
    });

    test(`login error ${vp.name}`, async ({ page }) => {
      await open(page, "/login");
      await page.locator("#login-email").fill("teacher@demo.parampara.invalid");
      await page.locator("#login-password").fill("not-the-password");
      await page.locator("form button[type=submit]").click();
      await page.getByRole("alert").filter({ hasText: "do not match" }).waitFor();
      await settle(page, 400);
      await shoot(page, `state-login-error-${vp.name}`, false);
    });

    test(`join unknown ${vp.name}`, async ({ page }) => {
      await open(page, "/join/ZZZZ2345");
      await settle(page);
      await shoot(page, `state-join-unknown-${vp.name}`, false);
    });

    test(`welcome error ${vp.name}`, async ({ page }) => {
      await openInvite(page);
      await open(page, "/welcome?e=1");
      await settle(page);
      await page.getByRole("alert").filter({ hasText: "could not save" }).scrollIntoViewIfNeeded();
      await shoot(page, `state-welcome-error-${vp.name}`, false);
    });

    test(`join closed ${vp.name}`, async ({ page }) => {
      await open(page, "/join/SAMPLE-X1");
      await settle(page);
      await shoot(page, `state-join-closed-${vp.name}`, false);
    });

    test(`invites gate ${vp.name}`, async ({ page }) => {
      await open(page, "/r/invites");
      await settle(page);
      await shoot(page, `state-invites-gate-${vp.name}`, false);
    });

    test(`welcome offline ${vp.name}`, async ({ page, context }) => {
      await openInvite(page);
      await settle(page);
      await context.setOffline(true);
      await page.waitForTimeout(900);
      await shoot(page, `state-welcome-offline-${vp.name}`, false);
    });

    test(`welcome agree held offline ${vp.name}`, async ({ page, context }) => {
      await openInvite(page);
      await settle(page);
      await context.setOffline(true);
      await page.getByRole("button", { name: /I agree/ }).click();
      await page.waitForTimeout(600);
      await shoot(page, `state-welcome-held-offline-${vp.name}`, false);
    });

    test(`welcome not now ${vp.name}`, async ({ page }) => {
      await openInvite(page);
      await page.getByText("Not now").filter({ visible: true }).first().click();
      await settle(page, 500);
      await page.getByText("Nothing is recorded").filter({ visible: true }).first().scrollIntoViewIfNeeded();
      await shoot(page, `state-welcome-not-now-${vp.name}`, false);
    });
  });
}
