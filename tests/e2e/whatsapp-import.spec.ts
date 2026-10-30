import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// F-A1: a master's interview as seven WhatsApp voice notes (consent first, then one answer per
// question), picked out of order, decoded in the real browser and laid on one timeline. Fixture
// mode (PW_FIXTURE=1): nothing is sent, the run stops once the browser has prepared the plan.
// The notes are synthetic (scripts/rehearsal-notes.mjs): speech like tones, never a real voice.
const fixture = !process.env.NEXT_PUBLIC_SUPABASE_URL;

let dir: string | null = mkdtempSync(join(tmpdir(), "pp-notes-"));
try {
  execFileSync("node", ["scripts/rehearsal-notes.mjs", "--out", dir], { stdio: "ignore" });
} catch {
  dir = null; // no ffmpeg with libopus here
}
const note = (n: number) => join(dir ?? "", `PTT-20261028-WA${String(n).padStart(4, "0")}.opus`);
const IN_ORDER = [3, 4, 5, 6, 7, 8, 9].map(
  (n) => `PTT-20261028-WA${String(n).padStart(4, "0")}.opus`,
);
const SHUFFLED = [7, 3, 9, 5, 4, 8, 6].map(note);

async function names(page: Page) {
  return page.getByTestId("import-file").evaluateAll((els) => els.map((e) => e.dataset.name));
}

async function open(page: Page) {
  await page.goto("/m/import?lang=en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bring in");
}

