import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// "Show me" (docs/BUILD.md M5.3) in fixture mode: no keys, a scripted photo reader, Sample text.
// The photo is resized and re-encoded in the browser (no EXIF), sent once in the request body, and
// never stored. Screenshots to docs/demos/M5/show-me-*.
// Run: PW_PORT=3157 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/show-me.shots.spec.ts --project=shots
const dir = "docs/demos/M5";
mkdirSync(dir, { recursive: true });

const SLATE = readFileSync("evals/images/photo-01-slate-ba-da.png");
const seen = (page: Page, selector: string) => page.locator(selector).filter({ visible: true });

async function asTeacher(context: BrowserContext, page: Page, lang: "kn" | "en", width = 390) {
  const port = process.env.PW_PORT ?? "3123";
  await context.addCookies([
    { name: "pp_fixture_role", value: "teacher", url: `http://localhost:${port}` },
  ]);
  await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}

async function openShowMe(page: Page) {
  await page.goto("/t/ask");
  await seen(page, '[data-testid="show-me-open"]').click();
  await expect(seen(page, '[data-testid="no-faces-line"]')).toBeVisible();
}

async function choose(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await seen(page, '[data-testid="show-me"]')
    .locator('[data-testid="photo-gallery"]')
    .setInputFiles(file);
  await expect(seen(page, '[data-testid="photo-preview"]')).toBeVisible();
}

/** A 2400 x 1800 JPEG made in the page, with an EXIF block carrying a GPS position spliced in. */
async function phonePhotoWithExif(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 2400;
    c.height = 1800;
    const g = c.getContext("2d")!;
    g.fillStyle = "#334";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#eee";
    g.font = "220px sans-serif";
    g.fillText("12  21  14  41", 160, 900);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    const payload = new TextEncoder().encode("Exif\0\0GPS 15.3500N 76.1500E Koppal school");
    const len = payload.length + 2;
    const app1 = new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...payload]);
    const out = new Uint8Array(jpeg.length + app1.length);
    out.set(jpeg.subarray(0, 2), 0);
    out.set(app1, 2);
    out.set(jpeg.subarray(2), 2 + app1.length);
    return Array.from(out);
  });
  return Buffer.from(bytes);
}

