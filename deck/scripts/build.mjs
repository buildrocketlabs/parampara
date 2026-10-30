// Builds the deck: deck/src/slides/NN.html → deck/out/slides/NN.html, deck/out/deck.html,
// deck/out/png/NN.png, deck/out/parampara-deck.pdf (vector text) and deck/out/contact-sheet.png.
//
//   node deck/scripts/build.mjs            (images are prepared once, then reused)
//   DECK_FRESH_IMAGES=1 node deck/scripts/build.mjs
//
// Every number comes from numbers.mjs through {{key}}; an unknown key stops the build.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { generate } from "lean-qr";
import { NUMBERS } from "./numbers.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const DECK = ROOT + "deck/";
const OUT = DECK + "out/";
const IMG = DECK + "assets/img/";
for (const d of [OUT, OUT + "slides", OUT + "png", IMG]) mkdirSync(d, { recursive: true });

export const LINKS = {
  app: "https://parampara-eta.vercel.app",
  film: "https://youtu.be/JD4pzalBlUU",
  code: "https://github.com/buildrocketlabs/parampara",
};
const NAV = [
  ["Problem", "s02"],
  ["Parampara", "s03"],
  ["AI", "s06"],
  ["Trust", "s07"],
  ["Reach", "s08"],
  ["Field", "s09"],
  ["Roadmap", "s11"],
];
const TEAM = "Team Namma Shaale · Challenge 3";

// ── Images: resized (and for backdrops blurred) once, as JPEG, so the PDF stays small ─────────
const IMAGES = [
  ["video/public/photos/mahesh.jpg", "mahesh.jpg", 1400],
  ["video/public/photos/talkal-blackboard.jpg", "talkal-blackboard.jpg", 1920],
  ["video/public/photos/talkal-board.jpg", "talkal-board.jpg", 1600],
  ["video/public/photos/talkal-headmaster-shows-app.jpg", "talkal-headmaster-shows-app.jpg", 1200],
  ["video/public/photos/talkal-teacher-reads-app.jpg", "talkal-teacher-reads-app.jpg", 1200],
  ["video/public/photos/talkal-two-teachers-phone.jpg", "talkal-two-teachers-phone.jpg", 1200],
  ["video/public/illustrations/diya-lights-diya.jpg", "diya-lights-diya.jpg", 1600],
  ["video/public/illustrations/voice-to-cards.jpg", "voice-to-cards.jpg", 1920],
  ["video/public/illustrations/lamps-multiply.jpg", "lamps-multiply.jpg", 1920],
  ["video/public/illustrations/lamps-multiply.jpg", "lamps-multiply-soft.jpg", 1920, 16],
  ["video/public/illustrations/window-9pm.jpg", "window-9pm.jpg", 1920],
  ["video/public/illustrations/lamps-row.jpg", "lamps-row.jpg", 1920],
  ["deck/assets/shots/04-ask.png", "shot-04-ask.jpg", 780],
  ["deck/assets/shots/04-answer.png", "shot-04-answer.jpg", 780],
  ["deck/assets/shots/04-hear.png", "shot-04-hear.jpg", 780],
  ["deck/assets/shots/08-offline-queued.png", "shot-08-queued.jpg", 780],
  ["deck/assets/shots/08-offline-saved.png", "shot-08-saved.jpg", 780],
  ["deck/assets/shots/06-trace-drawer.png", "shot-06-trace.jpg", 1120],
];

