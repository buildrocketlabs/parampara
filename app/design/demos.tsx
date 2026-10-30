"use client";

import { useEffect, useState } from "react";
import { BookOpen, Calculator, Mic, RotateCcw, Users } from "lucide-react";
import { AnswerActions, AnswerCard } from "@/components/parampara/AnswerCard";
import { ShareCard } from "@/components/parampara/ShareCard";
import { Bi } from "@/components/parampara/Bi";
import { Chip, ChipGroup, type ChipOption } from "@/components/parampara/Chip";
import { ErrorState } from "@/components/parampara/ErrorState";
import { LampLoader } from "@/components/parampara/LampLoader";
import { MicOrb, type MicOrbState } from "@/components/parampara/MicOrb";
import { BottomSheet } from "@/components/parampara/BottomSheet";
import { LazyCelebration, LazyTraceDrawer } from "@/components/parampara/lazy";
import { SoundToggle } from "@/components/parampara/SoundToggle";
import { useToast } from "@/components/parampara/Toast";
import { AnimatedToastCard as ToastCard } from "@/components/parampara/ToastStack";
import { SampleBadge } from "@/components/parampara/Badges";
import { TranscriptPanel, type TranscriptSegment } from "@/components/parampara/TranscriptPanel";
import { VoicePlayer } from "@/components/parampara/VoicePlayer";
import { SAMPLE_CUES, samplePeaks, useSampleAudio } from "./sample-audio";
import {
  SAMPLE_MASTER,
  SAMPLE_MATERIALS,
  SAMPLE_STEPS,
  SAMPLE_TITLE,
  SAMPLE_TRACE,
  SAMPLE_WHY,
} from "./sample-data";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n/provider";
import { fill } from "@/lib/i18n/fill";
import { DONE, IMPORT_STAGES } from "@/lib/stages";

// Live demos for the gallery. Each runs on timers only after the viewer presses Replay, or once on
// mount; under reduced motion components show their still pose anyway.

const CHUNKS = 24;
const PLAN: ReadonlyArray<[string, number]> = [
  ["reading", 6],
  ["uploading", 6],
  ["transcribing", CHUNKS],
  ["redacting", 6],
  ["extracting", 12],
];
const TOTAL_TICKS = PLAN.reduce((sum, [, len]) => sum + len, 0);

/** An import job walking through every stage, with a real looking chunk counter while transcribing. */
export function ImportLoaderDemo() {
  const { t } = useLang();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (tick > TOTAL_TICKS) return;
    const id = window.setTimeout(() => setTick(tick + 1), 260);
    return () => window.clearTimeout(id);
  }, [tick]);

  let left = tick;
  let current = DONE;
  let progress: number | undefined;
  let detail: string | undefined;
  for (const [key, len] of PLAN) {
    if (left < len) {
      current = key;
      if (key === "transcribing") {
        progress = (left + 1) / len;
        detail = fill(t("loader.part"), { n: left + 1, total: len });
      } else if (key === "uploading") {
        progress = (left + 1) / len;
      }
      break;
    }
    left -= len;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <LampLoader stages={IMPORT_STAGES} current={current} progress={progress} detail={detail} />
      <ReplayButton onClick={() => setTick(0)} />
    </div>
  );
}

export function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-12 items-center gap-2 rounded-chip border border-border bg-paper px-5 font-display text-base font-semibold text-ink-3 shadow-warm-sm hover:text-ink"
    >
      <RotateCcw className="size-4" aria-hidden />
      <Bi k="design.replay" sub={false} />
    </button>
  );
}

export function ErrorDemo({ kind }: { kind: "voice" | "network" | "import" }) {
  const { toast } = useToast();
  const retry = () => toast({ text: "loader.slow", tone: "caring", durationMs: 2500 });
  if (kind === "voice") {
    return (
      <ErrorState
        title="error.voice.title"
        body="error.voice.body"
        onRetry={retry}
        fallback={{ label: "state.typeInstead", onClick: retry }}
      />
    );
  }
  if (kind === "import") {
    return (
      <ErrorState
        title="error.import.title"
        body="error.import.body"
        onRetry={retry}
        reference="job 7f3a · chunk 12"
      />
    );
  }
  return <ErrorState title="error.network.title" body="error.network.body" onRetry={retry} />;
}

const PROBLEMS: ChipOption[] = [
  { value: "letters", text: "chip.letters", icon: BookOpen },
  { value: "numbers", text: "chip.numbers", icon: Calculator },
  { value: "multigrade", text: "chip.multigrade", icon: Users },
  { value: "silent", text: "chip.silent", icon: Mic },
];
const GRADES: ChipOption[] = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  text: "chip.grade",
  vars: { n },
}));

