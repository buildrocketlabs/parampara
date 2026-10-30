// Checks script.json and numbers.json before anything renders, and writes out/subtitles.srt.
//   node scripts/check.ts           a draft: problems are listed, nothing stops
//   node scripts/check.ts --final   the final: any missing asset, null number or TODO stops it
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findProblems,
  formatNumber,
  MAX_SECONDS,
  numbersSchema,
  scriptSchema,
  totalSeconds,
  type Numbers,
  type Script,
} from "../src/schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const final = process.argv.includes("--final");

function load<T>(file: string, parse: (x: unknown) => T): T {
  const raw: unknown = JSON.parse(readFileSync(join(root, file), "utf8"));
  try {
    return parse(raw);
  } catch (err) {
    console.error(`✗ ${file} is not valid:\n${String(err)}`);
    process.exit(1);
  }
}

const script: Script = load("script.json", (x) => scriptSchema.parse(x));
const numbers: Numbers = load("numbers.json", (x) => numbersSchema.parse(x));

const total = totalSeconds(script);
const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
console.log(
  `script.json: ${script.scenes.length} scenes, ${clock(total)} of ${clock(MAX_SECONDS)} (${(MAX_SECONDS - total).toFixed(1)} s to spare), no overlaps.`,
);

script.scenes.forEach((s, i) => {
  const prev = script.scenes[i - 1];
  if (prev && s.start > prev.end) {
    console.warn(
      `  note: ${(s.start - prev.end).toFixed(2)} s of plain cream between ${prev.id} and ${s.id}`,
    );
  }
});

const problems = findProblems(script, numbers, (p) => existsSync(join(root, "public", p)));
if (problems.length) {
  const head = final
    ? "✗ The final render is refused until these are done:"
    : "Still to come (drafts show them as placeholders):";
  console[final ? "error" : "log"](`${head}\n  ${problems.join("\n  ")}`);
  if (final) process.exit(1);
} else {
  console.log("Every asset, number and line is in.");
}

// The subtitle track, for an upload that wants a separate .srt.
const fill = (text: string) =>
  text.replace(/\{([a-z0-9_]+)\}/g, (all, key: string) => {
    const entry = numbers.numbers[key];
    if (entry?.hidden) return "(kept private)";
    return formatNumber(entry) ?? all;
  });
const stamp = (s: number) => {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const cues = script.scenes
  .filter((s) => s.kannada || s.english)
  .map((s, i) =>
    [
      i + 1,
      `${stamp(s.start)} --> ${stamp(s.end)}`,
      ...[s.kannada, s.english].filter(Boolean).map((t) => fill(t!)),
    ].join("\n"),
  );
mkdirSync(join(root, "out"), { recursive: true });
writeFileSync(join(root, "out", "subtitles.srt"), `${cues.join("\n\n")}\n`);
console.log("Wrote out/subtitles.srt");
