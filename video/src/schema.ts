import { z } from "zod";

// The shape of video/script.json and video/numbers.json. Imported by the composition (bundled by
// Remotion) and by scripts/*.ts (run by Node's own type stripping), so it imports nothing but zod.

export const MAX_SECONDS = 180;
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** A path inside video/public, never absolute and never climbing out. */
const asset = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), "a path inside video/public");

const hanateState = z.enum([
  "idle",
  "listening",
  "thinking",
  "speaking",
  "happy",
  "caring",
  "resting",
  "celebrating",
]);

/** A fixed fact from STORY.md §1 (value and source written here) or a key into numbers.json. */
const numberItem = z.union([
  z.object({
    value: z.string().min(1),
    label: z.string().min(1),
    labelKn: z.string().optional(),
    source: z.string().min(3),
  }),
  z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    labelKn: z.string().optional(),
    /** A plain words version of numbers.json's source, for the screen. */
    source: z.string().optional(),
  }),
]);

const picture = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("title"),
    tone: z.enum(["cream", "ink", "black"]).default("cream"),
    kn: z.string().optional(),
    en: z.string().optional(),
    hanate: hanateState.optional(),
    /** A lower third under the title: name, role, years. */
    lower: z.string().optional(),
    /** End credits, small at the top of the frame. */
    credits: z.string().optional(),
  }),
  z.object({
    kind: z.literal("numbers"),
    items: z.array(numberItem).min(1).max(5),
    /** Field numbers carry "Koppal field test" (Law 7). */
    badge: z.enum(["Koppal field test", "Sample"]).optional(),
    /** An optional photo behind the numbers, dimmed. */
    backdrop: asset.optional(),
  }),
  z.object({
    kind: z.literal("clip"),
    src: asset,
    /** phone: a 390 px clip; laptop: a 1280 px clip. */
    frame: z.enum(["phone", "laptop"]),
    /** Seconds into the clip where this scene starts. */
    from: z.number().min(0).default(0),
    playbackRate: z.number().min(0.25).max(4).default(1),
    /** Words beside the frame. */
    sideKn: z.string().optional(),
    sideEn: z.string().optional(),
    /** A plain English truth chip on the frame: "Sample demo account", "Koppal field test". */
    chip: z.string().optional(),
    /** Pixels (at the frame's size) scaled out of view at the top: a scrolled page's half cut line. */
    cropTop: z.number().min(0).max(120).default(0),
  }),
  z.object({
    kind: z.literal("hanate"),
    state: hanateState.default("celebrating"),
    /** How many small lamps Hanate lights, left to right. */
    lamps: z.number().int().min(0).max(24).default(9),
  }),
  z.object({
    kind: z.literal("photo"),
    src: asset,
    /** Faces policy: a photo of children's faces is never allowed, so it is not an option. */
    faces: z.enum(["none", "adults-consented"]),
    caption: z.string().optional(),
    /** Ken Burns: from and to (scale, and pan as a fraction of the frame). */
    zoom: z.tuple([z.number().min(1).max(1.4), z.number().min(1).max(1.4)]).default([1.04, 1.14]),
    pan: z
      .tuple([z.number().min(-0.1).max(0.1), z.number().min(-0.1).max(0.1)])
      .default([0, -0.03]),
    illustration: z.boolean().default(false),
    /** CSS object-position: where the photo is anchored (faces stay in frame). */
    focus: z.string().default("50% 30%"),
    /** Which top corner the caption sits in, away from faces. */
    captionAt: z.enum(["left", "right"]).default("left"),
  }),
  z.object({
    /** Child safety shown: a typed name turns into ಒಂದು ಮಗು, then the Childline 1098 card. */
    kind: z.literal("safety"),
  }),
  z.object({
    /** Consented photos one after another, crossfading, each with a slow push in. */
    kind: z.literal("montage"),
    photos: z
      .array(
        z.object({
          src: asset,
          faces: z.enum(["none", "adults-consented"]),
          focus: z.string().default("50% 25%"),
        }),
      )
      .min(2)
      .max(6),
    caption: z.string().optional(),
    captionAt: z.enum(["left", "right"]).default("left"),
  }),
  z.object({
    /** India drawn in code from real boundaries: Koppal's lamp, then Karnataka, then state by state. */
    kind: z.literal("map"),
    caption: z.string().optional(),
  }),
  z.object({
    kind: z.literal("video"),
    src: asset,
    faces: z.enum(["none", "adults-consented"]),
    from: z.number().min(0).default(0),
    /** The clip's own sound (the selfie speaks); off when the voiceover carries the scene. */
    muted: z.boolean().default(false),
    caption: z.string().optional(),
  }),
]);

