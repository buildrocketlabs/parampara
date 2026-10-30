import { createHash } from "node:crypto";
import type {
  AnswerInsert,
  AnswerLang,
  AnswerOutcome,
  AskAi,
  AskStage,
  AskStore,
  AskVoice,
  CardIndexEntry,
  DraftAnswer,
  DraftStep,
  FullCard,
  Outcome,
  PhotoReading,
  Span,
  Trace,
  TraceStep,
  Triage,
  Verdict,
  CardPool,
} from "./types";
import { spokenLine, spokenLines, spokenStep } from "@/lib/answers/voice";

// A teacher's question, end to end (docs/AI.md §2 to §5). Grounded or silent (Law 4): every shipped
// step cites an approved card and a second model says the card supports it; if fewer than two steps
// survive, a human answers instead. Children first (Law 5): a disclosure of harm skips pedagogy and
// shows Childline; only redacted text is ever stored. The raw transcript lives in memory only.
// A teacher's own distress stays private (Law 6): no queue, and her words are not in the trace.

export const MIN_SUPPORTED_STEPS = 2;
export const MAX_CARDS = 3;
/** Below this many prefiltered cards, the ranker sees the whole (small) library instead. */
const PREFILTER_MIN = 5;
const WITHHELD = "[question withheld: it could not be checked for children's names]";
const REMOVED_UNSAFE = "[removed: advice that is not safe for children]";

export type AskInput = {
  text?: string;
  wav?: Uint8Array;
  lang: AnswerLang;
  teacherId: string;
  isSample: boolean;
  traceId: string;
  /** Prompt and pattern versions: a new prompt must never replay an answer made by the old one. */
  versionTag?: string;
  /**
   * Keyed, one way hash of a normalised question (the route uses an HMAC with a server secret).
   * It lets the very same words replay their checked answer without triage, so sample questions
   * still work at the budget cap (Law 10), and nothing readable is stored.
   */
  rawKey?: (normalisedQuestion: string) => string;
  /**
   * "Show me" (M5.3): one JPEG of children's work, already checked and stripped of metadata by
   * the route. Read before triage, never stored, never sent anywhere else.
   */
  photo?: Uint8Array;
  /** The answer's voice, started while the steps are checked (D86). Optional: text never waits. */
  voice?: AskVoice;
};

const PHOTO_TITLE = { kn: "ನೀವು ತೋರಿಸಿದ ಫೋಟೋ", en: "The photo you showed" };
/**
 * The trace says only what happened to the photo, never what the reader wrote: what the work shows
 * is in "What you said", after triage has redacted it (audit H2; traces can be shown on /how).
 */
const PHOTO_DETAIL = {
  used: "Used: what the work shows was added to your question.",
  unrelated: "Not used: the photo did not show children's work.",
  person: "Not used: the photo showed a person.",
  unread: "Not read, so the answer comes from your words alone.",
  skipped: "Not read: your words came first.",
};
/** Said to her when the reader could not run (budget, timeout): the answer uses her words alone. */
const PHOTO_UNREAD: PhotoReading = {
  seenKn: "ಫೋಟೋ ನೋಡಲು ಆಗಲಿಲ್ಲ. ನಿಮ್ಮ ಮಾತಿನಿಂದಲೇ ಉತ್ತರ ಹುಡುಕುತ್ತೇನೆ.",
  seenEn: "The photo could not be read, so the answer comes from your words alone.",
  relevant: false,
  faces: false,
  welfareConcern: false,
  problemHint: null,
};

/** Flags that mean a child may be at risk, whatever the stated intent (Law 5). */
const CHILD_RISK = new Set(["child_harm", "abuse", "child_marriage", "child_labour"]);

