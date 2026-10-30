// Shapes of the teacher's question pipeline (docs/AI.md §2 to §5, docs/BUILD.md M3.2). The AI roles
// are injected (lib/ask/deps.ts wires @/ai) so "grounded or silent" (Law 4) is tested without keys.

export type AnswerLang = "kn" | "en" | "hi";
export type Bi = { kn: string; en: string };
export type Tri = Bi & { hi?: string };

export type Span = {
  role: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  costUsd: number;
  attempts: number;
  replayed: boolean;
};

export type RoleOk<T> = { status: "ok"; span?: Span } & T;
export type RoleNeedsHuman = { status: "needs_human"; reason: string; span?: Span };
export type RoleResult<T> = RoleOk<T> | RoleNeedsHuman;

export type Triage = {
  /** The question with every child's name replaced (Law 5). The only question text we keep. */
  redactedText: string;
  language: "kn" | "en" | "hi" | "other";
  topic: string;
  subject: string | null;
  gradeBand: string | null;
  intent:
    "pedagogy" | "safety_disclosure" | "teacher_distress" | "off_topic" | "greeting" | "other";
  needsClarification: boolean;
  clarifyingQuestion: Bi | null;
  safetyFlags: string[];
};

/** About 60 tokens per card: what retrieval ranks over (docs/AI.md §3 Context). */
export type CardIndexEntry = {
  id: string;
  titleEn: string;
  problemEn: string;
  topic: string | null;
  gradeBand: string | null;
  subject: string | null;
};

export type FullCard = {
  id: string;
  masterId: string;
  masterName: string | null;
  title: Bi;
  problem: Bi;
  steps: Bi[];
  materials: Bi[];
  why: Bi | null;
  quoteSegmentId: number | null;
  isSample: boolean;
};

export type DraftStep = Tri & { cardId: string };

export type DraftAnswer = {
  title: Tri;
  steps: DraftStep[];
  materials: Tri[];
  why: Tri | null;
};

export type Verdict = "supported" | "partial" | "unsupported";

export type SafetyCheck = {
  ok: boolean;
  categories: string[];
  escalate: boolean;
};

export type AskAi = {
  transcribe(
    wav: Uint8Array,
    opts: { traceId: string; lang?: AnswerLang },
  ): Promise<{ text: string; span?: Span }>;
  triage(input: {
    text: string;
    lang: AnswerLang;
    traceId: string;
    /** The first reading, before the second name reader: for work that stores nothing. */
    onFirstPass?: (first: Triage) => void;
  }): Promise<RoleResult<{ triage: Triage }>>;
  /** "Show me" (M5.3): what one photo of children's work shows. Never given her words. Optional. */
  readPhoto?(input: {
    photo: Uint8Array;
    lang: AnswerLang;
    traceId: string;
  }): Promise<RoleResult<{ reading: PhotoReading }>>;
  /** A teacher in crisis, by pattern (Tele-MANAS). Optional: triage also finds it. */
  crisisPatterns?(text: string): boolean;
  rank(input: {
    triage: Triage;
    index: CardIndexEntry[];
    traceId: string;
  }): Promise<RoleResult<{ cardIds: string[]; reasons: string[] }>>;
  answer(input: {
    question: string;
    lang: AnswerLang;
    cards: FullCard[];
    traceId: string;
    /** Each step as soon as it is written, before validation (D86): a hint for droppable work. */
    onStep?: (step: DraftStep) => void;
  }): Promise<RoleResult<{ answer: DraftAnswer }>>;
  judge(input: {
    step: DraftStep;
    card: FullCard;
    traceId: string;
  }): Promise<RoleResult<{ verdict: Verdict; cardQuote: string | null }>>;
  safety(input: {
    question: string;
    answerText: string;
    traceId: string;
  }): Promise<RoleResult<{ safety: SafetyCheck }>>;
  /** Deterministic pattern check (ai/safety/patterns), run before and after any model. */
  unsafePatterns(text: string): string[];
  /**
   * Made from her raw question before it is let go: counts the names from it that an answer
   * repeats and its cards never say (a count, never the names).
   */
  nameEchoCheck(question: string): (answerText: string, sources: string) => number;
  disclosurePatterns(text: string): string[];
};

export type TraceStep = {
  kind:
    | "transcript"
    | "photo"
    | "triage"
    | "retrieval"
    | "draft"
    | "grounding"
    | "safety"
    | "voice"
    | "cache";
  title: Bi;
  detail?: string;
  model?: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  promptVersion?: string;
  verdicts?: Array<{ step: string; verdict: Verdict; quote?: string | null; removed?: boolean }>;
  /**
   * A replay's "cache" step only (D35): when the first answer was made (ISO). Its latencyMs and
   * costUsd are the replay's own; the trace's totals stay the first answer's (F-P1).
   */
  at?: string;
};

