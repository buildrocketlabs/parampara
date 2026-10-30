import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { formatNumber, type Picture } from "../schema";
import { assetUrl, hasAsset, Marked, useStory } from "../story-context";
import { colors, fonts, radius, shadow, springs } from "../theme";
import { Grain } from "./Grain";

type NumbersPicture = Extract<Picture, { kind: "numbers" }>;
type Item = NumbersPicture["items"][number];

type Shown =
  | { kind: "value"; text: string; source: string }
  | { kind: "private"; source: string }
  | { kind: "pending"; key: string; source: string };

/** What one item shows: a fixed fact, a computed number, a private count, or a marked placeholder. */
function resolve(item: Item, numbers: ReturnType<typeof useStory>["numbers"]): Shown {
  if ("value" in item) return { kind: "value", text: item.value, source: item.source };
  const entry = numbers.numbers[item.key];
  const source = item.source ?? entry?.source ?? "numbers.json has no entry for this key";
  if (entry?.hidden) return { kind: "private", source };
  const text = formatNumber(entry);
  return text === null
    ? { kind: "pending", key: item.key, source }
    : { kind: "value", text, source };
}

/** Counts a plain number up as it appears ("8,042" → 0 … 8,042); anything else is shown as is. */
function countUp(text: string, progress: number): string {
  const m = text.match(/^([^\d]*)([\d,]+)([^\d]*)$/);
  if (!m) return text;
  const target = Number(m[2]!.replace(/,/g, ""));
  if (!Number.isFinite(target)) return text;
  const now = Math.round(target * progress);
  return `${m[1]}${now.toLocaleString("en-IN")}${m[3]}`;
}

/**
 * Numbers that appear one by one, each with its source under it (STORY.md: every number says its
 * source). Computed numbers come from numbers.json; a null one is a marked placeholder in drafts.
 */
export function NumberReveal({ picture }: { picture: NumbersPicture }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { numbers } = useStory();
  const items = picture.items;
  const step = Math.min(fps * 3.2, (durationInFrames * 0.75) / items.length);
  const backdrop = picture.backdrop && hasAsset(picture.backdrop) ? picture.backdrop : null;
  const cols = items.length === 4 ? 2 : items.length;

  return (
    <AbsoluteFill style={{ background: colors.cream }}>
      {backdrop && (
        <Img
          src={assetUrl(backdrop)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${interpolate(frame, [0, durationInFrames], [1.04, 1.1])})`,
          }}
        />
      )}
      <AbsoluteFill
        style={{ background: backdrop ? "rgba(247, 243, 234, 0.86)" : "transparent" }}
      />
      <Grain />
      {picture.backdrop && !backdrop && (
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 48,
            fontFamily: fonts.latin,
            fontSize: 22,
            color: colors["clay-cta"],
          }}
        >
          Missing backdrop photo: video/public/{picture.backdrop}
        </div>
      )}
      {picture.badge && (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 56,
            padding: "8px 22px",
            borderRadius: radius.chip,
            background: picture.badge === "Sample" ? colors.sage : colors.ink,
            color: picture.badge === "Sample" ? colors.ink : colors.flame,
            fontFamily: fonts.latin,
            fontWeight: 700,
            fontSize: 26,
          }}
        >
          {picture.badge}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          inset: "110px 90px 240px",
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 36,
          alignContent: "center",
        }}
      >
        {items.map((item, i) => {
          const p = spring({ frame: frame - i * step, fps, config: springs.gentle });
          // From 80%: the number on screen is never far from the one being spoken.
          const count = interpolate(frame - i * step, [0, fps * 0.8], [0.8, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const shown = resolve(item, numbers);
          return (
            <div
              key={i}
              style={{
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)`,
                background: colors.paper,
                borderRadius: radius.card,
                boxShadow: shadow.warm,
                padding: "34px 40px 30px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.display,
                  fontWeight: 700,
                  fontSize: items.length > 3 ? 96 : 120,
                  lineHeight: 1.05,
                  color: colors["clay-cta"],
                }}
              >
                {shown.kind === "value" && countUp(shown.text, count)}
                {shown.kind === "private" && <span style={{ fontSize: 56 }}>Kept private</span>}
                {shown.kind === "pending" && <Marked>{`{${shown.key}}`}</Marked>}
              </div>
              <div
                style={{
                  fontFamily: fonts.latin,
                  fontWeight: 600,
                  fontSize: 32,
                  lineHeight: 1.3,
                  color: colors.ink,
                }}
              >
                {shown.kind === "private"
                  ? `${item.label}: fewer than 5 teachers, so no number`
                  : item.label}
              </div>
              {item.labelKn && (
                <div
                  lang="kn"
                  style={{
                    fontFamily: fonts.kannada,
                    fontSize: 30,
                    lineHeight: 1.65,
                    color: colors["ink-3"],
                  }}
                >
                  {item.labelKn}
                </div>
              )}
              <div
                style={{
                  fontFamily: fonts.latin,
                  fontSize: 26,
                  lineHeight: 1.35,
                  color: colors.muted,
                }}
              >
                {shown.kind === "pending"
                  ? `Not read yet. Source: ${shown.source}`
                  : `Source: ${shown.source}`}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