test.describe("WhatsApp voice notes as one interview", () => {
  test.skip(!fixture, "fixture mode only (no keys in this build)");
  test.skip(!dir, "needs ffmpeg with libopus to make the synthetic notes");

  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "pp_fixture_role", value: "reviewer", url: baseURL! }]);
  });

  test("seven notes picked out of order: WhatsApp order, consent marked, one timeline", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await open(page);
    const txt = join(dir!, "WhatsApp Chat with Sample.txt");
    writeFileSync(txt, "not a recording");
    await page.getByTestId("import-files").setInputFiles([...SHUFFLED, txt]);

    await expect.poll(() => names(page)).toEqual(IN_ORDER);
    await expect(page.getByTestId("import-order-basis")).toContainText("time WhatsApp gave");
    await expect(page.getByText("Not a voice recording, so left out: 1")).toBeVisible();

    // The consent choice for notes is offered first; nothing is chosen for the reviewer (D49).
    const firstNote = page.getByRole("radio", { name: /first voice note is the consent/ });
    await expect(firstNote).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("import-consent-tag")).toHaveCount(0);
    await firstNote.click();
    const rows = page.getByTestId("import-file");
    await expect(rows.first()).toHaveAttribute("data-consent", "true");
    await expect(page.getByTestId("import-consent-tag")).toHaveCount(1);
    await expect(page.getByTestId("import-consent-tag")).toContainText("Consent");
    await expect(page.getByTestId("import-consent-tag")).toContainText("ಒಪ್ಪಿಗೆ");
    await expect(rows.first()).toContainText("never made into cards");

    // Move with buttons (touch and keyboard), then back; the order is now the reviewer's own.
    await page.getByRole("button", { name: `Down · ${IN_ORDER[1]}` }).click();
    await expect
      .poll(async () => (await names(page)).slice(1, 3))
      .toEqual([IN_ORDER[2], IN_ORDER[1]]);
    await expect(page.getByTestId("import-order-basis")).toContainText("Your order");
    await page.getByRole("button", { name: `Up · ${IN_ORDER[1]}` }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => names(page)).toEqual(IN_ORDER);

    // Remove one and add it back: a hand set order keeps new notes at the end.
    await page.getByRole("button", { name: `Remove · ${IN_ORDER[6]}` }).click();
    await expect.poll(() => names(page)).toEqual(IN_ORDER.slice(0, 6));
    await page.getByTestId("import-files").setInputFiles([note(9)]);
    await expect.poll(() => names(page)).toEqual(IN_ORDER);

    await page.getByTestId("import-begin").click();
    const plan = page.getByTestId("import-plan");
    await expect(plan).toBeVisible({ timeout: 150_000 });
    await expect(plan).toHaveAttribute("data-parts", "7");
    // Notes of 3, 4, 5, 3.5, 4.5, 3 and 4 minutes: 27 minutes on one timeline.
    await expect(plan).toContainText("27 min");
    await expect(plan).toContainText("7 notes");
    const consentEnd = Number(await plan.getAttribute("data-consent-end-ms"));
    expect(Math.abs(consentEnd - 180_000)).toBeLessThan(50);
    const pieces = Number(await plan.getAttribute("data-chunks"));
    expect(pieces).toBeGreaterThanOrEqual(Math.ceil((27 * 60) / 29.5));
    await expect(plan.getByText("Consent", { exact: true })).toBeVisible();
  });

  test("Safari's refusal of Ogg is met by the WebCodecs path", async ({ page }) => {
    test.setTimeout(120_000);
    // Make Web Audio refuse Ogg, as Safari before 18.4 does.
    await page.addInitScript(() => {
      const original = BaseAudioContext.prototype.decodeAudioData;
      BaseAudioContext.prototype.decodeAudioData = function (buffer, ...rest) {
        const head = new Uint8Array(buffer, 0, 4);
        if (String.fromCharCode(...head) === "OggS") {
          return Promise.reject(new DOMException("Decoding failed", "EncodingError"));
        }
        return original.call(this, buffer, ...rest);
      };
    });
    await open(page);
    await page.getByTestId("import-files").setInputFiles([note(4), note(3)]);
    await page.getByRole("radio", { name: /first voice note is the consent/ }).click();
    await page.getByTestId("import-begin").click();
    const plan = page.getByTestId("import-plan");
    await expect(plan).toBeVisible({ timeout: 90_000 });
    await expect(plan).toContainText("7:00"); // 3 + 4 minutes, decoded by WebCodecs
    const consentEnd = Number(await plan.getAttribute("data-consent-end-ms"));
    expect(Math.abs(consentEnd - 180_000)).toBeLessThan(50);
  });

  test("a browser that cannot read Ogg at all says so and names the note", async ({ page }) => {
    await page.addInitScript(() => {
      BaseAudioContext.prototype.decodeAudioData = () =>
        Promise.reject(new DOMException("Decoding failed", "EncodingError"));
      // @ts-expect-error: a browser without WebCodecs
      delete window.AudioDecoder;
    });
    await open(page);
    await page.getByTestId("import-files").setInputFiles([note(3), note(4)]);
    await page.getByRole("radio", { name: /first voice note is the consent/ }).click();
    await page.getByTestId("import-begin").click();
    await expect(page.getByTestId("import-run").getByRole("alert")).toContainText(
      "cannot read WhatsApp voice notes",
    );
    await expect(page.getByTestId("import-run").getByRole("alert")).toContainText("Chrome");
    await expect(page.getByTestId("import-error-part")).toContainText(IN_ORDER[0]!);
  });
});

test.describe("WhatsApp voice notes on a laptop", () => {
  test.skip(!fixture, "fixture mode only (no keys in this build)");
  test.skip(!dir, "needs ffmpeg with libopus to make the synthetic notes");
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("drag a note to a new place", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "pp_fixture_role", value: "reviewer", url: baseURL! }]);
    await open(page);
    await page.getByTestId("import-files").setInputFiles([note(5), note(3), note(4)]);
    await expect.poll(() => names(page)).toEqual(IN_ORDER.slice(0, 3));
    const rows = page.getByTestId("import-file");
    // Let the cards' entrance settle first: a drag that starts on a moving row is lost.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    await rows.nth(2).hover();
    await page.mouse.down();
    await rows.nth(0).hover();
    await rows.nth(0).hover(); // the second move is what fires dragover in Chromium
    await page.mouse.up();
    await expect.poll(() => names(page)).toEqual([IN_ORDER[2], IN_ORDER[0], IN_ORDER[1]]);
    await expect(page.getByTestId("import-order-basis")).toContainText("Your order");
  });
});
