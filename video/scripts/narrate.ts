// Renders the narration: every scene's `voiceover` in script.json, read by the chosen AI voice, to
// public/audio/vo-<scene id>.mp3, loudness normalised to -16 LUFS.
//   pnpm --dir video narrate                 every line not yet rendered
//   pnpm --dir video narrate deliver-ask     these lines again (overwrites)
//
// The founder chose ElevenLabs "George" (30 Oct; craft/ASSETS.md has the auditions). Names the
// voice says wrong are respelled for the voice only (SAY below); the subtitles keep the real
// spelling. Each take is transcribed back by hand after rendering (craft/ASSETS.md logs it).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptSchema } from "../src/schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOICE = { name: "George", id: "JBFqnCBsd6RMkjVDRZzb", model: "eleven_v4" };
const SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.05,
  use_speaker_boost: true,
  speed: 0.9,
};

/**
 * How the voice should hear a word (input only). Tested 30 Oct by transcribing George back: plain
 * Kannada, Koppal, Talakal, Ambedkar Nagar, Parampara and Kannadi come back right, and respelling
 * them made them worse; only Bedavatti came back wrong ("Vedavathi"), and "Bedavutti" fixes it.
 */
export const SAY: Array<[RegExp, string]> = [
  [/\bBedavatti\b/g, "Bedavutti"],
  // In "She asks, in Kannada" George said "Canada"; "Kunnada" is heard as Kannada.
  [/\bKannada\b/g, "Kunnada"],
  [/ಪರಂಪರೆ/g, "Parampara"],
];

export const forVoice = (text: string) => SAY.reduce((t, [re, say]) => t.replace(re, say), text);

const LOUDNESS = "I=-16:TP=-1.5:LRA=11";

function ffmpeg(args: string[]): string {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr.slice(-600));
  return r.stderr;
}

/** Two pass loudnorm, then a 40 ms fade at each end so no take clicks. */
function normalise(raw: string, out: string) {
  const m1 = ffmpeg([
    "-i",
    raw,
    "-af",
    `loudnorm=${LOUDNESS}:print_format=json`,
    "-f",
    "null",
    "-",
  ]);
  const m = JSON.parse(m1.slice(m1.lastIndexOf("{"), m1.lastIndexOf("}") + 1));
  const d = Number(
    spawnSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw],
      {
        encoding: "utf8",
      },
    ).stdout,
  );
  ffmpeg([
    "-i",
    raw,
    "-af",
    `loudnorm=${LOUDNESS}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000,afade=t=in:d=0.04,afade=t=out:st=${Math.max(d - 0.04, 0).toFixed(3)}:d=0.04`,
    "-ac",
    "2",
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    out,
  ]);
}

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("ELEVENLABS_API_KEY is not set (it lives in .env.local; run through pnpm narrate)");
  process.exit(1);
}
const script = scriptSchema.parse(JSON.parse(readFileSync(join(root, "script.json"), "utf8")));
const only = process.argv.slice(2);
for (const scene of script.scenes) {
  if (!scene.voiceover) continue;
  if (only.length && !only.includes(scene.id)) continue;
  const out = join(root, "public/audio", `vo-${scene.id}.mp3`);
  if (!only.length && existsSync(out)) continue;
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE.id}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text: forVoice(scene.voiceover),
        model_id: VOICE.model,
        voice_settings: SETTINGS,
      }),
    },
  );
  if (!r.ok) {
    console.error(`✗ ${scene.id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    process.exitCode = 1;
    continue;
  }
  const raw = `${out}.raw.mp3`;
  writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
  normalise(raw, out);
  rmSync(raw);
  console.log(`✓ vo-${scene.id}.mp3`);
}
