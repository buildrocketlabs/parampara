import { FLN_TOPIC_LABELS, FlnTopic, GRADE_BAND_LABELS, GradeBand } from "@/lib/domain/fln";
import type { MessageKey } from "@/lib/i18n";
import { fill, type Lookup } from "@/lib/i18n/fill";
import { DISTRICTS } from "@/lib/insights/districts";
import { colors } from "@/lib/tokens";
import type { ShareMeta } from "./card";

// The Tomorrow card drawn in the browser (Law 8: Kannada first). next/og cannot shape Kannada
// (DECISIONS D57), so a real card's Kannada would be lost in the server image; a canvas uses the
// browser's own text shaping and the fonts this page already loaded (Baloo Tamma 2, Noto Sans
// Kannada, Plus Jakarta Sans). Same 1080 x 1350 layout as /api/cards/[id]/image, which stays for link
// previews and as the fallback when a canvas or its fonts are not available.

export const CARD_W = 1080;
export const CARD_H = 1350;
const PAD = 72;
const TEXT_W = CARD_W - PAD * 2;
const STEP_INDENT = 76;

export type CardLang = "kn" | "en";
export type Measure = (text: string) => number;

/** Lines of `text` no wider than `max`, broken at spaces (Kannada words are space separated). */
export function wrapLines(
  text: string,
  max: number,
  measure: Measure,
  maxLines = Infinity,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || measure(next) <= max) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? "";
  while (last.includes(" ") && measure(`${last}…`) > max)
    last = last.slice(0, last.lastIndexOf(" "));
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/** The largest size whose block height fits the room; the smallest when none does. */
export function fitSize(sizes: number[], heightAt: (size: number) => number, room: number): number {
  for (const size of sizes) if (heightAt(size) <= room) return size;
  return sizes[sizes.length - 1] ?? 28;
}

// The caller's lookup (useLang().msg): this module runs in the browser and holds no dictionary.
let look: Lookup = () => "";
const say = (lang: CardLang, key: MessageKey, vars?: Record<string, string | number>) =>
  fill(look(lang, key), vars);

/** A district in the card's language when it is one of Karnataka's 31 (Koppal → ಕೊಪ್ಪಳ). */
export function districtIn(name: string, lang: CardLang): string {
  const d = DISTRICTS.find((x) => x.name.en.toLowerCase() === name.trim().toLowerCase());
  return d ? d.name[lang] : name;
}

/** The first letter as a reader sees it: a whole akshara (ಕೃ), never half of one. */
export function firstLetter(name: string): string {
  const seg =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? new Intl.Segmenter("kn", { granularity: "grapheme" })
      : null;
  const first = seg
    ? seg.segment(name.trim())[Symbol.iterator]().next().value?.segment
    : Array.from(name.trim())[0];
  return (first ?? "★").toLocaleUpperCase();
}

export type CardFonts = { display: string; body: string };

/** The page's own font stacks (next/font sets these variables on <html>). */
export function cardFonts(root: HTMLElement = document.documentElement): CardFonts {
  const css = getComputedStyle(root);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const kannada = v("--font-noto-kannada");
  return {
    display: [v("--font-baloo"), kannada, "sans-serif"].filter(Boolean).join(", "),
    body: [v("--font-jakarta"), kannada, "sans-serif"].filter(Boolean).join(", "),
  };
}

/** Waits for the fonts the card needs, with this card's own letters; false if they do not come. */
export async function loadCardFonts(
  fonts: CardFonts,
  sample: string,
  timeoutMs = 8000,
): Promise<boolean> {
  if (typeof document === "undefined" || !document.fonts) return false;
  const loads = Promise.all([
    document.fonts.load(`700 60px ${fonts.display}`, sample),
    document.fonts.load(`400 34px ${fonts.body}`, sample),
    document.fonts.load(`600 26px ${fonts.body}`, sample),
  ]).then(async (faces) => {
    await document.fonts.ready;
    return faces.every((f) => f.length > 0);
  });
  const timeout = new Promise<boolean>((resolve) =>
    window.setTimeout(() => resolve(false), timeoutMs),
  );
  try {
    return await Promise.race([loads, timeout]);
  } catch {
    return false;
  }
}

