// Pure helpers for VoicePlayer: clip bounds (play only the master's exact seconds of a long
// recording), karaoke cue lookup, peaks for the bar waveform, and time labels. Unit tested.

/** One spoken sentence, in the source file's own time (not relative to a clip). */
export type Cue = { startMs: number; endMs: number; kn: string; en: string };

export type ClipBounds = { startMs: number; endMs: number; lengthMs: number };

/** Played this close to the end counts as the end (timeupdate and rAF are not sample exact). */
export const END_TOLERANCE_MS = 40;

export const SPEEDS = [0.8, 1, 1.2] as const;
export type Speed = (typeof SPEEDS)[number];

function finite(n: number | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * The part of the file to play. Without a known duration (metadata not loaded, or a stream) the
 * requested bounds are trusted as they are. A missing or impossible end falls back to the file end.
 */
export function clipBounds(
  durationMs: number | undefined,
  startMs?: number,
  endMs?: number,
): ClipBounds {
  const total = finite(durationMs) && durationMs > 0 ? durationMs : undefined;
  let start = finite(startMs) ? Math.max(0, startMs) : 0;
  if (total !== undefined) start = Math.min(start, total);
  let end = finite(endMs) ? endMs : (total ?? Number.POSITIVE_INFINITY);
  if (total !== undefined) end = Math.min(end, total);
  if (end <= start) end = total ?? Number.POSITIVE_INFINITY;
  const lengthMs = Number.isFinite(end) ? end - start : 0;
  return { startMs: start, endMs: end, lengthMs };
}

/** 0..1 position within the clip. */
export function clipFraction(currentMs: number, b: ClipBounds): number {
  if (b.lengthMs <= 0) return 0;
  return Math.min(1, Math.max(0, (currentMs - b.startMs) / b.lengthMs));
}

export function isPastEnd(currentMs: number, b: ClipBounds): boolean {
  return Number.isFinite(b.endMs) && currentMs >= b.endMs - END_TOLERANCE_MS;
}

/** File time for a 0..1 position within the clip. */
export function seekWithin(fraction: number, b: ClipBounds): number {
  const f = Math.min(1, Math.max(0, fraction));
  return b.startMs + f * b.lengthMs;
}

/**
 * Index of the sentence being spoken at `ms`, or -1 in a pause or outside every cue.
 * Cues must be sorted by start; binary search keeps it cheap at 60 fps.
 */
export function findCue(cues: readonly Cue[], ms: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cue = cues[mid];
    if (!cue) break;
    if (cue.startMs <= ms) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const cue = found >= 0 ? cues[found] : undefined;
  return cue && ms < cue.endMs ? found : -1;
}

/** m:ss, or h:mm:ss for long interviews. Negative and missing values read 0:00. */
export function formatTime(ms: number): string {
  const total = finite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function nextSpeed(speed: number): Speed {
  const i = SPEEDS.findIndex((s) => s === speed);
  return SPEEDS[(i + 1) % SPEEDS.length] ?? 1;
}

/** Down samples peaks to `bars` values (max per bucket), scaled so the loudest bar is 1. */
export function resamplePeaks(peaks: readonly number[], bars: number): number[] {
  if (peaks.length === 0 || bars <= 0) return [];
  const out: number[] = [];
  const step = peaks.length / bars;
  for (let i = 0; i < bars; i++) {
    const from = Math.floor(i * step);
    const to = Math.max(from + 1, Math.floor((i + 1) * step));
    let max = 0;
    for (let j = from; j < to && j < peaks.length; j++)
      max = Math.max(max, Math.abs(peaks[j] ?? 0));
    out.push(max);
  }
  const top = Math.max(...out);
  return top > 0 ? out.map((v) => v / top) : out;
}

/**
 * Appends a `#t=start,end` media fragment so the browser itself starts at the clip (iOS Safari
 * otherwise ignores an early currentTime). Leaves blob/data URLs and existing fragments alone.
 */
export function withMediaFragment(src: string, startMs?: number, endMs?: number): string {
  if (!finite(startMs) || startMs <= 0) return src;
  if (src.includes("#") || src.startsWith("blob:") || src.startsWith("data:")) return src;
  const s = Number((startMs / 1000).toFixed(3));
  const e = finite(endMs) && endMs > startMs ? `,${Number((endMs / 1000).toFixed(3))}` : "";
  return `${src}#t=${s}${e}`;
}

/**
 * The body of GET /api/audio/segments/<id>, checked by hand: zod would add about 30 KB to every
 * page with a player (DESIGN §10). Null when anything is off; the player then shows its error state.
 */
export type SegmentAudio = { url: string; startMs: number; endMs: number; mime?: string };

export function parseSegmentAudio(value: unknown): SegmentAudio | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
  if (typeof v.url !== "string" || v.url.length === 0) return null;
  if (!num(v.startMs) || v.startMs < 0 || !num(v.endMs) || v.endMs <= 0) return null;
  if (v.mime !== undefined && typeof v.mime !== "string") return null;
  return { url: v.url, startMs: v.startMs, endMs: v.endMs, ...(v.mime ? { mime: v.mime } : {}) };
}
