"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Clock, Keyboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { FieldBadge, IllustrationBadge, SampleBadge } from "@/components/parampara/Badges";
import { Chip } from "@/components/parampara/Chip";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { MicOrb } from "@/components/parampara/MicOrb";
import type { Recording } from "@/lib/audio";
import { AskError, askQuestion, questionWav, type PhotoSeen } from "@/lib/ask/client";
import { countQuestions, queueQuestion, takeQuestion } from "@/lib/ask/question-queue";
import type { FieldChip } from "@/lib/ask/field-chips";
import type { AnswerLang, AskStage, Outcome } from "@/lib/ask/types";
import type { MessageKey } from "@/lib/i18n";
import { useLang } from "@/lib/i18n/provider";
import { haptics, vibrate } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import type { PreparedPhoto } from "@/lib/photo/prepare";
import { ANSWER_STAGES, PHOTO_ANSWER_STAGES } from "@/lib/stages";
import { takeEarlyTap } from "@/lib/ask/early-tap";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// What comes after the first tap loads after first paint (DESIGN §10), fetched when the page is
// idle so it is there by the time she needs it: the stages while answering, and "Show me".
const loadLoader = () => import("@/components/parampara/LampLoader");
const loadShowMe = () => import("./ShowMe");
const loadOutcome = () => import("./OutcomePanel");
const OutcomePanel = dynamic(() => loadOutcome().then((m) => m.OutcomePanel), { ssr: false });
const LampLoader = dynamic(() => loadLoader().then((m) => m.LampLoader), {
  ssr: false,
  // On a slow network a question can go before the stages have arrived: say the first one meanwhile.
  loading: () => (
    <div className="flex flex-col items-center text-center">
      <Hanate state="thinking" size={96} label="" />
      <p className="mt-3 font-display text-[22px] leading-snug font-bold text-ink">
        <BiText text="stage.understanding" subClassName="font-sans text-[16px] font-semibold" />
      </p>
    </div>
  ),
});
const ShowMe = dynamic(() => loadShowMe().then((m) => m.ShowMe), { ssr: false });
const PhotoAttached = dynamic(() => loadShowMe().then((m) => m.PhotoAttached), { ssr: false });

// Voice is the front door (DESIGN §2): hold or tap the orb, check the words, then honest stages
// until the answer opens. Typing is the quiet alternative, and so is "Show me": one photo of the
// work, sent once with the question and never kept (M5.3). Children's safety outranks everything.

type Phase =
  | { k: "idle" }
  | { k: "listening" }
  | { k: "transcribing" }
  | { k: "confirm"; text: string }
  | { k: "typing"; text: string }
  | { k: "photo" }
  | { k: "asking"; stage: AskStage; withPhoto: boolean; seen: PhotoSeen | null }
  | { k: "outcome"; outcome: Exclude<Outcome, { kind: "answered" }>; question: string }
  /** `question`: her words, kept so a photo error can still send them (without the photo). */
  | { k: "error"; code: string; question?: string }
  /** Asked with no network: kept on the phone, sent when it returns (Law 9). */
  | { k: "queued" };

const SAMPLES = ["letters", "numbers", "multilevel", "safety", "nocard"] as const;
const ERROR_COPY: Record<string, MessageKey> = {
  mic_denied: "ask.mic_denied",
  too_short: "ask.too_short",
  ai_not_ready: "ask.out.not_ready",
  not_configured: "ask.out.not_ready",
  photo_offline: "ask.photo.offline",
  photo_busy: "ask.photo.busy",
  photo_invalid: "ask.photo.error.send",
  too_large: "ask.photo.error.send",
};

/** A chip tapped before the page was ready looks pressed until its question goes (early-tap). */
const HELD = "data-early-held:border-clay-cta data-early-held:bg-sage";

/** Errors after which the photo is let go: it was refused, so sending it again cannot help. */
const PHOTO_DROPPED = new Set(["photo_invalid", "too_large"]);

