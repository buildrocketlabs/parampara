#!/usr/bin/env node
// Seven synthetic WhatsApp voice notes for rehearsing /m/import (F-A1). Never a real person's
// voice: either a speech like tone (fixture mode, decoding and order) or Kannada speech the
// product's own text to speech made from tests/rehearsal/notes.kn.ts (live rehearsal).
//
//   node scripts/rehearsal-notes.mjs                       tone notes into tests/rehearsal/out
//   node scripts/rehearsal-notes.mjs --from <dir>          loop each Kannada source to its length
//   node scripts/rehearsal-notes.mjs --out <dir> --minutes 3,4,5,3.5,4.5,3,4
//
// Output: PTT-20261028-WA0003.opus .. WA0009.opus (Opus in Ogg, mono, 16 kHz, 24 kb/s, as
// WhatsApp sends them), with shuffled modification times so only the names give the true order.
// Needs ffmpeg with libopus. Prints the files it wrote, nothing else.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, utimesSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};

const out = resolve(arg("out", "tests/rehearsal/out"));
const from = arg("from", null);
const minutes = arg("minutes", "3,4,5,3.5,4.5,3,4").split(",").map(Number);
if (minutes.length !== 7 || minutes.some((m) => !(m > 0 && m <= 10))) {
  console.error("--minutes needs seven lengths between 0 and 10");
  process.exit(1);
}

let sources = null;
if (from) {
  sources = readdirSync(from)
    .filter((f) => /\.(wav|mp3|m4a|ogg|opus)$/i.test(f))
    .sort()
    .map((f) => join(from, f));
  if (sources.length !== 7) {
    console.error(`--from needs seven audio files (consent first), found ${sources.length}`);
    process.exit(1);
  }
}

mkdirSync(out, { recursive: true });
const encode = [
  "-ac",
  "1",
  "-ar",
  "16000",
  "-c:a",
  "libopus",
  "-b:a",
  "24k",
  "-application",
  "voip",
];
// Shuffled saved times: a picker that sorts by date would get these wrong, the names would not.
const mtimeOrder = [4, 0, 6, 2, 5, 1, 3];
const base = Date.UTC(2026, 9, 28, 5, 0, 0) / 1000;

minutes.forEach((m, i) => {
  const seconds = Math.round(m * 60);
  const name = `PTT-20261028-WA${String(i + 3).padStart(4, "0")}.opus`;
  const file = join(out, name);
  const input = sources
    ? // Loop the Kannada source with a breath between, cut to length.
      ["-stream_loop", "-1", "-i", sources[i], "-af", "apad=pad_dur=1.5"]
    : [
        "-f",
        "lavfi",
        "-i",
        // Voiced bursts and pauses at a slightly different pitch per note, like someone talking.
        `aevalsrc=exprs='0.3*sin(2*PI*${150 + i * 12}*t)*(0.6+0.4*sin(2*PI*3*t))*gt(sin(2*PI*0.4*t+${i}),-0.2)':s=16000:d=${seconds}`,
      ];
  execFileSync("ffmpeg", ["-v", "error", "-y", ...input, "-t", String(seconds), ...encode, file]);
  const t = base + mtimeOrder[i] * 60;
  utimesSync(file, t, t);
  console.log(`${file}  ${m} min`);
});
