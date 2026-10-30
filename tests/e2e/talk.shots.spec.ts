import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// /m/talk in fixture mode (PW_FIXTURE=1, no keys): consent is recorded with the browser's fake
// microphone, the questions come from the interview guide, answers are typed, nothing is sent.
// Runs with the shots project (chromium) and writes docs/demos/M4/talk-*.png at 390 and 1280.
const dir = "docs/demos/M4";
mkdirSync(dir, { recursive: true });
const fixture = !process.env.NEXT_PUBLIC_SUPABASE_URL;

test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  permissions: ["microphone"],
});

async function enter(page: Page, baseURL: string, lang: "kn" | "en", role = "master") {
  await page.context().addCookies([{ name: "pp_fixture_role", value: role, url: baseURL }]);
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
  await page.goto("/m/talk");
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string) {
  await page.addStyleTag({ content: ".sticky, .lg\\:sticky { position: static !important; }" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/talk-${name}.png`, fullPage: true });
}

async function answer(page: Page, text: string) {
  await page.getByTestId("talk-answer").fill(text);
  await page.getByTestId("talk-send").click();
}

test.describe("talk with Hanate", () => {
  test.skip(!fixture, "fixture mode only (no keys in this build)");

  test("consent first, then one question at a time, stories as chapters, then thanks", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enter(page, baseURL!, "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tell us your experience");
    await expect(page.getByRole("note")).toContainText("Sample mode");
    await expect(page.getByText("I will not say children's names.")).toBeVisible();

    // The consent line is the first recording: tap the lamp, speak, tap again.
    const orb = page.getByRole("button", { name: "Tap to say your consent" });
    await orb.click();
    await expect(page.getByText("Go on, I am listening.").filter({ visible: true })).toBeVisible();
    await page.waitForTimeout(1_200);
    await page.screenshot({ path: `${dir}/talk-390-en-consent-listening.png` });
    await orb.click();

    const q = page.getByTestId("talk-question");
    await expect(q).toContainText("ನಮಸ್ಕಾರ", { timeout: 15_000 });
    await expect(page.getByText("About you").first()).toBeVisible();
    await answer(page, "ನಾನು ಮೂವತ್ತೆರಡು ವರ್ಷ ಪಾಠ ಮಾಡಿದ್ದೇನೆ, ಒಂದರಿಂದ ನಾಲ್ಕನೇ ತರಗತಿಗೆ.");
    await expect(q).toContainText("ಅಕ್ಷರ ಗುರುತು");
    await answer(page, "ಮರಳು ತಂದು ತಟ್ಟೆಯಲ್ಲಿ ಹಾಕ್ತಿದ್ದೆ, ಮಗು ಬೆರಳಿಂದ ಬರೀತಿತ್ತು.");
    await expect(q).toContainText("ಆಮೇಲೆ ನೀವು ಏನು ಮಾಡಿದಿರಿ?");

    // Both stories are kept as chapters under their topics.
    const chapters = page.getByRole("region", { name: "Your stories" });
    await expect(chapters).toContainText("Letter sounds");
    await expect(chapters).toContainText("ಮರಳು ತಂದು ತಟ್ಟೆಯಲ್ಲಿ");
    await shot(page, "390-en-question");

    // Ending asks the signature line once, then thanks.
    await page.getByTestId("talk-end").click();
    await expect(q).toContainText("ಒಂದೇ ಒಂದು ವಿಷಯ");
    await answer(page, "ಮಗುವನ್ನ ಮೊದಲು ಪ್ರೀತಿಸಿ, ಆಮೇಲೆ ಕಲಿಸಿ.");
    const done = page.getByTestId("talk-done");
    await expect(done).toBeVisible({ timeout: 15_000 });
    await expect(done).toContainText("Sample mode makes no cards");
    await shot(page, "390-en-done");
  });

  test("a sample session can continue without a microphone", async ({ page, baseURL }) => {
    await enter(page, baseURL!, "en");
    await page.getByTestId("talk-consent-skip").click();
    await expect(page.getByTestId("talk-question")).toContainText("ನಮಸ್ಕಾರ");
  });

  test("a child in danger: Hanate does not ask about it, thanks, moves on and shows Childline", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enter(page, baseURL!, "en");
    await page.getByTestId("talk-consent-skip").click();
    const q = page.getByTestId("talk-question");
    await expect(q).toContainText("ನಮಸ್ಕಾರ");
    await answer(page, "ನಾನು ಮೂವತ್ತೆರಡು ವರ್ಷ ಪಾಠ ಮಾಡಿದ್ದೇನೆ.");
    await expect(q).toContainText("ಅಕ್ಷರ ಗುರುತು");
    await answer(page, "ಒಂದು ಮಗು ಹೇಳ್ತು, ಮನೇಲಿ ಅಪ್ಪ ಕುಡಿದು ಬಂದು ದಿನಾ ಹೊಡೀತಾರಂತೆ.");
    // No follow up on it: a thank you and the next topic, with the helpline one tap away.
    await expect(q).toContainText("ಧನ್ಯವಾದ");
    await expect(q).not.toContainText("ಆಮೇಲೆ");
    const care = page.getByTestId("talk-care");
    await expect(care).toContainText("Childline 1098");
    await expect(care.getByRole("link")).toHaveAttribute("href", "tel:1098");
    await shot(page, "390-en-care");

    // Despair in the very last answer: the thank you screen keeps Tele MANAS with the master.
    await page.getByTestId("talk-end").click();
    await expect(q).toContainText("ಒಂದೇ ಒಂದು ವಿಷಯ");
    await answer(page, "I do not want to live like this any more.");
    const done = page.getByTestId("talk-done");
    await expect(done).toBeVisible({ timeout: 15_000 });
    await expect(done.getByTestId("talk-care").getByRole("link")).toHaveAttribute("href", "tel:14416");
    await shot(page, "390-en-done-care");
  });

  test("a reloaded tab offers to continue: turns, skips and the next question come back", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enter(page, baseURL!, "en");
    await page.getByTestId("talk-consent-skip").click();
    const q = page.getByTestId("talk-question");
    await expect(q).toContainText("ನಮಸ್ಕಾರ");
    await answer(page, "ನಾನು ಮೂವತ್ತೆರಡು ವರ್ಷ ಪಾಠ ಮಾಡಿದ್ದೇನೆ.");
    await expect(q).toContainText("ಅಕ್ಷರ ಗುರುತು");
    await answer(page, "ಮರಳು ತಂದು ತಟ್ಟೆಯಲ್ಲಿ ಹಾಕ್ತಿದ್ದೆ, ಮಗು ಬೆರಳಿಂದ ಬರೀತಿತ್ತು.");
    await expect(q).toContainText("ಆಮೇಲೆ ನೀವು ಏನು ಮಾಡಿದಿರಿ?");
    await page.getByRole("button", { name: "Skip question" }).click();
    await expect(q).toContainText("ಆಗ ನೀವು ಆ ಮಗುವಿಗೆ ಏನು ಹೇಳಿದಿರಿ?");

    // The phone locked, the tab reloaded: the talk is offered again, with where it stopped.
    await page.reload();
    const resume = page.getByTestId("talk-resume");
    await expect(resume).toBeVisible();
    await expect(resume).toContainText("Welcome back");
    await expect(page.getByTestId("talk-resume-count")).toContainText("2");
    await expect(page.getByTestId("talk-resume-count")).toContainText("stories so far");
    await expect(page.getByTestId("talk-resume-last")).toContainText("ಆಮೇಲೆ ನೀವು ಏನು ಮಾಡಿದಿರಿ?");
    await shot(page, "resume-390-en");

    // Continuing restores both stories and the skip, so the guide asks the same next question.
    await page.getByTestId("talk-resume-continue").click();
    await expect(q).toContainText("ಆಗ ನೀವು ಆ ಮಗುವಿಗೆ ಏನು ಹೇಳಿದಿರಿ?");
    const chapters = page.getByRole("region", { name: "Your stories" });
    await expect(chapters).toContainText("ಮೂವತ್ತೆರಡು ವರ್ಷ");
    await expect(chapters).toContainText("ಮರಳು ತಂದು ತಟ್ಟೆಯಲ್ಲಿ");
    await shot(page, "resume-continued-390-en");
  });

  test("a new talk can be started instead, and the old one is no longer offered", async ({ page, baseURL }) => {
    await enter(page, baseURL!, "kn");
    await page.getByTestId("talk-consent-skip").click();
    await answer(page, "ನಾನು ಮೂವತ್ತೆರಡು ವರ್ಷ ಪಾಠ ಮಾಡಿದ್ದೇನೆ.");
    await expect(page.getByTestId("talk-question")).toContainText("ಅಕ್ಷರ ಗುರುತು");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId("talk-resume")).toBeVisible();
    await shot(page, "resume-390-kn");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/talk-resume-1280-kn.png` });
    // If the kept talk cannot be read, the page says so kindly and still offers a new talk.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.localStorage.clear());
    await page.getByTestId("talk-resume-continue").click();
    await expect(page.getByTestId("talk-resume").getByRole("alert")).toBeVisible();
    await shot(page, "resume-error-390-kn");
    await page.getByTestId("talk-resume-new").click();
    await expect(page.getByTestId("talk-consent-skip")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("talk-consent-skip")).toBeVisible();
    await expect(page.getByTestId("talk-resume")).toHaveCount(0);
  });

  test("a room without a session never dead ends", async ({ page }) => {
    await page.goto("/m/talk?lang=en");
    await expect(page.getByText("Please come in as a master teacher or a reviewer.").filter({ visible: true })).toBeVisible();
  });

  for (const vp of [
    { name: "390", width: 390, height: 844 },
    { name: "1280", width: 1280, height: 800 },
  ]) {
    for (const lang of ["kn", "en"] as const) {
      test(`screens ${vp.name} ${lang}`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await enter(page, baseURL!, lang);
        // What fits in the window before any scroll: the consent line and the lamp to tap.
        if (vp.name === "1280") {
          await page.waitForTimeout(800);
          await page.screenshot({ path: `${dir}/talk-${vp.name}-${lang}-consent-fold.png` });
        }
        await shot(page, `${vp.name}-${lang}-consent`);
        await page.getByTestId("talk-consent-skip").click();
        await expect(page.getByTestId("talk-question")).toContainText("ನಮಸ್ಕಾರ");
        await answer(page, "ನಾನು ಕುಷ್ಟಗಿ ತಾಲೂಕಿನ ಶಾಲೆಯಲ್ಲಿ ಮೂವತ್ತೆರಡು ವರ್ಷ ಪಾಠ ಮಾಡಿದ್ದೇನೆ.");
        await answer(page, "ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ. ಮರಳಿನ ತಟ್ಟೆಯಲ್ಲಿ ಬೆರಳಿಂದ ಬರೆಸ್ತಿದ್ದೆ.");
        await expect(page.getByTestId("talk-question")).toContainText("ಆಮೇಲೆ");
        await shot(page, `${vp.name}-${lang}-question`);
        // What the master sees on the phone without scrolling: the question and the action bar.
        if (vp.name === "390") await page.screenshot({ path: `${dir}/talk-${vp.name}-${lang}-question-fold.png` });
        await page.getByTestId("talk-end").click();
        await answer(page, "ಮಗುವನ್ನ ಮೊದಲು ಪ್ರೀತಿಸಿ, ಆಮೇಲೆ ಕಲಿಸಿ.");
        await expect(page.getByTestId("talk-done")).toBeVisible({ timeout: 15_000 });
        await shot(page, `${vp.name}-${lang}-done`);
      });
    }
  }
});
