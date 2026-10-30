"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Keyboard, Mic, RotateCcw, ShieldAlert, SkipForward, Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SampleBadge } from "@/components/parampara/Badges";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { ConsentReader } from "@/components/parampara/ConsentReader";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import type { HanateState } from "@/components/parampara/hanate/variants";
import { LampLoader } from "@/components/parampara/LampLoader";
import { LampRowLazy as LampRow } from "@/components/parampara/LampRowLazy";
import { MicOrb } from "@/components/parampara/MicOrb";
import { startRecording, type Recording } from "@/lib/audio";
import { PLAN_BY_ID } from "@/lib/domain/interview";
import type { MessageKey } from "@/lib/i18n";
import { useLang } from "@/lib/i18n/provider";
import { haptics, vibrate } from "@/lib/motion";
import type { Stage } from "@/lib/stages";
import {
  askNext,
  finishTalk,
  newInterviewId,
  sendConsent,
  sendTypedAnswer,
  sendVoiceAnswer,
  TalkError,
  voiceUrl,
  loadTalk,
  sendSkip,
  type AnswerSent,
  type Question,
  type SavedTurn,
} from "@/lib/talk/client";
import { clearSampleTalk, loadSampleTalk, parseSampleTalk, sampleTalkRaw, saveSampleTurn } from "@/lib/talk/sample-store";
import type { ResumeOffer } from "@/lib/talk/turns";
import { careFor, type Care } from "@/lib/talk/care";
import { sayAloud, stopSaying } from "@/lib/talk/say";
import { scriptedNext, type Turn } from "@/lib/talk/script";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";
import { CareNote } from "./CareNote";
import { Chapters, type ChapterEntry } from "./Chapters";

// /m/talk (DESIGN §8): one question at a time in huge text, Hanate asks aloud, tap the lamp to
// answer, stories collected as chapters. Consent comes first and is the first recording. Without
// speech to text the helper types what the master says; in Sample mode nothing leaves the phone.
// The one action (the lamp, or Save) always sits in the bottom bar, where a thumb finds it.
// A talk survives a reloaded tab or a locked phone: an open talk of the last six hours is offered
// again, and continuing rebuilds every turn, skip and the next question from the server.

const noSubscribe = () => () => {};

export type TalkMaster = { id: string; name: string | null; years: number | null; consented: boolean; isSample: boolean };

type Mode = "voice" | "type";
type SendStage = "saving" | "hearing" | "thinking";
type Phase =
  | { k: "pick" }
  | { k: "resume"; offer: Offer; busy: boolean }
  | { k: "consent"; rec: "idle" | "listening" | "saving" }
  | { k: "ask"; rec: "idle" | "listening" }
  | { k: "sending"; stage: SendStage }
  | { k: "finishing"; done: number; total: number }
  | { k: "done"; cards: number | null; attention: boolean; welfare: number };
type Answer = { blob: Blob } | { text: string };
/** An open talk to come back to: from the server, or in Sample mode from this phone. */
type Offer = Pick<ResumeOffer, "interviewId" | "answered" | "lastQuestion">;

const ERROR_COPY: Record<string, MessageKey> = {
  offline: "talk.err.offline",
  network: "talk.err.offline",
  redaction_unavailable: "talk.err.redaction",
  budget: "talk.err.redaction",
  consent_missing: "talk.err.consent_missing",
  consent_short: "talk.err.consent_short",
  consent_silent: "talk.err.consent_short",
  consent_not_saved: "talk.err.consent_not_saved",
  empty_answer: "talk.err.empty",
  too_long: "talk.err.too_long",
  too_many_turns: "talk.err.too_long",
  sign_in_needed: "talk.err.sign_in",
  not_allowed: "talk.err.sign_in",
  mic: "talk.err.mic",
  consent_mic: "talk.err.consent_mic",
  resume: "talk.err.resume",
  resume_offline: "talk.err.resume_offline",
  interview_closed: "talk.err.resume",
};
const TALK_STAGES: Stage[] = [
  { key: "saving", label: "talk.stage.saving" },
  { key: "hearing", label: "talk.stage.hearing" },
  { key: "thinking", label: "talk.stage.thinking" },
];
/** An answer is up to a few minutes; the recorder stops itself here (lib/talk/turns MAX_TURN_MS). */
const ANSWER_MAX_MS = 5 * 60_000;
const CONSENT_MAX_MS = 90_000;
/** The same floor the server keeps (lib/talk/turns CONSENT_MIN_MS): a tap and stop is not consent. */
const CONSENT_MIN_MS = 5_000;
/** The consent line as spoken (the blanks are said aloud: name, school, years). */

