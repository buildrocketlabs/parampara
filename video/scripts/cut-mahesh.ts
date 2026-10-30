// Cuts Mahesh Bedavatti's lines from his own WhatsApp voice notes (consented, intro.mp3) into
// public/audio/mahesh-*.mp3, loudness normalised to -16 LUFS so his voice never sits under music.
//   pnpm --dir video cut:mahesh
//
// The times come from the field interview in the database: the notes were imported in order
// (intro, 1 to 6), so segment #956 and #957 (6.mp3) and #943 (1.mp3, cited by the approved card
// "From lines and circles to writing letters") locate each line, and the word edges inside them
// were found by transcribing the stretches between pauses (craft/ASSETS.md has the log).
// Nothing here changes his words: a cut only starts and ends in a pause.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const notes = join(root, "public/audio/mahesh-notes");
const out = join(root, "public/audio");

type Piece = { note: string; from: number; to: number };
type Line = { file: string; pieces: Piece[]; gap?: number; words: string };

const LINES: Line[] = [
  {
    // 0:00 open. Two phrases of one sentence in 6.mp3, joined over a short pause (the subtitle
    // shows the ellipsis, so the join is visible, never hidden).
    file: "mahesh-open.mp3",
    pieces: [
      { note: "6.mp3", from: 1.3, to: 3.8 },
      { note: "6.mp3", from: 14.95, to: 18.85 },
    ],
    gap: 0.5,
    words: "ಯುವ ಶಿಕ್ಷಕರಲ್ಲಿ ಒಂದು ವಿನಂತಿ… ಎಲ್ಲಾ ಮಕ್ಕಳನ್ನು ಒಂದೇ ದೃಷ್ಟಿಕೋನದಿಂದ ನೋಡಿ.",
  },
  {
    // 1:40 "Hear it from the master", short: card step 1 in his words.
    file: "mahesh-hear.mp3",
    pieces: [{ note: "1.mp3", from: 2.75, to: 11.06 }],
    words: "ಮಗುವಿಗೆ ಮೊದಲು ರೇಖೆಗಳನ್ನು ಎಳೆಯುವುದು, ವೃತ್ತ ಹಾಕುವುದು, ಮೇಲಿನ ಅರ್ಧಚಂದ್ರ, ಕೆಳಗಿನ ಅರ್ಧಚಂದ್ರ…",
  },
  {
    // The same moment, his whole first sentence, if the scene can give it 15 s.
    file: "mahesh-hear-full.mp3",
    pieces: [{ note: "1.mp3", from: 1.45, to: 16.7 }],
    words:
      "1ನೇ ತರಗತಿ ಮಗುವಿಗೆ ಮೊದಲು ರೇಖೆಗಳನ್ನು ಎಳೆಯುವುದು, ವೃತ್ತ ಹಾಕುವುದು, ಮೇಲಿನ ಅರ್ಧಚಂದ್ರ, ಕೆಳಗಿನ ಅರ್ಧಚಂದ್ರ ಹೀಗೆ ಗೆರೆ ಹಾಕುವುದನ್ನು ರೂಢಿ ಮಾಡುತ್ತೇವೆ.",
  },
  {
    // 2:51 close: the end of his request (segment #957).
    file: "mahesh-close.mp3",
    pieces: [{ note: "6.mp3", from: 24.62, to: 31.15 }],
    words: "ತಾವು ಹೆಚ್ಚಿನ ಪ್ರಯತ್ನವನ್ನು ಮಾಡಬೇಕೆಂಬುದು ನನ್ನ ಒಂದು ವಿನಂತಿ.",
  },
];

const LOUDNESS = "I=-16:TP=-1.5:LRA=11";

function ffmpeg(args: string[]): string {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr.slice(-800));
  return r.stderr;
}

// Each piece gets a short fade so no cut clicks; pieces are joined over `gap` seconds of silence.
function graph(line: Line): string {
  const parts = line.pieces.map((p, i) => {
    const d = p.to - p.from;
    return `[${i}:a]atrim=${p.from}:${p.to},asetpts=PTS-STARTPTS,highpass=f=70,afade=t=in:d=0.03,afade=t=out:st=${(d - 0.12).toFixed(3)}:d=0.12,aformat=sample_rates=48000:channel_layouts=mono[p${i}]`;
  });
  const labels = line.pieces.map((_, i) => `[p${i}]`);
  if (line.pieces.length > 1 && line.gap) {
    parts.push(`anullsrc=r=48000:cl=mono,atrim=0:${line.gap}[gap]`);
    labels.splice(1, 0, "[gap]");
  }
  parts.push(`${labels.join("")}concat=n=${labels.length}:v=0:a=1[joined]`);
  return parts.join(";");
}

for (const line of LINES) {
  const inputs = line.pieces.flatMap((p) => {
    const src = join(notes, p.note);
    if (!existsSync(src)) throw new Error(`Missing ${src}`);
    return ["-i", src];
  });
  // Two pass loudnorm: measure, then apply the measured values linearly (no pumping).
  const measured = ffmpeg([
    ...inputs,
    "-filter_complex",
    `${graph(line)};[joined]loudnorm=${LOUDNESS}:print_format=json[o]`,
    "-map",
    "[o]",
    "-f",
    "null",
    "-",
  ]);
  const m = JSON.parse(measured.slice(measured.lastIndexOf("{"), measured.lastIndexOf("}") + 1));
  const second = `loudnorm=${LOUDNESS}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ffmpeg([
    ...inputs,
    "-filter_complex",
    `${graph(line)};[joined]${second},aresample=48000[o]`,
    "-map",
    "[o]",
    "-ac",
    "2",
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    join(out, line.file),
  ]);
  console.log(`${line.file} · ${line.words}`);
}
