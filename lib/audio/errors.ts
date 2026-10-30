// Isomorphic: the server imports this through wav.ts. The UI maps `kind` to Kannada and English
// copy; `message` is for logs only.

export type AudioPrepErrorKind = "unsupported_format" | "decode_failed" | "too_long" | "empty";

export class AudioPrepError extends Error {
  readonly kind: AudioPrepErrorKind;
  /** Which input part failed, when the audio came in several parts (WhatsApp notes). */
  readonly part?: number;

  constructor(
    kind: AudioPrepErrorKind,
    message: string,
    options: { part?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AudioPrepError";
    this.kind = kind;
    this.part = options.part;
  }
}
