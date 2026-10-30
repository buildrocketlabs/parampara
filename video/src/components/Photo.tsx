import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Picture } from "../schema";
import { assetUrl, Filled, hasAsset } from "../story-context";
import { colors, fonts, radius, springs } from "../theme";
import { Placeholder } from "./Placeholder";

type PhotoPicture = Extract<Picture, { kind: "photo" }>;
type VideoPicture = Extract<Picture, { kind: "video" }>;

function Caption({ text, at = "left" }: { text: string; at?: "left" | "right" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 10, fps, config: springs.gentle });
  return (
    <div
      style={{
        position: "absolute",
        ...(at === "left" ? { left: 64 } : { right: 64 }),
        top: 40,
        maxWidth: 760,
        padding: "14px 26px",
        borderRadius: 20,
        background: "rgba(21, 48, 42, 0.86)",
        color: colors.paper,
        fontFamily: fonts.latin,
        fontWeight: 600,
        fontSize: 32,
        lineHeight: 1.4,
        textWrap: "balance",
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [-16, 0])}px)`,
      }}
    >
      <Filled text={text} />
    </div>
  );
}

/** A consented photo with a slow Ken Burns: zoom and pan from one pose to another over the scene. */
export function KenBurnsPhoto({ picture }: { picture: PhotoPicture }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!hasAsset(picture.src)) {
    return (
      <AbsoluteFill style={{ background: colors.cream, padding: 80 }}>
        <Placeholder
          path={picture.src}
          what="photo"
          note={`Faces: ${picture.faces === "none" ? "no faces" : "adults who agreed"}. Never a child's face.`}
        />
      </AbsoluteFill>
    );
  }
  const t = frame / Math.max(durationInFrames - 1, 1);
  const ease = (x: number) => x * x * (3 - 2 * x);
  const scale = interpolate(ease(t), [0, 1], picture.zoom);
  const pan = interpolate(ease(t), [0, 1], picture.pan) * 100;
  return (
    <AbsoluteFill style={{ background: colors.ink, overflow: "hidden" }}>
      <Img
        src={assetUrl(picture.src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: picture.focus,
          transform: `scale(${scale}) translate(${pan}%, ${pan / 2}%)`,
        }}
      />
      {picture.caption && <Caption text={picture.caption} at={picture.captionAt} />}
      {picture.illustration && (
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 40,
            padding: "6px 18px",
            borderRadius: radius.chip,
            background: colors.paper,
            color: colors.ink,
            fontFamily: fonts.latin,
            fontWeight: 600,
            fontSize: 22,
          }}
        >
          Illustration
        </div>
      )}
    </AbsoluteFill>
  );
}

/** A full frame video (the selfie): its own sound unless the voiceover carries the scene. */
export function FullVideo({ picture }: { picture: VideoPicture }) {
  const { fps } = useVideoConfig();
  if (!hasAsset(picture.src)) {
    return (
      <AbsoluteFill style={{ background: colors.cream, padding: 80 }}>
        <Placeholder
          path={picture.src}
          what="video"
          note="The founder's selfie clip (video/README.md)."
        />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      <OffthreadVideo
        src={assetUrl(picture.src)}
        muted={picture.muted}
        trimBefore={Math.round(picture.from * fps)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {picture.caption && <Caption text={picture.caption} />}
    </AbsoluteFill>
  );
}
