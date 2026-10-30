// Fresh screenshots of the live app for the deck (slides 04, 06, 08). Sample demo accounts only,
// through the one tap doors; nothing is sent, invited or approved. His question replays its checked
// answer from the cache (no model call). Output: deck/assets/shots/ (PNG, 2x for phones).
//
//   node deck/scripts/shots.mjs [https://parampara-eta.vercel.app]

import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "https://parampara-eta.vercel.app";
const OUT = new URL("../assets/shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1280, height: 800 };
const ONLY = process.env.ONLY; // "trace" re-shoots the trace drawer alone
// The film's question: it reaches Mahesh Bedavatti's approved field card (tests/e2e/story.spec.ts).
const HIS_QUESTION =
  "ಒಂದನೇ ತರಗತಿಯ ಒಂದು ಮಗುವಿಗೆ ಇನ್ನೂ ಅಕ್ಷರ ಬರೆಯಲು ಬರುತ್ತಿಲ್ಲ. ಗೆರೆ, ವೃತ್ತದಿಂದ ಹೇಗೆ ಶುರು ಮಾಡಲಿ?";

const browser = await chromium.launch();

async function context(viewport, lang, state) {
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport,
    storageState: state,
    deviceScaleFactor: 2,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
    locale: lang === "kn" ? "kn-IN" : "en-IN",
    timezoneId: "Asia/Kolkata",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await ctx.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
  ctx.setDefaultTimeout(60_000);
  return ctx;
}

async function signIn(role) {
  const ctx = await context(PHONE, "kn");
  const page = await ctx.newPage();
  await page.goto("/");
  await page.locator(`form[data-door="${role}"] button[type="submit"]`).click();
  await page.waitForURL((u) => u.pathname !== "/", { timeout: 60_000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
  await page.evaluate(() => document.fonts.ready);
  // The floating "tell us about this page" button is for testers, not part of the product's look.
  await page
    .addStyleTag({ content: "[data-feedback-tab]{display:none!important}" })
    .catch(() => {});
  await page.waitForTimeout(900);
}

const seen = (page, selector, text) =>
  (text ? page.locator(selector).filter({ hasText: text }) : page.locator(selector))
    .filter({ visible: true })
    .first();

async function shot(page, name, opts = {}) {
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log("shot", name);
}

const teacher = await signIn("teacher");

// ── 04: ask by voice, the answer credited to him, his own voice ───────────────────────────────
if (!ONLY) {
  const ctx = await context(PHONE, "kn", teacher);
  const page = await ctx.newPage();
  await page.goto("/t/ask");
  await settle(page);
  await shot(page, "04-ask");
  await seen(page, "button", "ಬರೆದು ಕೇಳಿ").click();
  await seen(page, "textarea").fill(HIS_QUESTION);
  await page.waitForTimeout(600);
  await shot(page, "04-ask-typed");
  await seen(page, 'main button[type="submit"]').click();
  await page.waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 150_000 });
  await settle(page);
  await page.waitForTimeout(2_500);
  console.log("answer", page.url());
  await shot(page, "04-answer");
  await shot(page, "04-answer-full", { fullPage: true });
  const hear = seen(page, "button[aria-pressed]", /ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ/);
  if ((await hear.count()) > 0) {
    await hear.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 220));
    await hear.click();
    await page.waitForTimeout(2_200);
    await shot(page, "04-hear");
  } else console.log("no voice button on this answer");
  // Save it, for the offline shot.
  const save = seen(page, "button[aria-pressed]", "ಉಳಿಸಿ");
  await save.scrollIntoViewIfNeeded();
  if ((await save.getAttribute("aria-pressed")) !== "true") await save.click();
  await page.waitForTimeout(1_200);

  // ── 08: offline. Saved and ready, then a question that waits on the phone ───────────────────
  await page.goto("/t/saved");
  await settle(page);
  await seen(page, "body").getByText("ಆಫ್‌ಲೈನ್‌ಗೆ ಸಿದ್ಧ").first().waitFor({ timeout: 30_000 });
  await page.goto("/t");
  await settle(page);
  await page.waitForLoadState("networkidle");
  await ctx.setOffline(true);
  await page.waitForTimeout(1_500);
  await shot(page, "08-offline-home");
  await seen(page, "button", "ಬರೆದು ಕೇಳಿ").click();
  await seen(page, "textarea").fill(
    "ಮಕ್ಕಳು ಬಾಯಿಪಾಠ ಎಣಿಸ್ತಾರೆ, ಆದ್ರೆ ಹದಿನಾಲ್ಕು ಅಂದ್ರೆ ಎಷ್ಟು ಅಂತ ಗೊತ್ತಿಲ್ಲ.",
  );
  await page.waitForTimeout(600);
  await page
    .getByRole("button", { name: "ಕೇಳಿ", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await seen(page, "body").getByText("ಪ್ರಶ್ನೆ ಉಳಿಸಿದ್ದೇನೆ").first().waitFor();
  await page.waitForTimeout(800);
  await shot(page, "08-offline-queued");
  await page.goto("/t/saved");
  await settle(page);
  await shot(page, "08-offline-saved");
  // Closed while offline: the queued question goes nowhere.
  await ctx.close();
}

// ── 06: how an answer was made, on a laptop, in English ───────────────────────────────────────
if (!ONLY) {
  const ctx = await context(LAPTOP, "en");
  const page = await ctx.newPage();
  await page.goto("/how?lang=en");
  await settle(page);
  for (const id of ["layers", "evals", "trace", "offline"]) {
    const section = page.locator(`section:has(> h2#${id})`).first();
    if ((await section.count()) === 0) continue;
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await section.screenshot({ path: `${OUT}06-how-${id}.png` });
    console.log("shot", `06-how-${id}`);
  }
  await shot(page, "06-how-full", { fullPage: true });
  await ctx.close();
}

// ── 06: the trace drawer on his answer, at 1280 wide and tall enough to hold the whole drawer ──
{
  const ctx = await context({ width: 1280, height: 2600 }, "en", teacher);
  const page = await ctx.newPage();
  await page.goto("/t/ask?lang=en");
  await settle(page);
  await seen(page, "button", /Type to ask|ಬರೆದು ಕೇಳಿ/).click();
  await seen(page, "textarea").fill(HIS_QUESTION);
  await seen(page, 'main button[type="submit"]').click();
  await page.waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 150_000 });
  await settle(page);
  await page.waitForTimeout(2_000);
  const how = seen(page, "button", /How this answer was made|ಈ ಉತ್ತರ ಹೇಗೆ ತಯಾರಾಯಿತು/);
  await how.scrollIntoViewIfNeeded();
  await how.click();
  await page.waitForTimeout(2_000);
  const drawer = page.getByRole("dialog").filter({ visible: true }).first();
  await drawer.screenshot({ path: `${OUT}06-trace-drawer.png` });
  console.log("shot 06-trace-drawer");
  await ctx.close();
}

await browser.close();