export function TalkFlow(props: {
  masters: TalkMaster[];
  resume?: Record<string, ResumeOffer>;
  fixture: boolean;
  speechReady: boolean;
  canReview: boolean;
}) {
  const { t, msg } = useLang();
  const CONSENT_KN = msg("kn", "talk.consent.line");
  const CONSENT_EN = msg("en", "talk.consent.line");
  const reduced = usePrefersReducedMotion();
  const live = !props.fixture;
  const [master, setMaster] = useState<TalkMaster | null>(props.masters.length === 1 ? props.masters[0]! : null);
  const firstPhase = (m: TalkMaster | null): Phase => {
    if (!m) return { k: "pick" };
    const offer = props.resume?.[m.id];
    return offer ? { k: "resume", offer, busy: false } : { k: "consent", rec: "idle" };
  };
  const [phase, setPhase] = useState<Phase>(() => firstPhase(master));
  const [mode, setMode] = useState<Mode>(props.speechReady && live ? "voice" : "type");
  const [question, setQuestion] = useState<Question | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [voiceMissing, setVoiceMissing] = useState(false);
  const [entries, setEntries] = useState<ChapterEntry[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const turns = useRef<Turn[]>([]);
  const answered = useRef(0);
  // What the guide needs if the server cannot be reached for the next question.
  const lastAnswer = useRef<{ nameRedacted: boolean; care: Care | null }>({ nameRedacted: false, care: null });
  const interviewId = useRef("");
  const turnId = useRef("");
  const consentTurn = useRef("");
  const recStartedAt = useRef(0);
  const rec = useRef<Recording | null>(null);
  // The answer being sent, kept until it is safely stored, so the master never tells it twice.
  const [unsent, setUnsent] = useState<Answer | null>(null);
  // The consent clip, kept the same way until it is on record.
  const [unsentConsent, setUnsentConsent] = useState<Blob | null>(null);
  // Care asked for by the very last answer stays with the master on the thank you screen.
  const [endCare, setEndCare] = useState<Care | null>(null);
  const abort = useRef(new AbortController());
  const questionRef = useRef<HTMLElement | null>(null);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  // Sample mode keeps its talk on this phone; offer it once the page is in the browser.
  const sampleRaw = useSyncExternalStore(
    noSubscribe,
    () => (props.fixture && master ? sampleTalkRaw(master.id) : null),
    () => null,
  );
  const [sampleChecked, setSampleChecked] = useState(false);
  if (sampleRaw && !sampleChecked) {
    setSampleChecked(true);
    const saved = parseSampleTalk(sampleRaw);
    if (saved && phase.k === "consent" && phase.rec === "idle") {
      const asked = saved.turns.filter((x) => x.question);
      setPhase({
        k: "resume",
        offer: { interviewId: "sample", answered: saved.turns.filter((x) => x.kind !== "skip").length, lastQuestion: asked[asked.length - 1]?.question ?? null },
        busy: false,
      });
    }
  }
  useEffect(() => {
    const controller = abort.current;
    return () => {
      stopSaying();
      rec.current?.cancel();
      controller.abort();
    };
  }, []);

  const elapsedMin = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 60_000));
  const intro = phase.k === "pick" || phase.k === "consent";
  const resuming = phase.k === "resume";

  async function present(q: Question) {
    setQuestion(q);
    setDraft("");
    setError(null);
    setUnsent(null);
    turnId.current = crypto.randomUUID();
    setPhase(q.done ? { k: "sending", stage: "thinking" } : { k: "ask", rec: "idle" });
    // The new question comes into view and takes focus, so a screen reader and an eye both land on it.
    requestAnimationFrame(() => {
      questionRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
      questionRef.current?.focus({ preventScroll: true });
    });
    const url = live && props.speechReady ? await voiceUrl(q.questionKn, q.sayToken) : null;
    if (q.done) setEndCare(q.care ?? null);
    const said = await sayAloud(q.questionKn, url, setSpeaking);
    setVoiceMissing(said === "none");
    if (q.done) void finish();
  }

  async function nextQuestion(after: "answer" | "skip" | "start") {
    setPhase({ k: "sending", stage: "thinking" });
    const care = after === "answer" ? lastAnswer.current.care : null;
    const scripted = (): Question => ({
      ...scriptedNext({
        turns: turns.current,
        elapsedMs: startedAt ? Date.now() - startedAt : 0,
        lastAnswerHadName: after === "answer" && lastAnswer.current.nameRedacted,
        care,
      }),
      care,
    });
    if (!live) return present(scripted());
    try {
      await present(await askNext(interviewId.current));
    } catch {
      // The guide's own next question rather than silence (the server does the same).
      await present({ ...scripted(), source: "script" });
    }
  }

  // ── Consent ──────────────────────────────────────────────────────────────
  async function consentStart() {
    setError(null);
    setUnsentConsent(null);
    try {
      vibrate(haptics.press);
      recStartedAt.current = Date.now();
      rec.current = await startRecording({ onLevel: setLevel, maxMs: CONSENT_MAX_MS, onMaxReached: () => void consentStop() });
      setPhase({ k: "consent", rec: "listening" });
    } catch {
      setError("consent_mic");
    }
  }

  async function consentStop() {
    const r = rec.current;
    rec.current = null;
    setLevel(0);
    if (!r || !master) return;
    const tooShort = Date.now() - recStartedAt.current < CONSENT_MIN_MS;
    const blob = await r.stop();
    if (live && tooShort) {
      setError("consent_short");
      return setPhase({ k: "consent", rec: "idle" });
    }
    setPhase({ k: "consent", rec: "saving" });
    // A new recording is a new interview; sending the same one again reuses its ids.
    interviewId.current = newInterviewId();
    consentTurn.current = crypto.randomUUID();
    await consentDone(blob);
  }

  async function consentDone(blob: Blob | null) {
    if (!master) return;
    setError(null);
    try {
      if (live) {
        if (!interviewId.current || !blob) {
          interviewId.current = newInterviewId();
          consentTurn.current = crypto.randomUUID();
        }
        setPhase({ k: "consent", rec: "saving" });
        setUnsentConsent(blob);
        await sendConsent({ interviewId: interviewId.current, turnId: consentTurn.current, masterId: master.id, blob, signal: abort.current.signal });
      }
      setUnsentConsent(null);
      setStartedAt(Date.now());
      vibrate(haptics.success);
      await nextQuestion("start");
    } catch (err) {
      setError(err instanceof TalkError ? err.code : "send");
      setPhase({ k: "consent", rec: "idle" });
    }
  }

  // ── Answers ──────────────────────────────────────────────────────────────
  async function answerStart() {
    setError(null);
    stopSaying();
    try {
      vibrate(haptics.press);
      rec.current = await startRecording({ onLevel: setLevel, maxMs: ANSWER_MAX_MS, onMaxReached: () => void answerStop() });
      setPhase({ k: "ask", rec: "listening" });
    } catch {
      setError("mic");
      setMode("type");
    }
  }

  async function answerStop() {
    const r = rec.current;
    rec.current = null;
    setLevel(0);
    if (!r) return;
    const blob = await r.stop();
    if (blob.size < 2_000) return setPhase({ k: "ask", rec: "idle" });
    await sendAnswer({ blob });
  }

  async function sendAnswer(answer: Answer) {
    if (!question) return;
    const q = question;
    const asked = { kn: q.questionKn, en: q.questionEn, topic: q.topic, probe: q.probe, sig: q.sig };
    setUnsent(answer);
    setError(null);
    setPhase({ k: "sending", stage: "blob" in answer ? "saving" : "hearing" });
    try {
      let sent: AnswerSent;
      let state: ChapterEntry["state"];
      if (!live) {
        // Sample mode: nothing leaves the phone, but the same care shows as in a real talk.
        sent = "text" in answer ? { lines: [{ kn: answer.text, en: null }], nameRedacted: false, care: careFor(answer.text) } : { lines: [], nameRedacted: false, care: null };
      } else if ("blob" in answer) {
        setPhase({ k: "sending", stage: "hearing" });
        sent = await sendVoiceAnswer({ interviewId: interviewId.current, question: asked, blob: answer.blob, turnId: turnId.current, signal: abort.current.signal });
        if (sent.lines.length === 0) state = props.speechReady ? "pending" : "audio_only";
      } else {
        sent = await sendTypedAnswer({ interviewId: interviewId.current, question: asked, text: answer.text, turnId: turnId.current });
      }
      const lines = sent.lines;
      if (!live && master && "text" in answer) {
        saveSampleTurn(master.id, startedAt ? Date.now() - startedAt : 0, { kind: "typed", topic: q.topic, probe: q.probe, question: { kn: q.questionKn, en: q.questionEn }, lines });
      }
      lastAnswer.current = { nameRedacted: sent.nameRedacted, care: sent.care ?? careFor(lines.map((l) => `${l.kn}\n${l.en ?? ""}`).join("\n")) };
      answered.current += 1;
      turns.current = [...turns.current, { topic: q.topic, probe: q.probe }];
      setEntries((e) => [...e, { topic: q.topic, question: { kn: q.questionKn, en: q.questionEn }, lines, state }]);
      await nextQuestion("answer");
    } catch (err) {
      setError(err instanceof TalkError ? err.code : "send");
      setPhase({ k: "ask", rec: "idle" });
    }
  }

  async function skip() {
    if (!question) return;
    stopSaying();
    const q = question;
    const s = { topic: q.topic, probe: q.probe };
    setError(null);
    if (live) {
      // Kept on the server first, so a reopened page does not ask it again.
      try {
        await sendSkip({ interviewId: interviewId.current, question: { kn: q.questionKn, en: q.questionEn, ...s, sig: q.sig }, turnId: turnId.current });
      } catch (err) {
        return setError(err instanceof TalkError ? err.code : "send");
      }
    } else if (master) {
      saveSampleTurn(master.id, startedAt ? Date.now() - startedAt : 0, { kind: "skip", ...s, question: { kn: q.questionKn, en: q.questionEn }, lines: [] });
    }
    turns.current = [...turns.current, s];
    await nextQuestion("skip");
  }

  // ── Coming back to a talk ────────────────────────────────────────────────
  async function continueTalk(offer: Offer) {
    if (!master) return;
    setError(null);
    setPhase({ k: "resume", offer, busy: true });
    try {
      let saved: { elapsedMs: number; turns: SavedTurn[] };
      if (live) {
        const talk = await loadTalk(offer.interviewId);
        if (talk.status !== "recording") throw new TalkError("interview_closed");
        saved = talk;
      } else {
        const sample = loadSampleTalk(master.id);
        if (!sample) throw new TalkError("resume");
        saved = sample;
      }
      const told = saved.turns.filter((x) => x.kind !== "consent");
      turns.current = told.flatMap((x) => (x.topic ? [{ topic: x.topic, probe: x.probe }] : []));
      answered.current = told.filter((x) => x.kind !== "skip").length;
      lastAnswer.current = { nameRedacted: false, care: null };
      setEntries(
        told
          .filter((x) => x.kind !== "skip" && x.topic && x.question)
          .map((x) => ({
            topic: x.topic!,
            question: x.question!,
            lines: x.lines,
            state: x.lines.length ? undefined : x.pending > 0 ? "pending" : "audio_only",
          })),
      );
      if (live) interviewId.current = offer.interviewId;
      setStartedAt(Date.now() - saved.elapsedMs);
      vibrate(haptics.success);
      // The next question comes from the server, which knows every turn and skip.
      await nextQuestion("start");
    } catch (err) {
      const code = err instanceof TalkError ? err.code : "resume";
      setError(code === "offline" || code === "network" ? "resume_offline" : "resume");
      setPhase({ k: "resume", offer, busy: false });
    }
  }

  function startNew() {
    if (master && !live) clearSampleTalk(master.id);
    setError(null);
    setPhase({ k: "consent", rec: "idle" });
  }

  async function endNow() {
    stopSaying();
    // The guide closes with the signature line; ask it once before finishing.
    if (!turns.current.some((x) => x.topic === "close") && question?.topic !== "close") {
      const close = PLAN_BY_ID.get("close")!;
      return present({ questionKn: close.opening.kn, questionEn: close.opening.en, why: "", topic: "close", probe: false, done: false, source: "script" });
    }
    await finish();
  }

  async function finish() {
    if (!live) {
      if (master) clearSampleTalk(master.id);
      return setPhase({ k: "done", cards: null, attention: false, welfare: 0 });
    }
    setPhase({ k: "finishing", done: 0, total: 0 });
    let welfare = 0;
    try {
      let cards: number | null = null;
      let attention = false;
      await finishTalk(
        interviewId.current,
        {
          stage: (stage, d) => {
            if (stage === "done") cards = d.done;
            if (stage === "attention") attention = true;
            if (stage === "reading") setPhase({ k: "finishing", done: d.done, total: d.total });
          },
          welfare: (n) => {
            welfare = n;
          },
        },
        abort.current.signal,
      );
      vibrate(haptics.success);
      setPhase({ k: "done", cards, attention, welfare });
    } catch {
      setPhase({ k: "done", cards: null, attention: true, welfare });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const listening = (phase.k === "ask" || phase.k === "consent") && phase.rec === "listening";
  const hanate: HanateState =
    phase.k === "done"
      ? "celebrating"
      : error
        ? "caring"
        : speaking
          ? "speaking"
          : listening
            ? "listening"
            : phase.k === "sending" || phase.k === "finishing" || (phase.k === "consent" && phase.rec === "saving")
              ? "thinking"
              : "idle";

  return (
    <>
      {(phase.k === "ask" || phase.k === "sending" || phase.k === "resume") && (
        <style>{"@media (max-width: 639px) { [data-feedback-tab] { display: none; } }"}</style>
      )}
      {intro ? (
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className={cn("text-[30px] leading-tight font-bold sm:text-[38px]", phase.k === "consent" && "max-sm:sr-only")}>
              <Bi k="talk.title" subClassName="font-sans text-lg font-semibold" />
            </h1>
            {/* Master body size (DESIGN §3): 22 px for a reader in his seventies. */}
            {/* Hidden at consent (the line he says comes first) and on a phone (the dock is low). */}
            <p
              className={cn(
                "mt-3 max-w-[60ch] text-[22px] leading-[1.6] text-ink-3 max-sm:hidden lg:mt-2",
                phase.k === "consent" && "hidden",
              )}
            >
              <Bi k="talk.sub" sub={false} />
            </p>
          </div>
        </div>
      ) : (
        <h1 className="sr-only">
          <Bi k="talk.title" sub={false} />
        </h1>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 lg:mt-3">
        {props.fixture && <SampleBadge />}
        {live && !props.speechReady && (
          <span className="inline-flex h-9 items-center gap-2 rounded-chip bg-sage px-4 text-[15px] font-semibold text-ink">
            <Keyboard className="size-4" aria-hidden />
            <Bi k="talk.typing_chip" sub={false} />
          </span>
        )}
        {props.fixture && intro && (
          <p role="note" className="text-[15px] text-ink-3">
            <Bi k="talk.sample" sub={false} />
          </p>
        )}
      </div>
      {live && !props.speechReady && intro && (
        <div role="note" className="mt-3 rounded-card bg-sage px-5 py-4 text-[17px] text-ink">
          <p className="font-display text-lg font-bold">
            <Bi k="talk.textmode.title" sub={false} />
          </p>
          <Bi k="talk.textmode.body" className="mt-1" subClassName="text-[15px]" />
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <div className="min-w-0">
          {phase.k === "pick" && (
            <section aria-labelledby="talk-pick" className="rounded-card bg-paper p-5 shadow-warm sm:p-7">
              <h2 id="talk-pick" className="font-display text-2xl font-bold">
                <Bi k="talk.pick.title" subClassName="text-lg font-semibold" />
              </h2>
              {props.masters.length === 0 ? (
                <p className="mt-4 text-[20px] text-ink-3">
                  <Bi k="talk.pick.none" subClassName="text-base" />
                </p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {props.masters.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMaster(m);
                          setPhase(firstPhase(m));
                        }}
                        className="flex min-h-16 w-full items-center justify-between gap-4 rounded-card border border-border bg-cream px-5 py-3 text-left transition-colors hover:bg-sage focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-clay"
                      >
                        <span className="font-display text-[22px] font-bold">{m.name ?? ""}</span>
                        {m.years !== null && (
                          <span className="text-base text-ink-3">
                            <BiText text="talk.pick.years" vars={{ years: m.years }} sub={false} />
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {phase.k === "resume" && master && (
            <section aria-labelledby="talk-resume" data-testid="talk-resume" className="rounded-card bg-paper p-6 shadow-warm sm:p-8">
              <div className="flex flex-col items-center text-center">
                <Hanate state={phase.busy ? "thinking" : "happy"} size={96} label="" />
                <h2 id="talk-resume" className="mt-3 font-display text-[28px] leading-tight font-bold">
                  <BiText text="talk.resume.title" vars={{ name: master.name ?? "" }} subClassName="font-sans text-base font-medium text-ink-3" />
                </h2>
                <p className="mt-2 text-[22px] leading-[1.6] text-ink-3">
                  <Bi k="talk.resume.body" subClassName="text-base" />
                </p>
                {/* One lamp per story told, as on the thank you screen. */}
                <div className="mt-4 flex items-center gap-3" data-testid="talk-resume-count">
                  <LampRow count={Math.min(Math.max(phase.offer.answered, 1), 7)} lit={phase.offer.answered > 0} />
                  <span className="font-display text-[40px] leading-none font-bold text-clay tabular-nums">{phase.offer.answered}</span>
                  <span className="text-left text-lg font-semibold text-ink">
                    <Bi k="talk.resume.count" subClassName="text-[14px] font-normal" />
                  </span>
                </div>
              </div>
              {phase.offer.lastQuestion && (
                <div className="mt-6">
                  <p className="font-display text-base font-bold text-clay-cta">
                    <Bi k="talk.resume.last" sub={false} />
                  </p>
                  <blockquote className="mt-2 border-l-4 border-flame pl-4">
                    <p lang="kn" data-testid="talk-resume-last" className="font-display text-[22px] leading-[1.65] font-bold text-ink">
                      {phase.offer.lastQuestion.kn}
                    </p>
                    <p
                      lang="en"
                      className="mt-1 text-base leading-normal text-ink-3 [:root[data-lang=en]_&]:text-[22px] [:root[data-lang=en]_&]:font-semibold [:root[data-lang=en]_&]:text-ink"
                    >
                      {phase.offer.lastQuestion.en}
                    </p>
                  </blockquote>
                </div>
              )}
              {props.fixture && (
                <p role="note" className="mt-5 text-[15px] text-ink-3">
                  <Bi k="talk.resume.sample" sub={false} />
                </p>
              )}
              {error && <ErrorNote code={error} />}
            </section>
          )}

          {phase.k === "consent" && master && (
            <section aria-labelledby="talk-consent">
              <ConsentReader
                speech={CONSENT_KN.replace(/_+/g, " ")}
                title={
                  <h2 id="talk-consent" className="rise mt-3 text-center font-display text-[28px] leading-tight font-bold">
                    {master.name && (
                      <span className="mb-1 block text-[20px] text-clay-cta">
                        <BiText text="talk.hello" vars={{ name: master.name }} sub={false} />
                      </span>
                    )}
                    <Bi k="talk.consent.title" subClassName="font-sans text-lg font-semibold" />
                  </h2>
                }
              >
                <p className="text-[20px] leading-[1.6] text-ink-3">
                  <Bi k="talk.consent.say" subClassName="text-base" />
                </p>
                <blockquote className="mt-4 border-l-4 border-flame pl-4">
                  <p lang="kn" className="text-[22px] leading-[1.75] text-ink">
                    <WithBlanks text={CONSENT_KN} />
                  </p>
                  <p lang="en" className="mt-3 text-base leading-[1.6] text-ink-3">
                    <WithBlanks text={CONSENT_EN} />
                  </p>
                </blockquote>
                {error && (
                  <ErrorNote code={error}>
                    {unsentConsent && (
                      <Button variant="ink" size="md" className="mt-3" onClick={() => void consentDone(unsentConsent)}>
                        <RotateCcw className="size-5" aria-hidden />
                        <Bi k="talk.again" sub={false} />
                      </Button>
                    )}
                  </ErrorNote>
                )}
              </ConsentReader>
            </section>
          )}

          {(phase.k === "ask" || phase.k === "sending") && question && (
            <section
              ref={questionRef}
              tabIndex={-1}
              aria-labelledby="talk-question-label"
              className="scroll-mt-4 rounded-card bg-paper p-5 shadow-warm outline-none sm:p-7"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Hanate state={hanate} size={64} label="" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p id="talk-question-label" className="font-display text-base font-bold text-clay-cta">
                        <Bi k="talk.question.label" sub={false} />
                      </p>
                      {/* The page's own badge scrolls away with the header; the card keeps the label. */}
                      {props.fixture && <SampleBadge />}
                    </div>
                    <p className="text-[17px] text-ink-3">
                      <BiText text={PLAN_BY_ID.get(question.topic)!.label} sub={false} inline />
                      {startedAt !== null && (
                        <>
                          {" · "}
                          <BiText text="talk.time" vars={{ min: elapsedMin }} sub={false} inline />
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {phase.k === "ask" && !voiceMissing && (
                  <Button
                    variant="paper"
                    size="md"
                    aria-pressed={speaking}
                    onClick={async () => {
                      if (speaking) return stopSaying();
                      const url = live && props.speechReady ? await voiceUrl(question.questionKn, question.sayToken) : null;
                      setVoiceMissing((await sayAloud(question.questionKn, url, setSpeaking)) === "none");
                    }}
                  >
                    {speaking ? <Square className="size-4 fill-current" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
                    <Bi k="talk.question.hear" sub={false} />
                  </Button>
                )}
              </div>

              {question.care && <CareNote care={question.care} />}
              {/* Each new question rises in (CSS rise, the enterUp spring), not Motion: DESIGN §10. */}
              <div key={question.questionKn} className={reduced ? undefined : "rise"}>
                <p data-testid="talk-question" lang="kn" className="mt-5 font-display text-[30px] leading-[1.65] font-bold text-ink sm:text-[36px]">
                  {question.questionKn}
                </p>
                {/* Quiet under the Kannada for a master; a juror in English reads it at body size. */}
                <p
                  lang="en"
                  className="mt-2 text-[16px] leading-normal text-ink-3 [:root[data-lang=en]_&]:text-[22px] [:root[data-lang=en]_&]:font-semibold [:root[data-lang=en]_&]:text-ink"
                >
                  {question.questionEn}
                </p>
                {question.source === "script" && live && (
                  <p className="mt-2 text-[17px] text-ink-3">
                    <Bi k="talk.question.script" sub={false} />
                  </p>
                )}
                {voiceMissing && phase.k === "ask" && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-chip bg-sage px-3 py-1.5 text-[15px] font-semibold text-ink">
                    <VolumeX className="size-4 shrink-0" aria-hidden />
                    <Bi k="talk.voice.none" sub={false} />
                  </p>
                )}
              </div>

              {phase.k === "sending" ? (
                <div className="mt-6">
                  <LampLoader stages={TALK_STAGES} current={phase.stage} />
                </div>
              ) : (
                mode === "type" && (
                  <div className="mt-6">
                    <label htmlFor="talk-answer" className="font-display text-lg font-bold">
                      <Bi k="talk.answer.label" sub={false} />
                    </label>
                    <p id="talk-answer-hint" className="mt-1 text-[17px] text-ink-3">
                      <Bi k="talk.answer.hint" sub={false} />
                    </p>
                    <textarea
                      ref={answerRef}
                      id="talk-answer"
                      data-testid="talk-answer"
                      aria-describedby="talk-answer-hint"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={3}
                      maxLength={4_000}
                      className="mt-3 w-full rounded-card border border-border bg-cream px-4 py-3 text-[22px] leading-[1.65] text-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-clay sm:min-h-44"
                    />
                  </div>
                )
              )}

              {error && phase.k === "ask" && (
                <ErrorNote code={error}>
                  {unsent && (
                    <Button variant="ink" size="md" className="mt-3" onClick={() => void sendAnswer(unsent)}>
                      <RotateCcw className="size-5" aria-hidden />
                      <Bi k="talk.again" sub={false} />
                    </Button>
                  )}
                </ErrorNote>
              )}

            </section>
          )}

          {(phase.k === "ask" || phase.k === "sending") && question && (
            <ActionBar>
              {phase.k === "sending" ? (
                // The bar stays while the answer travels, so the page does not jump.
                <p className="flex min-h-14 items-center text-center text-[22px] font-semibold text-ink-3" aria-hidden>
                  <Bi k={`talk.stage.${phase.stage}`} sub={false} />
                </p>
              ) : mode === "voice" ? (
                <>
                  <MicOrb
                    state={phase.rec === "listening" ? "listening" : "idle"}
                    level={level}
                    onPress={answerStart}
                    onRelease={answerStop}
                    label={t("talk.mic.label")}
                    caption={false}
                  />
                  <p className="mt-2 text-center text-[22px] font-semibold text-ink" aria-live="polite">
                    <Bi k={phase.rec === "listening" ? "talk.listening" : "talk.tap_to_answer"} sub={false} />
                  </p>
                </>
              ) : (
                <Button
                  className="w-full"
                  aria-disabled={!draft.trim() || undefined}
                  data-testid="talk-send"
                  onClick={() => (draft.trim() ? void sendAnswer({ text: draft.trim() }) : answerRef.current?.focus())}
                >
                  <Bi k="talk.answer.send" sub={false} />
                </Button>
              )}
              {phase.k === "ask" && phase.rec === "idle" && (
                <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-x-4 sm:justify-between">
                  {mode === "voice" ? (
                    <Button variant="ghost" size="md" onClick={() => setMode("type")}>
                      <Keyboard className="size-5" aria-hidden />
                      <Bi k="talk.answer.type_instead" sub={false} />
                    </Button>
                  ) : (
                    live &&
                    props.speechReady && (
                      <Button variant="ghost" size="md" onClick={() => setMode("voice")}>
                        <Mic className="size-5" aria-hidden />
                        <Bi k="talk.answer.speak_instead" sub={false} />
                      </Button>
                    )
                  )}
                  <Button variant="ghost" size="md" onClick={() => void skip()}>
                    <SkipForward className="size-5" aria-hidden />
                    <Bi k="talk.skip" sub={false} />
                  </Button>
                  <Button variant="ghost" size="md" onClick={() => void endNow()} data-testid="talk-end">
                    <Bi k="talk.end" sub={false} />
                  </Button>
                </div>
              )}
            </ActionBar>
          )}

          {phase.k === "finishing" && (
            <section className="rounded-card bg-paper p-6 shadow-warm sm:p-8" aria-live="polite">
              <p className="text-center font-display text-2xl font-bold">
                <Bi k="talk.finishing" subClassName="font-sans text-lg font-semibold" />
              </p>
              <div className="mt-5">
                <LampLoader stages={TALK_STAGES} current="thinking" detail={phase.total > 0 ? `${phase.done} / ${phase.total}` : undefined} />
              </div>
            </section>
          )}

          {phase.k === "done" && (
            <section data-testid="talk-done" className="flex flex-col items-center rounded-card bg-paper p-8 text-center shadow-warm" aria-live="polite">
              <Hanate state="celebrating" size={110} label="" />
              <LampRow count={Math.min(Math.max(entries.length, 1), 7)} lit className="mt-2" />
              <h2 className="mt-5 font-display text-[30px] leading-tight font-bold">
                <Bi k="talk.done.title" subClassName="font-sans text-lg font-semibold" />
              </h2>
              <p className="mt-2 max-w-md text-[22px] leading-[1.6] text-ink-3">
                <Bi k="talk.done.body" subClassName="text-base" />
              </p>
              <div className="mt-6 flex flex-col items-center">
                {props.fixture ? (
                  <>
                    <p className="font-display text-[56px] leading-none font-bold text-clay">{entries.length}</p>
                    <p className="mt-1 text-lg font-semibold">
                      <Bi k="talk.done.stories" sub={false} />
                    </p>
                    <p className="mt-3 max-w-sm text-[15px] text-ink-3">
                      <Bi k="talk.done.sample" sub={false} />
                    </p>
                  </>
                ) : phase.cards ? (
                  <>
                    <p className="font-display text-[56px] leading-none font-bold text-clay">{phase.cards}</p>
                    <p className="mt-1 text-lg font-semibold">
                      <Bi k="talk.done.cards_label" sub={false} />
                    </p>
                  </>
                ) : (
                  <p className="rounded-card bg-sage px-5 py-3 text-lg font-semibold text-ink">
                    <Bi k={phase.attention ? "talk.done.attention" : "talk.done.none"} subClassName="text-base font-normal" />
                  </p>
                )}
              </div>
              {(endCare || (phase.welfare > 0 && !props.canReview)) && (
                <div className="w-full max-w-md text-left">
                  <CareNote care={endCare ?? "child"} />
                </div>
              )}
              {phase.welfare > 0 && props.canReview && (
                <p role="note" className="mt-5 flex max-w-md items-start gap-3 rounded-button bg-flame/25 px-4 py-3 text-left text-base font-semibold">
                  <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <BiText text="import.welfare" vars={{ n: phase.welfare }} subClassName="text-[15px] font-normal" />
                </p>
              )}
              <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto">
                {props.canReview && !props.fixture ? (
                  <Button asChild>
                    <Link href="/r">
                      <Bi k="talk.review" sub={false} />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/m">
                      <Bi k="talk.home" sub={false} />
                    </Link>
                  </Button>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Coming back: the bottom bar on a phone, a panel beside the last question at desktop. */}
        {phase.k === "resume" && (
          <ActionBar side>
            {phase.busy ? (
              <p className="flex min-h-14 items-center text-center text-[22px] font-semibold text-ink-3" aria-live="polite">
                <Bi k="talk.resume.loading" sub={false} />
              </p>
            ) : (
              <>
                <Button className="w-full" data-testid="talk-resume-continue" onClick={() => void continueTalk(phase.offer)}>
                  <Bi k="talk.resume.continue" sub={false} />
                </Button>
                <Button variant="ghost" size="md" className="mt-3" data-testid="talk-resume-new" onClick={startNew}>
                  <Bi k="talk.resume.new" sub={false} />
                </Button>
              </>
            )}
          </ActionBar>
        )}

        {/* Consent's one action: the bottom bar on a phone, a panel beside the line at desktop. */}
        {phase.k === "consent" && master && (
          <ActionBar side>
            {/* A phone keeps this dock compact, so the line he reads aloud stays in view. */}
            <div className="max-sm:-m-7 max-sm:scale-[0.7]">
              <MicOrb
                state={phase.rec === "listening" ? "listening" : phase.rec === "saving" ? "thinking" : "idle"}
                level={level}
                onPress={consentStart}
                onRelease={consentStop}
                label={t("talk.mic.consent")}
                caption={false}
              />
            </div>
            <p className="mt-2 text-center text-[20px] font-semibold text-ink max-sm:mt-0 max-sm:text-left sm:text-[22px]" aria-live="polite">
              <Bi k={phase.rec === "listening" ? "talk.listening" : phase.rec === "saving" ? "talk.stage.saving" : "talk.mic.consent"} sub={false} />
            </p>
            {phase.rec === "idle" && ((master.consented && live) || props.fixture) && (
              // In Sample mode this is the juror's way on, so it is the clear button here.
              <Button
                // One clay element in the dock (the lamp); the Sample way on is clear but quieter.
                variant="ghost"
                size="md"
                className={cn(
                  "mt-1 h-auto min-h-12 text-center whitespace-normal max-sm:col-span-2",
                  // Outlined: clear, yet the clay lamp stays the dock's one filled action.
                  props.fixture && "min-h-14 border-2 border-ink text-ink hover:bg-sage",
                  props.fixture && "mt-3 w-full max-w-sm py-2.5 leading-snug max-sm:col-span-2 max-sm:mt-2 max-sm:max-w-none max-sm:text-[16px]",
                )}
                data-testid={props.fixture ? "talk-consent-skip" : undefined}
                onClick={() => void consentDone(null)}
              >
                <Bi k={props.fixture ? "talk.consent.sample_skip" : "talk.consent.earlier"} sub={false} />
              </Button>
            )}
          </ActionBar>
        )}

        {phase.k !== "pick" && !resuming && (
          <aside
            tabIndex={0}
            aria-label={t("talk.chapters")}
            className={cn(
              "min-w-0 rounded-card focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-clay lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:pb-10 lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-40px),transparent)]",
              // At consent nothing is told yet; the consent panel takes this column at desktop.
              phase.k === "consent" && entries.length === 0 && "hidden",
            )}
          >
            <Chapters entries={entries} sample={props.fixture} />
          </aside>
        )}
      </div>
    </>
  );
}

/** The one action, in the bottom third where a thumb finds it (DESIGN §2.10), as /m/import does. */
function ActionBar({ children, side = false }: { children: React.ReactNode; side?: boolean }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-5 mt-5 flex flex-col items-center bg-cream px-5 pt-4 pb-[max(env(safe-area-inset-bottom),12px)] shadow-warm-lg sm:mx-0 sm:rounded-card",
        // Beside the consent line at desktop, so the line and the lamp are both above the fold.
        side && "lg:top-6 lg:bottom-auto lg:col-start-2 lg:row-start-1 lg:mt-0 lg:self-start lg:py-8 lg:shadow-warm",
        // On a phone the consent dock is one row (lamp beside its words) so the line stays in view.
        side && "max-sm:grid max-sm:grid-cols-[auto_1fr] max-sm:items-center max-sm:gap-x-2 max-sm:pt-2",
      )}
    >
      {children}
    </div>
  );
}

/** The consent line's blanks as lines to fill aloud, not underscores. */
function WithBlanks({ text }: { text: string }) {
  const parts = text.split(/_{3,}/);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <span aria-hidden className="mx-1 inline-block w-16 translate-y-1 border-b-2 border-ink-3" />}
        </span>
      ))}
    </>
  );
}

function ErrorNote({ code, children }: { code: string; children?: React.ReactNode }) {
  return (
    <div role="alert" className="mt-5 rounded-card bg-cream px-4 py-3 text-[17px] text-ink">
      <p className="flex items-start gap-3">
        <RotateCcw className="mt-1 size-5 shrink-0 text-clay" aria-hidden />
        <span className="min-w-0 flex-1">
          <Bi k={ERROR_COPY[code] ?? "talk.err.send"} subClassName="text-[15px]" />
        </span>
      </p>
      {children}
    </div>
  );
}
