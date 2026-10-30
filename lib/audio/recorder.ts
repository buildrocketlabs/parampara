// Browser only. Records the microphone with MediaRecorder and reports a live level for the mic
// orb's rings. The recording then goes through prepareAudio like any other file (D34).

export type RecorderErrorKind =
  "permission_denied" | "no_microphone" | "unsupported" | "interrupted";

export class RecorderError extends Error {
  readonly kind: RecorderErrorKind;

  constructor(kind: RecorderErrorKind, message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "RecorderError";
    this.kind = kind;
  }
}

export type RecordingOptions = {
  /** 0 (hush) to 1 (loud speech), smoothed, about 30 times a second. */
  onLevel?: (level: number) => void;
  /** Stops by itself after this long; stop() then returns what was recorded. */
  maxMs?: number;
  onMaxReached?: () => void;
};

export type Recording = {
  /** Resolves with the recording. After cancel() it resolves with an empty Blob. */
  stop(): Promise<Blob>;
  /** Discards the recording and releases the microphone. */
  cancel(): void;
  /** What MediaRecorder is actually producing; "" means the browser default. */
  mimeType: string;
};

/** Opus first (small, Chrome and Firefox), then AAC in MP4 (Safari). */
export const MIME_PREFERENCE = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];

export function pickMimeType(isSupported: (mimeType: string) => boolean): string {
  for (const mimeType of MIME_PREFERENCE) {
    try {
      if (isSupported(mimeType)) return mimeType;
    } catch {
      // Some browsers throw instead of returning false.
    }
  }
  return "";
}

/** -60 dBFS (a quiet room) maps to 0 and -10 dBFS (close, loud speech) to 1. */
export function levelFromRms(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-6));
  return Math.min(1, Math.max(0, (db + 60) / 50));
}

/** Rises quickly so a syllable shows at once, falls slowly so the rings breathe, not flicker. */
export function smoothLevel(previous: number, next: number): number {
  return previous + (next - previous) * (next > previous ? 0.6 : 0.15);
}

export async function startRecording(opts: RecordingOptions = {}): Promise<Recording> {
  const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (typeof media?.getUserMedia !== "function" || typeof MediaRecorder === "undefined") {
    throw new RecorderError("unsupported", "this browser cannot record audio");
  }

  let stream: MediaStream;
  try {
    stream = await media.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
  } catch (err) {
    throw toRecorderError(err);
  }

  const preferred = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
  } catch (cause) {
    stopTracks(stream);
    throw new RecorderError("unsupported", "MediaRecorder could not start", { cause });
  }

  const pieces: Blob[] = [];
  let cancelled = false;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  const meter = opts.onLevel ? startLevelMeter(stream, opts.onLevel) : undefined;
  const release = () => {
    clearTimeout(maxTimer);
    meter?.stop();
    stopTracks(stream);
  };

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) pieces.push(event.data);
  });
  const finished = new Promise<Blob>((resolve, reject) => {
    // Also fires when the microphone goes away mid recording: we keep what we have.
    recorder.addEventListener("stop", () => {
      release();
      const type = recorder.mimeType || preferred || pieces[0]?.type || "";
      resolve(new Blob(cancelled ? [] : pieces, { type }));
    });
    recorder.addEventListener("error", (event) => {
      release();
      reject(new RecorderError("interrupted", "recording failed", { cause: event }));
    });
  });
  finished.catch(() => {}); // surfaced through stop(); no unhandled rejection if never awaited

  try {
    recorder.start();
  } catch (cause) {
    release();
    throw new RecorderError("unsupported", "MediaRecorder could not start", { cause });
  }
  if (opts.maxMs !== undefined) {
    maxTimer = setTimeout(() => {
      if (recorder.state === "inactive") return;
      recorder.stop();
      opts.onMaxReached?.();
    }, opts.maxMs);
  }

  const stopRecorder = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };
  return {
    mimeType: recorder.mimeType || preferred,
    stop() {
      stopRecorder();
      return finished;
    },
    cancel() {
      cancelled = true;
      pieces.length = 0;
      stopRecorder();
    },
  };
}

function toRecorderError(err: unknown): RecorderError {
  const name =
    typeof err === "object" && err !== null ? (err as { name?: unknown }).name : undefined;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return new RecorderError("permission_denied", "microphone permission was refused", {
        cause: err,
      });
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
    case "NotReadableError": // present but busy or broken
    case "TrackStartError":
    case "AbortError":
      return new RecorderError("no_microphone", "no usable microphone", { cause: err });
    default:
      return new RecorderError("unsupported", "the microphone could not be opened", { cause: err });
  }
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

/** Emit about 30 times a second whatever the display refresh (60 or 120 Hz). */
const LEVEL_INTERVAL_MS = 1000 / 30 - 4;

/** Metering is a nicety: if Web Audio is missing or fails, recording carries on without it. */
function startLevelMeter(
  stream: MediaStream,
  onLevel: (level: number) => void,
): { stop(): void } | undefined {
  const g = globalThis as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Context = g.AudioContext ?? g.webkitAudioContext;
  if (!Context || typeof requestAnimationFrame !== "function") return undefined;

  try {
    const context = new Context();
    // Old WebKit returns nothing here, so wrap rather than chain.
    void Promise.resolve().then(() => context.resume()).catch(() => {});
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser); // never to the speakers
    const frame = new Float32Array(analyser.fftSize);
    let level = 0;
    let lastEmit = -Infinity;
    let raf = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - lastEmit < LEVEL_INTERVAL_MS) return;
      lastEmit = now;
      analyser.getFloatTimeDomainData(frame);
      let sum = 0;
      for (const v of frame) sum += v * v;
      level = smoothLevel(level, levelFromRms(Math.sqrt(sum / frame.length)));
      onLevel(level);
    };
    raf = requestAnimationFrame(tick);

    return {
      stop() {
        cancelAnimationFrame(raf);
        source.disconnect();
        void Promise.resolve().then(() => context.close()).catch(() => {});
      },
    };
  } catch {
    return undefined;
  }
}