export async function ask(
  ai: AskAi,
  store: AskStore,
  input: AskInput,
  emit: (s: AskStage) => void = () => {},
  /** What the photo reader saw, as soon as it is known (the route streams it to the teacher). */
  onPhoto: (reading: PhotoReading) => void = () => {},
): Promise<Outcome> {
  const started = Date.now();
  const trace: TraceStep[] = [];
  const spanStep = (
    kind: TraceStep["kind"],
    title: TraceStep["title"],
    span?: Span,
    detail?: string,
  ): TraceStep => ({
    kind,
    title,
    detail,
    model: span?.model,
    latencyMs: span?.latencyMs,
    tokensIn: span?.tokensIn,
    tokensOut: span?.tokensOut,
    costUsd: span?.costUsd,
    promptVersion: span?.promptVersion,
  });
  const done = (): Trace => ({
    steps: trace,
    totals: {
      latencyMs: Date.now() - started,
      costUsd: round(trace.reduce((a, s) => a + (s.costUsd ?? 0), 0)),
    },
  });
  const empty = (
    questionId: string,
    status: AnswerInsert["status"],
    outcome: AnswerOutcome,
  ): AnswerInsert => emptyAnswer(questionId, status, outcome, done(), input);

  // 1. Understanding: words, deterministic disclosure check, then triage before anything is stored.
  const withPhoto = Boolean(input.photo && ai.readPhoto);
  emit(withPhoto ? "seeing" : "understanding");
  let raw = input.text?.trim() ?? "";
  let sttSpan: Span | undefined;
  if (!raw && input.wav) {
    const heard = await ai.transcribe(input.wav, { traceId: input.traceId, lang: input.lang });
    raw = heard.text.trim();
    sttSpan = heard.span;
  }
  if (!raw) return { kind: "redirect", reason: "empty" };

  let disclosure = ai.disclosurePatterns(raw);

  // "Show me": the photo is read before triage, and never with her words (they go no further than
  // triage). What the WORK shows is appended to her question, so triage redacts it like her own
  // words and the same grounded pipeline answers. A child's writing about harm escalates like a
  // disclosure. A person in the photo means it is not used; the request then ends kindly only if
  // nothing in her words needs care first (safety audit, 24 Oct, H1 to H3, M6).
  let photoStep: TraceStep | null = null;
  let photoRefused = false;
  if (withPhoto && input.photo && ai.readPhoto) {
    if (disclosure.length > 0 || ai.crisisPatterns?.(raw)) {
      // Her words come first; a photo that may show the child is not sent anywhere.
      photoStep = { kind: "photo", title: PHOTO_TITLE, detail: PHOTO_DETAIL.skipped };
    } else {
      const read = await ai.readPhoto({
        photo: input.photo,
        lang: input.lang,
        traceId: input.traceId,
      });
      const step = (detail: string) => spanStep("photo", PHOTO_TITLE, read.span, detail);
      if (read.status !== "ok") {
        onPhoto(PHOTO_UNREAD);
        photoStep = step(PHOTO_DETAIL.unread);
      } else {
        const r = read.reading;
        onPhoto(r);
        // Used or not, a child's own words about harm are never dropped.
        disclosure = [
          ...new Set([
            ...disclosure,
            ...(r.welfareConcern ? ["child_harm"] : []),
            ...(r.faces ? [] : ai.disclosurePatterns(`${r.seenEn}\n${r.seenKn}`)),
          ]),
        ];
        if (r.faces) {
          photoRefused = true;
          photoStep = step(PHOTO_DETAIL.person);
        } else if (r.relevant) {
          raw = `${raw}\n[What the photo shows: ${r.seenEn}]`;
          photoStep = step(PHOTO_DETAIL.used);
        } else {
          photoStep = step(PHOTO_DETAIL.unrelated);
        }
      }
    }
    emit("understanding");
  }

  // The very same words asked before (and no disclosure): replay without any model call (D35).
  const pool: CardPool = input.isSample ? "all" : "field";
  const version = await store.libraryVersion(pool);
  const versionKey = `${version}:${input.versionTag ?? ""}`;
  const rawKey = input.rawKey
    ? input.rawKey(`${input.lang}\n${versionKey}\n${normalise(raw)}`)
    : null;
  if (rawKey && disclosure.length === 0 && !withPhoto) {
    const hit = await store.findCachedRaw(rawKey);
    if (hit) {
      const questionId = await store.insertQuestion({
        ...hit.question,
        teacherId: input.teacherId,
        lang: input.lang,
        isSample: input.isSample,
      });
      // No model was called on this path: nothing spent now.
      const answerId = await store.copyAnswer(hit.answerId, questionId, {
        latencyMs: Date.now() - started,
        costUsd: 0,
      });
      if (hit.question.safetyFlags.includes("medical"))
        await store.queue(questionId, "safety", false, input.isSample);
      return { kind: "answered", answerId, replayed: true };
    }
  }

  // The card index is read while triage runs, and once triage's first reading is in, the ranker
  // starts while the second name reader checks the redacted words (latency, 24 Oct). Ranking
  // stores nothing; if the name reader sends triage round again, this early ranking is dropped
  // and done again on the corrected words. Only a plain classroom question is ranked early.
  const indexRead = store.cardIndex(pool);
  indexRead.catch(() => {});
  let early: Promise<EarlyRank> | null = null;
  const tri = await ai.triage({
    text: raw,
    lang: input.lang,
    traceId: input.traceId,
    onFirstPass: (first) => {
      if (!rankEarly(first, disclosure)) return;
      early = (async () => {
        const index = await indexRead;
        const candidates = prefilter(index, first);
        const ranked = candidates.length
          ? await ai.rank({ triage: first, index: candidates, traceId: input.traceId })
          : null;
        // The chosen cards are read too (a read, nothing stored), so drafting can start the
        // moment triage is done instead of after two more database round trips (Track B).
        const ids = chosenIds(ranked, candidates);
        const cards = ids.length ? store.fullCards(ids, pool) : Promise.resolve([]);
        cards.catch(() => {});
        return { triage: first, index, candidates, ranked, ids, cards };
      })();
      early.catch(() => {});
    },
  });
  // Only the possible names are kept, to check the answer against (Law 5); never stored or logged.
  const echoesName = ai.nameEchoCheck(raw);
  raw = ""; // the unredacted words go no further than triage
  const triage: Triage | null = tri.status === "ok" ? tri.triage : null;
  const flags = triage?.safetyFlags ?? [];
  const distress = triage?.intent === "teacher_distress";
  // The redacted words' cache entry is looked up while the question is stored (a read; its
  // result is used only on the classroom path below, after every safety branch).
  const cacheKey = triage ? answerCacheKey(triage.redactedText, input.lang, versionKey) : null;
  const cachedLookup = cacheKey ? store.findCached(cacheKey) : Promise.resolve(null);
  cachedLookup.catch(() => {});

  const questionId = await store.insertQuestion({
    teacherId: input.teacherId,
    textRedacted: triage?.redactedText ?? WITHHELD,
    lang: input.lang,
    topic: triage?.topic ?? null,
    gradeBand: triage?.gradeBand ?? null,
    safetyFlags: [
      ...new Set([
        ...flags,
        ...disclosure,
        ...(distress ? ["teacher_distress"] : []),
        ...(photoRefused ? ["photo_faces"] : []),
      ]),
    ],
    isSample: input.isSample,
  });
  // Her own words appear in the trace only for a classroom question; distress stays private.
  trace.push(
    spanStep(
      "transcript",
      { kn: "ನೀವು ಹೇಳಿದ್ದು", en: "What you said" },
      sttSpan,
      distress ? undefined : triage?.redactedText,
    ),
  );
  if (photoStep) trace.push(photoStep);
  trace.push(
    spanStep(
      "triage",
      { kn: "ನಾವು ಅರ್ಥಮಾಡಿಕೊಂಡದ್ದು", en: "What we understood" },
      tri.span,
      triage
        ? distress
          ? "private"
          : `${triage.topic} · ${triage.gradeBand ?? "any class"} · ${triage.intent}`
        : "triage unavailable",
    ),
  );

  // Safety before pedagogy: a child at risk gets care and a helpline, never a lesson plan.
  const harm =
    disclosure.length > 0 ||
    triage?.intent === "safety_disclosure" ||
    flags.some((f) => CHILD_RISK.has(f)) ||
    (flags.includes("self_harm") && !distress);
  if (harm) {
    await store.queue(questionId, "safety", true, input.isSample);
    trace.push({
      kind: "safety",
      title: { kn: "ಮಗುವಿನ ಸುರಕ್ಷೆ", en: "Child safety" },
      detail: "marked urgent for reviewers; Childline 1098 shown",
    });
    const answerId = await store.insertAnswer(empty(questionId, "escalated", "child_safety"));
    return { kind: "escalated", answerId, helpline: "childline" };
  }
  if (!triage) {
    // We could not check these words, so the page shows Childline beside "we will not guess" and a
    // person sees the question. Not urgent: urgent stays reserved for child safety, so an outage
    // cannot bury a real case (safety audit re check, 24 Oct).
    await store.queue(questionId, "unsupported", false, input.isSample);
    const answerId = await store.insertAnswer(empty(questionId, "needs_human", "needs_human"));
    return { kind: "needs_human", answerId, reason: "model" };
  }
  if (distress) {
    // Private: no queue, no report (Law 6). Kindness and Tele-MANAS, no pedagogy.
    const answerId = await store.insertAnswer(empty(questionId, "escalated", "distress"));
    return { kind: "distress", answerId, helpline: "telemanas" };
  }
  if (photoRefused) {
    // Nothing in her words needs care now, and the photo showed a person: it was not used, and she
    // is asked for another photo or to ask without one. Her question is kept, unanswered.
    return { kind: "photo_refused", reason: "faces" };
  }
  if (triage.intent === "off_topic" || triage.intent === "greeting") {
    return { kind: "redirect", reason: triage.intent };
  }
  if (triage.needsClarification && triage.clarifyingQuestion) {
    return { kind: "clarify", question: triage.clarifyingQuestion };
  }

  // 2. The same question (after redaction) against the same library: replay, and say so (D35).
  const cached = await cachedLookup;
  if (cached) {
    // Triage ran first on this path: its cost is what this replay spent (done() sums the trace).
    const now = done();
    const answerId = await store.copyAnswer(cached.answerId, questionId, now.totals);
    if (flags.includes("medical")) await store.queue(questionId, "safety", false, input.isSample);
    return { kind: "answered", answerId, replayed: true };
  }

  // 3. Finding: deterministic prefilter, then a fast model ranks the compact index.
  emit("finding");
  const ahead = await (early as Promise<EarlyRank> | null)?.catch(() => null);
  const reuse = ahead && sameReading(ahead.triage, triage);
  const index = reuse ? ahead.index : await indexRead;
  const candidates = reuse ? ahead.candidates : prefilter(index, triage);
  const ranked = reuse
    ? ahead.ranked
    : candidates.length
      ? await ai.rank({ triage, index: candidates, traceId: input.traceId })
      : null;
  const cardIds = reuse ? ahead.ids : chosenIds(ranked, candidates);
  trace.push(
    spanStep(
      "retrieval",
      { kn: "ಸಿಕ್ಕ ಅಭ್ಯಾಸ ಕಾರ್ಡ್‌ಗಳು", en: "Practice cards we found" },
      ranked?.span,
      `${cardIds.length} of ${candidates.length} considered (${index.length} approved)`,
    ),
  );
  if (cardIds.length === 0) {
    await store.queue(questionId, "no_card", false, input.isSample);
    const answerId = await store.insertAnswer(empty(questionId, "needs_human", "no_card"));
    return {
      kind: "no_card",
      answerId,
      ...(flags.includes("hunger") ? { note: "hunger" as const } : {}),
    };
  }
  const cards = reuse ? await ahead.cards : await store.fullCards(cardIds, pool);
  const byId = new Map(cards.map((c) => [c.id, c]));

  // A step is judged against its card alone; an unsafe step is never sent to be judged.
  const judgeOne = async (step: DraftStep): Promise<Judged> => {
    const unsafe = ai.unsafePatterns(`${step.kn} ${step.en} ${step.hi ?? ""}`);
    if (unsafe.length)
      return { step, verdict: "unsupported", quote: null, span: undefined, unsafe };
    const j = await ai.judge({ step, card: byId.get(step.cardId)!, traceId: input.traceId });
    return j.status === "ok"
      ? { step, verdict: j.verdict, quote: j.cardQuote, span: j.span, unsafe }
      : { step, verdict: "unsupported", quote: null, span: j.span, unsafe };
  };
  // Judging starts while the answer is still being written (D86): each finished step goes to its
  // judge at once. Nothing is stored or shown from it; a judgment is used only for a step the
  // validated answer repeats word for word, so the result is the same as judging afterwards.
  const earlyJudged = new Map<string, Promise<Judged>>();

  // 4. The answer may only use the given cards; a step citing anything else is dropped.
  const drafted = await ai.answer({
    question: triage.redactedText,
    lang: input.lang,
    cards,
    traceId: input.traceId,
    onStep: (step) => {
      const key = stepKey(step);
      if (!byId.has(step.cardId) || earlyJudged.has(key)) return;
      const judged = judgeOne(step);
      judged.catch(() => {});
      earlyJudged.set(key, judged);
    },
  });
  trace.push(spanStep("draft", { kn: "ಉತ್ತರದ ಕರಡು", en: "The draft answer" }, drafted.span));
  if (drafted.status !== "ok") {
    await store.queue(questionId, "unsupported", false, input.isSample);
    const answerId = await store.insertAnswer(empty(questionId, "needs_human", "needs_human"));
    return { kind: "needs_human", answerId, reason: "model" };
  }
  const draft = drafted.answer;
  // Law 5, defence in depth: a person she named never reaches an answer, even if triage and the
  // name reader both missed the name. The draft is held whole; no step of it is stored or shown.
  if (echoesName(answerTextOf(draft, draft.steps), sourcesOf(cards)) > 0) {
    // The hold must not hide danger: the final reading still looks at her question (and none of
    // the draft), so a child at risk is escalated with the helplines as on any other path.
    const read = await ai.safety({
      question: triage.redactedText,
      answerText: "",
      traceId: input.traceId,
    });
    const escalate = read.status === "ok" && read.safety.escalate;
    trace.push(
      spanStep(
        "safety",
        { kn: "ಸುರಕ್ಷತಾ ಪರಿಶೀಲನೆ", en: "Safety check" },
        read.span,
        escalate ? "marked urgent" : "held for a human",
      ),
      {
        kind: "safety",
        title: { kn: "ಹೆಸರು", en: "A name" },
        detail: escalate
          ? "the draft repeated a name from the question, and the question needs a person now; Childline 1098 and Tele-MANAS 14416 shown"
          : "the draft repeated a name from the question; held for a person",
      },
    );
    if (escalate) {
      await store.queue(questionId, "safety", true, input.isSample);
      const answerId = await store.insertAnswer(empty(questionId, "escalated", "care"));
      return { kind: "escalated", answerId, helpline: "both" };
    }
    await store.queue(questionId, "safety", false, input.isSample);
    const answerId = await store.insertAnswer(empty(questionId, "needs_human", "needs_human"));
    return { kind: "needs_human", answerId, reason: "safety" };
  }
  const cited = draft.steps.filter((s) => byId.has(s.cardId));

  // 5. Checking: a second model judges every step against its card, in parallel, and the final
  // safety reading runs at the same time on every step that could be kept (a superset of what
  // ships), so it is never weaker than reading the kept steps alone, and the teacher waits for
  // the slower of the two instead of both in turn (latency, 24 Oct).
  emit("checking");
  const candidate = cited.filter(
    (s) => ai.unsafePatterns(`${s.kn} ${s.en} ${s.hi ?? ""}`).length === 0,
  );
  const safetyRead = ai.safety({
    question: triage.redactedText,
    answerText: answerTextOf(draft, candidate),
    traceId: input.traceId,
  });
  // The voice starts now (D86): the title and why at once, each step the moment its judge says
  // supported, numbered as if every earlier step stays (a step removed later only means a line is
  // spoken again with its true number). Speaking stores nothing; only an answered answer keeps it.
  const voice = input.voice;
  const speakable = (t: { kn: string; en: string; hi?: string }) =>
    ai.unsafePatterns(`${t.kn} ${t.en} ${t.hi ?? ""}`).length === 0;
  if (voice) {
    // The title is stored without Hindi (as the voice route reads it), so it is spoken the same way.
    if (speakable(draft.title))
      voice.start(spokenLine(input.lang, { kn: draft.title.kn, en: draft.title.en }));
    if (draft.why && speakable(draft.why)) voice.start(spokenLine(input.lang, draft.why));
  }
  const removed = new Set<number>();
  const judging = Promise.all(
    cited.map(async (step, i): Promise<Judged> => {
      const j = { ...(await (earlyJudged.get(stepKey(step)) ?? judgeOne(step))), step };
      if (j.verdict === "supported") {
        const before = [...removed].filter((r) => r < i).length;
        voice?.start(spokenStep(input.lang, step, i - before));
      } else removed.add(i);
      return j;
    }),
  );
  const [judged, safe] = await Promise.all([judging, safetyRead]);
  const kept = judged.filter((j) => j.verdict === "supported");
  trace.push({
    kind: "grounding",
    title: { kn: "ಪ್ರತಿ ಹಂತದ ಪರಿಶೀಲನೆ", en: "Every step checked" },
    model: judged.find((j) => j.span)?.span?.model,
    latencyMs: Math.max(0, ...judged.map((j) => j.span?.latencyMs ?? 0)),
    costUsd: round(judged.reduce((a, j) => a + (j.span?.costUsd ?? 0), 0)),
    promptVersion: judged.find((j) => j.span)?.span?.promptVersion,
    verdicts: [
      // An unsafe draft step is never stored or shown, not even struck through (audit, 24 Oct).
      ...judged.map((j) => ({
        step: j.unsafe.length ? REMOVED_UNSAFE : j.step.en,
        verdict: j.verdict,
        quote: j.quote,
        removed: j.verdict !== "supported",
      })),
      ...draft.steps
        .filter((s) => !byId.has(s.cardId))
        .map((s) => ({
          step: ai.unsafePatterns(`${s.kn} ${s.en} ${s.hi ?? ""}`).length ? REMOVED_UNSAFE : s.en,
          verdict: "unsupported" as Verdict,
          quote: null,
          removed: true,
        })),
    ],
  });

  // 6. Safety on the words the teacher would see. A child at risk comes first, whatever the judges said.
  const steps: Array<DraftStep & { verdict: Verdict }> = kept.map((k) => ({
    ...k.step,
    verdict: k.verdict,
  }));
  const answerText = answerTextOf(draft, steps);
  const safeOk =
    safe.status === "ok" && safe.safety.ok && ai.unsafePatterns(answerText).length === 0;
  trace.push(
    spanStep(
      "safety",
      { kn: "ಸುರಕ್ಷತಾ ಪರಿಶೀಲನೆ", en: "Safety check" },
      safe.span,
      safeOk ? "passed" : "held for a human",
    ),
  );
  if (safe.status === "ok" && safe.safety.escalate) {
    // The final check saw danger in the question but cannot say whether to a child or to the
    // teacher, so the page offers both helplines in neutral words (audit, 24 Oct).
    await store.queue(questionId, "safety", true, input.isSample);
    trace.push({
      kind: "safety",
      title: { kn: "ಸುರಕ್ಷೆ", en: "Safety" },
      detail: "marked urgent; Childline 1098 and Tele-MANAS 14416 shown",
    });
    const answerId = await store.insertAnswer(empty(questionId, "escalated", "care"));
    return { kind: "escalated", answerId, helpline: "both" };
  }
  if (kept.length < MIN_SUPPORTED_STEPS) {
    await store.queue(questionId, "unsupported", false, input.isSample);
    const answerId = await store.insertAnswer(empty(questionId, "needs_human", "needs_human"));
    return { kind: "needs_human", answerId, reason: "unsupported" };
  }
  if (!safeOk) {
    await store.queue(questionId, "safety", false, input.isSample);
    const answerId = await store.insertAnswer(empty(questionId, "needs_human", "needs_human"));
    return { kind: "needs_human", answerId, reason: "safety" };
  }

  const usedCards = [...new Set(steps.map((s) => s.cardId))];
  const trail = done();
  const answerId = await store.insertAnswer({
    questionId,
    status: "answered",
    outcome: "answered",
    lang: input.lang,
    title: { kn: draft.title.kn, en: draft.title.en },
    steps,
    materials: draft.materials,
    why: draft.why,
    cardIds: usedCards,
    trace: trail,
    costUsd: trail.totals.costUsd,
    latencyMs: trail.totals.latencyMs,
    cacheKey,
    rawKey,
    replayedFrom: null,
    isSample: input.isSample,
  });
  // Exactly the lines the voice route would read from this stored answer.
  voice?.finish(
    answerId,
    spokenLines(input.lang, {
      title: { kn: draft.title.kn, en: draft.title.en },
      steps,
      why: draft.why,
    }),
  );
  // Health questions are answered from cards (observe, support, refer) but a person looks too.
  if (flags.includes("medical")) await store.queue(questionId, "safety", false, input.isSample);
  return { kind: "answered", answerId, replayed: false };
}

