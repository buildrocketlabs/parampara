import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

// The Talakal field path in fixture mode (no keys): one QR for many teachers (D80), first run in
// one tap (D83), field chips never Sample (D64), feedback under every answer (D82), and a waiting
// question answered from the reviewer queue. Screenshots to docs/demos/F-A2/.
const dir = "docs/demos/F-A2";
mkdirSync(dir, { recursive: true });
const port = process.env.PW_PORT ?? "3123";
const origin = `http://localhost:${port}`;

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
  await page.waitForTimeout(450); // entrance animations settle
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}

for (const lang of ["kn", "en"] as const) {
  test(`the group QR page, ${lang}`, async ({ page, context }) => {
    await as(context, "reviewer");
    await phone(page, lang);
    await open(page, "/r/invites/qr/SAMPLE-G1");
    const qr = page.getByTestId("group-qr");
    await expect(qr).toBeVisible();
    await expect(qr.locator("svg[data-qr-link]")).toHaveAttribute(
      "data-qr-link",
      /\/join\/SAMPLE-G1$/,
    );
    await expect(qr.getByText("ಕ್ಯಾಮೆರಾದಿಂದ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ")).toBeVisible();
    await expect(qr.getByText("Scan with your camera")).toBeVisible();
    await expect(seen(page.getByTestId("qr-left"))).toContainText(
      lang === "kn" ? "15" : "of 15 places left",
    );
    await shot(page, `qr-390-${lang}`);
  });

  test(`a full and an expired group say so kindly, ${lang}`, async ({ page }) => {
    await phone(page, lang);
    await open(page, "/join/SAMPLE-G0");
    await expect(page.getByTestId("group-full")).toBeVisible();
    await expect(
      seen(page.getByText(lang === "kn" ? /ಮುಖ್ಯ ಶಿಕ್ಷಕರನ್ನು/ : /ask your headmaster/)),
    ).toBeVisible();
    await shot(page, `join-full-390-${lang}`);
    await open(page, "/join/SAMPLE-GE");
    await expect(page.getByTestId("group-expired")).toBeVisible();
    await shot(page, `join-expired-390-${lang}`);
  });

  test(`first run: scan, agree, ask, ${lang}`, async ({ page }) => {
    await phone(page, lang);
    await open(page, "/join/SAMPLE-G1");
    await expect(page.getByTestId("group-welcome")).toBeVisible();
    await shot(page, `first-run-1-scan-390-${lang}`);
    await page.getByTestId("group-agree").click();
    // One tap: no Begin, no separate consent page, no language step.
    await expect(page).toHaveURL(/\/t$/);
    await expect(page.locator("button[data-state][aria-pressed]").first()).toBeVisible();
    await shot(page, `first-run-2-ask-390-${lang}`);
  });

  test(`feedback right under an answer, ${lang}`, async ({ page, context }) => {
    await as(context, "teacher");
    await phone(page, lang);
    await open(page, "/t/a/00000000-0000-4000-8000-0000000a0001");
    const invite = page.getByTestId("answer-feedback");
    await invite.scrollIntoViewIfNeeded();
    await expect(invite).toBeVisible();
    // The whole answer, so the row is seen where it sits: right under the card.
    await page.waitForTimeout(1500);
    await shot(page, `feedback-1-under-answer-390-${lang}`, true);
    await invite.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("answer-feedback-mic")).toBeVisible();
    // Quoting is off until she ticks it.
    await expect(sheet.getByTestId("answer-feedback-quote")).not.toBeChecked();
    await sheet
      .locator("#answer-feedback-text")
      .fill(
        lang === "kn"
          ? "ಹಂತಗಳು ಸ್ಪಷ್ಟವಾಗಿದ್ದವು. ನಾಳೆ ಮಾಡಿ ನೋಡುತ್ತೇನೆ."
          : "The steps were clear. I will try it tomorrow.",
      );
    await sheet.getByTestId("answer-feedback-quote").check();
    await shot(page, `feedback-2-sheet-390-${lang}`);
    await sheet.getByRole("button", { name: lang === "kn" ? /ಕಳುಹಿಸಿ/ : /^Send$/ }).click();
    await expect(sheet.getByTestId("answer-feedback-sent")).toBeVisible();
    await shot(page, `feedback-3-sent-390-${lang}`);
  });
}

test("the group QR page on a laptop", async ({ page, context }) => {
  await as(context, "reviewer");
  await phone(page, "kn", 1280, 800);
  await open(page, "/r/invites/qr/SAMPLE-G1");
  await expect(page.getByTestId("group-qr")).toBeVisible();
  await shot(page, "qr-1280-kn");
});