for (const lang of ["kn", "en"] as const) {
  test(`show me: the line about faces, the tick, then the photo goes with the question (${lang})`, async ({
    page,
    context,
  }) => {
    await asTeacher(context, page, lang);
    await page.goto("/t/ask");
    await expect(seen(page, '[data-testid="show-me-open"]')).toBeVisible();
    await shot(page, `show-me-idle-390-${lang}`, false);

    await seen(page, '[data-testid="show-me-open"]').click();
    await expect(seen(page, '[data-testid="no-faces-line"]')).toContainText(
      lang === "kn" ? "ಮುಖ ಬೇಡ" : "no children's faces",
    );
    await shot(page, `show-me-panel-390-${lang}`);

    await choose(page, { name: "slate.png", mimeType: "image/png", buffer: SLATE });
    const use = seen(page, '[data-testid="photo-use"]');
    await expect(use).toBeDisabled();
    await page.waitForTimeout(900); // the panel moves up once the preview has its size
    await seen(page, '[data-testid="show-me"]')
      .getByText(lang === "kn" ? /ಯಾರ ಮುಖವೂ ಇಲ್ಲ/ : /no faces in this photo/)
      .filter({ visible: true })
      .first()
      .click();
    await expect(use).toBeEnabled();
    // The photo, the tick and the button fit one phone screen.
    for (const testid of ["photo-preview", "photo-use"]) {
      const box = await seen(page, `[data-testid="${testid}"]`).boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    }
    await shot(page, `show-me-preview-390-${lang}`, false);

    await use.click();
    await expect(seen(page, '[data-testid="photo-attached"]')).toBeVisible();
    await shot(page, `show-me-attached-390-${lang}`, false);

    // Her question goes with the photo; the request body is the only place the photo ever goes.
    const request = page.waitForRequest(
      (r) => r.url().endsWith("/api/ask") && r.method() === "POST",
    );
    await seen(page, "button")
      .filter({ hasText: lang === "kn" ? "ಬರೆದು ಕೇಳಿ" : "Type it instead" })
      .click();
    await seen(page, "textarea").fill(
      lang === "kn"
        ? "ಒಂದು ಮಗು ಬ ಮತ್ತು ದ ಅದಲು ಬದಲು ಬರೆಯುತ್ತದೆ."
        : "A child swaps ಬ and ದ when writing.",
    );
    await seen(page, 'main button[type="submit"]').click();
    const body = (await request).postDataJSON() as { text: string; photo: string };
    const sent = Buffer.from(body.photo, "base64");
    expect(sent.subarray(0, 3).toString("hex")).toBe("ffd8ff");

    const card = seen(page, '[data-testid="photo-seen"]');
    await expect(card).toContainText(lang === "kn" ? "ಅದಲು ಬದಲಾಗಿವೆ" : "swapped in 4 of 6");
    await expect(card.locator('[data-badge="sample"]')).toBeVisible();
    await shot(page, `show-me-seeing-390-${lang}`);
    // Fixture mode has no answers to give, and says so; the photo is let go either way.
    await expect(seen(page, '[role="alert"]:not(#__next-route-announcer__)')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="photo-attached"]')).toHaveCount(0);
  });

  test(`show me: a face is refused kindly, nothing used (${lang})`, async ({ page, context }) => {
    await asTeacher(context, page, lang);
    await page.route("**/api/ask", (route) =>
      route.continue({ headers: { ...route.request().headers(), "x-pp-fixture-photo": "faces" } }),
    );
    await openShowMe(page);
    await choose(page, { name: "slate.png", mimeType: "image/png", buffer: SLATE });
    await seen(page, '[data-testid="no-faces-tick"]').check({ force: true });
    await seen(page, '[data-testid="photo-use"]').click();
    await seen(page, "button")
      .filter({ hasText: lang === "kn" ? "ಬರೆದು ಕೇಳಿ" : "Type it instead" })
      .click();
    await seen(page, "textarea").fill(
      lang === "kn" ? "ಮಕ್ಕಳಿಗೆ ಬ ದ ಗೊಂದಲ." : "Children mix up ಬ and ದ.",
    );
    await seen(page, 'main button[type="submit"]').click();
    const panel = seen(page, '[data-testid="outcome-photo-refused"]');
    await expect(panel).toBeVisible();
    await expect(page.locator('[data-testid="photo-attached"]')).toHaveCount(0);
    await expect(panel.locator('a[href="tel:1098"]')).toBeVisible();
    await shot(page, `show-me-refused-390-${lang}`);

    // Another photo keeps her question ready to send again.
    await panel
      .getByRole("button", { name: lang === "kn" ? /ಬೇರೆ ಫೋಟೋ/ : /Take another photo/ })
      .click();
    await expect(seen(page, '[data-testid="no-faces-line"]')).toBeVisible();
  });

  test(`show me at 1280 (${lang})`, async ({ page, context }) => {
    await asTeacher(context, page, lang, 1280);
    await openShowMe(page);
    await choose(page, { name: "slate.png", mimeType: "image/png", buffer: SLATE });
    await seen(page, '[data-testid="no-faces-tick"]').check({ force: true });
    await shot(page, `show-me-preview-1280-${lang}`, false);
    await seen(page, '[data-testid="photo-use"]').click();
    await seen(page, "button")
      .filter({ hasText: lang === "kn" ? "ಬರೆದು ಕೇಳಿ" : "Type it instead" })
      .click();
    await seen(page, "textarea").fill("ಬ ದ");
    await seen(page, 'main button[type="submit"]').click();
    await expect(seen(page, '[data-testid="photo-seen"]')).toBeVisible();
    await shot(page, `show-me-seeing-1280-${lang}`);
  });
}