function emptyAnswer(
  questionId: string,
  status: AnswerInsert["status"],
  outcome: AnswerOutcome,
  trace: Trace,
  input: Pick<AskInput, "lang" | "isSample">,
): AnswerInsert {
  return {
    questionId,
    status,
    outcome,
    lang: input.lang,
    title: null,
    steps: [],
    materials: [],
    why: null,
    cardIds: [],
    trace,
    costUsd: trace.totals.costUsd,
    latencyMs: trace.totals.latencyMs,
    cacheKey: null,
    rawKey: null,
    replayedFrom: null,
    isSample: input.isSample,
  };
}

type EarlyRank = {
  triage: Triage;
  index: CardIndexEntry[];
  candidates: CardIndexEntry[];
  ranked: Awaited<ReturnType<AskAi["rank"]>> | null;
  ids: string[];
  cards: Promise<FullCard[]>;
};

type Judged = {
  step: DraftStep;
  verdict: Verdict;
  quote: string | null;
  span: Span | undefined;
  unsafe: string[];
};

/** A step's identity for reusing an early judgment: its card and every word, in every language. */
function stepKey(s: DraftStep): string {
  return JSON.stringify([s.cardId, s.kn, s.en, s.hi ?? null]);
}

/** The ranker's picks that were really among the candidates, at most MAX_CARDS, best first. */
function chosenIds(
  ranked: Awaited<ReturnType<AskAi["rank"]>> | null,
  candidates: CardIndexEntry[],
): string[] {
  if (ranked?.status !== "ok") return [];
  const allowed = new Set(candidates.map((c) => c.id));
  return [...new Set(ranked.cardIds)].filter((id) => allowed.has(id)).slice(0, MAX_CARDS);
}

