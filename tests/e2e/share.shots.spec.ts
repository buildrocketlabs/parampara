import { mkdirSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Share a Tomorrow card (the teacher's answer footer, the reviewer's approved card) in fixture
// mode, on the gallery's answer demo, which renders the same footer on the Sample library's tens
// and ones card. The browser's share sheet, WhatsApp and downloads are stood in for, so each path
// and each honest state can be seen. Also: the offline banner settles into a pill. Screenshots to
// docs/demos/M5/share-*.
// Run: PW_PORT=3181 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/share.shots.spec.ts --project=shots
const dir = "docs/demos/M5";
mkdirSync(dir, { recursive: true });

const port = process.env.PW_PORT ?? "3123";
const CARD = "sample-card-02";

async function open(context: BrowserContext, page: Page, lang: "kn" | "en", role = "teacher") {
  await context.addCookies([
    { name: "pp_fixture_role", value: role, url: `http://localhost:${port}` },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
}

/** The phone's share sheet, accepting files; what it was given is kept on window. */
async function withShareSheet(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared?: unknown };
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: { text?: string; title?: string; files?: File[] }) => {
        w.__shared = {
          text: data.text,
          title: data.title,
          files: (data.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })),
        };
      },
    });
  });
}

/** A browser with no file sharing; window.open is recorded (and can be "blocked"). */
async function withoutShareSheet(page: Page, popupBlocked = false) {
  await page.addInitScript((blocked) => {
    const w = window as unknown as { __opened?: string };
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
    window.open = ((url?: string | URL) => {
      w.__opened = String(url);
      return blocked ? null : ({ opener: {} } as unknown as Window);
    }) as typeof window.open;
  }, popupBlocked);
}

const card = (page: Page) => page.locator(`[data-share-card="${CARD}"]`);
const state = (page: Page) => card(page).locator("[data-share-state]");

async function toCard(page: Page) {
  await page.goto("/design#answer");
  await card(page).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

async function shot(page: Page, name: string) {
  await card(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${name}.png` });
}

test("the share sheet gets the picture itself and the Kannada words, Sample kept", async ({
  page,
  context,
}) => {
  await open(context, page, "kn");
  await withShareSheet(page);
  await toCard(page);
  await expect(state(page)).toHaveAttribute("data-share-state", "idle");
  await shot(page, "share-answer-390-kn");
  await card(page).getByRole("button").click();
  await expect(state(page)).toHaveAttribute("data-share-state", "shared");
  const shared = await page.evaluate(
    () =>
      (
        window as unknown as {
          __shared: { text: string; files: Array<{ name: string; type: string; size: number }> };
        }
      ).__shared,
  );
  expect(shared.files).toHaveLength(1);
  expect(shared.files[0]?.type).toBe("image/png");
  expect(shared.files[0]?.size).toBeGreaterThan(10_000);
  expect(shared.text).toContain("ಕಡ್ಡಿ ಕಟ್ಟಿನಿಂದ ಹತ್ತು ಮತ್ತು ಬಿಡಿ");
  expect(shared.text).toContain("ಪರಂಪರೆ · ಹಿರಿಯ ಶಿಕ್ಷಕರ ಅನುಭವ");
  expect(shared.text).toContain("Sharada ಅವರ ಅನುಭವ");
  expect(shared.text).toContain("ಮಾದರಿ ದತ್ತಾಂಶ (Sample)");
  await shot(page, "share-shared-390-kn");
});

test("no file sharing: WhatsApp opens with the Kannada words and the picture's link", async ({
  page,
  context,
}) => {
  await open(context, page, "en");
  await withoutShareSheet(page);
  await toCard(page);
  await card(page).getByRole("button").click();
  await expect(state(page)).toHaveAttribute("data-share-state", "whatsapp");
  const opened = await page.evaluate(() => (window as unknown as { __opened: string }).__opened);
  expect(opened.startsWith("https://wa.me/?text=")).toBe(true);
  const text = decodeURIComponent(opened.split("text=")[1] ?? "");
  expect(text).toContain("ಕಡ್ಡಿ ಕಟ್ಟಿನಿಂದ ಹತ್ತು ಮತ್ತು ಬಿಡಿ");
  expect(text).toContain(`/api/cards/${CARD}/image`);
  await shot(page, "share-whatsapp-390-en");
});

test("no share sheet and WhatsApp blocked: the picture is saved to the phone", async ({
  page,
  context,
}) => {
  await open(context, page, "en");
  await withoutShareSheet(page, true);
  await toCard(page);
  const download = page.waitForEvent("download");
  await card(page).getByRole("button").click();
  expect((await download).suggestedFilename()).toBe(`parampara-sample-${CARD}.png`);
  await expect(state(page)).toHaveAttribute("data-share-state", "downloaded");
  await shot(page, "share-downloaded-390-en");
});

test("offline: the press is held and the button says when it is ready again", async ({
  page,
  context,
}) => {
  await open(context, page, "en");
  await withShareSheet(page);
  await toCard(page);
  await context.setOffline(true);
  await card(page).getByRole("button").click();
  await expect(state(page)).toHaveAttribute("data-share-state", "offline");
  await shot(page, "share-offline-390-en");
  await context.setOffline(false);
  await expect(state(page)).toHaveAttribute("data-share-state", "ready");
  await shot(page, "share-ready-390-en");
  await card(page).getByRole("button").click();
  await expect(state(page)).toHaveAttribute("data-share-state", "shared");
});

test("the picture cannot be made: an honest word and a way to try again", async ({
  page,
  context,
}) => {
  await open(context, page, "en");
  await withShareSheet(page);
  // Neither picture can be made: no canvas in this browser, and the server's image fails.
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.route(`**/api/cards/${CARD}/image`, (r) => r.fulfill({ status: 500, body: "" }));
  await toCard(page);
  await card(page).getByRole("button").click();
  await expect(state(page)).toHaveAttribute("data-share-state", "error");
  await expect(card(page).getByRole("button")).toContainText("Try again");
  await shot(page, "share-error-390-en");
});

test("offline on the officer's board: the banner settles into a pill clear of Send", async ({
  page,
  context,
}) => {
  await open(context, page, "en", "officer");
  await page.goto("/i");
  await expect(page.locator("[data-actions]")).toBeVisible();
  await context.setOffline(true);
  const banner = page.locator("[data-offline-banner]");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("data-compact", "true", { timeout: 8000 });
  const pill = await banner.boundingBox();
  expect(pill!.height).toBeLessThanOrEqual(64);
  const send = await page.locator("[data-share-line]").first().boundingBox();
  const overlaps =
    pill!.x < send!.x + send!.width &&
    send!.x < pill!.x + pill!.width &&
    pill!.y < send!.y + send!.height &&
    send!.y < pill!.y + pill!.height;
  expect(overlaps).toBe(false);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/share-offline-pill-pulse-390-en.png` });
  // Tapping the pill says the whole sentence again.
  await banner.getByRole("button").click();
  await expect(banner).not.toHaveAttribute("data-compact", "true");
  await context.setOffline(false);
});
