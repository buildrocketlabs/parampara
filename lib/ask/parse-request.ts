import { z } from "zod";
import { PHOTO_MAX_BYTES, stripJpegMetadata } from "@/lib/photo/jpeg";
import type { AnswerLang } from "./types";

// The body of POST /api/ask (docs/AI.md §4, BUILD.md M5.3): a typed question as JSON (with an
// optional "Show me" photo as base64), a voice question as a 16 kHz WAV, or the same as multipart.
// A photo must be a real JPEG of at most 1.5 MB; it is rebuilt without any metadata here.

export const MAX_WAV_BYTES = 1_200_000;
const PHOTO_B64_MAX = Math.ceil((PHOTO_MAX_BYTES * 4) / 3) + 16;

const Lang = z.enum(["kn", "en", "hi"]);
const TextBody = z.object({
  text: z.string().trim().min(1).max(1200),
  lang: Lang,
  photo: z.string().max(PHOTO_B64_MAX).optional(),
  /** The photo is our drawn sample slate. Read only by fixture mode, to script a matching reading. */
  photoSample: z.boolean().optional(),
});

export type AskRequest = {
  text?: string;
  wav?: Uint8Array;
  lang: AnswerLang;
  photo?: Uint8Array;
  photoSample?: boolean;
};
export type ParsedAsk =
  | ({ ok: true } & AskRequest)
  | { ok: false; status: 400 | 413 | 415; error: "invalid" | "too_large" | "photo_invalid" };

const TOO_LARGE = { ok: false, status: 413, error: "too_large" } as const;
const INVALID = { ok: false, status: 400, error: "invalid" } as const;

export async function parseAskRequest(req: Request, fallbackLang: AnswerLang): Promise<ParsedAsk> {
  const type = req.headers.get("content-type") ?? "";
  let text: string | undefined;
  let wav: Uint8Array | undefined;
  let photo: Uint8Array | undefined;
  let lang: AnswerLang = fallbackLang;
  let photoSample = false;

  if (type.startsWith("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return INVALID;
    lang = Lang.catch(fallbackLang).parse(form.get("lang"));
    const t = form.get("text");
    if (typeof t === "string" && t.trim()) text = t.trim().slice(0, 1200);
    const audio = form.get("audio");
    if (audio instanceof Blob) {
      if (audio.size === 0 || audio.size > MAX_WAV_BYTES) return TOO_LARGE;
      wav = new Uint8Array(await audio.arrayBuffer());
    }
    const p = form.get("photo");
    if (p instanceof Blob) {
      if (p.size === 0 || p.size > PHOTO_MAX_BYTES) return TOO_LARGE;
      photo = new Uint8Array(await p.arrayBuffer());
    }
    if (!text && !wav) return INVALID;
  } else if (type.startsWith("audio/")) {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_WAV_BYTES) return TOO_LARGE;
    wav = bytes;
    lang = Lang.catch(fallbackLang).parse(new URL(req.url).searchParams.get("lang"));
  } else {
    const raw = await req.json().catch(() => null);
    const tooBig =
      raw && typeof raw === "object" && typeof (raw as { photo?: unknown }).photo === "string"
        ? (raw as { photo: string }).photo.length > PHOTO_B64_MAX
        : false;
    if (tooBig) return TOO_LARGE;
    const body = TextBody.safeParse(raw);
    if (!body.success) return INVALID;
    text = body.data.text;
    lang = body.data.lang;
    photoSample = body.data.photoSample === true;
    if (body.data.photo) {
      const bytes = Buffer.from(body.data.photo, "base64");
      if (bytes.byteLength === 0 || bytes.byteLength > PHOTO_MAX_BYTES) return TOO_LARGE;
      photo = new Uint8Array(bytes);
    }
  }

  if (photo) {
    // Only a real baseline or progressive JPEG of sane size, rebuilt from its image segments only
    // (the second lock, after the browser's canvas re-encode).
    const clean = stripJpegMetadata(photo);
    if (!clean) return { ok: false, status: 415, error: "photo_invalid" };
    photo = clean;
  }
  return { ok: true, text, wav, lang, photo, ...(photo && photoSample ? { photoSample } : {}) };
}
