#!/usr/bin/env node
// node scripts/brand-kannada-png.mjs → assets/brand/*.png and assets/brand/titles/<hash>.png
// next/og (Satori) cannot shape Kannada (DECISIONS D57), so the Tomorrow card's fixed Kannada
// lines, and the Kannada titles of the approved Sample library cards (the demo path jurors share),
// are drawn once here by Chromium, which shapes Kannada correctly, from the app's own OFL font, and
// kept as transparent PNGs at 2x. Rerun only if the words, the Sample library or the font change.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const LINES = {
  "parampara-kn": { text: "ಪರಂಪರೆ", size: 72, color: "#C8553D" },
  "tomorrow-kn": { text: "ನಾಳೆ ತರಗತಿಯಲ್ಲಿ ಮಾಡಿ ನೋಡಿ", size: 40, color: "#2C574C" },
  "missing-kn": { text: "ಈ ಕಾರ್ಡ್ ಈಗ ಹಂಚಿಕೆಯಲ್ಲಿ ಇಲ್ಲ", size: 48, color: "#15302A" },
};

// The approved Sample cards (scripts/seed-sample-library.mjs keeps 04, 05 and 08 as drafts; 09
// carries an injected line for the evals and never reaches an image).
const SAMPLE_TITLES = [
  "sample-card-01",
  "sample-card-02",
  "sample-card-03",
  "sample-card-06",
  "sample-card-07",
];

const root = new URL("../", import.meta.url);
const font = readFileSync(new URL("assets/fonts/BalooTamma2-Bold.ttf", root)).toString("base64");
const library = JSON.parse(readFileSync(new URL("evals/library.json", root), "utf8"));
mkdirSync(new URL("assets/brand/titles/", root), { recursive: true });

const html = (text, size, color, maxWidth) => `<!doctype html><html><head><style>
  @font-face { font-family: Baloo; src: url(data:font/ttf;base64,${font}) format("truetype"); font-weight: 700; }
  html, body { margin: 0; background: transparent; }
  #t { display: inline-block; font-family: Baloo; font-weight: 700; font-size: ${size}px; line-height: 1.3;
       color: ${color}; padding: 2px 4px; ${maxWidth ? `max-width: ${maxWidth}px;` : "white-space: nowrap;"} }
</style></head><body><span id="t" lang="kn">${text}</span></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
async function draw(file, text, size, color, maxWidth) {
  await page.setContent(html(text, size, color, maxWidth));
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#t").screenshot({ path: new URL(file, root).pathname, omitBackground: true });
  console.log(`  ✓ ${file}`);
}
for (const [name, { text, size, color }] of Object.entries(LINES)) {
  await draw(`assets/brand/${name}.png`, text, size, color);
}
for (const id of SAMPLE_TITLES) {
  const card = library.cards.find((c) => c.id === id);
  if (!card) throw new Error(`${id} is not in evals/library.json`);
  // Named by the Kannada title itself, so the seeded Sample cards (uuid ids) find it too.
  const hash = createHash("sha256")
    .update(card.title.kn.normalize("NFC"))
    .digest("hex")
    .slice(0, 16);
  await draw(`assets/brand/titles/${hash}.png`, card.title.kn, 44, "#21453C", 900);
}
await browser.close();