export type Trace = { steps: TraceStep[]; totals: { latencyMs: number; costUsd: number } };

export type Outcome =
  | { kind: "answered"; answerId: string; replayed: boolean }
  /** `note`: a gentle line under the outcome, never a helpline (hunger, D72). */
  | { kind: "no_card"; answerId: string; note?: "hunger" }
  | { kind: "needs_human"; answerId: string; reason: "unsupported" | "safety" | "model" }
  /** `both`: the final check saw danger but cannot tell whether to a child or the teacher. */
  | { kind: "escalated"; answerId: string; helpline: "childline" | "both" }
  | { kind: "distress"; answerId: string; helpline: "telemanas" }
  | { kind: "clarify"; question: Bi }
  | { kind: "redirect"; reason: "off_topic" | "greeting" | "empty" }
  | { kind: "limited"; retryInMinutes: number }
  /** "Show me": the photo showed a face, so nothing was read or kept and nothing was asked. */
  | { kind: "photo_refused"; reason: "faces" };

export type AskStage = "seeing" | "understanding" | "finding" | "checking" | "voicing";

/** What the photo reader saw, as the ask route streams it and the trace records it. */
export type PhotoReading = {
  seenKn: string;
  seenEn: string;
  relevant: boolean;
  faces: boolean;
  /** The child's own writing or drawing speaks of harm: escalates like a disclosure. */
  welfareConcern: boolean;
  problemHint: string | null;
};

export type QuestionInsert = {
  teacherId: string;
  textRedacted: string;
  lang: AnswerLang;
  topic: string | null;
  gradeBand: string | null;
  safetyFlags: string[];
  isSample: boolean;
};

export type AnswerOutcome =
  "answered" | "no_card" | "needs_human" | "child_safety" | "distress" | "care";

export type AnswerInsert = {
  questionId: string;
  status: "answered" | "needs_human" | "escalated";
  outcome: AnswerOutcome;
  lang: AnswerLang;
  /** Keyed hash of the question as asked, for replay without triage (see AskInput.rawKey). */
  rawKey: string | null;
  title: Bi | null;
  steps: Array<DraftStep & { verdict: Verdict }>;
  materials: Tri[];
  why: Tri | null;
  cardIds: string[];
  trace: Trace;
  costUsd: number;
  latencyMs: number;
  cacheKey: string | null;
  replayedFrom: string | null;
  isSample: boolean;
};

/**
 * Which approved cards a teacher may be answered from (D64). A field teacher hears only real,
 * consented masters; a Sample (demo) account hears Sample and real masters alike, so a juror can
 * meet both. Never mix the other way: a synthetic card must never reach a real classroom.
 */
export type CardPool = "field" | "all";

/**
 * The answer's voice, started while its steps are checked (D86). `start` speaks a line that may
 * end up in the answer (nothing is stored); `finish` is told the answer's exact lines once it is
 * stored as answered, and keeps the spoken file for it. Neither ever delays the text.
 */
export type AskVoice = {
  start(line: string): void;
  finish(answerId: string, lines: string[]): void;
};

export type AskStore = {
  insertQuestion(q: QuestionInsert): Promise<string>;
  insertAnswer(a: AnswerInsert): Promise<string>;
  queue(
    questionId: string,
    reason: "no_card" | "unsupported" | "safety",
    urgent: boolean,
    isSample: boolean,
  ): Promise<void>;
  /** Approved cards only. */
  cardIndex(pool: CardPool): Promise<CardIndexEntry[]>;
  fullCards(ids: string[], pool: CardPool): Promise<FullCard[]>;
  /** Part of every cache key, so the two pools never share a cached answer. */
  libraryVersion(pool: CardPool): Promise<string>;
  findCached(cacheKey: string): Promise<{ answerId: string; createdAt: string } | null>;
  /** The same words asked before: the earlier answer and its question's redacted record. */
  findCachedRaw(rawKey: string): Promise<{
    answerId: string;
    question: Pick<QuestionInsert, "textRedacted" | "topic" | "gradeBand" | "safetyFlags">;
  } | null>;
  /** `now`: what this replay itself took and spent (its trace says so, not the first answer's). */
  copyAnswer(
    fromAnswerId: string,
    questionId: string,
    now?: { latencyMs: number; costUsd: number },
  ): Promise<string>;
};