const LAMP = {
  flame: "M20 2 C23 8 27 12 27 17 C27 21.5 24 24 20 24 C16 24 13 21.5 13 17 C13 12 17 8 20 2 Z",
  core: "M20 13 C21.4 16 23 18 23 20 C23 22 21.6 23 20 23 C18.4 23 17 22 17 20 C17 18 18.6 16 20 13 Z",
  bowl: "M4 27 C4 37 11 42 20 42 C29 42 36 37 36 27 Z",
};

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 40, size / 40);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = colors.flame;
  ctx.beginPath();
  ctx.arc(20, 15, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fill(new Path2D(LAMP.flame));
  ctx.fillStyle = colors.paper;
  ctx.fill(new Path2D(LAMP.core));
  ctx.fillStyle = colors.clay;
  ctx.fill(new Path2D(LAMP.bowl));
  ctx.fillStyle = colors["clay-cta"];
  ctx.beginPath();
  ctx.ellipse(20, 27, 16, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function eyebrow(meta: ShareMeta, lang: CardLang): string {
  const topic = FlnTopic.safeParse(meta.topic);
  const grade = GradeBand.safeParse(meta.gradeBand);
  return [
    topic.success ? FLN_TOPIC_LABELS[topic.data][lang] : null,
    grade.success ? GRADE_BAND_LABELS[grade.data][lang] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Draws the card onto `canvas` (1080 x 1350) in `lang`. Fonts must already be loaded. */
export function paintTomorrowCard(
  canvas: HTMLCanvasElement,
  meta: ShareMeta,
  lang: CardLang,
  fonts: CardFonts,
  host: string,
): void {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas");
  const kn = lang === "kn";
  const lh = kn ? 1.5 : 1.36; // Kannada needs taller lines (DESIGN §3)
  const font = (weight: number, size: number, display = false) =>
    `${weight} ${size}px ${display ? fonts.display : fonts.body}`;
  const measureWith = (f: string): Measure => {
    ctx.font = f;
    return (t) => ctx.measureText(t).width;
  };
  ctx.textBaseline = "top";

  // Canvas: cream with the lamp's warm glow in the corner.
  ctx.fillStyle = colors.cream;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W * 0.85, 0, 0, CARD_W * 0.85, 0, 640);
  glow.addColorStop(0, "rgba(255, 201, 77, 0.28)");
  glow.addColorStop(1, "rgba(247, 243, 234, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Header: the lamp, ಪರಂಪರೆ, the line under it; Sample on the right.
  drawLamp(ctx, PAD, 56, 64);
  ctx.fillStyle = colors.clay;
  ctx.font = font(700, 54, true);
  ctx.fillText("ಪರಂಪರೆ", PAD + 82, 52);
  ctx.fillStyle = colors["ink-3"];
  ctx.font = font(600, 24);
  ctx.fillText(say(lang, "card.tagline"), PAD + 84, 126);
  if (meta.isSample) {
    const label = say(lang, "badge.sample");
    ctx.font = font(600, 30);
    const w = ctx.measureText(label).width + 56;
    ctx.fillStyle = colors.ink;
    roundRect(ctx, CARD_W - PAD - w, 58, w, 60, 30);
    ctx.fill();
    ctx.fillStyle = colors.white;
    ctx.fillText(label, CARD_W - PAD - w + 28, 70);
  }

  // Bottom up: footer, then the master's credit, so the middle knows its room.
  const footerY = CARD_H - 52 - 30;
  const panelH = 124;
  const panelY = footerY - 20 - panelH;

  let y = 196;
  const label = eyebrow(meta, lang);
  if (label) {
    ctx.fillStyle = colors.moss;
    ctx.font = font(600, 26);
    ctx.fillText(label, PAD, y);
    y += 26 * lh + 6;
  }

  // Title: as large as two or three lines allow.
  const title = meta.title[lang];
  const titleSize = fitSize(
    [64, 58, 52, 46],
    (s) => wrapLines(title, TEXT_W, measureWith(font(700, s, true))).length * s * 1.22,
    3 * 52 * 1.22,
  );
  ctx.fillStyle = colors.ink;
  ctx.font = font(700, titleSize, true);
  for (const line of wrapLines(title, TEXT_W, measureWith(font(700, titleSize, true)), 3)) {
    ctx.font = font(700, titleSize, true);
    ctx.fillText(line, PAD, y);
    y += titleSize * 1.22;
  }

  // The problem, in two lines at most.
  y += 12;
  ctx.fillStyle = colors["ink-3"];
  for (const line of wrapLines(meta.problem[lang], TEXT_W, measureWith(font(400, 27)), 2)) {
    ctx.font = font(400, 27);
    ctx.fillText(line, PAD, y);
    y += 27 * lh;
  }

  // What you need, kept above the credit.
  const materials = meta.materials
    .map((m) => m[lang])
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
  const needLabel = say(lang, "card.need");
  const materialsH = materials ? 27 * lh + 26 : 0;

  // Steps: the largest size whose lines fit what is left.
  const steps = meta.steps.slice(0, 5).map((s) => s[lang]);
  const stepsTop = y + 28;
  const room = panelY - 26 - materialsH - stepsTop;
  const stepW = TEXT_W - STEP_INDENT;
  const gapFor = (s: number) => (s >= 38 ? 24 : 16);
  const stepSize = fitSize(
    [46, 42, 38, 34, 30, 27],
    // Exactly as drawn below: each step is its lines (centred on the number when it is one line)
    // or the number's 54 px, whichever is taller, then the gap.
    (s) => {
      const m = measureWith(font(400, s));
      return steps.reduce((h, t, i) => {
        const lines = wrapLines(t, stepW, m).length;
        const text = Math.max(0, (54 - s * lh) / 2) + lines * s * lh;
        return h + Math.max(text, 54) + (i < steps.length - 1 ? gapFor(s) : 0);
      }, 0);
    },
    room,
  );
  y = stepsTop;
  steps.forEach((text, i) => {
    ctx.fillStyle = colors.flame;
    ctx.beginPath();
    ctx.arc(PAD + 27, y + 27, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.ink;
    ctx.font = font(700, 30, true);
    const n = String(i + 1);
    ctx.fillText(n, PAD + 27 - ctx.measureText(n).width / 2, y + 10);
    ctx.font = font(400, stepSize);
    const lines = wrapLines(text, stepW, measureWith(font(400, stepSize)));
    let ly = y + Math.max(0, (54 - stepSize * lh) / 2);
    for (const line of lines) {
      ctx.font = font(400, stepSize);
      ctx.fillText(line, PAD + STEP_INDENT, ly);
      ly += stepSize * lh;
    }
    y = Math.max(ly, y + 54) + gapFor(stepSize);
  });

  if (materials) {
    const my = y - gapFor(stepSize) + 26;
    ctx.fillStyle = colors["ink-2"];
    ctx.font = font(600, 27);
    ctx.fillText(needLabel, PAD, my);
    const w = ctx.measureText(`${needLabel} `).width;
    ctx.font = font(400, 27);
    const [line] = wrapLines(materials, TEXT_W - w, measureWith(font(400, 27)), 1);
    ctx.font = font(400, 27);
    ctx.fillText(line ?? "", PAD + w, my);
  }

  // The master's credit, as they chose.
  ctx.fillStyle = colors.ink;
  roundRect(ctx, PAD, panelY, TEXT_W, panelH, 32);
  ctx.fill();
  const cx = PAD + 30 + 38;
  const cy = panelY + panelH / 2;
  ctx.fillStyle = colors.flame;
  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.clay;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fill();
  const initial = meta.credit ? firstLetter(meta.credit) : "★";
  ctx.fillStyle = colors.paper;
  ctx.font = font(700, 36, true);
  ctx.fillText(initial, cx - ctx.measureText(initial).width / 2, cy - 22);
  const tx = cx + 38 + 22;
  ctx.fillStyle = colors.mist;
  ctx.font = font(600, 22);
  ctx.fillText(say(lang, "card.from"), tx, panelY + 18);
  const who = meta.credit
    ? meta.master.years
      ? `${meta.credit}, ${say(lang, "master.years", { n: meta.master.years })}`
      : meta.credit
    : say(lang, "master.anonymous");
  ctx.fillStyle = colors.paper;
  const [whoLine] = wrapLines(who, TEXT_W - (tx - PAD) - 30, measureWith(font(700, 34, true)), 1);
  ctx.font = font(700, 34, true);
  ctx.fillText(whoLine ?? "", tx, panelY + 46);
  if (meta.master.district) {
    ctx.fillStyle = colors.mist;
    ctx.font = font(400, 22);
    ctx.fillText(districtIn(meta.master.district, lang), tx, panelY + 88);
  }

  // Footer: what the card is, and where the rest lives.
  ctx.font = font(600, 21);
  const hostW = ctx.measureText(host).width;
  ctx.fillStyle = colors["clay-cta"];
  ctx.fillText(host, CARD_W - PAD - hostW, footerY);
  ctx.fillStyle = colors["ink-3"];
  const note = say(lang, meta.isSample ? "card.footer.sample" : "card.footer.field");
  const [noteLine] = wrapLines(note, TEXT_W - hostW - 24, measureWith(font(400, 21)), 1);
  ctx.font = font(400, 21);
  ctx.fillText(noteLine ?? "", PAD, footerY);
}

/** The card as a PNG file, or null when the canvas or the fonts are not available. */
export async function drawTomorrowCard(
  meta: ShareMeta,
  lang: CardLang,
  fileName: string,
  lookup: Lookup,
): Promise<File | null> {
  look = lookup;
  try {
    const fonts = cardFonts();
    const sample = [meta.title[lang], ...meta.steps.map((s) => s[lang]), "ಪರಂಪರೆ"].join(" ");
    if (!(await loadCardFonts(fonts, sample))) return null;
    const canvas = document.createElement("canvas");
    paintTomorrowCard(canvas, meta, lang, fonts, meta.host || window.location.host);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? new File([blob], fileName, { type: "image/png" }) : null;
  } catch {
    return null;
  }
}