export function AskFlow({
  profileLang,
  fieldChips = null,
}: {
  profileLang: AnswerLang;
  /**
   * A field teacher's chips, drawn from real approved cards only (D64, D83); null for a Sample
   * (demo) account, which keeps the warmed Sample questions. An empty list shows no chip at all.
   */
  fieldChips?: FieldChip[] | null;
}) {
  const router = useRouter();
  const { lang, t } = useLang();
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [level, setLevel] = useState(0);
  const recRef = useRef<Recording | null>(null);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const [waiting, setWaiting] = useState(0);
  const reduced = usePrefersReducedMotion();
  const flowTop = useRef<HTMLDivElement>(null);
  // A photo error brings the photo and the way forward to the top, clear of the offline banner.
  const photoError = phase.k === "error" && phase.code.startsWith("photo_");
  useEffect(() => {
    if (!photoError) return;
    flowTop.current?.scrollIntoView({ block: "start", behavior: reduced ? "instant" : "smooth" });
  }, [photoError, reduced]);
  // The photo waiting for her question, in memory only, with its preview URL (M5.3).
  const [attached, setAttached] = useState<{
    photo: PreparedPhoto;
    url: string;
    /** Our drawn sample slate (Show me, for jurors): labelled, with a sample question. */
    sample: boolean;
  } | null>(null);
  const attachedRef = useRef(attached);
  attachedRef.current = attached;
  // Her question, kept while she takes another photo after one was refused.
  const [pending, setPending] = useState<string | null>(null);
  // Hindi is a teacher's own choice at welcome; otherwise answers follow the screen's language.
  const answerLang: AnswerLang = profileLang === "hi" ? "hi" : lang;
  // She tapped the mic before the page was ready: say it is ready now (lib/ask/early-tap).
  const [earlyMic, setEarlyMic] = useState(false);

  async function startListening() {
    setEarlyMic(false);
    try {
      vibrate(haptics.press);
      // Fetched at idle (below), so this resolves at once inside her tap.
      const { startRecording } = await import("@/lib/audio");
      recRef.current = await startRecording({
        onLevel: setLevel,
        maxMs: 29_000,
        onMaxReached: () => void stopListening(),
      });
      setPhase({ k: "listening" });
    } catch {
      setPhase({ k: "error", code: "mic_denied" });
    }
  }

  async function stopListening() {
    const rec = recRef.current;
    recRef.current = null;
    setLevel(0);
    if (!rec) return;
    setPhase({ k: "transcribing" });
    try {
      const blob = await rec.stop();
      if (blob.size < 2_000) throw new AskError("too_short");
      const wav = await questionWav(blob);
      if (!navigator.onLine) {
        const audio = new Blob([wav as BlobPart], { type: "audio/wav" });
        await queueQuestion({ kind: "audio", wav: audio, lang: answerLang, at: Date.now() });
        setWaiting(await countQuestions());
        setPhase({ k: "queued" });
        return;
      }
      await transcribe(wav);
    } catch (err) {
      setPhase({ k: "error", code: err instanceof AskError ? err.code : "failed" });
    }
  }

  // Speech to text, then she checks the words before anything is asked (the confirm step).
  async function transcribe(wav: Uint8Array | Blob) {
    setPhase({ k: "transcribing" });
    const res = await fetch(`/api/transcribe?lang=${answerLang}`, {
      method: "POST",
      headers: { "content-type": "audio/wav" },
      body: wav as BodyInit,
    });
    const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!res.ok) throw new AskError(body.error ?? "failed");
    if (!body.text?.trim()) throw new AskError("too_short");
    setPhase({ k: "confirm", text: body.text.trim() });
  }

  function attachPhoto(photo: PreparedPhoto, from: { sample: boolean }) {
    dropPhoto();
    setAttached({ photo, url: URL.createObjectURL(photo.blob), sample: from.sample });
    // After a refused photo, her question is ready to go again with the new one.
    setPhase(pending ? { k: "typing", text: pending } : { k: "idle" });
    setPending(null);
  }

  function dropPhoto() {
    const now = attachedRef.current;
    if (now) URL.revokeObjectURL(now.url);
    attachedRef.current = null;
    setAttached(null);
  }

  // Nothing of the photo outlives the page.
  useEffect(
    () => () => {
      if (attachedRef.current) URL.revokeObjectURL(attachedRef.current.url);
    },
    [],
  );

  async function send(text: string, usePhoto = true) {
    const question = text.trim();
    if (!question) return;
    const photo = usePhoto ? attachedRef.current?.photo : undefined;
    const photoSample = usePhoto ? Boolean(attachedRef.current?.sample) : false;
    if (!navigator.onLine) {
      // A photo is never written to the phone's storage, so it cannot wait in the offline queue.
      if (photo) {
        setPhase({ k: "error", code: "photo_offline", question });
        return;
      }
      await queueQuestion({ kind: "text", text: question, lang: answerLang, at: Date.now() });
      setWaiting(await countQuestions());
      setPhase({ k: "queued" });
      return;
    }
    setPhase({
      k: "asking",
      stage: photo ? "seeing" : "understanding",
      withPhoto: Boolean(photo),
      seen: null,
    });
    try {
      const outcome = await askQuestion(
        { text: question, lang: answerLang, photo: photo?.blob, photoSample },
        (stage) => setPhase((p) => (p.k === "asking" ? { ...p, stage } : p)),
        undefined,
        (seen) => setPhase((p) => (p.k === "asking" ? { ...p, seen } : p)),
      );
      // Sent once and read once: the photo is let go whatever the outcome.
      if (photo) dropPhoto();
      if (outcome.kind === "answered") {
        vibrate(haptics.success);
        router.push(`/t/a/${outcome.answerId}`);
        return;
      }
      setPhase({ k: "outcome", outcome, question });
    } catch (err) {
      const code = err instanceof AskError ? err.code : "failed";
      if (photo && PHOTO_DROPPED.has(code)) dropPhoto();
      setPhase({ k: "error", code, question });
    }
  }

  // A question kept while offline goes as soon as the network is back (and when she opens the
  // room again later), but never over something she is doing right now.
  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    const now = phaseRef.current.k;
    if (now !== "idle" && now !== "queued") return;
    const next = await takeQuestion().catch(() => null);
    setWaiting(await countQuestions().catch(() => 0));
    if (!next) return;
    if (next.kind === "text") await send(next.text, false);
    else
      await transcribe(next.wav).catch((err) =>
        setPhase({ k: "error", code: err instanceof AskError ? err.code : "failed" }),
      );
    // send and transcribe are recreated each render; the latest ones are used through the refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A tap held before hydration (F-P1): a chip's question goes now, as if tapped this moment. It is
  // taken on mount and sent from the next render, which reads the screen's real language (the
  // hydration render still has the server's default).
  const [early, setEarly] = useState<string | null>(null);
  useEffect(() => {
    const key = takeEarlyTap();
    if (key) queueMicrotask(() => setEarly(key));
  }, []);
  const replayed = useRef(false);
  useEffect(() => {
    if (!early || replayed.current) return;
    replayed.current = true;
    if (early === "mic") {
      queueMicrotask(() => setEarlyMic(true));
      return;
    }
    const sample = SAMPLES.find((s) => early === `sample:${s}`);
    if (sample) {
      void send(t(`ask.sample.${sample}`));
      return;
    }
    const chip = fieldChips?.find((c) => early === `field:${c.cardId}`);
    if (chip) void send(answerLang === "en" ? chip.ask.en : chip.ask.kn);
    // Once, for the held tap: send, t and the chips are this render's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [early]);

  // Wakes the answer service as the screen opens (no model call, nothing stored), so her first
  // question does not wait for a cold start or the spend total (Track B, D85).
  useEffect(() => {
    // The reply is not needed: let it go, so the request ends instead of waiting to be read.
    if (navigator.onLine)
      void fetch("/api/ask", { method: "GET" })
        .then((r) => r.body?.cancel())
        .catch(() => undefined);
  }, []);

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const preload = () => {
      void loadLoader().catch(() => undefined);
      void loadShowMe().catch(() => undefined);
      void loadOutcome().catch(() => undefined);
      void import("@/lib/audio").catch(() => undefined);
    };
    if (w.requestIdleCallback) w.requestIdleCallback(preload);
    else window.setTimeout(preload, 2500);
  }, []);

  useEffect(() => {
    void countQuestions()
      .then(setWaiting)
      .catch(() => 0);
    queueMicrotask(() => void flush());
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  if (phase.k === "queued") {
    return (
      <div className="mt-6 flex flex-col items-center text-center" role="status" aria-live="polite">
        <span
          aria-hidden
          className="grid size-16 place-items-center rounded-chip bg-flame/30 text-ink-2"
        >
          <Clock className="size-8" />
        </span>
        <p className="mt-3 text-[22px] leading-tight font-bold">
          <Bi k="pwa.queued.title" subClassName="font-sans text-base font-semibold" />
        </p>
        <p className="mt-2 max-w-sm text-lg text-ink-3">
          <Bi k="pwa.queued.body" subClassName="text-base" />
        </p>
        {waiting > 1 && (
          <p className="mt-2 text-base text-ink-3">
            <BiText text="pwa.queued.count" vars={{ n: waiting }} sub={false} />
          </p>
        )}
        <Button
          variant="paper"
          className="mt-6 w-full max-w-sm"
          onClick={() => setPhase({ k: "idle" })}
        >
          <Bi k="ask.again" sub={false} />
        </Button>
      </div>
    );
  }

  if (phase.k === "asking") {
    return (
      <div className="mt-8" aria-live="polite" data-testid="ask-stages">
        {/* What the photo shows comes first: she sees at once what was read, and can judge it. */}
        {phase.seen && (
          <PhotoSeenCard
            seen={phase.seen}
            thumbUrl={attached?.url ?? null}
            sample={Boolean(attached?.sample)}
          />
        )}
        <LampLoader
          stages={phase.withPhoto ? PHOTO_ANSWER_STAGES : ANSWER_STAGES}
          current={phase.stage}
        />
      </div>
    );
  }

  if (phase.k === "outcome")
    return (
      <OutcomePanel
        outcome={phase.outcome}
        question={phase.question}
        onAgain={() => setPhase({ k: "idle" })}
        onClarify={(reply) => send(`${phase.question}\n${reply}`)}
        onRetakePhoto={() => {
          setPending(phase.question);
          setPhase({ k: "photo" });
        }}
        onWithoutPhoto={() => void send(phase.question, false)}
      />
    );

  if (phase.k === "photo")
    return (
      <div className="flex flex-col items-center">
        <ShowMe
          onUse={attachPhoto}
          onCancel={() => {
            setPending(null);
            setPhase({ k: "idle" });
          }}
        />
      </div>
    );

  return (
    <div
      ref={flowTop}
      data-early-zone
      className="mt-6 flex scroll-mt-4 flex-col items-center lg:mt-3"
    >
      {/* Shown only by lib/ask/early-tap, while a tap waits for the page to be ready. */}
      <p
        role="status"
        className="fixed inset-x-0 bottom-6 z-40 mx-auto hidden w-fit max-w-[calc(100%-2.5rem)] items-center gap-2 rounded-chip bg-ink px-5 py-3 font-display text-[16px] font-bold text-white shadow-warm-lg [html[data-early-wait]_&]:flex"
      >
        <span aria-hidden className="size-2.5 shrink-0 animate-breathe rounded-full bg-flame" />
        <Bi k="ask.early.wait" sub={false} />
      </p>
      {attached && (phase.k !== "error" || phase.code.startsWith("photo_")) && (
        <PhotoAttached
          url={attached.url}
          onRemove={dropPhoto}
          sample={attached.sample}
          className={attached.sample && phase.k === "idle" ? "mb-3" : "mb-6"}
        />
      )}
      {attached?.sample && phase.k === "idle" && (
        // One tap asks about our sample slate, in her language (jurors on a laptop).
        <Chip
          text="ask.photo.sample.question"
          className="mb-6 rise"
          style={{ "--i": 1 } as React.CSSProperties}
          data-testid="sample-slate-question"
          onClick={() => void send(t("ask.photo.sample.question"))}
        />
      )}
      {(phase.k === "idle" || phase.k === "listening" || phase.k === "transcribing") && (
        <MicOrb
          state={
            phase.k === "listening" ? "listening" : phase.k === "transcribing" ? "thinking" : "idle"
          }
          level={level}
          onPress={startListening}
          onRelease={stopListening}
          label={t("mic.label")}
          onTypeInstead={() => setPhase({ k: "typing", text: "" })}
          alsoAction={
            attached
              ? undefined
              : {
                  icon: Camera,
                  text: "ask.photo.open",
                  onClick: () => setPhase({ k: "photo" }),
                  testId: "show-me-open",
                }
          }
        />
      )}
      {phase.k === "transcribing" && (
        <p className="mt-3 text-lg text-ink-3" aria-live="polite">
          <Bi k="ask.transcribing" sub={false} />
        </p>
      )}
      {earlyMic && phase.k === "idle" && (
        <p
          role="status"
          className="mt-3 rounded-chip bg-flame/25 px-4 py-2 text-[16px] font-semibold text-ink"
        >
          <Bi k="ask.early.ready" sub={false} />
        </p>
      )}

      {(phase.k === "confirm" || phase.k === "typing") && (
        <form
          className="w-full max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            void send(phase.text);
          }}
        >
          {phase.k === "confirm" && (
            <h2 className="text-[22px] font-bold">
              <Bi k="ask.confirm.title" subClassName="font-sans text-base font-semibold" />
            </h2>
          )}
          <textarea
            autoFocus
            rows={4}
            maxLength={1200}
            value={phase.text}
            placeholder={t("ask.placeholder")}
            aria-label={t("ask.placeholder")}
            onChange={(e) => setPhase({ ...phase, text: e.target.value })}
            className="mt-3 w-full rounded-card border border-input bg-paper px-4 py-3 text-[19px] leading-[1.65] shadow-warm-sm outline-none focus:border-clay focus:shadow-flame"
          />
          {phase.k === "confirm" && (
            <p className="mt-1 text-[15px] text-ink-3">
              <Bi k="ask.confirm.hint" sub={false} />
            </p>
          )}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button type="submit" className="w-full sm:flex-1" disabled={!phase.text.trim()}>
              <Bi k={phase.k === "confirm" ? "ask.confirm.yes" : "ask.send"} sub={false} />
            </Button>
            <Button type="button" variant="paper" onClick={() => setPhase({ k: "idle" })}>
              <RotateCcw aria-hidden />
              <Bi k="ask.confirm.again" sub={false} />
            </Button>
          </div>
        </form>
      )}

      {phase.k === "error" && (
        <div className="mt-4 flex max-w-md flex-col items-center text-center" role="alert">
          <Hanate state="caring" size={photoError ? 72 : 96} label="" />
          <p className="mt-3 text-lg font-semibold">
            <Bi
              k={ERROR_COPY[phase.code] ?? "ask.out.error"}
              subClassName="text-base font-normal"
            />
          </p>
          {phase.code === "photo_offline" && phase.question ? (
            // Law 9: her words can still wait for the network; the photo cannot.
            <div className="mt-5 flex w-full flex-col gap-3">
              <Button className="w-full" onClick={() => void send(phase.question!, false)}>
                <Bi k="ask.photo.offline_send" sub={false} />
              </Button>
              <Button variant="paper" className="w-full" onClick={() => setPhase({ k: "idle" })}>
                <Bi k="ask.photo.offline_wait" sub={false} />
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex gap-3">
              <Button variant="paper" size="md" onClick={() => setPhase({ k: "idle" })}>
                <Bi k="ask.confirm.again" sub={false} />
              </Button>
              <Button variant="ghost" size="md" onClick={() => setPhase({ k: "typing", text: "" })}>
                <Keyboard aria-hidden />
                <Bi k="ask.type" sub={false} />
              </Button>
            </div>
          )}
        </div>
      )}

      {phase.k === "idle" && !attached && (
        <>
          {waiting > 0 && (
            <p
              role="status"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-chip bg-flame/25 px-4 text-[16px] font-semibold text-ink"
            >
              <BiText text="pwa.queued.count" vars={{ n: waiting }} sub={false} />
            </p>
          )}
          {fieldChips ? (
            <FieldChips
              chips={fieldChips}
              onAsk={(chip) => void send(answerLang === "en" ? chip.ask.en : chip.ask.kn)}
            />
          ) : (
            <section className="mt-6 w-full lg:mt-2" aria-labelledby="samples-title">
              <h2
                id="samples-title"
                className="text-center font-display text-base font-bold text-ink-3"
              >
                <Bi k="ask.samples" sub={false} />
              </h2>
              {/* A tidy two-up grid on a phone (an odd last chip spans both); a centred row above. */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center [&>*]:w-full max-sm:[&>*]:justify-center max-sm:[&>*]:px-3 sm:[&>*]:w-auto [&>*:last-child:nth-child(odd)]:col-span-2">
                {SAMPLES.map((s) => (
                  <Chip
                    key={s}
                    text={`ask.sample.${s}.short`}
                    data-testid={`sample-${s}`}
                    data-early={`sample:${s}`}
                    className={HELD}
                    onClick={() => void send(t(`ask.sample.${s}`))}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * A field teacher's chips: questions a real master has answered (D83), labelled as field data
 * (Law 7). Titles can be long, so each chip is a full width row that wraps, never cut.
 * No field card yet: one honest line instead, never a Sample chip.
 */
function FieldChips({ chips, onAsk }: { chips: FieldChip[]; onAsk: (chip: FieldChip) => void }) {
  if (chips.length === 0) {
    return (
      <p
        className="mt-6 max-w-md text-center text-base leading-snug text-ink-3"
        data-testid="field-chips-none"
      >
        <Bi k="ask.field.none" subClassName="mt-1 text-[15px]" />
      </p>
    );
  }
  return (
    <section
      className="mt-6 w-full max-w-md lg:mt-2"
      aria-labelledby="field-chips-title"
      data-testid="field-chips"
    >
      <h2
        id="field-chips-title"
        className="flex flex-wrap items-center justify-center gap-2 text-center font-display text-base font-bold text-ink-3"
      >
        <Bi k="ask.field.title" sub={false} />
        <FieldBadge />
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {chips.map((chip) => (
          <Chip
            key={chip.cardId}
            text={chip.title}
            data-testid="field-chip"
            data-early={`field:${chip.cardId}`}
            className={cn(
              "h-auto min-h-12 w-full justify-start py-3 text-left leading-snug whitespace-normal",
              HELD,
            )}
            onClick={() => onAsk(chip)}
          />
        ))}
      </div>
    </section>
  );
}

/** What the photo reader saw, shown first while the answer is made: nothing is hidden from her. */
function PhotoSeenCard({
  seen,
  thumbUrl,
  sample,
}: {
  seen: PhotoSeen;
  thumbUrl: string | null;
  /** Our drawn sample slate: the reading is real, the slate is an Illustration (Law 7). */
  sample: boolean;
}) {
  const { lang } = useLang();
  const [main, sub] = lang === "kn" ? [seen.seenKn, seen.seenEn] : [seen.seenEn, seen.seenKn];
  return (
    <section
      className="relative mx-auto mb-6 flex w-full max-w-md rise gap-4 rounded-card border border-l-4 border-border border-l-flame bg-paper p-4 shadow-warm"
      aria-labelledby="photo-seen-title"
      data-testid="photo-seen"
      data-keep-clear
    >
      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          className="size-14 shrink-0 rounded-lg object-cover ring-2 ring-flame"
        />
      )}
      <div className="min-w-0 flex-1">
        <h2
          id="photo-seen-title"
          className="flex flex-wrap items-center gap-2 font-display text-[17px] font-bold text-ink-3"
        >
          <Camera className="size-4" aria-hidden />
          <Bi k={sample ? "ask.photo.seen_sample" : "ask.photo.seen"} sub={false} />
          {(seen.sample || sample) && <SampleBadge />}
          {sample && <IllustrationBadge />}
        </h2>
        <p className="mt-1.5 text-[19px] leading-snug font-semibold text-ink">
          <span lang={lang === "kn" ? "kn" : "en"}>{main}</span>
          <span
            lang={lang === "kn" ? "en" : "kn"}
            className="mt-1 block text-base font-normal text-ink-3"
          >
            {sub}
          </span>
        </p>
        {!seen.used && (
          <p className="mt-2 text-[16px] text-ink-3" data-testid="photo-not-used">
            <Bi k="ask.photo.not_used" sub={false} />
          </p>
        )}
      </div>
      {/* Hanate has looked too: a small, glad nod in the corner. */}
      <span
        aria-hidden
        className="absolute -right-1 -bottom-2 rise"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <Hanate state={seen.used ? "happy" : "idle"} size={40} label="" />
      </span>
    </section>
  );
}
