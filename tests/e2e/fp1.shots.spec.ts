import { mkdirSync } from "node:fs";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

// F-P1 (28 Oct, before the Koppal field day): each fixed screen at 390 px in Kannada and English,
// and the group QR at 1280 x 800, in fixture mode (no keys). Screenshots to docs/demos/F-P1/.
const dir = "docs/demos/F-P1";
mkdirSync(dir, { recursive: true });
const origin = process.env.PW_BASE_URL ?? `http://localhost:${process.env.PW_PORT ?? "3123"}`;
const ANSWER = "/t/a/00000000-0000-4000-8000-0000000a0001";
const REPLAY = "/t/a/00000000-0000-4000-8000-0000000a0002";

const seen = (l: Locator) => l.filter({ visible: true }).first();

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}

async function phone(page: Page, lang: "kn" | "en", width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
}

async function as(context: BrowserContext, role: "teacher" | "reviewer") {
  await context.addCookies([{ name: "pp_fixture_role", value: role, url: origin }]);
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.waitForTimeout(500); // entrance animations settle
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}

/** Nothing floats over the page on a phone: the feedback tab is not shown below sm. */
async function noFloatingFeedback(page: Page) {
  await expect(page.locator("[data-feedback-tab]")).toBeHidden();
}

for (const lang of ["kn", "en"] as const) {
  test(`consent on a group QR: honest lead, Read all, nothing cut, ${lang}`, async ({ page }) => {
    await phone(page, lang);
    await open(page, "/join/SAMPLE-G1");
    await expect(page.getByTestId("group-welcome")).toBeVisible();
    // Headless Chromium has no Kannada voice and the fixture has no recording: "read", not "hear".
    const lead = seen(
      page.getByText(lang === "kn" ? /^ಈ ಕೆಲವು ಮಾತುಗಳನ್ನು ಓದಿ\./ : /^Read these few words\./),
    );
    await expect(lead).toBeVisible();
    await expect(page.getByText(/ಓದಿ ಅಥವಾ ಕೇಳಿ|Read or hear/)).toHaveCount(0);
    // The app's name is spelt ಪರಂಪರೆ in the consent.
    await expect(seen(page.getByText(/^ಪರಂಪರೆ ಒಂದು ಪರೀಕ್ಷಾ ಆಪ್/))).toBeVisible();
    // "Read all" sits above the pinned I agree tray, so no line is cut by it.
    const readAll = page.getByTestId("consent-read-all");
    await expect(readAll).toBeVisible();
    await noFloatingFeedback(page);
    await shot(page, `consent-390-${lang}`); // also lets the entrance animation finish
    const tray = await page.locator("[data-cta-tray]").boundingBox();
    const button = await readAll.boundingBox();
    expect(button!.y + button!.height).toBeLessThanOrEqual(tray!.y + 24); // the tray's clear fade
    await readAll.click();
    await expect(readAll).toHaveCount(0);
    await shot(page, `consent-read-all-390-${lang}`, true);
  });

  test(`a closed group QR: ask your headmaster first, Try again, ${lang}`, async ({ page }) => {
    await phone(page, lang);
    await open(page, "/join/SAMPLE-G0");
    const full = page.getByTestId("group-full");
    await expect(full).toBeVisible();
    await expect(seen(full.locator("h1"))).toContainText(
      lang === "kn" ? "ಮುಖ್ಯ ಶಿಕ್ಷಕರನ್ನು" : "Please ask your headmaster",
    );
    if (lang === "en")
      await expect(seen(page.getByText("All places on this code are taken"))).toBeVisible();
    await expect(page.getByTestId("closed-retry")).toHaveAttribute("href", "/join/SAMPLE-G0");
    await expect(page.locator('a[href="/"]').filter({ hasText: /home|ಮುಖಪುಟ/i })).toHaveCount(0);
    await shot(page, `join-full-390-${lang}`);
    await open(page, "/join/SAMPLE-GE");
    await expect(page.getByTestId("group-expired")).toBeVisible();
    if (lang === "en") await expect(seen(page.getByText("This code has expired"))).toBeVisible();
    await shot(page, `join-expired-390-${lang}`);
  });

  test(`on a phone feedback closes the page and floats over nothing, ${lang}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000); // five pages
    await as(context, "teacher");
    await phone(page, lang);
    for (const path of ["/t", "/t/ask", ANSWER, "/t/saved"]) {
      await open(page, path);
      await noFloatingFeedback(page);
      // It closes the page's own main, after everything on it.
      await expect(page.locator("main#main > [data-feedback-foot]:last-child")).toBeAttached();
    }
    await open(page, "/t/ask");
    await shot(page, `ask-390-${lang}`);
    await open(page, ANSWER);
    await shot(page, `answer-390-${lang}`);
    // Scrolled to the end, it sits above the pinned "I'll try it tomorrow" tray, not under it.
    const foot = page.locator("[data-feedback-foot] button");
    await foot.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const tray = await page.locator("[data-cta-tray]").boundingBox();
    const box = await foot.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(tray!.y);
    await shot(page, `answer-end-390-${lang}`);
    await foot.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, `feedback-from-page-end-390-${lang}`);
  });

  test(`a replayed answer's trace tells the truth about now and then, ${lang}`, async ({
    page,
    context,
  }) => {
    await as(context, "teacher");
    await phone(page, lang);
    await open(page, REPLAY);
    await page.locator("[data-trace-open]").click();
    const note = page.getByTestId("trace-replay");
    await expect(note).toBeVisible();
    await expect(
      seen(note.getByText(lang === "kn" ? /ಈಗ ಏನೂ ಖರ್ಚಾಗಿಲ್ಲ/ : /nothing spent now/)),
    ).toBeVisible();
    await expect(
      seen(
        note.getByText(
          lang === "kn" ? /ಶುಕ್ರವಾರ, 23 ಅಕ್ಟೋಬರ್, ರಾತ್ರಿ 9:00/ : /Fri, 23 Oct, 9:00 pm/,
        ),
      ),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).not.toContainText(/\d{4}-\d{2}-\d{2}T/);
    await shot(page, `trace-replay-390-${lang}`);
  });

  test(`an answer just seen is kept for offline under Opened lately, ${lang}`, async ({
    page,
    context,
  }) => {
    await as(context, "teacher");
    await phone(page, lang);
    await open(page, ANSWER);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("parampara.recent")))
      .toContain("0000000a0001");
    await open(page, "/t/saved");
    await expect(page.getByTestId("saved-recent")).toBeVisible();
    await shot(page, `saved-recent-390-${lang}`);
  });

  test(`the group QR at 390, ${lang}`, async ({ page, context }) => {
    await as(context, "reviewer");
    await phone(page, lang);
    await open(page, "/r/invites/qr/SAMPLE-G1");
    await expect(page.getByTestId("group-qr")).toBeVisible();
    await noFloatingFeedback(page);
    await shot(page, `qr-390-${lang}`);
  });
}