async function prepareImages(browser) {
  const page = await browser.newPage();
  for (const [src, name, width, blur = 0] of IMAGES) {
    const out = IMG + name;
    // Raw app shots are git ignored; a clone builds from the prepared copies in assets/img.
    if (existsSync(out) && !existsSync(ROOT + src)) continue;
    if (
      existsSync(out) &&
      statSync(out).mtimeMs > statSync(ROOT + src).mtimeMs &&
      process.env.DECK_FRESH_IMAGES !== "1"
    )
      continue;
    const data = readFileSync(ROOT + src).toString("base64");
    const type = src.endsWith(".png") ? "png" : "jpeg";
    await page.setContent(
      `<body style="margin:0;background:#15302a"><img id="i" src="data:image/${type};base64,${data}"
        style="display:block;width:${width}px;${blur ? `filter:blur(${blur}px) saturate(1.05);transform:scale(1.06)` : ""}"></body>`,
    );
    await page.waitForFunction(() => document.getElementById("i").complete);
    const box = await page
      .locator("#i")
      .evaluate((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
    await page.setViewportSize({ width: box.w, height: box.h });
    await page.screenshot({
      path: out,
      type: "jpeg",
      quality: type === "png" ? 90 : 84,
      clip: { x: 0, y: 0, width: box.w, height: box.h },
    });
    console.log("image", name, `${box.w}×${box.h}`);
  }
  await page.close();
}

// ── Pieces the slides ask for by name ─────────────────────────────────────────────────────────
function qr(key, size) {
  const url = LINKS[key];
  if (!url) throw new Error(`qr: no link ${key}`);
  const code = generate(url);
  let d = "";
  for (let y = 0; y < code.size; y++)
    for (let x = 0; x < code.size; x++) if (code.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
  return `<span class="qr"><svg width="${size}" height="${size}" viewBox="0 0 ${code.size} ${code.size}" shape-rendering="crispEdges"><path d="${d}" fill="#15302a"/></svg></span>`;
}

let hanateCount = 0;
function hanate(state, size) {
  const svg = readFileSync(`${DECK}assets/svg/hanate-${state}.svg`, "utf8");
  const id = `h${++hanateCount}`;
  return svg
    .replace(/_R_[A-Za-z0-9_]+_/g, id)
    .replace(/width="[\d.]+" height="[\d.]+"/, `width="${size}" height="${(size * 140) / 120}"`)
    .replace('class="overflow-visible"', 'class="hanate" style="overflow:visible"');
}

function indiaMap(height) {
  const india = JSON.parse(readFileSync(ROOT + "video/src/data/india-states.json", "utf8"));
  const { width: w, height: h, projection: p, states } = india;
  const project = (lon, lat) => [(lon - p.lon0) * p.k * p.scale, (p.lat1 - lat) * p.scale];
  const [kx, ky] = project(76.15, 15.35); // Koppal, where the first lamp is.
  const paths = states
    .map((s) =>
      s.name === "Karnataka"
        ? ""
        : `<path d="${s.d}" fill="#22463d" stroke="#3f6b57" stroke-width="1.2" stroke-linejoin="round"/>`,
    )
    .join("");
  const ka = states.find((s) => s.name === "Karnataka");
  const lamps = states
    .filter((s) => s.name !== "Karnataka")
    .map((s) => `<circle cx="${s.c[0]}" cy="${s.c[1]}" r="4.5" fill="#ffc94d" opacity="0.55"/>`)
    .join("");
  return `<svg width="${(w * height) / h}" height="${height}" viewBox="0 0 ${w} ${h}" style="overflow:visible">
    <defs><radialGradient id="mapglow"><stop offset="0%" stop-color="#ffc94d" stop-opacity="0.9"/><stop offset="45%" stop-color="#f2a93b" stop-opacity="0.35"/><stop offset="100%" stop-color="#f2a93b" stop-opacity="0"/></radialGradient></defs>
    ${paths}${lamps}
    <path d="${ka.d}" fill="#f2a93b" stroke="#ffc94d" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${kx}" cy="${ky}" r="46" fill="url(#mapglow)"/><circle cx="${kx}" cy="${ky}" r="9" fill="#fffdf8"/>
  </svg>`;
}

const browser = await chromium.launch();
await prepareImages(browser);

// A voice note's real loudness, in 34 bars, read from the file itself (ffmpeg).
function wave(name) {
  const file = `${ROOT}video/public/audio/mahesh-notes/${name}.mp3`;
  const pcm = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-ac", "1", "-ar", "2000", "-f", "s16le", "-"],
    { maxBuffer: 1 << 26 },
  );
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
  const bars = 34;
  const per = Math.floor(samples.length / bars);
  const rms = Array.from({ length: bars }, (_, b) => {
    let sum = 0;
    for (let i = b * per; i < (b + 1) * per; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / per);
  });
  const max = Math.max(...rms);
  return rms
    .map((r) => `<i style="height:${Math.max(4, Math.round((r / max) * 30))}px"></i>`)
    .join("");
}

const used = new Set();
function fill(html, file) {
  return html.replace(/\{\{([a-z]+):?([^}]*)\}\}/g, (_, kind, arg) => {
    if (kind === "qr") return qr(...arg.split(":").map((a, i) => (i ? Number(a) : a)));
    if (kind === "hanate") return hanate(...arg.split(":").map((a, i) => (i ? Number(a) : a)));
    if (kind === "map") return indiaMap(Number(arg));
    if (kind === "wave") return wave(arg);
    if (kind === "img") {
      if (!existsSync(IMG + arg)) throw new Error(`${file}: no image ${arg}`);
      return `assets/img/${arg}`;
    }
    if (kind === "link") {
      if (!LINKS[arg]) throw new Error(`${file}: no link ${arg}`);
      return LINKS[arg];
    }
    if (kind === "n") {
      const v = NUMBERS[arg];
      if (!v) throw new Error(`${file}: unknown number {{n:${arg}}}`);
      used.add(arg);
      return v.value;
    }
    throw new Error(`${file}: unknown placeholder {{${kind}:${arg}}}`);
  });
}

// ── Slides ────────────────────────────────────────────────────────────────────────────────────
const files = readdirSync(DECK + "src/slides")
  .filter((f) => /^\d\d\.html$/.test(f))
  .sort();
const TOTAL = String(files.length).padStart(2, "0");
const sections = files.map((file) => {
  const raw = readFileSync(`${DECK}src/slides/${file}`, "utf8");
  const m = /^<!--\s*(\{[\s\S]*?\})\s*-->\n/.exec(raw);
  if (!m) throw new Error(`${file}: first line must be <!-- {meta} -->`);
  const meta = JSON.parse(m[1]);
  const no = file.slice(0, 2);
  const body = fill(raw.slice(m[0].length), file);
  const nav = NAV.map(
    ([label, id]) => `<a href="#${id}"${label === meta.nav ? ' class="on"' : ""}>${label}</a>`,
  ).join("");
  return `<section class="slide" id="s${no}" data-title="${meta.title}">
  <header class="topbar">
    <a class="mark" href="#s01">${hanate("idle", 38)}</a>
    <nav class="nav" aria-label="Sections">${nav}</nav>
    <a class="wordmark" href="#s01"><span class="kn">ಪರಂಪರೆ</span><span class="en">Parampara</span></a>
  </header>
  <div class="canvas ${meta.canvas ?? ""}">${body}${meta.src ? `<p class="sources">Sources: ${fill(meta.src, file)}</p>` : ""}</div>
  <footer class="meta"><span class="team">${TEAM}</span><span class="page">${no} / ${TOTAL}</span></footer>
</section>`;
});

const page = (title, inner) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><base href="file://${DECK}">
<title>${title}</title><link rel="stylesheet" href="src/deck.css"></head>
<body>${inner}</body></html>`;

writeFileSync(OUT + "deck.html", page("Parampara · Team Namma Shaale", sections.join("\n")));
sections.forEach((s, i) =>
  writeFileSync(`${OUT}slides/${files[i]}`, page(`Parampara ${files[i].slice(0, 2)}`, s)),
);

// Which numbers the deck shows, and where each comes from.
writeFileSync(
  OUT + "numbers.md",
  `# Numbers in the deck\nBuilt ${new Date().toISOString()} by deck/scripts/build.mjs. Every value is read by deck/scripts/numbers.mjs.\n\n| Key | Value | Source |\n|---|---|---|\n` +
    [...used]
      .sort()
      .map((k) => `| ${k} | ${NUMBERS[k].value} | ${NUMBERS[k].source.replace(/\|/g, "/")} |`)
      .join("\n") +
    "\n",
);

