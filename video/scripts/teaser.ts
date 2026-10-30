// The 20 second teaser, cut from the final film (out/parampara.mp4) by scene, so every line stays
// whole: 9 pm, the young teacher, his own voice, the map. Writes out/teaser.mp4.
//   pnpm --dir video teaser
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptSchema } from "../src/schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const film = join(root, "out/parampara.mp4");
if (!existsSync(film)) {
  console.error("Render the film first: pnpm --dir video render:final");
  process.exit(1);
}
const script = scriptSchema.parse(JSON.parse(readFileSync(join(root, "script.json"), "utf8")));
const at = (id: string) => {
  const s = script.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`no scene ${id}`);
  return s;
};
const hear = at("hear-master");
const hisAt = hear.start + (hear.audio.find((a) => a.kind === "headmaster")?.at ?? 0);

/** [from, to] in seconds of the film. */
const cuts: Array<[number, number]> = [
  [at("deliver-window").start, at("deliver-window").end],
  [at("deliver-phone").start, at("deliver-phone").end],
  [hisAt - 0.4, hisAt + 5.6],
  [at("vision-map").start, at("vision-map").end],
];
const FADE = 0.3;
const parts = cuts.map(
  ([a, b], i) =>
    `[0:v]trim=${a}:${b},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=0.08,afade=t=out:st=${(b - a - 0.12).toFixed(2)}:d=0.12[a${i}]`,
);
// Crossfade the pictures by light (fade through), cut the sound cleanly between lines.
let v = "[v0]";
let offset = cuts[0]![1] - cuts[0]![0];
for (let i = 1; i < cuts.length; i++) {
  parts.push(
    `${v}[v${i}]xfade=transition=fade:duration=${FADE}:offset=${(offset - FADE).toFixed(2)}[x${i}]`,
  );
  v = `[x${i}]`;
  offset += cuts[i]![1] - cuts[i]![0] - FADE;
}
// The sound crossfades by the same amount, so picture and sound stay the same length.
let a = "[a0]";
for (let i = 1; i < cuts.length; i++) {
  parts.push(`${a}[a${i}]acrossfade=d=${FADE}:c1=tri:c2=tri[y${i}]`);
  a = `[y${i}]`;
}
parts.push(`${v}fade=t=out:st=${(offset - 0.6).toFixed(2)}:d=0.6[vo]`);
parts.push(
  `${a}atrim=0:${offset.toFixed(2)},afade=t=out:st=${(offset - 0.6).toFixed(2)}:d=0.6[ao]`,
);
const r = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    film,
    "-filter_complex",
    parts.join(";"),
    "-map",
    "[vo]",
    "-map",
    "[ao]",
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    join(root, "out/teaser.mp4"),
  ],
  { encoding: "utf8" },
);
if (r.status !== 0) throw new Error(r.stderr.slice(-800));
console.log(`out/teaser.mp4 · ${offset.toFixed(1)} s`);