test("the invite list links a group to its QR", async ({ page, context }) => {
  await as(context, "reviewer");
  await phone(page, "en");
  await open(page, "/r/invites");
  const row = page.locator('li[data-invite="SAMPLE-G1"]');
  await expect(row).toBeVisible();
  await expect(row.locator('a[data-share="whatsapp"]')).toHaveCount(0); // shown, never forwarded
  await row.getByTestId("show-qr").click();
  await expect(page).toHaveURL(/\/r\/invites\/qr\/SAMPLE-G1$/);
});

test("a field teacher never meets a Sample chip, and a second scan lands in her own account", async ({
  page,
  context,
}) => {
  await phone(page, "en");
  await open(page, "/join/TEST-FIELD-G1");
  await page.getByTestId("group-agree").click();
  await expect(page).toHaveURL(/\/t$/);
  await expect(page.locator('[data-testid^="sample-"]')).toHaveCount(0);
  await expect(page.getByTestId("field-chips-none")).toBeVisible();
  await shot(page, "field-teacher-ask-390-en");
  await open(page, "/t/ask");
  await expect(page.locator('[data-testid^="sample-"]')).toHaveCount(0);
  await expect(page.getByTestId("field-chips-none")).toBeVisible();

  // Scanning again while signed in: straight back, no second place taken.
  const mine = (await context.cookies()).find((c) => c.name === "pp_fixture_invite")?.value;
  expect(mine).toBeTruthy();
  await page.goto("/join/TEST-FIELD-G1");
  await expect(page).toHaveURL(/\/t$/);
  expect((await context.cookies()).find((c) => c.name === "pp_fixture_invite")?.value).toBe(mine);

  // Session gone (signed out), phone still remembers: Welcome back, one tap, the same account.
  await context.clearCookies({ name: "pp_fixture_role" });
  await context.clearCookies({ name: "pp_fixture_invite" });
  await open(page, "/join/TEST-FIELD-G1");
  await expect(page.getByTestId("group-returning")).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page).toHaveURL(/\/t$/);
  expect((await context.cookies()).find((c) => c.name === "pp_fixture_invite")?.value).toBe(mine);
});

test("a reviewer answers a waiting question with a card", async ({ page, context }) => {
  await as(context, "reviewer");
  await phone(page, "en");
  await open(page, "/r/queue");
  const row = page.locator('[data-queue-row="no_card"]').first();
  await row.getByTestId("answer-with-card").locator("summary").click();
  await expect(row.locator('select[name="card"] option')).toHaveCount(1);
  await row.getByRole("button", { name: /Send this card/ }).scrollIntoViewIfNeeded();
  await shot(page, "queue-answer-with-card-390-en");
  await row.getByRole("button", { name: /Send this card/ }).click();
  await expect(page).toHaveURL(/sent=/);
  await expect(
    seen(page.getByText("Card sent. The teacher finds it among her answers.")),
  ).toBeVisible();
});

test("first run timing on a throttled phone", async ({ page }) => {
  // DevTools "Slow 4G" (formerly Fast 3G) and a 4x slower CPU: a cautious stand in for a mid
  // range Android on rural 4G. Excludes reading the consent, which is hers to take.
  await phone(page, "kn");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150 * 3.75,
    downloadThroughput: ((1.6 * 1000 * 1000) / 8) * 0.9,
    uploadThroughput: ((750 * 1000) / 8) * 0.9,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const t0 = Date.now();
  await page.goto("/join/SAMPLE-G1");
  const agree = page.getByTestId("group-agree");
  await expect(agree).toBeVisible({ timeout: 30_000 });
  const scanToConsent = Date.now() - t0;
  const t1 = Date.now();
  await agree.click();
  await expect(page).toHaveURL(/\/t$/, { timeout: 30_000 });
  await expect(page.locator("button[data-state][aria-pressed]").first()).toBeVisible({
    timeout: 30_000,
  });
  const agreeToMic = Date.now() - t1;
  writeFileSync(
    `${dir}/first-run-timing.json`,
    JSON.stringify(
      {
        measured: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
        build: "fixture (no keys; live adds about 1 s of Supabase sign in)",
        network: "DevTools Slow 4G (Fast 3G numbers), CPU 4x slower",
        taps: 1,
        scanToConsentMs: scanToConsent,
        agreeToMicMs: agreeToMic,
      },
      null,
      2,
    ) + "\n",
  );
});