test("show me: a phone photo is cut to 1280 px and loses its EXIF before it leaves the phone", async ({
  page,
  context,
}) => {
  await asTeacher(context, page, "en");
  await openShowMe(page);
  const original = await phonePhotoWithExif(page);
  expect(original.includes(Buffer.from("GPS 15.3500N"))).toBe(true);
  await choose(page, { name: "IMG_2041.jpg", mimeType: "image/jpeg", buffer: original });
  const size = await seen(page, '[data-testid="photo-preview"]').evaluate(
    (img: HTMLImageElement) => ({
      w: img.naturalWidth,
      h: img.naturalHeight,
    }),
  );
  expect(size).toEqual({ w: 1280, h: 960 });

  await seen(page, '[data-testid="no-faces-tick"]').check({ force: true });
  await seen(page, '[data-testid="photo-use"]').click();
  const request = page.waitForRequest((r) => r.url().endsWith("/api/ask"));
  await seen(page, "button").filter({ hasText: "Type it instead" }).click();
  await seen(page, "textarea").fill("A child writes 21 for twelve.");
  await seen(page, 'main button[type="submit"]').click();
  const sent = Buffer.from(((await request).postDataJSON() as { photo: string }).photo, "base64");
  expect(sent.subarray(0, 3).toString("hex")).toBe("ffd8ff");
  expect(sent.includes(Buffer.from("Exif"))).toBe(false);
  expect(sent.includes(Buffer.from("GPS"))).toBe(false);
  expect(sent.byteLength).toBeLessThan(1_500_000);
});

test("show me: where the browser can see a face, it warns (never relied on)", async ({
  page,
  context,
}) => {
  await asTeacher(context, page, "en");
  await page.addInitScript(() => {
    (window as unknown as { FaceDetector: unknown }).FaceDetector = class {
      async detect() {
        return [{ boundingBox: {} }];
      }
    };
  });
  await openShowMe(page);
  await choose(page, { name: "slate.png", mimeType: "image/png", buffer: SLATE });
  await expect(seen(page, '[data-testid="face-warning"]')).toBeVisible();
  await shot(page, "show-me-face-warning-390-en");
});

test("show me: the trace names the photo step (design gallery, Sample)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.setItem("parampara.lang", "en"));
  await page.goto("/design#trace");
  const specimen = page.locator("figure").filter({ hasText: "with a photo · Show me · Sample" });
  await expect(
    specimen.getByText("The photo you showed").filter({ visible: true }).first(),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await specimen.screenshot({
    path: `${dir}/show-me-trace-390-en.png`,
    style: "header, [data-feedback-tab] { visibility: hidden !important; }",
  });
});

test("show me: a file that is not a photo, offline, and a photo that does not fit the question", async ({
  page,
  context,
}) => {
  await asTeacher(context, page, "en");
  await openShowMe(page);
  await seen(page, '[data-testid="show-me"]')
    .locator('[data-testid="photo-gallery"]')
    .setInputFiles({
      name: "notes.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
  await expect(seen(page, '[data-testid="photo-error"]')).toBeVisible();
  await shot(page, "show-me-error-390-en");

  // Offline: the photo cannot wait in the offline queue, so she is told, and can take it off.
  await choose(page, { name: "slate.png", mimeType: "image/png", buffer: SLATE });
  await seen(page, '[data-testid="no-faces-tick"]').check({ force: true });
  await seen(page, '[data-testid="photo-use"]').click();
  await seen(page, "button").filter({ hasText: "Type it instead" }).click();
  await seen(page, "textarea").fill("A child swaps ಬ and ದ.");
  await context.setOffline(true);
  await seen(page, 'main button[type="submit"]').click();
  await expect(
    seen(page, '[role="alert"]:not(#__next-route-announcer__)').filter({
      hasText: "A photo needs the network",
    }),
  ).toBeVisible();
  await expect(seen(page, '[data-testid="photo-attached"]')).toBeVisible();
  await expect(seen(page, "button").filter({ hasText: "Send it without the photo" })).toBeVisible();
  await shot(page, "show-me-offline-390-en", false);
  await seen(page, "button").filter({ hasText: "Keep the photo, ask later" }).click();
  await expect(seen(page, '[data-testid="photo-attached"]')).toBeVisible();
  await context.setOffline(false);

  // A photo that does not show work for this question is read, said so, and left out.
  await page.route("**/api/ask", (route) =>
    route.continue({
      headers: { ...route.request().headers(), "x-pp-fixture-photo": "unrelated" },
    }),
  );
  await seen(page, "button").filter({ hasText: "Type it instead" }).click();
  await seen(page, "textarea").fill("Children cannot read simple words.");
  await seen(page, 'main button[type="submit"]').click();
  await expect(seen(page, '[data-testid="photo-not-used"]')).toBeVisible();
  await shot(page, "show-me-not-used-390-en");
});

test("show me: while a big photo is made ready, she sees that it is being prepared", async ({
  page,
  context,
}) => {
  await asTeacher(context, page, "en");
  // Hold the decode for a moment, as a slow phone would.
  await page.addInitScript(() => {
    const original = window.createImageBitmap.bind(window);
    window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) =>
      new Promise((r) => setTimeout(r, 2500)).then(() =>
        original(...args),
      )) as typeof createImageBitmap;
  });
  await openShowMe(page);
  await seen(page, '[data-testid="show-me"]')
    .locator('[data-testid="photo-gallery"]')
    .setInputFiles({ name: "slate.png", mimeType: "image/png", buffer: SLATE });
  await expect(seen(page, '[data-testid="photo-preparing"]')).toBeVisible();
  await shot(page, "show-me-preparing-390-en", false);
  await expect(seen(page, '[data-testid="photo-preview"]')).toBeVisible({ timeout: 10_000 });
});

