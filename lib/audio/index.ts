// One audio pipeline for every source (DECISIONS D34). Server code should import ./wav directly.
export { AudioPrepError, type AudioPrepErrorKind } from "./errors";
export {
  decodeToMono16k,
  downmix,
  resampleLinear,
  sniffContainer,
  TARGET_SAMPLE_RATE,
  type Container,
} from "./decode";
export { planChunks, CHUNK_DEFAULTS, type ChunkOptions, type PlannedChunk } from "./split";
export { encodeWav16, parseWav, wavDurationMs, type ParsedWav } from "./wav";
export {
  prepareAudio,
  type PrepareOptions,
  type PrepareStage,
  type PreparedAudio,
  type PreparedChunk,
} from "./prepare";
export {
  startRecording,
  pickMimeType,
  levelFromRms,
  smoothLevel,
  RecorderError,
  type Recording,
  type RecordingOptions,
  type RecorderErrorKind,
} from "./recorder";
export {
  createUploadQueue,
  backoffDelayMs,
  UploadQueueError,
  type UploadQueue,
  type UploadQueueOptions,
  type OnlineEvents,
  type BackoffOptions,
} from "./upload-queue";
