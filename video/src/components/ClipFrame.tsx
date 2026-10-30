import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Picture } from "../schema";
import { assetUrl, Filled, hasAsset } from "../story-context";
import { colors, fonts, shadow, springs } from "../theme";
import { Grain } from "./Grain";
import { Placeholder } from "./Placeholder";

type ClipPicture = Extract<Picture, { kind: "clip" }>;

// A 390 x 844 clip in a phone; a 1280 x 800 clip in a laptop. Sizes keep the clip's own ratio.
const PHONE = { w: 450, h: Math.round((450 * 844) / 390), bezel: 16, radius: 66 };
const LAPTOP = { w: 1152, h: 720, bezel: 22, radius: 26 };
/**
 * The story recorder can draw an English caption bar over the top of a clip (tests/e2e/story.spec.ts).
 * Set its height here to scale it out of view; clips recorded with STORY_CAPTIONS=0 need none.
 */
const BAR = { phone: 0, laptop: 0 }; // clips since 30 Oct are recorded with STORY_CAPTIONS=0

function Screen({ picture, w, h }: { picture: ClipPicture; w: number; h: number }) {
  const { fps } = useVideoConfig();
  if (!hasAsset(picture.src)) {
    return (
      <Placeholder
        path={picture.src}
        what={`${picture.frame} clip`}
        note="Recorded by `pnpm exec playwright test --project=story` (docs/story/README.md)."
        width={w}
        height={h}
      />
    );
  }
  return (
    <OffthreadVideo
      src={assetUrl(picture.src)}
      muted
      trimBefore={Math.round(picture.from * fps)}
      playbackRate={picture.playbackRate}
      style={{
        width: w,
        height: h,
        objectFit: "cover",
        display: "block",
        transform: `scale(${h / (h - BAR[picture.frame] - picture.cropTop)})`,
        transformOrigin: "50% 100%",
      }}
    />
  );
}

/** An app clip from Playwright, inside a phone (390 px clips) or a laptop (1280 px clips). */
export function ClipFrame({ picture }: { picture: ClipPicture }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: springs.gentle });
  const lift = interpolate(enter, [0, 1], [40, 0]);

  if (picture.frame === "laptop") {
    const { w, h, bezel, radius } = LAPTOP;
    return (
      <AbsoluteFill
        style={{ background: `linear-gradient(180deg, ${colors.cream}, ${colors.dusk})` }}
      >
        <Grain />
        <div
          style={{
            position: "absolute",
            left: (1920 - w - bezel * 2) / 2,
            top: 36,
            opacity: enter,
            transform: `translateY(${lift}px)`,
          }}
        >
          <div
            style={{
              padding: bezel,
              paddingBottom: bezel + 6,
              background: colors.ink,
              borderRadius: radius,
              boxShadow: shadow.deep,
            }}
          >
            <div
              style={{
                width: w,
                height: h,
                overflow: "hidden",
                borderRadius: 8,
                background: colors.paper,
              }}
            >
              <Screen picture={picture} w={w} h={h} />
            </div>
          </div>
          {/* the laptop's base */}
          <div
            style={{
              margin: "0 -70px",
              height: 22,
              background: `linear-gradient(180deg, ${colors["ink-3"]}, ${colors.ink})`,
              borderRadius: "0 0 26px 26px",
            }}
          />
        </div>
        {picture.chip && <TruthChip text={picture.chip} />}
      </AbsoluteFill>
    );
  }

  const { w, h, bezel, radius } = PHONE;
  return (
    <AbsoluteFill
      style={{ background: `linear-gradient(180deg, ${colors.cream}, ${colors.dusk})` }}
    >
      <Grain />
      <div
        style={{
          position: "absolute",
          left: 360,
          top: (1080 - h - bezel * 2) / 2,
          padding: bezel,
          background: colors.ink,
          borderRadius: radius,
          boxShadow: shadow.deep,
          opacity: enter,
          transform: `translateY(${lift}px)`,
        }}
      >
        <div style={{ width: w, height: h, overflow: "hidden", borderRadius: radius - bezel }}>
          <Screen picture={picture} w={w} h={h} />
        </div>
      </div>
      {(picture.sideKn || picture.sideEn) && (
        <div
          style={{
            position: "absolute",
            left: 960,
            right: 100,
            top: 0,
            bottom: 260,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 18,
            opacity: spring({ frame: frame - 8, fps, config: springs.gentle }),
          }}
        >
          {picture.sideKn && (
            <div
              lang="kn"
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 76,
                lineHeight: 1.3,
                color: colors["clay-cta"],
              }}
            >
              <Filled text={picture.sideKn} />
            </div>
          )}
          {picture.sideEn && (
            <div
              style={{
                fontFamily: fonts.latin,
                fontWeight: 600,
                fontSize: 56,
                lineHeight: 1.3,
                color: colors.ink,
              }}
            >
              <Filled text={picture.sideEn} />
            </div>
          )}
        </div>
      )}
      {picture.chip && <TruthChip text={picture.chip} />}
    </AbsoluteFill>
  );
}

/** Plain English truth chip, top left, clear of the device: what this screen is. */
function TruthChip({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        top: 40,
        maxWidth: 280,
        padding: "10px 18px",
        borderRadius: 16,
        background: colors.ink,
        color: colors.paper,
        fontFamily: fonts.latin,
        fontWeight: 600,
        fontSize: 26,
        lineHeight: 1.3,
      }}
    >
      {text.split(" · ").map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

/** Where subtitles sit beside a phone: the right column, so they never cover the screen. */
export const PHONE_SUBTITLE_AREA = { left: 920, right: 80 } as const;
