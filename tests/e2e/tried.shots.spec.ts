import { mkdirSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// "Did it work?" (docs/BUILD.md M4.1) in fixture mode: no keys, the Sample answer, the teacher's
// answers kept in a cookie. Screenshots to docs/demos/M4/.
// Run: PW_PORT=3157 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/tried.shots.spec.ts --project=shots
const dir = "docs/demos/M4";
mkdirSync(dir, { recursive: true });

const ANSWER = "00000000-0000-4000-8000-0000000a0001";
const URL = `/t/tried/${ANSWER}`;

// Next keeps the previous render of a route hidden for instant back navigation, so every locator
// here looks only at what is visible.
const seen = (page: Page, selector: string) => page.locator(selector).filter({ visible: true });
const outcome = (page: Page, o: string) => seen(page, `[data-outcome="${o}"]`);

async function asTeacher(
  context: BrowserContext,
  page: Page,
  lang: "kn" | "en",
  width = 390,
  height = 844,
) {
  const port = process.env.PW_PORT ?? "3123";
  await context.addCookies([
    { name: "pp_fixture_role", value: "teacher", url: `http://localhost:${port}` },
  ]);
  await page.setViewportSize({ width, height });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700); // let the entrance (rise, 520 ms) settle
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}

for (const lang of ["kn", "en"] as const) {
  test(`worked: one tap, the lamps light, then a one tap thank you (${lang})`, async ({
    page,
    context,
  }) => {
    await asTeacher(context, page, lang);
    await page.goto(URL);
    await expect(page.getByRole("main").getByRole("radiogroup")).toBeVisible();
    // All three answers sit above the fold on a 390x844 phone.
    const box = await outcome(page, "didnt").boundingBox();
    expect((box?.y ?? 900) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
    await shot(page, `tried-ask-390-${lang}`, false);

    await outcome(page, "worked").click();
    const celebration = page
      .getByRole("status")
      .filter({ hasText: /ದೀಪ ಹಚ್ಚಿದ್ದೀರಿ|You lit a lamp/ });
    await expect(celebration).toBeVisible();
    await expect(page.getByRole("switch", { name: /ಶಬ್ದ|Sound/ })).toBeVisible();
    await page.waitForTimeout(900);
    await shot(page, `tried-celebrate-390-${lang}`);
    // Continue skips ahead; if the moment already ended on its own, the thank you step is there.
    await celebration
      .getByRole("button", { name: /ಮುಂದುವರಿಯಿರಿ|Continue/ })
      .click({ timeout: 1500 })
      .catch(() => undefined);

    await expect(seen(page, "#thanks-title")).toBeVisible();
    await shot(page, `tried-thanks-390-${lang}`);
    await seen(page, '[data-phrase="tried.thanks.p1"]').click();
    await expect(seen(page, "#closing-title")).toContainText(/ಹೊರಟಿದೆ|on its way/);
    await page.waitForTimeout(600); // the spark reaches the master
    await shot(page, `tried-sent-390-${lang}`);

    // Coming back: what she said is remembered, she may change it, and is not asked to thank twice.
    await page.goto(URL);
    await expect(
      page.getByText(/ಮೊದಲು ಹೇಳಿದ್ದು|You said before/).filter({ visible: true }),
    ).toBeVisible();
    await expect(outcome(page, "worked")).toHaveAttribute("aria-checked", "true");
  });
}

for (const o of ["partly", "didnt"] as const) {
  test(`${o}: a kind word, room to say what happened, a way on`, async ({ page, context }) => {
    await asTeacher(context, page, "en");
    await page.goto(URL);
    await outcome(page, o).click();
    const closing = seen(page, "#closing-title");
    await expect(closing).toContainText(o === "partly" ? "good start" : "Thank you for trying");
    await expect(page.getByRole("link", { name: "Ask a follow up" })).toHaveAttribute(
      "href",
      `/t/ask?about=${ANSWER}`,
    );
    await expect(page.locator("main")).not.toContainText(/fault|failed|wrong/i);
    await seen(page, "#tried-note").fill("Two children could not count past twenty yet");
    await page.getByRole("button", { name: "Send" }).click();
    // Fixture mode has no redactor, so the note is honestly not kept (fail closed, Law 5).
    await expect(page.getByRole("status").filter({ hasText: /noted|not kept/ })).toBeVisible();
    await shot(page, `tried-${o}-390-en`);
  });
}

test("a note that hints a child may be at risk shows Childline, never a celebration", async ({
  page,
  context,
}) => {
  await asTeacher(context, page, "kn");
  await page.goto(URL);
  await outcome(page, "partly").click();
  await seen(page, "#tried-note").fill("One child has bruises and says there is no food at home");
  await page.getByRole("button", { name: /ಕಳುಹಿಸಿ/ }).click();
  await expect(page.getByRole("link", { name: /1098/ })).toHaveAttribute("href", "tel:1098");
  await shot(page, "tried-welfare-390-kn");
  await page.getByRole("button", { name: /ಮುಂದುವರಿಯಿರಿ/ }).click();
  await expect(seen(page, "#closing-title")).toContainText("ಒಳ್ಳೆಯ ಆರಂಭ");
});

test("offline: the answer waits on the phone and goes when the network is back", async ({
  page,
  context,
}) => {
  await asTeacher(context, page, "en");
  await page.goto(URL);
  await expect(page.getByRole("main").getByRole("radiogroup")).toBeVisible();
  await context.setOffline(true);
  await outcome(page, "worked").click();
  await expect(seen(page, "#closing-title")).toContainText("when the network is back");
  await shot(page, "tried-queued-390-en", false);
  await context.setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "has been sent" })).toBeVisible();
  await page.goto(URL);
  await expect(outcome(page, "worked")).toHaveAttribute("aria-checked", "true");
});