const audio = z.object({
  src: asset,
  kind: z.enum(["voiceover", "headmaster", "sound"]),
  /** Seconds after the scene starts. */
  at: z.number().min(0).default(0),
  /** Seconds into the file to start from (to pick his best line out of a long note). */
  from: z.number().min(0).default(0),
  /** Seconds to play; omit to play to the end of the file or the scene. */
  duration: z.number().positive().optional(),
  volume: z.number().min(0).max(1).default(1),
});

export const sceneSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, "lower case, digits and dashes"),
    start: z.number().min(0),
    end: z.number().positive(),
    /** What this beat is for, for whoever edits the script next. */
    note: z.string().optional(),
    picture,
    /** The Kannada line on screen, if any. */
    kannada: z.string().optional(),
    /** The English subtitle (the Kannada line's English, or the words heard). May hold {keys}. */
    english: z.string().optional(),
    /** A small truth chip at the top right of the scene (e.g. the AI narration credit). */
    tag: z.string().optional(),
    /** The voiceover words for this beat (the AI narrator reads them). May hold {keys}. */
    voiceover: z.string().default(""),
    audio: z.array(audio).default([]),
  })
  .refine((s) => s.end > s.start, { message: "end must be after start" });

export const scriptSchema = z
  .object({
    title: z.string(),
    fps: z.literal(FPS),
    width: z.literal(WIDTH),
    height: z.literal(HEIGHT),
    scenes: z.array(sceneSchema).min(1),
    /** The music bed for the whole film (scripts/score.ts bakes the ducking into it). */
    music: z.object({ src: asset, volume: z.number().min(0).max(1).default(1) }).optional(),
  })
  .superRefine((s, ctx) => {
    const ids = new Set<string>();
    s.scenes.forEach((scene, i) => {
      if (ids.has(scene.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", i, "id"],
          message: `duplicate id ${scene.id}`,
        });
      }
      ids.add(scene.id);
      const prev = s.scenes[i - 1];
      if (prev && scene.start < prev.end) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", i, "start"],
          message: `${scene.id} starts at ${scene.start}s, before ${prev.id} ends at ${prev.end}s (scenes must not overlap and must be in order)`,
        });
      }
    });
    const total = Math.max(...s.scenes.map((x) => x.end));
    if (total >= MAX_SECONDS) {
      ctx.addIssue({
        code: "custom",
        path: ["scenes"],
        message: `total is ${total}s; it must be under ${MAX_SECONDS}s (judges stop at 3:00)`,
      });
    }
  });