export function ChoiceChipsDemo() {
  const { t } = useLang();
  const [problem, setProblem] = useState<string | null>("numbers");
  return (
    <ChipGroup
      label={t("chip.problem.label")}
      options={PROBLEMS}
      value={problem}
      onChange={setProblem}
    />
  );
}

export function MultiChipsDemo() {
  const { t } = useLang();
  const [grades, setGrades] = useState<string[]>(["1", "2"]);
  return (
    <ChipGroup
      multiple
      label={t("chip.grade.label")}
      options={GRADES}
      value={grades}
      onChange={setGrades}
    />
  );
}

export function ActionChipsDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2.5">
      {PROBLEMS.slice(0, 3).map((o) => (
        <Chip key={o.value} text={o.text} icon={o.icon} onClick={() => toast({ text: o.text })} />
      ))}
      <Chip text="chip.silent" disabled />
    </div>
  );
}

const DEMO_TOASTS = [
  { text: "toast.saved", tone: "success" },
  { text: "toast.queued", action: { label: "toast.undo", onClick: () => undefined } },
  { text: "toast.thanks", tone: "caring" },
] as const;

export function ToastDemo() {
  const { toast } = useToast();
  const [n, setN] = useState(0);
  return (
    <Button
      variant="paper"
      size="md"
      className="self-start"
      onClick={() => {
        const item = DEMO_TOASTS[n % DEMO_TOASTS.length];
        if (item) toast({ ...item });
        setN(n + 1);
      }}
    >
      <Bi k="design.toast.show" sub={false} />
    </Button>
  );
}

/** Toasts drawn in place (not floating), so the gallery and screenshots can show every tone. */
export function ToastSpecimens() {
  return (
    <ol className="flex flex-col gap-2">
      <ToastCard
        item={{ text: "toast.saved", tone: "success", durationMs: 0 }}
        onDismiss={() => undefined}
      />
      <ToastCard
        item={{
          text: "toast.queued",
          durationMs: 0,
          action: { label: "toast.undo", onClick: () => undefined },
        }}
        onDismiss={() => undefined}
      />
      <ToastCard
        item={{ text: "toast.thanks", tone: "caring", durationMs: 0 }}
        onDismiss={() => undefined}
      />
    </ol>
  );
}

const ANSWER_PEAKS = samplePeaks(9);
const CLIP_PEAKS = samplePeaks(16, 4_000, 10_500);

function AnswerVoice() {
  const src = useSampleAudio(9);
  return <VoicePlayer src={src} peaks={ANSWER_PEAKS} cues={SAMPLE_CUES} title="voice.answer" />;
}

/** The answer's voice: karaoke cues and English subtitles. */
export function AnswerVoiceDemo() {
  return (
    <div className="flex flex-col gap-3">
      <SampleBadge className="self-start" />
      <AnswerVoice />
    </div>
  );
}

/** "Hear it from the master": only 4.0 s to 10.5 s of a longer recording. */
export function ClipVoiceDemo() {
  const { withName } = useLang();
  const src = useSampleAudio(16);
  return (
    <VoicePlayer
      src={src}
      startMs={4_000}
      endMs={10_500}
      peaks={CLIP_PEAKS}
      eyebrow="voice.clip"
      title={withName("answer.hearNamed", SAMPLE_MASTER.name)}
    />
  );
}

/** No peaks: the calm bar. */
export function PlainVoiceDemo() {
  const src = useSampleAudio(6);
  return <VoicePlayer src={src} title="voice.answer" />;
}