// ── Render ────────────────────────────────────────────────────────────────────────────────────
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const view = await ctx.newPage();
await view.goto("file://" + OUT + "deck.html");
await view.evaluate(() => document.fonts.ready);
await view.waitForFunction(() =>
  [...document.images].every((i) => i.complete && i.naturalWidth > 0),
);

// Kannada must be shaped by the real fonts, never a fallback face.
const fonts = await view.evaluate(() => {
  const faces = [...document.fonts].map((f) => `${f.family}:${f.status}`);
  const kn = [...document.querySelectorAll("*")].some((el) => /[ಀ-೿]/.test(el.textContent ?? ""));
  return {
    faces,
    kn,
    check:
      document.fonts.check('32px "Noto Sans Kannada"', "ಪರಂಪರೆ") &&
      document.fonts.check('32px "Baloo Tamma 2"', "ಪರಂಪರೆ"),
  };
});
const unloaded = fonts.faces.filter((f) => !f.endsWith(":loaded"));
if (unloaded.length || !fonts.check) throw new Error(`fonts not loaded: ${unloaded.join(", ")}`);
console.log("fonts", fonts.faces.join(" · "));

// Nothing may spill out of its slide.
const overflow = await view.evaluate(() =>
  [...document.querySelectorAll(".canvas")].flatMap((c, i) => {
    const box = c.getBoundingClientRect();
    return [...c.querySelectorAll("[data-fit]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.right > box.right + 1 ||
          r.bottom > box.bottom + 1 ||
          el.scrollHeight > el.clientHeight + 2
        );
      })
      .map((el) => `slide ${i + 1}: ${el.dataset.fit}`);
  }),
);
if (overflow.length) console.warn("OVERFLOW", overflow.join("; "));

