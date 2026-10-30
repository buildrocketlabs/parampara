// The film's music, composed in code for this film (no samples, no licence to track): a tanpura
// drone on D, a bansuri-like phrase in Bhupali (D E F# A B), soft piano and a low string pad,
// shaped to CREATIVE-BRIEF §6 from the scene times in script.json. Writes public/audio/music.mp3.
//   pnpm --dir video score        (run again after any change to scene times or narration)
//
// The mix rules are baked in: the bed ducks under every narration take and is fully silent under
// every moment of Mahesh Bedavatti's own voice (with a breath on either side), so his voice is
// never under music.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptSchema, type Scene } from "../src/schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SR = 48000;
const script = scriptSchema.parse(JSON.parse(readFileSync(join(root, "script.json"), "utf8")));
const total = Math.max(...script.scenes.map((s) => s.end));
const N = Math.ceil(total * SR);
const scene = (id: string): Scene => {
  const s = script.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`script.json has no scene ${id}`);
  return s;
};
const duration = (file: string) =>
  Number(
    spawnSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      {
        encoding: "utf8",
      },
    ).stdout,
  );

// ── When the narration and his voice sound ─────────────────────────────────────────────────────
type Span = [number, number];
const voice: Span[] = [];
const his: Span[] = [];
for (const s of script.scenes) {
  for (const a of s.audio) {
    if (a.kind === "sound") continue;
    const at = s.start + a.at;
    const len = a.duration ?? duration(join(root, "public", a.src)) - a.from;
    (a.kind === "headmaster" ? his : voice).push([at, Math.min(at + len, s.end)]);
  }
}

// ── Instruments ────────────────────────────────────────────────────────────────────────────────
const L = new Float32Array(N);
const R = new Float32Array(N);
const SA = 146.83; // D3
const hz = (semitonesFromSa: number, octave = 0) => SA * 2 ** (octave + semitonesFromSa / 12);

/** Adds a mono voice at time t, panned (-1 left to 1 right). */
function add(t: number, samples: Float32Array, gain: number, pan = 0) {
  const i0 = Math.round(t * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < samples.length; i++) {
    const j = i0 + i;
    if (j < 0 || j >= N) continue;
    L[j] = L[j]! + samples[i]! * gl;
    R[j] = R[j]! + samples[i]! * gr;
  }
}

/** A tanpura string: many harmonics, the upper ones swelling a moment after the pluck (jawari). */
function tanpuraString(f: number, seconds: number, seed: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let k = 1; k <= 18; k++) {
    const fk = f * k * (1 + 0.0004 * Math.sin(seed + k));
    if (fk > 9000) break;
    const a = 1 / k ** 0.85;
    const w = (2 * Math.PI * fk) / SR;
    const delay = 0.05 * k;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const attack = Math.min(t / 0.012, 1);
      const decay = Math.exp(-t / 2.6);
      const sweep = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(Math.max((t - delay) / 0.9, 0), 1));
      out[i]! += a * attack * decay * sweep * Math.sin(w * i + seed * k);
    }
  }
  return out;
}

/** A bansuri-like note: breathy sine with a little 2nd and 3rd harmonic, vibrato after a moment. */
function flute(f: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.round((seconds + 0.25) * SR));
  let phase = 0;
  let noise = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const vib =
      1 + 0.006 * Math.min(Math.max((t - 0.35) / 0.4, 0), 1) * Math.sin(2 * Math.PI * 5.2 * t);
    phase += (2 * Math.PI * f * vib) / SR;
    const env = Math.min(t / 0.09, 1) * Math.min(Math.max((seconds + 0.25 - t) / 0.25, 0), 1);
    noise = 0.97 * noise + 0.03 * (Math.random() * 2 - 1);
    out[i] =
      env *
      (Math.sin(phase) + 0.18 * Math.sin(2 * phase) + 0.06 * Math.sin(3 * phase) + 0.35 * noise);
  }
  return out;
}

