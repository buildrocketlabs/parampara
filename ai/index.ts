// The public surface of ai/. App code imports from `@/ai` only (ESLint fences the providers out,
// Law 3). Server only: this pulls in node:fs, node:crypto and the service role logger.

import { CARD_EXTRACTOR_PROMPT_VERSION } from "./prompts/card_extractor";
import { extractCards, windowSegments, type ExtractInput } from "./roles/card_extractor";
import { redactPhrases, type RedactInput } from "./roles/redactor";
import { transcribeChunk } from "./speech/sarvam";

export {
  lineSpeaker,
  speak,
  transcribeChunk,
  splitForSpeech,
  SpeechFailed,
  SpeechNotConfigured,
  SpeechRateLimited,
} from "./speech/sarvam";
export type { LineSpeaker, Phrase, SpeakOptions, Transcript } from "./speech/sarvam";
export { redactPhrases, redactorRole } from "./roles/redactor";
export type { RedactInput, RedactResult, RedactedPhrase } from "./roles/redactor";
export {
  cardExtractorRole,
  DEFAULT_WINDOW,
  DROP_REASONS,
  evidenceOverlap,
  extractCards,
  mergeWindowCards,
  windowSegments,
} from "./roles/card_extractor";
export type {
  DropReason,
  DroppedItem,
  ExtractedCard,
  ExtractInput,
  ExtractResult,
  ExtractSegment,
} from "./roles/card_extractor";
export { CARD_EXTRACTOR_PROMPT_VERSION } from "./prompts/card_extractor";
export { REDACTOR_PROMPT_VERSION } from "./prompts/redactor";
export {
  findDisclosures,
  findUnsafe,
  findWelfareSignals,
  SAFETY_PATTERNS_VERSION,
} from "./safety/patterns";
export type { UnsafeCategory, WelfareCategory } from "./safety/patterns";
export { aiMode } from "./run";
export type { AiMode, NeedsHumanReason } from "./run";
export type { Span } from "./span";

/**
 * The capture functions in the shape lib/import's pipeline injects (its `ImportAi`), so wiring
 * needs no adapter. Windows default to 10 minutes with 1 minute of overlap (D40).
 */
export const captureAi = {
  transcribe: (wav: Uint8Array, opts: { traceId?: string }) => transcribeChunk(wav, opts),
  redact: (input: RedactInput) => redactPhrases(input),
  extract: (input: ExtractInput) => extractCards(input),
  windows: <T extends { startMs: number; endMs: number }>(segments: T[]) =>
    windowSegments(segments),
  promptVersion: CARD_EXTRACTOR_PROMPT_VERSION,
};

// The teacher's question (M3): the roles in the shape lib/ask's pipeline injects (its `AskAi`).
export { askAi, transcribeQuestion } from "./ask";
export { triageQuestion, triageRole, TRIAGE_FLAGS, INTENTS } from "./roles/triage";
export type { Triage, TriageResult } from "./roles/triage";
export { rankCards, retrieverRole } from "./roles/retriever";
export type { RankResult } from "./roles/retriever";
export { answerQuestion, answererRole } from "./roles/answerer";
export type { AnswerResult, DraftAnswer } from "./roles/answerer";
export { judgeStep, groundingJudgeRole } from "./roles/grounding_judge";
export type { JudgeResult, Verdict } from "./roles/grounding_judge";
export { checkSafety, safetyRole, SAFETY_CATEGORIES } from "./roles/safety";
export type { SafetyResult } from "./roles/safety";
export { TRIAGE_PROMPT_VERSION } from "./prompts/triage";
export { RETRIEVER_PROMPT_VERSION } from "./prompts/retriever";
export { ANSWERER_PROMPT_VERSION } from "./prompts/answerer";
export { JUDGE_PROMPT_VERSION } from "./prompts/grounding_judge";
export { SAFETY_PROMPT_VERSION } from "./prompts/safety";

// The live interviewer (M4.3).
export { nextInterviewQuestion, interviewerRole } from "./roles/interviewer";
export type {
  InterviewerInput,
  InterviewerResult,
  InterviewTurn,
  NextQuestion,
} from "./roles/interviewer";
export { INTERVIEWER_PROMPT_VERSION } from "./prompts/interviewer";
/** Which voice speaks (model, speaker, pace, codec): part of every cached voice file's key. */
export { SPEAK_VOICE_ID } from "./speech/voice-id";
// The officer's weekly note (M5): anonymous aggregates in, a grounded digest out.
export {
  summarizeInsights,
  insightsDigestRole,
  DigestOutput,
  validateDigest,
} from "./roles/insights_digest";
export type { DigestInput, DigestCount, DigestResult } from "./roles/insights_digest";
export { INSIGHTS_DIGEST_PROMPT_VERSION } from "./prompts/insights_digest";
export { PHOTO_READER_PROMPT_VERSION } from "./prompts/photo_reader";
export { photoReaderRole, readPhoto } from "./roles/photo_reader";
export type { PhotoReading, PhotoReaderResult } from "./roles/photo_reader";
/** Reads the spend total into memory ahead of a question (GET /api/ask, D85); no model call. */
export { loadSpend as warmSpend } from "./spend";