const only = process.env.DECK_ONLY?.split(",");
for (const file of files) {
  const no = file.slice(0, 2);
  if (only && !only.includes(no)) continue;
  await view.locator(`#s${no}`).screenshot({ path: `${OUT}png/${no}.png` });
}
console.log("png", files.length);

if (!only) {
  await view.emulateMedia({ media: "print" });
  await view.pdf({
    path: OUT + "parampara-deck.pdf",
    width: "1920px",
    height: "1080px",
    printBackground: true,
    preferCSSPageSize: true,
  });
  const mb = statSync(OUT + "parampara-deck.pdf").size / 1e6;
  console.log("pdf", `${mb.toFixed(1)} MB`);
  if (mb > 15) throw new Error("PDF over 15 MB");

  // Contact sheet: all slides at a glance.
  const tiles = files
    .map((f) => {
      const no = f.slice(0, 2);
      return `<figure><img src="file://${OUT}png/${no}.png"><figcaption>${no}</figcaption></figure>`;
    })
    .join("");
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: 2040, height: 1200 });
  writeFileSync(
    OUT + "contact-sheet.html",
    `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#15302a;padding:30px;display:grid;grid-template-columns:repeat(3,640px);gap:30px 30px}
    figure{margin:0}img{width:640px;height:360px;display:block;border-radius:10px}
    figcaption{font:600 18px system-ui;color:#a9c4b8;margin-top:8px}</style>${tiles}`,
  );
  await sheet.goto("file://" + OUT + "contact-sheet.html");
  await sheet.waitForFunction(() => [...document.images].every((i) => i.complete));
  await sheet.screenshot({ path: OUT + "contact-sheet.png", fullPage: true });
  console.log("contact sheet");
}
await browser.close();