/** One computed number. `value` stays null until it is read from the database. */
const numberEntry = z.object({
  value: z.union([z.number(), z.string(), z.null()]),
  /** Where it comes from (a query, a file, a page). Required, so no number is ever sourceless. */
  source: z.string().min(3),
  /** true when the app keeps it private (fewer than 5 teachers behind it): shown as words, not a number. */
  hidden: z.boolean().default(false),
  /** Shown before (prefix, e.g. "₹") or after (suffix) the number. */
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

export const numbersSchema = z.object({
  $comment: z.string().optional(),
  numbers: z.record(z.string(), numberEntry),
});

export type Script = z.infer<typeof scriptSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Picture = Scene["picture"];
export type AudioCue = Scene["audio"][number];
export type Numbers = z.infer<typeof numbersSchema>;
export type NumberEntry = Numbers["numbers"][string];

export const totalSeconds = (s: Script) => Math.max(...s.scenes.map((x) => x.end));

/** Every asset a scene needs, with what it is for. */
export function sceneAssets(scene: Scene): Array<{ path: string; what: string }> {
  const out: Array<{ path: string; what: string }> = [];
  const p = scene.picture;
  if (p.kind === "clip") out.push({ path: p.src, what: `app clip (${p.frame})` });
  if (p.kind === "photo") out.push({ path: p.src, what: "photo" });
  if (p.kind === "video") out.push({ path: p.src, what: "video" });
  if (p.kind === "montage") for (const ph of p.photos) out.push({ path: ph.src, what: "photo" });
  if (p.kind === "numbers" && p.backdrop)
    out.push({ path: p.backdrop, what: "photo behind numbers" });
  for (const a of scene.audio) out.push({ path: a.src, what: a.kind });
  return out;
}

/** The {keys} a text uses. */
export function textKeys(text: string | undefined): string[] {
  return [...(text ?? "").matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]!);
}

/** Every numbers.json key the script needs. */
export function scriptKeys(script: Script): string[] {
  const keys = new Set<string>();
  for (const s of script.scenes) {
    const p = s.picture;
    const captions = p.kind === "photo" || p.kind === "montage" || p.kind === "map" ? [p.caption] : [];
    for (const k of [
      ...textKeys(s.english),
      ...textKeys(s.voiceover),
      ...textKeys(s.kannada),
      ...textKeys(s.tag),
      ...captions.flatMap((c) => textKeys(c)),
    ]) {
      keys.add(k);
    }
    if (s.picture.kind === "numbers") {
      for (const item of s.picture.items) if ("key" in item) keys.add(item.key);
    }
  }
  return [...keys];
}

/** Formats a number entry for screen: Indian grouping, prefix and suffix; null stays null. */
export function formatNumber(entry: NumberEntry | undefined): string | null {
  if (!entry || entry.value === null) return null;
  const v =
    typeof entry.value === "number" ? entry.value.toLocaleString("en-IN") : String(entry.value);
  return `${entry.prefix ?? ""}${v}${entry.suffix ?? ""}`;
}

/** True when a text still holds a TODO (words not chosen yet, like his line or a teacher's quote). */
export const isTodo = (text: string | undefined) => /\bTODO\b/.test(text ?? "");

/**
 * What stops a final render: a missing asset, a number not yet read, a key numbers.json lacks, or
 * words still marked TODO. Drafts render all of these as labelled placeholders instead.
 */
export function findProblems(
  script: Script,
  numbers: Numbers,
  exists: (assetPath: string) => boolean,
): string[] {
  const problems: string[] = [];
  for (const scene of script.scenes) {
    for (const a of sceneAssets(scene)) {
      if (!exists(a.path)) problems.push(`${scene.id}: missing ${a.what} public/${a.path}`);
    }
    const p = scene.picture;
    const texts = [scene.kannada, scene.english, scene.voiceover];
    if (p.kind === "title") texts.push(p.kn, p.en, p.lower);
    if (p.kind === "montage") texts.push(p.caption);
    for (const t of texts) if (isTodo(t)) problems.push(`${scene.id}: words still TODO ("${t}")`);
  }
  if (script.music && !exists(script.music.src)) problems.push(`missing music public/${script.music.src}`);
  for (const key of scriptKeys(script)) {
    const entry = numbers.numbers[key];
    if (!entry) problems.push(`numbers.json has no "${key}"`);
    else if (entry.value === null && !entry.hidden) problems.push(`numbers.json "${key}" is null`);
  }
  return problems;
}
