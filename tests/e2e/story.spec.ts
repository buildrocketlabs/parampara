import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// Story clips for the submission video (docs/story/README.md, video/README.md). Each test records
// one clip of the live deployment with the Sample demo accounts, in Kannada, with a small English
// caption bar the test injects (it is not part of the app). Pauses are paced for a viewer.
//
//   PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=story --workers=1
//   STORY_WIDTH=1280 PW_BASE_URL=… pnpm exec playwright test --project=story --workers=1
//
// Phone clips are 390 x 844; STORY_WIDTH=1280 records the same clips at 1280 x 800, named with
// "-1280". Live clips go to video/public/clips/ (git ignored), where the video picks them up.
// Run it on a warm cache (the judge or rehearse project first) so every chip answers from the
// cache. It never makes an invite link, never types a name and never sends a thank you. The
// reviewer clip approves one Sample draft card: run `pnpm seed:library` then `pnpm seed:pulse`
// before recording again, so the drafts come back. Without PW_BASE_URL it is a dry run against the
// local fixture build, and the clips go to coverage/story-dry/ (not committed).

const LIVE = Boolean(process.env.PW_BASE_URL);
const OUT = process.env.STORY_OUT ?? (LIVE ? "video/public/clips" : "coverage/story-dry");
const RAW = "test-results/story-raw";
const DESKTOP = process.env.STORY_WIDTH === "1280";
const PHONE = DESKTOP ? { width: 1280, height: 800 } : { width: 390, height: 844 };
const SUFFIX = DESKTOP ? "-1280" : "";
const MAX_BYTES = 8 * 1024 * 1024;
const BEAT = 1_800;

// Not serial: one clip failing must not stop the others. Run with --workers=1 for steady pacing.
test.describe.configure({ timeout: 300_000 });
test.skip(!LIVE && process.env.STORY_DRY !== "1", "story clips: set PW_BASE_URL (or STORY_DRY=1)");
mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });

type Role = "teacher" | "master" | "reviewer" | "officer";
type State = Awaited<ReturnType<BrowserContext["storageState"]>>;

// ── The caption bar: one English line per beat, on top of the page, outside the app's own DOM ─
const CAPTION_SCRIPT = () => {
  const KEY = "story.caption";
  const paint = () => {
    const text = sessionStorage.getItem(KEY);
    let bar = document.getElementById("story-caption");
    if (!text) {
      bar?.remove();
      return;
    }
    if (!document.body) return;
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "story-caption";
      bar.setAttribute("aria-hidden", "true");
      Object.assign(bar.style, {
        position: "fixed",
        left: "0",
        right: "0",
        top: "0",
        zIndex: "2147483647",
        padding: "7px 14px",
        background: "rgba(21, 48, 42, 0.92)",
        color: "#fffdf8",
        font: "600 14px/1.35 'Plus Jakarta Sans', system-ui, sans-serif",
        textAlign: "center",
        pointerEvents: "none",
      });
    }
    if (bar.textContent !== text) bar.textContent = text;
    // On <html>, not <body>: a transformed body would turn "fixed" into "scrolls away".
    if (bar.parentElement !== document.documentElement) document.documentElement.appendChild(bar);
  };
  (window as unknown as { __storyCaption: (t: string) => void }).__storyCaption = (t: string) => {
    sessionStorage.setItem(KEY, t);
    paint();
  };
  // React may re render the body; keep the bar on top through it and through navigations.
  setInterval(paint, 250);
};

// STORY_CAPTIONS=0 records without the caption bar (the film carries its own subtitles and chips).
const CAPTIONS = process.env.STORY_CAPTIONS !== "0";

async function caption(page: Page, text: string, hold = BEAT) {
  if (!CAPTIONS) {
    await page.waitForTimeout(hold);
    return;
  }
  await page.evaluate((t) => {
    (window as unknown as { __storyCaption?: (t: string) => void }).__storyCaption?.(t);
  }, text);
  await page.waitForTimeout(hold);
}