/** Rank early only a plain classroom question: no disclosure, no risk, nothing to ask back. */
export function rankEarly(first: Triage, disclosure: string[]): boolean {
  return (
    disclosure.length === 0 &&
    first.intent === "pedagogy" &&
    !first.needsClarification &&
    !first.safetyFlags.some((f) => CHILD_RISK.has(f) || f === "self_harm")
  );
}

/** The early ranking is used only when the final reading is the same question, routed the same way. */
export function sameReading(a: Triage, b: Triage): boolean {
  return (
    a.redactedText === b.redactedText &&
    a.topic === b.topic &&
    a.gradeBand === b.gradeBand &&
    a.subject === b.subject
  );
}

/** The words a teacher would read: title, steps, materials and why, in every language given. */
/** Everything the cards say (and their masters' names): a word from here is the practice's, not a person's. */
export function sourcesOf(
  cards: ReadonlyArray<
    Pick<FullCard, "title" | "problem" | "steps" | "materials" | "why" | "masterName">
  >,
): string {
  return cards
    .flatMap((c) => [
      c.title,
      c.problem,
      ...c.steps,
      ...c.materials,
      ...(c.why ? [c.why] : []),
      c.masterName ?? "",
    ])
    .map((t) => (typeof t === "string" ? t : `${t.kn}\n${t.en}`))
    .join("\n");
}