// Sample interview (made up for the gallery, labelled Sample). Timings fit the 16 s sample audio.
const SEGMENTS: TranscriptSegment[] = [
  {
    id: 1,
    startMs: 0,
    endMs: 2_000,
    speaker: "interviewer",
    redacted: false,
    kn: "ಮಕ್ಕಳು ಹತ್ತರ ನಂತರ ಎಣಿಕೆಯಲ್ಲಿ ತಪ್ಪುತ್ತಿದ್ದಾಗ ನೀವು ಏನು ಮಾಡಿದಿರಿ?",
    en: "When children got lost counting past ten, what did you do?",
  },
  {
    id: 2,
    startMs: 2_000,
    endMs: 5_200,
    speaker: "master",
    redacted: false,
    kn: "ನಾನು ಹುಣಸೆ ಕಡ್ಡಿಗಳನ್ನು ತಂದೆ. ಹತ್ತು ಕಡ್ಡಿಗಳಿಗೆ ರಬ್ಬರ್ ಬ್ಯಾಂಡ್ ಹಾಕಿ ಒಂದು ಕಟ್ಟು ಮಾಡಿದೆವು.",
    en: "I brought tamarind sticks. We tied ten sticks with a rubber band into one bundle.",
  },
  {
    id: 3,
    startMs: 5_200,
    endMs: 8_600,
    speaker: "master",
    redacted: true,
    kn: "ಒಂದು ಮಗು ಕಟ್ಟು ಹಿಡಿದು ಒಂದು ಹತ್ತು ಎಂದು ಜೋರಾಗಿ ಹೇಳುತ್ತಿತ್ತು.",
    en: "A child would hold the bundle up and say one ten aloud.",
  },
  {
    id: 4,
    startMs: 8_600,
    endMs: 10_000,
    speaker: "interviewer",
    redacted: false,
    kn: "ಅದು ಫಲ ಕೊಡದಿದ್ದರೆ?",
    en: "And if that did not work?",
  },
  {
    id: 5,
    startMs: 10_000,
    endMs: 14_500,
    speaker: "master",
    redacted: false,
    kn: "ಆಗ ಕಟ್ಟುಗಳನ್ನು ನೆಲದ ಮೇಲೆ ಸಾಲಾಗಿ ಇಟ್ಟು, ಎಲ್ಲರೂ ಒಟ್ಟಿಗೆ ಎಣಿಸುತ್ತಿದ್ದೆವು.",
    en: "Then we laid the bundles in a row on the floor and all counted together.",
  },
];

/** Reviewer composition: pressing a cited moment plays exactly those seconds. */
export function TranscriptDemo() {
  const { withName } = useLang();
  const src = useSampleAudio(16);
  const [active, setActive] = useState<number>(2);
  const seg = SEGMENTS.find((x) => x.id === active) ?? SEGMENTS[1];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-3">
        <SampleBadge className="self-start" />
        <VoicePlayer
          key={active}
          src={src}
          startMs={seg?.startMs}
          endMs={seg?.endMs}
          eyebrow="voice.clip"
          title={withName("answer.hearNamed", SAMPLE_MASTER.name)}
        />
      </div>
      <TranscriptPanel
        segments={SEGMENTS}
        highlight={[2, 3, 5]}
        activeId={active}
        onPlay={setActive}
        className="max-h-[440px] rounded-card border border-border bg-paper p-4"
      />
    </div>
  );
}

/** MicOrb with a pretend recorder: the level follows a speech like wobble while listening. */
export function MicDemo() {
  const { t } = useLang();
  const { toast } = useToast();
  const [state, setState] = useState<MicOrbState>("idle");
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (state !== "listening") return;
    let raf = 0;
    const tick = (now: number) => {
      const s = now / 1000;
      setLevel(Math.max(0, Math.abs(Math.sin(s * 5.3)) * 0.7 + Math.sin(s * 13.1) * 0.2 + 0.1));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  useEffect(() => {
    if (state !== "thinking") return;
    const id = window.setTimeout(() => setState("idle"), 1800);
    return () => window.clearTimeout(id);
  }, [state]);

  return (
    <MicOrb
      state={state}
      level={level}
      label={t("mic.label")}
      onPress={() => setState("listening")}
      onRelease={() => setState("thinking")}
      onTypeInstead={() => toast({ text: "state.typeInstead" })}
    />
  );
}

/** A still MicOrb in a given state, for the gallery's state row. */
export function MicStill({ state, level = 0 }: { state: MicOrbState; level?: number }) {
  const { t } = useLang();
  return (
    <MicOrb
      state={state}
      level={level}
      label={t("mic.label")}
      onPress={() => undefined}
      onRelease={() => undefined}
      onTypeInstead={state === "idle" || state === "disabled" ? () => undefined : undefined}
    />
  );
}

/** The full answer page: unfolds, steps arrive one by one, footer actions, trace link. */
export function AnswerDemo() {
  const { toast } = useToast();
  const [run, setRun] = useState(0);
  const [saved, setSaved] = useState(false);
  const [trace, setTrace] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <LazyTraceDrawer open={trace} onOpenChange={setTrace} trace={SAMPLE_TRACE} isSample />
      <AnswerCard
        key={run}
        title={SAMPLE_TITLE}
        steps={SAMPLE_STEPS}
        materials={SAMPLE_MATERIALS}
        why={SAMPLE_WHY}
        master={SAMPLE_MASTER}
        isSample
        player={<AnswerVoice />}
        onShowTrace={() => setTrace(true)}
        actions={
          <>
            <AnswerActions
              masterName={SAMPLE_MASTER.name}
              onTryTomorrow={() => toast({ text: "celebrate.sub", tone: "success" })}
              onHearMaster={() => toast({ text: "voice.clip" })}
              onSave={() => {
                if (!saved) toast({ text: "toast.saved", tone: "success" });
                setSaved(!saved);
              }}
              saved={saved}
              onFollowUp={() => toast({ text: "answer.followUp" })}
            />
            <ShareCard cardId="sample-card-02" className="mt-3" />
          </>
        }
      />
      <div className="flex justify-center">
        <ReplayButton onClick={() => setRun(run + 1)} />
      </div>
    </div>
  );
}

