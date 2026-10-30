import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { originFromHeaders, shareBaseUrl } from "@/lib/app-url";
import { FLN_TOPIC_LABELS, FlnTopic, GRADE_BAND_LABELS, GradeBand } from "@/lib/domain/fln";
import { colors } from "@/lib/tokens";
import { loadOpenCard } from "@/lib/open/load";
import type { OpenCard } from "@/lib/open/cards";

// GET /api/cards/[id]/image: the Tomorrow card (docs/BUILD.md M5.4). One approved practice as a
// portrait PNG (1080 x 1350) to share on WhatsApp or print and pin up: the title, 3 to 5 steps,
// what you need, the master's credit as they chose it, Sample when it is Sample, and where to
// find the rest.
//
// The card's own words are English, on purpose: next/og (Satori) cannot shape Kannada (tested
// 24 Oct with Noto Sans Kannada and Baloo Tamma 2: conjuncts break apart with a visible virama).
// The two fixed Kannada lines (ಪರಂಪರೆ and the tagline) are PNGs drawn once by Chromium from the
// app's own font (scripts/brand-kannada-png.mjs). The share message carries the card's Kannada
// words, which WhatsApp shapes correctly. DECISIONS D57.

const W = 1080;
const H = 1350;
const MAX_STEPS = 5;

// Literal paths, so the bundler traces only these six files into the function.
const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/BalooTamma2-Bold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/PlusJakartaSans-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/PlusJakartaSans-SemiBold.ttf")),
]);
const kannada = Promise.all([
  readFile(join(process.cwd(), "assets/brand/parampara-kn.png")),
  readFile(join(process.cwd(), "assets/brand/tomorrow-kn.png")),
  readFile(join(process.cwd(), "assets/brand/missing-kn.png")),
]).then(([word, tag, missing]) => ({
  word: `data:image/png;base64,${word.toString("base64")}`,
  tag: `data:image/png;base64,${tag.toString("base64")}`,
  missing: `data:image/png;base64,${missing.toString("base64")}`,
}));

type Png = { src: string; width: number; height: number };

/** A pre drawn Kannada title (scripts/brand-kannada-png.mjs), shown at its 2x size halved. */
async function kannadaTitle(title: string): Promise<Png | null> {
  const hash = createHash("sha256").update(title.normalize("NFC")).digest("hex").slice(0, 16);
  try {
    const png = await readFile(join(process.cwd(), "assets/brand/titles", `${hash}.png`));
    // PNG header: width and height are big endian at bytes 16 and 20.
    return {
      src: `data:image/png;base64,${png.toString("base64")}`,
      width: Math.round(png.readUInt32BE(16) / 2),
      height: Math.round(png.readUInt32BE(20) / 2),
    };
  } catch {
    return null;
  }
}

/**
 * The largest step size whose lines fit the card's middle: wide enough to read on a WhatsApp
 * thumbnail, never pushing the master's credit off the card. Plus Jakarta averages about half an
 * em per character; the text column is about 850 px wide.
 */
