// The content type an original part is stored under (F-A1). Browsers disagree on WhatsApp notes:
// a .opus file may come as "", "audio/opus", "audio/ogg; codecs=opus" or something odd, and the
// interviews bucket accepts only a fixed list (0002_storage.sql). A refused upload would leave the
// consent note unstored, and consent counts only once its audio is stored (D53), so we settle the
// type here from the extension first, then from what the browser said.

/** Mirrors the `interviews` bucket's allowed_mime_types in supabase/migrations/0002_storage.sql. */
export const STORABLE_MIME = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
  "audio/flac",
  "audio/amr",
  "audio/3gpp",
  "video/mp4",
  "video/webm",
  "application/octet-stream",
]);

const BY_EXTENSION: Record<string, string> = {
  opus: "audio/ogg", // WhatsApp's .opus is Opus in an Ogg container
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  webm: "audio/webm",
  flac: "audio/flac",
  amr: "audio/amr",
  "3gp": "audio/3gpp",
};

/** Extensions the picker offers, beside audio/*: some systems do not call .opus or .amr audio. */
export const AUDIO_EXTENSIONS = Object.keys(BY_EXTENSION);

function extensionOf(name: string): string | null {
  return /\.([a-z0-9]{1,5})$/i.exec(name.trim())?.[1]?.toLowerCase() ?? null;
}

export function storableMime(file: { name: string; type: string }): string {
  const ext = extensionOf(file.name);
  if (ext && BY_EXTENSION[ext]) return BY_EXTENSION[ext];
  const bare = file.type.split(";")[0]!.trim().toLowerCase();
  return STORABLE_MIME.has(bare) ? bare : "application/octet-stream";
}

/** Whether a picked file could be a recording at all (a chat's .txt or a photo is not). */
export function looksLikeAudio(file: { name: string; type: string }): boolean {
  const ext = extensionOf(file.name);
  if (ext && BY_EXTENSION[ext]) return true;
  const bare = file.type.split(";")[0]!.trim().toLowerCase();
  if (bare.startsWith("audio/") || bare === "video/mp4" || bare === "video/webm") return true;
  // No extension and no type: let the decoder decide rather than refuse a real recording.
  return !ext && !bare;
}

/** Ogg (WhatsApp's notes) by name or type: Safari before 18.4 cannot read these. */
export function isOggName(file: { name: string; type: string }): boolean {
  const ext = extensionOf(file.name);
  return ext === "opus" || ext === "ogg" || ext === "oga" || /ogg|opus/i.test(file.type);
}