/** A soft piano note: decaying partials, slightly inharmonic, the upper ones dying faster. */
function piano(f: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let k = 1; k <= 8; k++) {
    const fk = f * k * Math.sqrt(1 + 0.0004 * k * k);
    const a = 1 / k ** 1.4;
    const w = (2 * Math.PI * fk) / SR;
    const tau = 2.4 / k ** 0.6;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      out[i]! += a * Math.min(t / 0.006, 1) * Math.exp(-t / tau) * Math.sin(w * i);
    }
  }
  return out;
}

/** A low string pad note: soft saw (8 harmonics), slow swell in and out. */
function strings(f: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let k = 1; k <= 8; k++) {
    for (const detune of [-0.003, 0.003]) {
      const w = (2 * Math.PI * f * k * (1 + detune)) / SR;
      const a = 1 / k / 2;
      for (let i = 0; i < out.length; i++) {
        const t = i / SR;
        const env = Math.min(t / 1.6, 1) * Math.min((seconds - t) / 1.6, 1);
        out[i]! += a * env * Math.sin(w * i + k);
      }
    }
  }
  return out;
}

// ── The score ──────────────────────────────────────────────────────────────────────────────────
const firstHis = his[0]!;
const lastHis = his[his.length - 1]!;
const droneFrom = firstHis[1] + 0.2; // after his opening line
const droneTo = lastHis[0] - 0.9; // resolves before his closing line

// Tanpura: Pa, Sa, Sa, low Sa, every 3.2 s, four slightly different cycles.
const cycles = [0, 1, 2, 3].map((v) => [
  tanpuraString(hz(-5), 5, v + 1),
  tanpuraString(hz(0), 5, v + 2),
  tanpuraString(hz(0), 5, v + 3),
  tanpuraString(hz(0, -1), 5, v + 4),
]);
for (let t = droneFrom - 1, n = 0; t < droneTo; t += 3.2, n++) {
  const c = cycles[n % 4]!;
  c.forEach((s, i) => add(t + i * 0.8, s, 0.05, [-0.35, -0.1, 0.1, 0.35][i]!));
}

// Bhupali on D: Sa Re Ga Pa Dha = 0 2 4 7 9.
const BHUPALI_UP: Array<[number, number, number]> = [
  [7, 0, 0.6],
  [9, 0, 0.6],
  [0, 1, 1.4],
  [9, 0, 0.5],
  [7, 0, 0.5],
  [4, 0, 0.9],
  [2, 0, 0.6],
  [0, 0, 2.2],
];
const BHUPALI_HIGH: Array<[number, number, number]> = [
  [0, 1, 0.9],
  [2, 1, 0.6],
  [4, 1, 1.2],
  [2, 1, 0.5],
  [0, 1, 0.5],
  [9, 0, 0.9],
  [7, 0, 0.8],
  [9, 0, 0.6],
  [0, 1, 2.4],
  [7, 0, 0.7],
  [4, 0, 0.7],
  [2, 0, 0.7],
  [0, 0, 3.0],
];
function phrase(t: number, notes: Array<[number, number, number]>, gain: number) {
  let at = t;
  for (const [s, o, d] of notes) {
    add(at, flute(hz(s, o + 1), d), gain, 0.15);
    at += d;
  }
}
phrase(scene("promise-lamp").start + 0.4, BHUPALI_UP, 0.06);
phrase(scene("proof").start + 1.0, BHUPALI_UP.slice(0, 6), 0.035);
phrase(scene("vision-lamps").start + 0.2, BHUPALI_HIGH, 0.07);

// Piano: D, Bm, G, A (and home), soft, from Deliver; again at Learn and Vision.
const CHORDS: number[][] = [
  [0, 4, 7],
  [-3, 0, 4],
  [-7, -3, 0],
  [-5, -1, 2],
];
function chords(from: number, to: number, every: number, gain: number) {
  for (let t = from, n = 0; t < to - 0.5; t += every, n++) {
    const notes = to - t < every + 0.5 ? [0, 4, 7] : CHORDS[n % 4]!;
    notes.forEach((s, i) => add(t + i * 0.03, piano(hz(s), every + 1.5), gain, -0.2 + i * 0.2));
  }
}
const hear = scene("hear-master");
chords(scene("deliver-window").start, hear.start + 0.5, 3.6, 0.05);
chords(scene("talakal-cut").start + 0.3, scene("spread-hindi").start + 2, 3.6, 0.04);
chords(scene("vision-lamps").start, droneTo, 3.2, 0.055);