function fitStepSize(steps: string[], hasKannadaTitle: boolean): number {
  const room = hasKannadaTitle ? 600 : 640;
  for (const size of [46, 42, 38, 34, 30]) {
    const perLine = Math.floor(850 / (size * 0.5));
    const lines = steps.reduce((n, s) => n + Math.max(1, Math.ceil(s.length / perLine)), 0);
    const height = lines * size * 1.36 + (steps.length - 1) * (size >= 38 ? 26 : 16);
    if (height <= room) return size;
  }
  return 30;
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function eyebrow(card: OpenCard): string {
  const topic = FlnTopic.safeParse(card.topic);
  const grade = GradeBand.safeParse(card.gradeBand);
  return [
    topic.success ? FLN_TOPIC_LABELS[topic.data].en : null,
    grade.success ? GRADE_BAND_LABELS[grade.data].en : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function Lamp({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 -2 40 46">
      <circle cx="20" cy="15" r="16" fill={colors.flame} opacity="0.35" />
      <path
        d="M20 2 C23 8 27 12 27 17 C27 21.5 24 24 20 24 C16 24 13 21.5 13 17 C13 12 17 8 20 2 Z"
        fill={colors.flame}
      />
      <path
        d="M20 13 C21.4 16 23 18 23 20 C23 22 21.6 23 20 23 C18.4 23 17 22 17 20 C17 18 18.6 16 20 13 Z"
        fill={colors.paper}
      />
      <path d="M4 27 C4 37 11 42 20 42 C29 42 36 37 36 27 Z" fill={colors.clay} />
      <ellipse cx="20" cy="27" rx="16" ry="3.6" fill={colors["clay-cta"]} />
    </svg>
  );
}

function Header({ word, isSample }: { word: string; isSample: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Lamp size={64} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* 556 x 188 at 2x: the word sits in the top two thirds. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={word} width={185} height={63} alt="ಪರಂಪರೆ" style={{ marginBottom: -12 }} />
          <span style={{ fontSize: 24, color: colors["ink-3"], fontWeight: 600 }}>
            Parampara · a practice for tomorrow
          </span>
        </div>
      </div>
      {isSample && (
        <span
          style={{
            display: "flex",
            fontSize: 32,
            fontWeight: 600,
            color: colors.white,
            backgroundColor: colors.ink,
            borderRadius: 999,
            padding: "10px 28px",
          }}
        >
          Sample
        </span>
      )}
    </div>
  );
}

function CardImage({
  card,
  url,
  word,
  tag,
  titleKn,
}: {
  card: OpenCard;
  url: string;
  word: string;
  tag: string;
  /** The card's Kannada title, when it has been drawn (the Sample library). */
  titleKn: Png | null;
}) {
  const steps = card.steps.slice(0, MAX_STEPS);
  // As large as the card has room for (fitStepSize): read from a WhatsApp thumbnail or a wall.
  const stepSize = fitStepSize(steps.map((s) => s.en), titleKn !== null);
  const stepMax = stepSize <= 30 ? 150 : 170;
  const titleSize = titleKn ? 54 : card.title.en.length > 48 ? 58 : 64;
  const master = card.master.name
    ? `${card.master.name}${card.master.yearsTeaching ? `, ${card.master.yearsTeaching} years of teaching` : ""}`
    : "A master teacher";
  const label = eyebrow(card);
  const materials = card.materials
    .map((m) => m.en)
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");

  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.cream,
        backgroundImage: `radial-gradient(900px 520px at 85% 0%, rgba(255, 201, 77, 0.28), rgba(247, 243, 234, 0))`,
        padding: "60px 72px 52px",
        fontFamily: "Jakarta",
        color: colors.ink,
      }}
    >
      <Header word={word} isSample={card.isSample} />

      {/* Kannada first: the card's own Kannada title when it has one, else the Kannada tagline. */}
      {!titleKn && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tag}
          width={360}
          height={36}
          alt="ನಾಳೆ ತರಗತಿಯಲ್ಲಿ ಮಾಡಿ ನೋಡಿ"
          style={{ marginTop: 34 }}
        />
      )}
      {label && (
        <span
          style={{ marginTop: titleKn ? 34 : 14, fontSize: 26, fontWeight: 600, color: colors.moss }}
        >
          {label}
        </span>
      )}
      {titleKn && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={titleKn.src}
          width={titleKn.width}
          height={titleKn.height}
          alt={card.title.kn}
          style={{ marginTop: 8, marginLeft: -4 }}
        />
      )}
      <span
        style={{
          marginTop: titleKn ? 2 : 10,
          fontFamily: "Baloo",
          fontSize: titleSize,
          lineHeight: 1.08,
          color: colors.ink,
        }}
      >
        {clip(card.title.en, 90)}
      </span>
      <span style={{ marginTop: 16, fontSize: 27, lineHeight: 1.4, color: colors["ink-3"] }}>
        {clip(card.problem.en, 100)}
      </span>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 34,
          gap: stepSize >= 38 ? 26 : 16,
        }}
      >
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 22 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 54,
                height: 54,
                flexShrink: 0,
                borderRadius: 999,
                backgroundColor: colors.flame,
                fontFamily: "Baloo",
                fontSize: 30,
                color: colors.ink,
                paddingTop: 4,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: stepSize, lineHeight: 1.36, marginTop: 4, flex: 1 }}>
              {clip(s.en, stepMax)}
            </span>
          </div>
        ))}
      </div>

      {materials && (
        <div
          style={{
            display: "flex",
            marginTop: 26,
            marginBottom: 20,
            fontSize: 27,
            color: colors["ink-2"],
          }}
        >
          <span style={{ fontWeight: 600, marginRight: 12 }}>You need:</span>
          <span style={{ flex: 1 }}>{clip(materials, 90)}</span>
        </div>
      )}

      <div style={{ flexGrow: 1 }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          backgroundColor: colors.ink,
          borderRadius: 32,
          padding: "24px 30px",
          color: colors.paper,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 76,
            height: 76,
            flexShrink: 0,
            borderRadius: 999,
            backgroundColor: colors.clay,
            border: `4px solid ${colors.flame}`,
            fontFamily: "Baloo",
            fontSize: 36,
            color: colors.paper,
          }}
        >
          {card.master.name ? card.master.name.slice(0, 1).toUpperCase() : "★"}
        </span>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span style={{ fontSize: 22, color: colors.mist, fontWeight: 600 }}>
            From the classroom of
          </span>
          <span style={{ fontFamily: "Baloo", fontSize: 36, lineHeight: 1.15, marginTop: 2 }}>
            {clip(master, 60)}
          </span>
          {card.master.district && (
            <span style={{ fontSize: 22, color: colors.mist, marginTop: 2 }}>
              {card.master.district}
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginTop: 18,
          fontSize: 21,
          color: colors["ink-3"],
          lineHeight: 1.35,
        }}
      >
        <span style={{ flex: 1 }}>
          {card.isSample
            ? "Sample card for the demo, not from a real classroom. CC BY 4.0."
            : "Approved by a reviewer. Every step comes from the master's own recorded words. CC BY 4.0."}
        </span>
        <span style={{ fontWeight: 600, color: colors["clay-cta"] }}>{url}</span>
      </div>
    </div>
  );
}

