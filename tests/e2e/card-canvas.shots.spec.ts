import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// The Tomorrow card drawn in the browser (Law 8, D57): Kannada shaped by the browser with the
// page's own fonts. Checks that the picture shared is the canvas card, that its Kannada shapes
// (conjuncts join, no missing glyph boxes), that it matches the committed reference picture, that
// the English toggle gives an English card, and that a browser without a canvas falls back to the
// server's image. Pictures to docs/demos/M5/card-canvas-{kn,en}.png.
// Run: PW_PORT=3181 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/card-canvas.shots.spec.ts --project=shots
// (first run, or after a deliberate change to the card: add --update-snapshots and review the PNGs)
const dir = "docs/demos/M5";
mkdirSync(dir, { recursive: true });

const port = process.env.PW_PORT ?? "3123";
const CARD = "sample-card-02";
const TITLE_KN = "ಕಡ್ಡಿ ಕಟ್ಟಿನಿಂದ ಹತ್ತು ಮತ್ತು ಬಿಡಿ";

async function open(context: BrowserContext, page: Page, lang: "kn" | "en") {
  await context.addCookies([
    { name: "pp_fixture_role", value: "teacher", url: `http://localhost:${port}` },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);
  // The phone's share sheet: keeps the picture it was given as a data URL.
  await page.addInitScript(() => {
    const w = window as unknown as { __png?: string; __pngName?: string };
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: { files?: File[] }) => {
        const file = data.files?.[0];
        if (!file) return;
        w.__pngName = file.name;
        w.__png = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.readAsDataURL(file);
        });
      },
    });
  });
}

async function shareAndGetPng(page: Page, expected = "shared"): Promise<Buffer> {
  await page.goto("/design#answer");
  const card = page.locator(`[data-share-card="${CARD}"]`);
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await card.getByRole("button").click();
  // The server image's first render is slow on a cold server under parallel workers.
  await expect(card.locator("[data-share-state]")).toHaveAttribute("data-share-state", expected, {
    timeout: 30_000,
  });
  const dataUrl = await page.evaluate(() => (window as unknown as { __png: string }).__png);
  expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  return Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
}

/** 1080 x 1350, from the PNG header. */
function size(png: Buffer) {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test("Kannada card: drawn in the browser, conjuncts joined, no missing glyphs, as the reference", async ({
  page,
  context,
}) => {
  await open(context, page, "kn");
  const png = await shareAndGetPng(page);
  expect(size(png)).toEqual({ width: 1080, height: 1350 });
  writeFileSync(`${dir}/card-canvas-kn.png`, png);

  // Shaping, measured with the card's own fonts: a conjunct (ಡ್ಡ, ಟ್ಟ, ತ್ತ) is narrower than its
  // letters side by side, which is only true when the browser joined them. And every Kannada
  // letter of the title is covered by a loaded font face (no tofu boxes).
  const check = await page.evaluate(async (title) => {
    const css = getComputedStyle(document.documentElement);
    const family = `${css.getPropertyValue("--font-baloo").trim()}, ${css.getPropertyValue("--font-noto-kannada").trim()}`;
    const font = `700 60px ${family}`;
    const faces = await document.fonts.load(font, title);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = font;
    const w = (t: string) => ctx.measureText(t).width;
    const conjuncts = ["ಡ್ಡ", "ಟ್ಟ", "ತ್ತ"].map((c) => ({
      c,
      joined: w(c),
      apart: w(c[0]!) + w(c[1]!) + w(c[2]!),
    }));
    return { faces: faces.length, covered: document.fonts.check(font, title), conjuncts };
  }, TITLE_KN);
  expect(check.faces).toBeGreaterThan(0);
  expect(check.covered).toBe(true);
  for (const c of check.conjuncts) expect(c.joined, c.c).toBeLessThan(c.apart * 0.9);

  expect(png).toMatchSnapshot("card-canvas-kn.png", { maxDiffPixelRatio: 0.01 });
});

test("English toggle: the same card in English", async ({ page, context }) => {
  await open(context, page, "en");
  const png = await shareAndGetPng(page);
  expect(size(png)).toEqual({ width: 1080, height: 1350 });
  writeFileSync(`${dir}/card-canvas-en.png`, png);
  expect(png).toMatchSnapshot("card-canvas-en.png", { maxDiffPixelRatio: 0.01 });
});

test("no canvas: the server's picture is shared instead, never nothing", async ({
  page,
  context,
}) => {
  await open(context, page, "kn");
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  // Said plainly: the Kannada card could not be drawn, the server's card went instead.
  const png = await shareAndGetPng(page, "fellback");
  // The server's image is 1080 x 1350 too; the fallback is honest and still shares.
  expect(size(png)).toEqual({ width: 1080, height: 1350 });
  const name = await page.evaluate(() => (window as unknown as { __pngName: string }).__pngName);
  expect(name).toBe(`parampara-sample-${CARD}.png`);
});