/** Enters through the role's one tap door in a context that is not recorded. */
async function signIn(browser: Browser, baseURL: string, role: Role): Promise<State> {
  const ctx = await browser.newContext({ baseURL, viewport: PHONE });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.locator(`form[data-door="${role}"] button[type="submit"]`).click();
  await page.waitForURL((u) => u.pathname !== "/", { timeout: 60_000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function recorder(browser: Browser, baseURL: string, state: State) {
  const ctx = await browser.newContext({
    baseURL,
    storageState: state,
    viewport: PHONE,
    deviceScaleFactor: DESKTOP ? 1 : 2,
    isMobile: !DESKTOP,
    hasTouch: !DESKTOP,
    locale: "kn-IN",
    timezoneId: "Asia/Kolkata",
    colorScheme: "light",
    recordVideo: { dir: RAW, size: PHONE },
  });
  await ctx.addInitScript(() => window.localStorage.setItem("parampara.lang", "kn"));
  await ctx.addInitScript(CAPTION_SCRIPT);
  // A step that cannot be found fails the clip in a minute, not at the test's five.
  ctx.setDefaultTimeout(60_000);
  const page = await ctx.newPage();
  return { ctx, page };
}

/** Closes the context (which finishes the video), then keeps it under 8 MB in OUT. */
async function keep(ctx: BrowserContext, page: Page, name: string) {
  const video = page.video();
  await ctx.close();
  if (!video) return;
  const raw = await video.path();
  const out = `${OUT}/${name}${SUFFIX}.webm`;
  rmSync(out, { force: true });
  renameSync(raw, out);
  if (statSync(out).size > MAX_BYTES) shrink(out);
}

/** Fewer frames and a little less quality, until the clip is under the limit (needs ffmpeg). */
function shrink(file: string) {
  for (const [fps, crf] of [
    [15, 38],
    [12, 44],
    [10, 50],
  ] as const) {
    const tmp = file.replace(/\.webm$/, ".small.webm");
    const r = spawnSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      file,
      "-r",
      String(fps),
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "0",
      "-crf",
      String(crf),
      "-an",
      tmp,
    ]);
    if (r.status !== 0 || !existsSync(tmp)) return;
    renameSync(tmp, file);
    if (statSync(file).size <= MAX_BYTES) return;
  }
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
  await page.evaluate(() => document.fonts.ready);
}

/** A slow, readable scroll (a viewer follows the steps). */
async function glide(page: Page, px: number, steps = 6) {
  // The wheel scrolls what is under the pointer: the middle of the screen, not its corner.
  await page.mouse.move(PHONE.width / 2, PHONE.height / 2);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, px / steps);
    await page.waitForTimeout(260);
  }
}

/** The first visible match (bilingual text renders twice and CSS hides one), optionally by text. */
const seen = (page: Page, selector: string, text?: string | RegExp) =>
  (text ? page.locator(selector).filter({ hasText: text }) : page.locator(selector))
    .filter({ visible: true })
    .first();

// The demo teacher's question for the film: it reaches Mahesh Bedavatti's approved field card
// "From lines and circles to writing letters" (the Sample pool is "all", lib/ask/pipeline.ts), so
// the answer credits him and plays his own voice, while the question and answer stay Sample rows
// (no field data is made; master impact joins only rows of the same Sample flag, 0005).
const HIS_QUESTION = "ಒಂದನೇ ತರಗತಿಯ ಒಂದು ಮಗುವಿಗೆ ಇನ್ನೂ ಅಕ್ಷರ ಬರೆಯಲು ಬರುತ್ತಿಲ್ಲ. ಗೆರೆ, ವೃತ್ತದಿಂದ ಹೇಗೆ ಶುರು ಮಾಡಲಿ?";
const HIS_QUESTION_HI =
  "कक्षा 1 का एक बच्चा अभी भी अक्षर नहीं लिख पाता। रेखाओं और गोलों से कैसे शुरू करूँ?";
/** His approved field card, for the field reviewer clip. */
const HIS_CARD = "082659f7-5fde-4e87-b2fe-e3dd867bc460";

/** Types a question on /t/ask and sends it (the page is already there). */
async function typeQuestion(page: Page, text: string) {
  await seen(page, "button", "ಬರೆದು ಕೇಳಿ").click();
  await seen(page, "textarea").fill(text);
  await page.waitForTimeout(900);
  await seen(page, 'main button[type="submit"]').click();
}

/** Asks his question in a context that is not recorded, and returns the answer's path. */
async function answerPath(
  browser: Browser,
  baseURL: string,
  state: State,
  question = HIS_QUESTION,
): Promise<string> {
  const ctx = await browser.newContext({ baseURL, storageState: state, viewport: PHONE });
  const page = await ctx.newPage();
  await page.goto("/t/ask");
  await typeQuestion(page, question);
  await page.waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 150_000 });
  const path = new URL(page.url()).pathname;
  await ctx.close();
  return path;
}