/** A small designed image instead of a bare error, so a broken share still looks like Parampara. */
function Missing({
  word,
  missing,
  url,
  status,
}: {
  word: string;
  missing: string;
  url: string;
  status: 404 | 503;
}) {
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.cream,
        fontFamily: "Jakarta",
        color: colors.ink,
        gap: 24,
        padding: 96,
        textAlign: "center",
      }}
    >
      <Lamp size={140} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={word} width={278} height={94} alt="ಪರಂಪರೆ" />
      {status === 404 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={missing} width={657} height={67} alt="ಈ ಕಾರ್ಡ್ ಈಗ ಹಂಚಿಕೆಯಲ್ಲಿ ಇಲ್ಲ" />
      )}
      <span style={{ fontFamily: "Baloo", fontSize: 54, lineHeight: 1.15 }}>
        {status === 404
          ? "This card is not shared right now"
          : "This card could not be drawn just now"}
      </span>
      <span style={{ fontSize: 30, color: colors["ink-3"], lineHeight: 1.4 }}>
        {status === 404
          ? "It may not be approved yet, or its master may have changed what they share."
          : "Please try again in a little while."}
      </span>
      <span style={{ marginTop: 24, fontSize: 28, fontWeight: 600, color: colors["clay-cta"] }}>{url}</span>
    </div>
  );
}

export async function GET(req: Request, ctx: RouteContext<"/api/cards/[id]/image">) {
  const { id } = await ctx.params;
  const [[baloo, jakarta, jakartaSemi], { word, tag, missing }] = await Promise.all([fonts, kannada]);
  const url = shareBaseUrl(originFromHeaders(req.headers)).replace(/^https?:\/\//, "");
  const options = (status: number, cache: string) => ({
    width: W,
    height: H,
    status,
    fonts: [
      { name: "Baloo", data: baloo, weight: 700 as const, style: "normal" as const },
      { name: "Jakarta", data: jakarta, weight: 400 as const, style: "normal" as const },
      { name: "Jakarta", data: jakartaSemi, weight: 600 as const, style: "normal" as const },
    ],
    headers: {
      "cache-control": cache,
      "content-disposition": `inline; filename="parampara-${id.replace(/[^\w-]/g, "").slice(0, 40)}.png"`,
    },
  });

  let card: OpenCard | null;
  try {
    card = await loadOpenCard(id);
  } catch {
    return new ImageResponse(
      <Missing word={word} missing={missing} url={url} status={503} />,
      options(503, "no-store"),
    );
  }
  if (!card)
    return new ImageResponse(
      <Missing word={word} missing={missing} url={url} status={404} />,
      options(404, "no-store"),
    );

  return new ImageResponse(
    <CardImage card={card} url={url} word={word} tag={tag} titleKn={await kannadaTitle(card.title.kn)} />,
    // An hour at most: a withdrawn card or a changed name must not linger (next/og's default is a
    // year, immutable).
    options(200, "public, max-age=600, s-maxage=3600, stale-while-revalidate=600"),
  );
}
