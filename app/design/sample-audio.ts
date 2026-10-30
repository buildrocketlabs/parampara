import { useSyncExternalStore } from "react";
import type { Cue } from "@/lib/player";

// Gallery only: a soft, speech paced hum made in the browser (no audio files in the repo, no
// network), with peaks and cues that match it. Labelled Sample wherever it plays.
const RATE = 16_000;

function syllables(t: number): number {
  const phrase = (t % 3) / 3; // a short pause at the end of every 3 s sentence
  if (phrase > 0.9) return 0;
  return Math.abs(Math.sin(Math.PI * 3.2 * t)) * (0.6 + 0.4 * Math.sin(Math.PI * 0.7 * t) ** 2);
}

function wavUrl(seconds: number): string {
  const n = Math.floor(seconds * RATE);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const tone = Math.sin(2 * Math.PI * 196 * t) * 0.6 + Math.sin(2 * Math.PI * 294 * t) * 0.3;
    v.setInt16(44 + i * 2, tone * syllables(t) * 0.12 * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/** Loudness every 100 ms, the shape VoicePlayer expects. */
export function samplePeaks(seconds: number, fromMs = 0, toMs = seconds * 1000): number[] {
  const out: number[] = [];
  for (let ms = fromMs; ms < toMs; ms += 100) out.push(syllables(ms / 1000));
  return out;
}

const cache = new Map<number, string>();
const noop = () => () => undefined;

export function useSampleAudio(seconds: number): string | null {
  return useSyncExternalStore(
    noop,
    () => {
      let url = cache.get(seconds);
      if (!url) {
        url = wavUrl(seconds);
        cache.set(seconds, url);
      }
      return url;
    },
    () => null,
  );
}

export const SAMPLE_CUES: Cue[] = [
  {
    startMs: 0,
    endMs: 2_700,
    kn: "ಹತ್ತು ಕಡ್ಡಿಗಳನ್ನು ಎಣಿಸಿ, ರಬ್ಬರ್ ಬ್ಯಾಂಡ್ ಹಾಕಿ ಒಂದು ಕಟ್ಟು ಮಾಡಿ.",
    en: "Count ten sticks and tie them with a rubber band into one bundle.",
  },
  {
    startMs: 3_000,
    endMs: 5_700,
    kn: "ಈ ಕಟ್ಟು ಒಂದು ಹತ್ತು ಎಂದು ಮಕ್ಕಳಿಗೆ ಹೇಳಿ.",
    en: "Tell the children this bundle is one ten.",
  },
  {
    startMs: 6_000,
    endMs: 8_700,
    kn: "ನಂತರ ಕಟ್ಟುಗಳು ಮತ್ತು ಬಿಡಿ ಕಡ್ಡಿಗಳಿಂದ ಸಂಖ್ಯೆ ಮಾಡಿಸಿ.",
    en: "Then let them build numbers with bundles and loose sticks.",
  },
];