test.describe("story clips", () => {
  test("1 teacher asks: her question, his answer, his voice, the trace", async ({
    browser,
    baseURL,
  }) => {
    test.skip(!LIVE, "needs live answers (the fixture build has none to give)");
    const state = await signIn(browser, baseURL!, "teacher");
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto("/t");
    await settle(page);
    await caption(page, "9 pm. A teacher opens Parampara (Sample account)", 2_200);
    await page.goto("/t/ask");
    await settle(page);
    await caption(page, "She asks, in Kannada, about a child who cannot yet write letters", 900);
    await typeQuestion(page, HIS_QUESTION);
    await caption(page, "Parampara looks only in practice approved from master teachers", 600);
    await page.waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 150_000 });
    await settle(page);
    await caption(page, "A Kannada answer: steps for tomorrow, and whose method it is", 2_200);
    await glide(page, 520);
    await caption(page, "Every step comes from a master teacher's card");
    // The master's own voice shows only when the lead card's master made it public; the letters
    // answer can lead with a master who did not, and then this beat is left out.
    const hear = seen(page, "button[aria-pressed]", /ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ/);
    const hasVoice = (await hear.count()) > 0;
    if (hasVoice) {
      await hear.scrollIntoViewIfNeeded();
      await caption(page, "Hear the master say it, from the recording", 900);
      await hear.click();
      await page.waitForTimeout(2_000);
    }
    // A Sample card made without audio says so; the caption never claims a voice that is not there.
    if (!hasVoice) {
      await page.waitForTimeout(1_500);
    } else if (
      await seen(page, "body")
        .getByText("ಈ ಭಾಗದ ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ")
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await caption(page, "This Sample card has no recording, so his words are shown", 2_200);
    } else {
      await page.waitForTimeout(2_500);
    }
    await glide(page, -900, 5);
    const how = seen(page, "button", "ಈ ಉತ್ತರ ಹೇಗೆ ತಯಾರಾಯಿತು");
    await how.scrollIntoViewIfNeeded();
    await caption(page, "How this answer was made: every step checked against its card", 900);
    await how.click();
    await page.waitForTimeout(1_200);
    await glide(page, 500);
    await page.waitForTimeout(2_000);
    await keep(ctx, page, "1-teacher-asks");
  });

  test("2 it worked: the next day, worked, the celebration", async ({ browser, baseURL }) => {
    test.skip(!LIVE, "needs a live answer to report on");
    const state = await signIn(browser, baseURL!, "teacher");
    const answer = await answerPath(browser, baseURL!, state);
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto(answer.replace("/t/a/", "/t/tried/"));
    await settle(page);
    await caption(page, "Next day: did yesterday's idea work?", 2_200);
    await caption(page, "One tap. No forms, no marks, nobody watching", 1_600);
    await seen(page, "button", "ಫಲ ಕೊಟ್ಟಿತು").click();
    await caption(page, "It worked: she lights a lamp", 4_000);
    // The thanks screen names the master (Mahesh, 32 years, Koppal). Nothing is sent from here.
    const thanks = page.locator("#thanks-title");
    await thanks.scrollIntoViewIfNeeded().catch(() => undefined);
    await caption(page, "His thirty two years hear that it helped", 3_600);
    await keep(ctx, page, "2-it-worked");
  });

  test("3 master: his room, then Hanate's first question", async ({ browser, baseURL }) => {
    const state = await signIn(browser, baseURL!, "master");
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto("/m");
    await settle(page);
    await caption(page, "A retired master teacher's room (Sample)", 2_200);
    await glide(page, 420);
    await caption(page, "What his practice did, counted from the database, never who", 2_200);
    await glide(page, -420, 3);
    await caption(page, "He tells Hanate a new story, in Kannada", 900);
    await seen(page, "a", "ಹೊಸ ಕಥೆ ಹೇಳಿ").click();
    await page.waitForURL(/\/m\/talk/);
    await settle(page);
    const resume = page.getByTestId("talk-resume");
    const question = page.getByTestId("talk-question");
    if (await resume.isVisible().catch(() => false)) {
      await caption(page, "Hanate remembers where they stopped");
      await page.getByTestId("talk-resume-continue").click();
    } else {
      // His consent is already on record (the Sample master consented), so nothing is recorded.
      await caption(page, "No story is recorded without his consent; his is on record");
      await seen(
        page,
        "button",
        /ಒಪ್ಪಿಗೆ ಹಿಂದೆಯೇ ರೆಕಾರ್ಡ್ ಆಗಿದೆ|ಮಾದರಿ ಮೋಡ್: ರೆಕಾರ್ಡ್ ಮಾಡದೆ/,
      ).click();
    }
    await expect(question).toBeVisible({ timeout: 90_000 });
    await question.scrollIntoViewIfNeeded();
    await caption(page, "One question at a time, about a real classroom problem", 3_000);
    await keep(ctx, page, "3-master-talk");
  });

  test("4 reviewer: a card, the moment it cites, approve", async ({ browser, baseURL }) => {
    test.skip(!LIVE, "the fixture build has no draft cards to review");
    const state = await signIn(browser, baseURL!, "reviewer");
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto("/r/cards");
    await settle(page);
    await caption(page, "A reviewer checks every card before any teacher sees it", 2_200);
    const first = seen(page, 'a[href^="/r/cards/"]');
    await expect(first).toBeVisible({ timeout: 30_000 });
    await first.click();
    await page.waitForURL(/\/r\/cards\/[^/]+$/);
    await settle(page);
    await caption(page, "Problem, steps, materials: drawn from the master's own words", 2_000);
    const moment = seen(page, "button", /^\d+:\d{2}$/);
    await moment.scrollIntoViewIfNeeded();
    await caption(page, "Each step cites the moment in the recording", 900);
    await moment.click();
    await page.waitForTimeout(2_500);
    const approve = seen(page, "button", "ಒಪ್ಪಿಗೆ ಕೊಡಿ");
    if (await approve.isVisible().catch(() => false)) {
      await approve.scrollIntoViewIfNeeded();
      await caption(page, "Approved: now it can reach teachers", 600);
      await approve.click();
      await page.waitForTimeout(3_000);
    } else {
      await caption(page, "This card is already approved", 2_000);
    }
    await keep(ctx, page, "4-reviewer-approves");
  });

  test("5 officer: the week's Pulse, then the Lamps of Karnataka", async ({ browser, baseURL }) => {
    const state = await signIn(browser, baseURL!, "officer");
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto("/i?data=sample");
    await settle(page);
    await caption(page, "A district officer's week: what teachers asked, what worked", 2_400);
    await glide(page, 700, 8);
    await caption(page, "Any number about fewer than 5 teachers stays private", 2_200);
    await glide(page, 700, 8);
    await caption(page, "No teacher is ever named or ranked", 1_600);
    await page.goto("/i/lamps?data=sample");
    await settle(page);
    await caption(page, "Lamps of Karnataka: where a master's practice worked", 2_600);
    const koppal = page.locator('[data-district="koppal"]');
    await koppal.scrollIntoViewIfNeeded();
    await koppal.click();
    await caption(page, "Koppal: whose practice helped there", 3_200);
    await keep(ctx, page, "5-officer-pulse-lamps");
  });

  test("6 show me: a photo of a slate goes with the question", async ({ browser, baseURL }) => {
    test.skip(
      !LIVE || process.env.STORY_SHOW_ME !== "1",
      "a live photo read costs a model call: set STORY_SHOW_ME=1 once the sample slate is in",
    );
    const slate = readFileSync("evals/images/photo-01-slate-ba-da.png");
    const state = await signIn(browser, baseURL!, "teacher");
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto("/t/ask");
    await settle(page);
    await caption(page, "Show me: a photo of the child's slate, never a face", 1_400);
    await seen(page, '[data-testid="show-me-open"]').click();
    await page.waitForTimeout(1_200);
    await seen(page, '[data-testid="show-me"]')
      .locator('[data-testid="photo-gallery"]')
      .setInputFiles({ name: "slate.png", mimeType: "image/png", buffer: slate });
    await expect(seen(page, '[data-testid="photo-preview"]')).toBeVisible();
    await caption(page, "She ticks: no faces in this photo", 900);
    await seen(page, '[data-testid="no-faces-tick"]').click();
    await seen(page, '[data-testid="photo-use"]').click();
    await seen(page, "button", "ಬರೆದು ಕೇಳಿ").click();
    await seen(page, "textarea").fill("ಒಂದು ಮಗು ಬ ಮತ್ತು ದ ಅದಲು ಬದಲು ಬರೆಯುತ್ತದೆ.");
    await caption(page, "The photo goes with her question, and is not kept", 900);
    await seen(page, 'main button[type="submit"]').click();
    await expect(seen(page, '[data-testid="photo-seen"]')).toBeVisible({ timeout: 120_000 });
    await caption(page, "What the slate shows joins her question", 2_400);
    await page.waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 150_000 }).catch(() => undefined);
    await settle(page);
    await caption(page, "An answer for this child's slate", 2_400);
    await keep(ctx, page, "6-show-me");
  });

  test("7 offline: a saved answer opens, a question waits on the phone", async ({
    browser,
    baseURL,
  }) => {
    test.skip(!LIVE, "needs a live answer to save");
    const state = await signIn(browser, baseURL!, "teacher");
    const answer = await answerPath(browser, baseURL!, state);
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto(answer);
    await settle(page);
    await caption(page, "She saves an answer to keep", 900);
    const save = seen(page, "button[aria-pressed]", "ಉಳಿಸಿ");
    await save.scrollIntoViewIfNeeded();
    await save.click();
    await page.waitForTimeout(1_000);
    await page.goto("/t/saved");
    await settle(page);
    await expect(seen(page, "body").getByText("ಆಫ್‌ಲೈನ್‌ಗೆ ಸಿದ್ಧ").first()).toBeVisible({
      timeout: 30_000,
    });
    await caption(page, "Saved, and ready offline", 1_600);
    // Home is loaded while online; the question is typed after the network goes (as in pwa.shots).
    await page.goto("/t");
    await settle(page);
    await page.waitForLoadState("networkidle");
    await ctx.setOffline(true);
    await caption(page, "No network in the village", 1_400);
    await caption(page, "She asks anyway", 600);
    await seen(page, "button", "ಬರೆದು ಕೇಳಿ").click();
    await seen(page, "textarea").fill(
      "ಮಕ್ಕಳು ಬಾಯಿಪಾಠ ಎಣಿಸ್ತಾರೆ, ಆದ್ರೆ ಹದಿನಾಲ್ಕು ಅಂದ್ರೆ ಎಷ್ಟು ಅಂತ ಗೊತ್ತಿಲ್ಲ.",
    );
    await page.waitForTimeout(800);
    // By its name: the button's text also holds the hidden English, so a text match never fits.
    await page
      .getByRole("button", { name: "ಕೇಳಿ", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await expect(seen(page, "body").getByText("ಪ್ರಶ್ನೆ ಉಳಿಸಿದ್ದೇನೆ").first()).toBeVisible();
    await caption(page, "It waits on the phone and goes when the network returns", 2_600);
    await page.goto("/t/saved");
    await settle(page);
    await seen(page, 'a[href^="/t/a/"]').click();
    await settle(page);
    await caption(page, "Yesterday's saved answer still opens", 2_600);
    // Closed while still offline: the queued question goes nowhere (the clip asks nothing live).
    await keep(ctx, page, "7-offline");
  });

  // ── Single beat clips for the video's cuts (video/script.json): one idea each, nothing else ──

  test("8 master impact: his lamp has lit teachers", async ({ browser, baseURL }) => {
    const state = await signIn(browser, baseURL!, "master");
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto("/m");
    await settle(page);
    await caption(page, "The master's room (Sample)", 1_600);
    await page.locator("#m-impact").scrollIntoViewIfNeeded();
    await caption(page, "How many teachers his practice reached, counted from the database", 3_000);
    await caption(page, "He hears that it helped, never who asked", 2_400);
    await keep(ctx, page, "8-master-impact");
  });

  test("9 officer pulse: this week, anonymous", async ({ browser, baseURL }) => {
    const state = await signIn(browser, baseURL!, "officer");
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto("/i?data=sample");
    await settle(page);
    await caption(page, "Teacher Pulse: what teachers asked this week (Sample)", 2_600);
    await glide(page, 600, 8);
    await caption(page, "What worked, and what to record next", 2_200);
    await glide(page, 600, 8);
    await caption(page, "Fewer than 5 teachers? The number stays private", 2_400);
    await keep(ctx, page, "9-officer-pulse");
  });

  test("10 lamps of Karnataka: where a practice worked", async ({ browser, baseURL }) => {
    const state = await signIn(browser, baseURL!, "officer");
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto("/i/lamps?data=sample");
    await settle(page);
    await caption(page, "Lamps of Karnataka (Sample)", 2_400);
    const koppal = page.locator('[data-district="koppal"]');
    await koppal.scrollIntoViewIfNeeded();
    await koppal.click();
    await caption(page, "Koppal: whose practice helped there", 3_400);
    await keep(ctx, page, "10-lamps");
  });

  test("11 trace drawer: how this answer was made", async ({ browser, baseURL }) => {
    test.skip(!LIVE, "needs a live answer to trace");
    const state = await signIn(browser, baseURL!, "teacher");
    // A new wording of his question, so this answer is made fresh and its trace shows every
    // stage and every step's verdict, not "answered before" (one model call, Sample rows).
    const answer = await answerPath(browser, baseURL!, state, `${HIS_QUESTION} ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಏನು ಮಾಡಲಿ?`);
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto(answer);
    await settle(page);
    const how = seen(page, "button", "ಈ ಉತ್ತರ ಹೇಗೆ ತಯಾರಾಯಿತು");
    await how.scrollIntoViewIfNeeded();
    await caption(page, "Every answer can show how it was made", 1_200);
    await how.click();
    await page.waitForTimeout(1_200);
    await caption(page, "What she asked, the cards found, the draft", 2_200);
    await glide(page, 500, 8);
    await caption(page, "Each step checked against its card by a second model", 2_600);
    await glide(page, 500, 8);
    await caption(page, "The safety check, the model, the time and the cost", 2_600);
    await keep(ctx, page, "11-trace-drawer");
  });

  test("12 his cards: the field reviewer opens his approved card and its moments", async ({
    browser,
    baseURL,
  }) => {
    // His interview is field data, which the Sample reviewer cannot open (lib/review/store.ts).
    // The founder signs in once with his own reviewer link and saves the session, never printed:
    //   pnpm exec playwright codegen --save-storage=field-private/reviewer-state.json <site>
    const file = process.env.STORY_REVIEWER_STATE;
    test.skip(!LIVE || !file || !existsSync(file), "set STORY_REVIEWER_STATE to a field reviewer's saved session");
    const state = JSON.parse(readFileSync(file!, "utf8")) as State;
    const { ctx, page } = await recorder(browser, baseURL!, state);
    await page.goto(`/r/cards/${HIS_CARD}`);
    await settle(page);
    await caption(page, "His seven WhatsApp voice notes became six practice cards", 2_400);
    await glide(page, 360);
    const moment = seen(page, "button", /^\d+:\d{2}$/);
    await moment.scrollIntoViewIfNeeded();
    await caption(page, "Every step cites the second he said it", 900);
    await moment.click();
    await page.waitForTimeout(3_200);
    await glide(page, 420);
    await page.waitForTimeout(1_200);
    // The second half is the check scene: the same card, approved, at the bottom of the page.
    await glide(page, 1600, 10);
    await caption(page, "A headmaster checks every card. Nothing reaches a teacher unchecked", 4_000);
    await keep(ctx, page, "12-master-cards");
  });

  test("13 hindi: the same card, answered in Hindi, still in his name", async ({
    browser,
    baseURL,
  }) => {
    test.skip(!LIVE, "needs a live answer");
    const state = await signIn(browser, baseURL!, "teacher");
    // The demo teacher is shared with judges: Hindi is set in a context that is not recorded and
    // set back to Kannada afterwards, whatever happens in between.
    const setLang = async (lang: "hi" | "kn") => {
      const ctx = await browser.newContext({ baseURL, storageState: state, viewport: PHONE });
      const page = await ctx.newPage();
      await page.goto("/welcome/language");
      await page.locator(`button[name="lang"][value="${lang}"]`).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/welcome"), { timeout: 60_000 });
      await ctx.close();
    };
    await setLang("hi");
    try {
      const { ctx, page } = await recorder(browser, baseURL!, state);
      await page.goto("/t/ask");
      await settle(page);
      await caption(page, "A teacher who chose Hindi answers asks the same thing", 900);
      await typeQuestion(page, HIS_QUESTION_HI);
      await page.waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 150_000 });
      await settle(page);
      await caption(page, "The same card, in Hindi, still in his name", 2_600);
      await glide(page, 520);
      await page.waitForTimeout(2_200);
      await keep(ctx, page, "13-hindi-answer");
    } finally {
      await setLang("kn");
    }
  });
});
