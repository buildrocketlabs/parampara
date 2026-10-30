import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Picture } from "../schema";
import { assetUrl, Filled, hasAsset } from "../story-context";
import { colors, fonts } from "../theme";
import { Placeholder } from "./Placeholder";

type MontagePicture = Extract<Picture, { kind: "montage" }>;

const FADE = 0.7;

/** Consented photos, one after another, each with a slow warm push in, crossfading. */
export function PhotoMontage({ picture }: { picture: MontagePicture }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const each = durationInFrames / picture.photos.length;
  const fade = FADE * fps;
  return (
    <AbsoluteFill style={{ background: colors.ink, overflow: "hidden" }}>
      {picture.photos.map((p, i) => {
        const start = i * each;
        const local = frame - start;
        if (local < -fade || local > each + fade) return null;
        const opacity =
          i === 0
            ? interpolate(local, [each, each + fade], [1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : interpolate(
                local,
                [0, fade, each, each + fade],
                [0, 1, 1, i === picture.photos.length - 1 ? 1 : 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              );
        const t = Math.min(Math.max(local / (each + fade), 0), 1);
        const scale = interpolate(t, [0, 1], [1.02, 1.1]);
        const pan = interpolate(t, [0, 1], [0, i % 2 ? 1.5 : -1.5]);
        return (
          <AbsoluteFill key={p.src} style={{ opacity }}>
            {hasAsset(p.src) ? (
              <Img
                src={assetUrl(p.src)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: p.focus,
                  transform: `scale(${scale}) translateX(${pan}%)`,
                  // A warm grade and a light vignette, as for every photo in the film.
                  filter: "sepia(0.12) saturate(1.08) brightness(1.02)",
                }}
              />
            ) : (
              <AbsoluteFill style={{ background: colors.cream, padding: 80 }}>
                <Placeholder
                  path={p.src}
                  what="photo"
                  note="Adults who agreed; never a child's face."
                />
              </AbsoluteFill>
            )}
          </AbsoluteFill>
        );
      })}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(21, 48, 42, 0.45) 100%)",
        }}
      />
      {picture.caption && (
        <div
          style={{
            position: "absolute",
            ...(picture.captionAt === "left" ? { left: 64 } : { right: 64 }),
            top: 40,
            maxWidth: 1100,
            padding: "14px 26px",
            borderRadius: 20,
            background: "rgba(21, 48, 42, 0.86)",
            color: colors.paper,
            fontFamily: fonts.latin,
            fontWeight: 600,
            fontSize: 32,
            lineHeight: 1.4,
            textWrap: "balance",
          }}
        >
          <Filled text={picture.caption} />
        </div>
      )}
    </AbsoluteFill>
  );
}