export function answerTextOf(
  draft: Pick<DraftAnswer, "title" | "materials" | "why">,
  steps: DraftStep[],
): string {
  return [draft.title, ...steps, ...draft.materials, ...(draft.why ? [draft.why] : [])]
    .flatMap((t) => [t.kn, t.en, t.hi ?? ""])
    .filter(Boolean)
    .join("\n");
}

/** Cards that plausibly fit by topic, class or subject; the ranker decides among them. */
export function prefilter(
  index: CardIndexEntry[],
  triage: Pick<Triage, "topic" | "gradeBand" | "subject">,
): CardIndexEntry[] {
  const fit = index.filter(
    (c) =>
      (triage.topic && c.topic === triage.topic) ||
      (triage.subject &&
        c.subject === triage.subject &&
        gradesOverlap(c.gradeBand, triage.gradeBand)),
  );
  return fit.length >= PREFILTER_MIN ? fit : index;
}

export function gradesOverlap(a: string | null, b: string | null): boolean {
  const range = (g: string | null): [number, number] => {
    if (!g || g === "any") return [0, 12];
    const [lo, hi] = g.split("-").map(Number);
    return [lo ?? 0, hi ?? lo ?? 12];
  };
  const [a0, a1] = range(a);
  const [b0, b1] = range(b);
  return a0 <= b1 && b0 <= a1;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function answerCacheKey(redacted: string, lang: AnswerLang, libraryVersion: string): string {
  return createHash("sha256")
    .update(`${lang}\n${libraryVersion}\n${normalise(redacted)}`)
    .digest("hex");
}

function round(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
