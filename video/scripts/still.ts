// One review frame as a PNG in out/stills/.
//   pnpm --dir video still <scene-id>          a frame 70% into that scene (reveals done)
//   pnpm --dir video still <scene-id> 2.5      2.5 s into that scene
//   pnpm --dir video still fonts               the Kannada shaping check (FontCheck)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FPS, scriptSchema } from "../src/schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [id, at] = process.argv.slice(2);
const script = scriptSchema.parse(JSON.parse(readFileSync(join(root, "script.json"), "utf8")));

if (!id) {
  console.error(`Which scene? One of: fonts, ${script.scenes.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

let args: string[];
if (id === "fonts") {
  args = ["still", "src/index.ts", "FontCheck", "out/stills/fonts.png"];
} else {
  const scene = script.scenes.find((s) => s.id === id);
  if (!scene) {
    console.error(`No scene "${id}". Scenes: ${script.scenes.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }
  const offset = at === undefined ? (scene.end - scene.start) * 0.7 : Number(at);
  const frame = Math.min(Math.round((scene.start + offset) * FPS), Math.round(scene.end * FPS) - 1);
  args = [
    "still",
    "src/index.ts",
    "Story",
    `out/stills/${id}.png`,
    `--frame=${frame}`,
    `--props={"mode":"draft"}`,
  ];
}

const r = spawnSync(join(root, "node_modules", ".bin", "remotion"), args, {
  cwd: root,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