// Jurors on a laptop: our drawn slate (an Illustration, labelled Sample) through the same path.
for (const lang of ["kn", "en"] as const) {
  for (const width of [390, 1280]) {
    test(`show me: the sample slate, labelled, pre-ticked, one tap to ask (${lang}, ${width})`, async ({
      page,
      context,
    }) => {
      await asTeacher(context, page, lang, width);
      await openShowMe(page);
      await seen(page, '[data-testid="photo-sample"]').click();
      await expect(seen(page, '[data-testid="photo-preview"]')).toBeVisible();
      const labels = seen(page, '[data-testid="sample-labels"]');
      await expect(labels.locator('[data-badge="sample"]')).toBeVisible();
      await expect(labels.locator('[data-badge="illustration"]')).toBeVisible();
      await expect(seen(page, '[data-testid="no-faces-tick"]')).toBeChecked();
      await page.waitForTimeout(900); // the panel moves up once the preview has its size
      await shot(page, `show-me-sample-preview-${width}-${lang}`, false);

      await seen(page, '[data-testid="photo-use"]').click();
      await expect(seen(page, '[data-testid="photo-attached"]')).toContainText(
        lang === "kn" ? "ಮಾದರಿ ಸ್ಲೇಟ್" : "Sample slate",
      );
      await shot(page, `show-me-sample-attached-${width}-${lang}`, false);

      // One tap asks the sample question with the slate, through the same request as a photo.
      const request = page.waitForRequest(
        (r) => r.url().endsWith("/api/ask") && r.method() === "POST",
      );
      await seen(page, '[data-testid="sample-slate-question"]').click();
      const body = (await request).postDataJSON() as {
        text: string;
        photo: string;
        photoSample?: boolean;
      };
      expect(body.text).toBe(
        lang === "kn" ? "ಈ ಮಗುವಿಗೆ ನಾಳೆ ಏನು ಮಾಡಲಿ?" : "What should I do for this child tomorrow?",
      );
      expect(Buffer.from(body.photo, "base64").subarray(0, 3).toString("hex")).toBe("ffd8ff");
      expect(body.photoSample).toBe(true);
      await expect(seen(page, '[data-testid="photo-seen"]')).toContainText(
        lang === "kn" ? "ಬ ಮತ್ತು ವ" : "ಬ and ವ",
      );
      // Labelled by the page itself (Law 7), whatever the server says: the slate is our drawing.
      await expect(
        seen(page, '[data-testid="photo-seen"]').locator('[data-badge="illustration"]'),
      ).toBeVisible();
      await shot(page, `show-me-sample-seeing-${width}-${lang}`, false);
    });
  }
}