test("desktop composition at 1280 in Kannada", async ({ page, context }) => {
  await asTeacher(context, page, "kn", 1280, 800);
  await page.goto(URL);
  await expect(page.getByRole("main").getByRole("radiogroup")).toBeVisible();
  await shot(page, "tried-ask-1280-kn", false);
});

test("the home prompt: three equal one tap answers that record on arrival, then it leaves", async ({
  page,
  context,
}) => {
  await asTeacher(context, page, "kn");
  await page.goto("/design#tried");
  const prompt = seen(page, "[data-tried-prompt]");
  await expect(prompt).toBeVisible();
  await expect(prompt.locator("a[data-outcome]")).toHaveCount(3);
  await prompt.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await prompt.screenshot({ path: `${dir}/tried-prompt-390-kn.png` });
  await prompt.locator('a[data-outcome="worked"]').click();
  await expect(page).toHaveURL(new RegExp(`/t/tried/${ANSWER}\\?outcome=worked`));
  await expect(page.getByRole("status").filter({ hasText: /ದೀಪ ಹಚ್ಚಿದ್ದೀರಿ/ })).toBeVisible();
  await page.goto("/design#tried");
  await expect(page.locator("[data-tried-prompt]")).toHaveCount(0);
});

test("without a teacher session the page offers a way in, not a dead end", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole("link", { name: /ಮುಖಪುಟಕ್ಕೆ|Back to home/ })).toBeVisible();
});

test("reduced motion: the lamps are simply lit", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await asTeacher(context, page, "en");
  await page.goto(URL);
  await outcome(page, "worked").click();
  await expect(page.getByRole("status").filter({ hasText: "You lit a lamp" })).toBeVisible();
  await shot(page, "tried-celebrate-390-reduced");
});

test("a mis tap is one tap from undone", async ({ page, context }) => {
  await asTeacher(context, page, "en");
  await page.goto(URL);
  await outcome(page, "didnt").click();
  await expect(seen(page, "#closing-title")).toContainText("Thank you for trying");
  await page.getByRole("button", { name: "Change" }).click();
  await expect(outcome(page, "didnt")).toHaveAttribute("aria-checked", "true");
  await outcome(page, "worked").click();
  await expect(page.getByRole("status").filter({ hasText: "You lit a lamp" })).toBeVisible();
});
