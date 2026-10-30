import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ClipFrame, PHONE_SUBTITLE_AREA } from "./components/ClipFrame";
import { IndiaMap } from "./components/IndiaMap";
import { PhotoMontage } from "./components/PhotoMontage";
import { SafetyRedact } from "./components/SafetyRedact";
import { LampRow } from "./components/LampRow";
import { NumberReveal } from "./components/NumberReveal";
import { FullVideo, KenBurnsPhoto } from "./components/Photo";
import { Subtitles } from "./components/Subtitles";
import { TitleCard } from "./components/TitleCard";
import { useMemo } from "react";
import {
  findProblems,
  numbersSchema,
  scriptSchema,
  type AudioCue,
  type Numbers,
  type Scene,
  type Script,
} from "./schema";
import { assetUrl, Filled, hasAsset, StoryContext, type Mode } from "./story-context";
import { colors, cssVars, fonts } from "./theme";

export type StoryProps = {
  mode: Mode;
  /** script.json as read (validated again inside, so --props cannot slip past the schema). */
  script: Script | unknown;
  numbers: Numbers | unknown;
};

function Picture({ scene }: { scene: Scene }) {
  const p = scene.picture;
  switch (p.kind) {
    case "title":
      return <TitleCard tone={p.tone} kn={p.kn} en={p.en} hanate={p.hanate} lower={p.lower} credits={p.credits} />;
    case "numbers":
      return <NumberReveal picture={p} />;
    case "clip":
      return <ClipFrame picture={p} />;
    case "hanate":
      return <LampRow state={p.state} lamps={p.lamps} />;
    case "photo":
      return <KenBurnsPhoto picture={p} />;
    case "safety":
      return <SafetyRedact />;
    case "montage":
      return <PhotoMontage picture={p} />;
    case "map":
      return <IndiaMap caption={p.caption} />;
    case "video":
      return <FullVideo picture={p} />;
  }
}

function Cue({ cue, mode }: { cue: AudioCue; mode: Mode }) {
  const { fps } = useVideoConfig();
  const from = Math.round(cue.at * fps);
  const length = cue.duration ? Math.round(cue.duration * fps) : undefined;
  if (!hasAsset(cue.src)) {
    // Drafts say what is missing in the corner; a final render never gets this far (findProblems).
    return mode === "draft" ? (
      <Sequence from={from} durationInFrames={length ?? fps * 2} layout="none">
        <MissingAudio cue={cue} />
      </Sequence>
    ) : null;
  }
  return (
    <Sequence from={from} durationInFrames={length} layout="none">
      <Audio src={assetUrl(cue.src)} trimBefore={Math.round(cue.from * fps)} volume={cue.volume} />
    </Sequence>
  );
}

function MissingAudio({ cue }: { cue: AudioCue }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        top: 40 + (cue.kind === "headmaster" ? 54 : 0),
        padding: "6px 16px",
        borderRadius: 12,
        background: colors.flame,
        color: colors.ink,
        fontFamily: fonts.latin,
        fontWeight: 600,
        fontSize: 20,
      }}
    >
      Missing {cue.kind} audio: video/public/{cue.src}
    </div>
  );
}

function SceneView({ scene, mode }: { scene: Scene; mode: Mode }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // A short fade in and out at each cut; scenes never overlap (the schema checks).
  const opacity = interpolate(frame, [0, 6, durationInFrames - 6, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const besidePhone = scene.picture.kind === "clip" && scene.picture.frame === "phone";
  const glow = scene.start === 0 ? 0 : interpolate(frame, [0, 4, 20], [0.55, 0.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity }}>
      <Picture scene={scene} />
      {/* Light is the transition (brief §5): a warm flame glow that blooms at each cut and fades. */}
      {glow > 0 && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background: `radial-gradient(circle at 50% 55%, rgba(255, 201, 77, ${glow}) 0%, rgba(242, 169, 59, ${glow * 0.45}) 30%, transparent 60%)`,
          }}
        />
      )}
      {scene.tag && (
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 40,
            // Fits the margin beside a laptop frame; wraps rather than covering the screen.
            maxWidth: 330,
            padding: "8px 18px",
            borderRadius: 16,
            lineHeight: 1.35,
            textAlign: "right",
            background: colors.paper,
            color: colors.ink,
            fontFamily: fonts.latin,
            fontWeight: 600,
            fontSize: 26,
          }}
        >
          <Filled text={scene.tag} />
        </div>
      )}
      <Subtitles
        kannada={scene.kannada}
        english={scene.english}
        area={besidePhone ? PHONE_SUBTITLE_AREA : undefined}
      />
      {scene.audio.map((cue, i) => (
        <Cue key={i} cue={cue} mode={mode} />
      ))}
    </AbsoluteFill>
  );
}

function DraftMark({ scene }: { scene: Scene | undefined }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  const clock = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          fontFamily: fonts.latin,
          fontWeight: 700,
          fontSize: 260,
          color: "rgba(200, 85, 61, 0.10)",
          transform: "rotate(-14deg)",
        }}
      >
        DRAFT
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 14,
          fontFamily: "monospace",
          fontSize: 22,
          color: colors["clay-cta"],
          background: "rgba(255, 253, 248, 0.85)",
          padding: "2px 10px",
          borderRadius: 8,
        }}
      >
        DRAFT · {clock} · {scene?.id ?? "between scenes"}
      </div>
    </>
  );
}

/** The whole video: every scene from script.json at its time, with its picture, words and sound. */
export function Story(props: StoryProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Props may come from --props (raw JSON), so they are parsed here too: defaults filled, bad shapes
  // stopped with the schema's message.
  const { script, numbers } = useMemo(
    () => ({
      script: scriptSchema.parse(props.script),
      numbers: numbersSchema.parse(props.numbers),
    }),
    [props.script, props.numbers],
  );
  const mode: Mode = props.mode === "final" ? "final" : "draft";
  if (mode === "final") {
    const problems = findProblems(script, numbers, hasAsset);
    if (problems.length) {
      throw new Error(`Final render refused:\n${problems.join("\n")}`);
    }
  }
  const now = script.scenes.find((s) => frame >= s.start * fps && frame < s.end * fps);
  return (
    <StoryContext.Provider value={{ mode, numbers }}>
      {/* Dark under every scene, so each cut passes through the dark into the next lamp, never cream. */}
      <AbsoluteFill style={{ ...cssVars, background: "#0E1F1B" }}>
        {script.scenes.map((scene) => (
          <Sequence
            key={scene.id}
            name={scene.id}
            from={Math.round(scene.start * fps)}
            durationInFrames={Math.round((scene.end - scene.start) * fps)}
          >
            <SceneView scene={scene} mode={mode} />
          </Sequence>
        ))}
        {script.music && hasAsset(script.music.src) && (
          <Audio src={assetUrl(script.music.src)} volume={script.music.volume} />
        )}
        {mode === "draft" && <DraftMark scene={now} />}
      </AbsoluteFill>
    </StoryContext.Provider>
  );
}
