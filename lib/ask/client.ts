"use client";

import type { AnswerLang, AskStage, Outcome } from "./types";

// Browser side of /api/ask: send text or a voice question, read the honest stages as they stream,
// end with the outcome. A recording is turned into a 16 kHz mono WAV under 30 s first (D34), so
// the server never needs to understand webm, mp4 or ogg.

export const QUESTION_MAX_MS = 29_000;

export class AskError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AskError";
  }
}

/** A recorded blob (webm, mp4, ogg) → WAV the speech service takes in one request. */
export async function questionWav(blob: Blob): Promise<Uint8Array> {
  // The audio code loads with the first recording, not with the page (DESIGN §10).
  const { decodeToMono16k, encodeWav16, TARGET_SAMPLE_RATE } = await import("@/lib/audio");
  const samples = await decodeToMono16k(blob, { maxMs: 10 * 60_000 });
  const max = Math.floor((QUESTION_MAX_MS / 1000) * TARGET_SAMPLE_RATE);
  return encodeWav16(samples.subarray(0, Math.min(samples.length, max)), TARGET_SAMPLE_RATE);
}

/** What the photo reader saw, streamed before the answer ("Show me", M5.3). */
export type PhotoSeen = {
  seenKn: string;
  seenEn: string;
  used: boolean;
  faces: boolean;
  /** A scripted reading (fixture mode): shown with the Sample label (Law 7). */
  sample?: boolean;
};

export async function askQuestion(
  input:
    | {
        text: string;
        lang: AnswerLang;
        photo?: Blob;
        /** The photo is our drawn sample slate: only fixture mode reads this (a matching script). */
        photoSample?: boolean;
      }
    | { wav: Uint8Array; lang: AnswerLang },
  onStage: (stage: AskStage) => void,
  signal?: AbortSignal,
  onPhoto?: (seen: PhotoSeen) => void,
): Promise<Outcome> {
  const res =
    "text" in input
      ? await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // The photo goes in this request body only: never stored, never cached (M5.3).
          body: JSON.stringify({
            text: input.text,
            lang: input.lang,
            ...(input.photo
              ? { photo: await (await import("@/lib/photo/prepare")).photoBase64(input.photo) }
              : {}),
            ...(input.photo && input.photoSample ? { photoSample: true } : {}),
          }),
          signal,
        })
      : await fetch(`/api/ask?lang=${input.lang}`, {
          method: "POST",
          headers: { "content-type": "audio/wav" },
          body: input.wav as BodyInit,
          signal,
        });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AskError(body.error ?? `http_${res.status}`);
  }
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await res.json()) as { outcome?: Outcome; error?: string };
    if (body.outcome) return body.outcome;
    throw new AskError(body.error ?? "failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as {
        stage?: AskStage;
        photo?: PhotoSeen;
        outcome?: Outcome;
        error?: string;
      };
      if (msg.stage) onStage(msg.stage);
      if (msg.photo) onPhoto?.(msg.photo);
      if (msg.outcome) return msg.outcome;
      if (msg.error) throw new AskError(msg.error);
    }
    if (done) break;
  }
  throw new AskError("stream_ended");
}