test("the group QR on a laptop: places left and closing time in view, Kannada day part", async ({
  page,
  context,
}) => {
  await as(context, "reviewer");
  await phone(page, "kn", 1280, 800);
  await open(page, "/r/invites/qr/SAMPLE-G1");
  const left = seen(page.getByTestId("qr-left"));
  await expect(left).toBeInViewport({ ratio: 1 });
  const until = seen(page.getByText(/ತೆರೆದಿರುತ್ತದೆ/));
  await expect(until).toBeInViewport({ ratio: 1 });
  await expect(until).toHaveText(/(ಬೆಳಿಗ್ಗೆ|ಮಧ್ಯಾಹ್ನ|ಸಂಜೆ|ರಾತ್ರಿ) \d{1,2}:\d{2}/);
  await expect(until).not.toHaveText(/AM|PM/);
  await shot(page, "qr-1280-kn");
});

for (const lang of ["kn", "en"] as const) {
  test(`the jury's path: ask, the answer opens, go offline, reload: the answer is there, ${lang}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000);
    await as(context, "teacher");
    await phone(page, lang);
    await open(page, "/t/ask");
    // The service worker registers in production builds once the page is idle (D52).
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
      timeout: 30_000,
    });
    // After asking, the app opens the answer with a client navigation, as router.push does.
    await page.evaluate((to) => {
      (window as unknown as { next: { router: { push: (u: string) => void } } }).next.router.push(
        to,
      );
    }, ANSWER);
    await expect(page.locator("[data-trace-open]")).toBeVisible();
    // No Save tap: the page is kept because she has seen it.
    await expect
      .poll(() => page.evaluate((p) => caches.match(p).then(Boolean), ANSWER), { timeout: 20_000 })
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("[data-trace-open]")).toBeVisible();
    await expect(page.getByText(/Something went wrong|ಏನೋ ತಪ್ಪಾಯಿತು/)).toHaveCount(0);
    await shot(page, `offline-reload-answer-390-${lang}`);
    // A page this phone never kept says what works offline, never a raw error.
    await page.goto("/t/a/00000000-0000-4000-8000-0000000a0009").catch(() => undefined);
    await expect(page.getByText(/Something went wrong|ಏನೋ ತಪ್ಪಾಯಿತು/)).toHaveCount(0);
    // The worker's /offline page, or (once the router finds no page) the same words from the error boundary.
    await expect(seen(page.locator("[data-offline-page] h1"))).toBeVisible();
    await expect(seen(page.getByText(/^(Saved answers|ಉಳಿಸಿದ ಉತ್ತರಗಳು)$/))).toBeVisible();
    await shot(page, `offline-never-kept-390-${lang}`);
    await context.setOffline(false);
  });
}