/** An answer served from the cache, credited to a master who chose to stay anonymous. */
export function AnswerReplayedDemo() {
  return (
    <AnswerCard
      title={SAMPLE_TITLE}
      steps={SAMPLE_STEPS.slice(0, 2).map((s) => ({ ...s, masterName: null }))}
      materials={SAMPLE_MATERIALS.slice(0, 2)}
      why={null}
      master={{ name: null, years: 28 }}
      replayed
      answeredAt="22 Oct, 9:14 pm"
      isSample
      player={<VoicePlayer src={null} status="offline" title="voice.answer" />}
    />
  );
}

/**
 * A child who comes hungry (D72): the steps of the sample "smile at the door" card, then one calm
 * line about the headmaster and the mid day meal. Never a helpline.
 */
export function AnswerHungerDemo() {
  const geeta = { kn: "ಗೀತಾ", en: "Geeta" };
  return (
    <AnswerCard
      title={{ kn: "ಮಾತಾಡದ ಮಗುವಿಗೆ ಬಾಗಿಲಲ್ಲಿ ನಗು", en: "A smile at the door for a silent child" }}
      steps={[
        {
          kn: "ಬೆಳಿಗ್ಗೆ ಬಾಗಿಲಲ್ಲಿ ನಿಂತು ನಗುತ್ತಾ 'ಬಾ, ಇಲ್ಲಿ ಕೂತ್ಕೋ' ಅಂತ ಕರೆಯಿರಿ.",
          en: "Stand at the door in the morning and greet the child with a smile: 'Come, sit here.'",
          cardId: "sample-card-07",
          masterName: geeta,
        },
        {
          kn: "ಆ ಮಗುವಿಗೆ ಒಂದು ಸಣ್ಣ ಕೆಲಸ ಕೊಡಿ: ಹಾಜರಿ ಹೇಳುವಾಗ ಬಳಪ ಹಂಚೋದು.",
          en: "Give the child one small job, like handing out chalk during attendance.",
          cardId: "sample-card-07",
          masterName: geeta,
        },
      ]}
      materials={[{ kn: "ಬಳಪ", en: "chalk" }]}
      why={null}
      master={{ name: geeta }}
      isSample
      note={<Bi k="ask.note.hunger" className="text-[16px]" subClassName="text-[14px]" />}
    />
  );
}

/** Opens the TraceDrawer: the sample trace, or one of the states without a trace. */
const TRACE_LABEL = {
  ready: "design.trace.ready",
  loading: "design.trace.loading",
  error: "design.trace.error",
  offline: "design.trace.offline",
} as const;

export function TraceDemo({ variant = "ready" }: { variant?: keyof typeof TRACE_LABEL }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="paper"
        size="md"
        className="self-start"
        onClick={() => setOpen(true)}
        data-open-trace={variant}
      >
        <Bi k={TRACE_LABEL[variant]} sub={false} />
      </Button>
      <LazyTraceDrawer
        open={open}
        onOpenChange={setOpen}
        trace={variant === "ready" ? SAMPLE_TRACE : null}
        status={variant === "ready" ? undefined : variant}
        onRetry={() => setOpen(false)}
        isSample
      />
    </>
  );
}

/** A plain BottomSheet with a choice inside, the way the "Did you mean" confirm will use it. */
export function SheetDemo() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="paper"
        size="md"
        className="self-start"
        onClick={() => setOpen(true)}
        data-open-sheet
      >
        <Bi k="design.open" sub={false} />
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="chip.problem.label"
        description="design.s.sheet"
        side="bottom"
        footer={
          <Button className="w-full" onClick={() => setOpen(false)}>
            <Bi k="celebrate.continue" sub={false} />
          </Button>
        }
      >
        <ChipGroup
          label={t("chip.problem.label")}
          options={PROBLEMS}
          value={problem}
          onChange={setProblem}
        />
      </BottomSheet>
    </>
  );
}

/** Celebration, replayable. The bell rings only after a tap and only if sounds are on. */
export function CelebrationDemo({ lamps = 6 }: { lamps?: number }) {
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <LazyCelebration key={run} lamps={lamps} sound={run > 0} onDone={() => setDone(true)} />
      <div className="flex flex-wrap items-center gap-2">
        <ReplayButton
          onClick={() => {
            setDone(false);
            setRun(run + 1);
          }}
        />
        <SoundToggle />
        {done && <span className="sr-only" data-celebration-done />}
      </div>
    </div>
  );
}