// Strings: low D and A under Deliver, Spread and Trust; a swell at Vision.
const pad = (from: number, to: number, gain: number) => {
  for (const s of [hz(0, -1), hz(-5)]) add(from, strings(s, to - from), gain, 0);
};
pad(scene("deliver-phone").start, hear.start + 0.6, 0.03);
pad(scene("spread-hindi").start, scene("proof").start + 1, 0.022);
pad(scene("vision-lamps").start, droneTo + 0.3, 0.045);

// ── A small hall (Schroeder reverb), wetter on the right for width ─────────────────────────────
function reverb(x: Float32Array, spread: number): Float32Array {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
  const aps = [225, 556].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
  const out = new Float32Array(x.length);
  for (let n = 0; n < x.length; n++) {
    let y = 0;
    for (const c of combs) {
      const v = c.buf[c.i]!;
      c.buf[c.i] = x[n]! + v * 0.82;
      c.i = (c.i + 1) % c.buf.length;
      y += v;
    }
    y /= combs.length;
    for (const a of aps) {
      const v = a.buf[a.i]!;
      const w = y + v * 0.5;
      a.buf[a.i] = w;
      a.i = (a.i + 1) % a.buf.length;
      y = v - w * 0.5;
    }
    out[n] = x[n]! * 0.75 + y * 0.45;
  }
  return out;
}
const wetL = reverb(L, 0);
const wetR = reverb(R, 23);

// ── Shape: sections, ducking under narration, silence under his voice ──────────────────────────
const ramp = (t: number, a: number, b: number) => Math.min(Math.max((t - a) / (b - a), 0), 1);
function gainAt(t: number): number {
  let g = 1;
  // Hear it from the master: strip back to silence before the tap, back after his voice.
  g *=
    1 - ramp(t, hear.start - 0.2, hear.start + 1.0) * (1 - ramp(t, hear.end - 0.3, hear.end + 1.2));
  for (const [a, b] of voice) g *= 1 - 0.68 * ramp(t, a - 0.35, a) * (1 - ramp(t, b, b + 0.45));
  // His voice is never under music: silent from a breath before to a breath after.
  for (const [a, b] of his) g *= 1 - ramp(t, a - 1.2, a - 0.3) * (1 - ramp(t, b + 0.3, b + 1.2));
  return g;
}
const pcm = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) {
  const g = gainAt(n / SR);
  pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(wetL[n]! * g * 32767))), n * 4);
  pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(wetR[n]! * g * 32767))), n * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);
const wav = join(root, "public/audio/music.raw.wav");
writeFileSync(wav, Buffer.concat([header, pcm]));
// A bed, not a song: one fixed gain to -27 LUFS overall (about -24 between lines, -33 under
// narration). Measured first, so the ducking above is kept exactly (no dynamic normalising).
const measure = spawnSync(
  "ffmpeg",
  ["-hide_banner", "-nostdin", "-i", wav, "-af", "ebur128", "-f", "null", "-"],
  { encoding: "utf8" },
).stderr;
const integrated = Number(/I:\s+(-?[\d.]+) LUFS/.exec(measure.slice(measure.lastIndexOf("Summary")))?.[1]);
const r = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    wav,
    "-af",
    `volume=${(-27 - integrated).toFixed(2)}dB,alimiter=limit=0.7:level=false`,
    "-ar",
    "48000",
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    join(root, "public/audio/music.mp3"),
  ],
  { encoding: "utf8" },
);
rmSync(wav);
if (r.status !== 0) throw new Error(r.stderr.slice(-400));
console.log(
  `music.mp3 · ${total.toFixed(1)} s · drone ${droneFrom.toFixed(1)} to ${droneTo.toFixed(1)} s · ducked under ${voice.length} takes, silent under ${his.length} of his lines`,
);
