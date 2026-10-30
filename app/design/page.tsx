// The design system gallery. Who: engineers composing M2 to M4 screens, the design critic, and jurors
// who want to see the craft. One job: every signature component in every state, kn and en, at phone
// and desktop widths. Feeling: a well kept workshop, warm and exact.
import type { Metadata } from "next";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { LampLoader } from "@/components/parampara/LampLoader";
import { LanguageToggle } from "@/components/parampara/LanguageToggle";
import { StageList } from "@/components/parampara/StageList";
import { Wordmark } from "@/components/parampara/Wordmark";
import { ANSWER_STAGES, DONE, IMPORT_STAGES } from "@/lib/stages";
import { BookmarkPlus, Inbox } from "lucide-react";
import { FieldBadge, IllustrationBadge, SampleBadge } from "@/components/parampara/Badges";
import { ChipTag } from "@/components/parampara/Chip";
import { EmptyState } from "@/components/parampara/EmptyState";
import { ErrorState } from "@/components/parampara/ErrorState";
import { MasterMedallion } from "@/components/parampara/MasterMedallion";
import { ProgressDots } from "@/components/parampara/ProgressDots";
import { Timeline } from "@/components/parampara/TraceDrawer";
import { TriedPrompt } from "@/components/teacher/TriedPrompt";
import { FIXTURE_ANSWER_ID } from "@/lib/tried/fixture";
import { VoicePlayer } from "@/components/parampara/VoicePlayer";
import {
  FIELD_CHANGE_SPECIMEN,
  FIELD_SPECIMEN,
  FIELD_SPECIMEN_FEW,
  SAMPLE_PHOTO_STEPS,
  SAMPLE_TRACE,
} from "./sample-data";
import { FieldTestCard } from "@/components/how/FieldTest";
import { SkeletonCard, SkeletonLine, SkeletonMedallion } from "@/components/parampara/Skeleton";
import {
  ActionChipsDemo,
  AnswerDemo,
  AnswerHungerDemo,
  AnswerReplayedDemo,
  AnswerVoiceDemo,
  ChoiceChipsDemo,
  ClipVoiceDemo,
  ErrorDemo,
  CelebrationDemo,
  ImportLoaderDemo,
  SheetDemo,
  TraceDemo,
  MicDemo,
  MicStill,
  MultiChipsDemo,
  PlainVoiceDemo,
  ToastDemo,
  ToastSpecimens,
  TranscriptDemo,
} from "./demos";
import { EntrySection } from "./entry";
import { Section, Specimen } from "./parts";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const NAV = [
  { id: "loader", name: "LampLoader" },
  { id: "stages", name: "StageList" },
  { id: "answer", name: "AnswerCard" },
  { id: "trace", name: "TraceDrawer" },
  { id: "sheet", name: "BottomSheet" },
  { id: "mic", name: "MicOrb" },
  { id: "tried", name: "TriedPrompt" },
  { id: "celebration", name: "Celebration" },
  { id: "voice", name: "VoicePlayer" },
  { id: "medallion", name: "MasterMedallion" },
  { id: "transcript", name: "TranscriptPanel" },
  { id: "states", name: "Empty and error" },
  { id: "badges", name: "Badges" },
  { id: "chips", name: "Chips" },
  { id: "toast", name: "Toast" },
  { id: "skeleton", name: "Skeleton" },
  { id: "dots", name: "ProgressDots" },
  { id: "entry", name: "Entry" },
] as const;

export default function DesignPage() {
  return (
    <div className="paper-grain min-h-dvh bg-cream">
      <header className="sticky top-0 z-30 border-b border-border bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Wordmark />
          <LanguageToggle />
        </div>
        <nav
          aria-label="Components"
          className="mx-auto max-w-7xl overflow-x-auto px-5 pb-3 sm:px-8"
        >
          <ul className="flex w-max gap-2">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className="inline-flex h-10 items-center rounded-chip border border-border bg-paper px-4 font-display text-[15px] font-semibold text-ink-3 hover:text-ink"
                >
                  {n.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="pt-10 pb-4 sm:pt-14">
          <h1 className="text-[34px] leading-tight font-extrabold text-clay sm:text-[46px]">
            <Bi k="design.title" subClassName="font-sans text-lg font-semibold" />
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-3">
            <Bi k="design.sub" subClassName="text-base" />
          </p>
          <p className="mt-2 max-w-2xl text-base text-ink-3">
            <Bi k="design.reduced" sub={false} />
          </p>
        </div>

        <Section id="loader" name="LampLoader" file="LampLoader.tsx" desc="design.s.loader">
          <Specimen label="live · import job, replay" surface="dusk" className="md:row-span-2">
            <ImportLoaderDemo />
          </Specimen>
          <Specimen label="answer · finding (progress unknown)" surface="dusk">
            <LampLoader stages={ANSWER_STAGES} current="finding" showStages={false} />
          </Specimen>
          <Specimen label="import · transcribing 38 of 96" surface="dusk">
            <LampLoader
              stages={IMPORT_STAGES}
              current="transcribing"
              progress={38 / 96}
              detail={<BiText text="loader.part" vars={{ n: 38, total: 96 }} sub={false} inline />}
              showStages={false}
            />
          </Specimen>
          <Specimen label="tone caring · slow path" surface="dusk">
            <LampLoader
              stages={ANSWER_STAGES}
              current="checking"
              tone="caring"
              showStages={false}
            />
          </Specimen>
          <Specimen label="paused · offline or queued" surface="dusk">
            <LampLoader
              stages={IMPORT_STAGES}
              current="transcribing"
              progress={0.4}
              paused
              showStages={false}
            />
          </Specimen>
          <Specimen label="complete" surface="dusk">
            <LampLoader stages={ANSWER_STAGES} current={DONE} showStages={false} />
          </Specimen>
        </Section>

        <Section id="stages" name="StageList" file="StageList.tsx" desc="design.s.stages">
          <Specimen label="md · answer, checking">
            <StageList stages={ANSWER_STAGES} current="checking" />
          </Specimen>
          <Specimen label="md · import, transcribing with detail and progress">
            <StageList
              stages={IMPORT_STAGES}
              current="transcribing"
              detail={<BiText text="loader.part" vars={{ n: 12, total: 96 }} sub={false} inline />}
              progress={12 / 96}
            />
          </Specimen>
          <Specimen label="sm · for the trace, complete">
            <StageList stages={ANSWER_STAGES} current={DONE} size="sm" />
          </Specimen>
        </Section>

        <Section
          id="answer"
          name="AnswerCard · AnswerActions"
          file="AnswerCard.tsx"
          desc="design.s.answer"
          className="md:grid-cols-2 xl:grid-cols-2"
        >
          <Specimen label="unfolds · steps one by one · Sample" surface="dusk">
            <AnswerDemo />
          </Specimen>
          <Specimen label="replayed · anonymous master · offline voice" surface="dusk">
            <AnswerReplayedDemo />
          </Specimen>
          <Specimen label="a child who comes hungry · the gentle note, no helpline" surface="dusk">
            <AnswerHungerDemo />
          </Specimen>
        </Section>

        <Section
          id="trace"
          name="TraceDrawer · Timeline"
          file="TraceDrawer.tsx"
          desc="design.s.trace"
        >
          <Specimen
            label="timeline in place (Sample trace)"
            surface="paper"
            className="notebook md:col-span-2 xl:col-span-2"
          >
            <TimelineInPlace />
          </Specimen>
          <Specimen label="with a photo · Show me · Sample" surface="paper" className="notebook">
            <div className="flex flex-col gap-4 pl-1">
              <SampleBadge className="self-start" />
              <Timeline steps={SAMPLE_PHOTO_STEPS} />
            </div>
          </Specimen>
          <Specimen label="open · ready, loading, error, offline">
            <div className="flex flex-col gap-3">
              <TraceDemo />
              <TraceDemo variant="loading" />
              <TraceDemo variant="error" />
              <TraceDemo variant="offline" />
            </div>
          </Specimen>
        </Section>

        <Section id="sheet" name="BottomSheet" file="BottomSheet.tsx" desc="design.s.sheet">
          <Specimen label="drag the handle down, Escape, or the close button">
            <SheetDemo />
          </Specimen>
        </Section>

        <Section
          id="mic"
          name="MicOrb"
          file="MicOrb.tsx"
          desc="design.s.mic"
          className="md:grid-cols-2 xl:grid-cols-5"
        >
          <Specimen
            label="live · hold, or tap and tap"
            surface="dusk"
            className="md:col-span-2 xl:col-span-1"
          >
            <MicDemo />
          </Specimen>
          <Specimen label="idle · breathing" surface="dusk">
            <MicStill state="idle" />
          </Specimen>
          <Specimen label="listening · level 0.7" surface="dusk">
            <MicStill state="listening" level={0.7} />
          </Specimen>
          <Specimen label="thinking" surface="dusk">
            <MicStill state="thinking" />
          </Specimen>
          <Specimen label="disabled · no permission" surface="dusk">
            <MicStill state="disabled" />
          </Specimen>
        </Section>

        <Section
          id="tried"
          name="TriedPrompt"
          file="../teacher/TriedPrompt.tsx"
          desc="design.s.tried"
          className="md:grid-cols-2 xl:grid-cols-2"
        >
          <Specimen label="teacher home · untried Sample answer (enter as a teacher to see it)">
            <TriedPrompt answerId={FIXTURE_ANSWER_ID} />
          </Specimen>
        </Section>

        <Section
          id="celebration"
          name="Celebration · SoundToggle"
          file="Celebration.tsx"
          desc="design.s.celebration"
          className="md:grid-cols-2 xl:grid-cols-2"
        >
          <Specimen label="worked · lamps light, petals fall, onDone">
            <CelebrationDemo />
          </Specimen>
          <Specimen label="a class of 12">
            <CelebrationDemo lamps={12} />
          </Specimen>
        </Section>

        <Section
          id="voice"
          name="VoicePlayer · SegmentPlayer"
          file="VoicePlayer.tsx"
          desc="design.s.voice"
        >
          <Specimen
            label="ready · cues, karaoke, subtitles (Sample audio)"
            className="md:col-span-2 xl:col-span-1"
          >
            <AnswerVoiceDemo />
          </Specimen>
          <Specimen label="clip · 0:04 to 0:10 of a longer file">
            <ClipVoiceDemo />
          </Specimen>
          <Specimen label="no peaks · calm bar">
            <PlainVoiceDemo />
          </Specimen>
          <Specimen label="loading · voice still being made">
            <VoicePlayer src={null} title="voice.answer" />
          </Specimen>
          <Specimen label="error · kind words + retry">
            <VoicePlayer src={null} status="error" title="voice.answer" />
          </Specimen>
          <Specimen label="offline">
            <VoicePlayer src={null} status="offline" title="voice.answer" />
          </Specimen>
          <Specimen label="unavailable · 403, 404, 409 from the segment route">
            <VoicePlayer
              src={null}
              status="unavailable"
              eyebrow="voice.clip"
              title="answer.hearMaster"
            />
          </Specimen>
        </Section>

        <Section
          id="medallion"
          name="MasterMedallion"
          file="MasterMedallion.tsx"
          desc="design.s.medallion"
        >
          <Specimen label="lg · named, Sample">
            <MasterMedallion
              name={{ kn: "ಶಾಂತಮ್ಮ ಕೆ.", en: "Shantamma K." }}
              years={34}
              district={{ kn: "ಕೊಪ್ಪಳ", en: "Koppal" }}
              portraitSrc="/illustrations/sample-master-a.svg"
              size="lg"
              isSample
            />
          </Specimen>
          <Specimen label="md · illustrated · initial · anonymous">
            <div className="flex flex-col gap-5">
              <MasterMedallion
                name={{ kn: "ಶಾಂತಮ್ಮ ಕೆ.", en: "Shantamma K." }}
                years={34}
                district={{ kn: "ಕೊಪ್ಪಳ", en: "Koppal" }}
                portraitSrc="/illustrations/sample-master-a.svg"
                size="md"
                isSample
              />
              <MasterMedallion
                name={{ kn: "ಬಸವರಾಜ ಹ.", en: "Basavaraj H." }}
                years={41}
                district={{ kn: "ಕೊಪ್ಪಳ", en: "Koppal" }}
                portraitSrc="/illustrations/sample-master-b.svg"
                size="md"
                isSample
              />
              <MasterMedallion
                name={{ kn: "ಶಾಂತಮ್ಮ ಕೆ.", en: "Shantamma K." }}
                years={34}
                district={{ kn: "ಕೊಪ್ಪಳ", en: "Koppal" }}
                size="md"
                isSample
              />
              <MasterMedallion name={null} years={28} size="md" />
            </div>
          </Specimen>
          <Specimen label="sm · in a source chip row · portrait only">
            <div className="flex flex-col gap-4">
              <MasterMedallion
                name={{ kn: "ಶಾಂತಮ್ಮ ಕೆ.", en: "Shantamma K." }}
                portraitSrc="/illustrations/sample-master-a.svg"
                size="sm"
                isSample
              />
              <MasterMedallion name={null} size="sm" />
              <div className="flex gap-3">
                <MasterMedallion
                  name={{ kn: "ಶಾಂತಮ್ಮ ಕೆ.", en: "Shantamma K." }}
                  portraitSrc="/illustrations/sample-master-a.svg"
                  size="md"
                  portraitOnly
                />
                <MasterMedallion
                  name={{ kn: "ಬಸವರಾಜ ಹ.", en: "Basavaraj H." }}
                  portraitSrc="/illustrations/sample-master-b.svg"
                  size="md"
                  portraitOnly
                />
                <MasterMedallion name="ಶ್ರೀನಿವಾಸ" size="md" portraitOnly />
                <MasterMedallion name={null} size="md" portraitOnly />
              </div>
            </div>
          </Specimen>
        </Section>

        <Section
          id="transcript"
          name="TranscriptPanel"
          file="TranscriptPanel.tsx"
          desc="design.s.transcript"
          className="md:grid-cols-1 xl:grid-cols-1"
        >
          <Specimen label="evidence lit in flame · press a moment to hear it · redacted mark">
            <TranscriptDemo />
          </Specimen>
        </Section>

        <Section
          id="states"
          name="EmptyState · ErrorState"
          file="EmptyState.tsx, ErrorState.tsx"
          desc="design.s.states"
        >
          <Specimen label="empty · saved answers">
            <EmptyState
              title="empty.saved.title"
              body="empty.saved.body"
              action={{ label: "empty.saved.action", href: "/design#mic", icon: BookmarkPlus }}
            />
          </Specimen>
          <Specimen label="empty · reviewer queue">
            <EmptyState
              title="empty.review.title"
              body="empty.review.body"
              hanate="happy"
              action={{ label: "empty.review.action", href: "/design#loader", icon: Inbox }}
            />
          </Specimen>
          <Specimen label="empty · offline (resting)">
            <EmptyState title="empty.saved.title" body="voice.offline" hanate="resting" />
          </Specimen>
          <Specimen label="error · voice, retry + text fallback">
            <ErrorDemo kind="voice" />
          </Specimen>
          <Specimen label="error · network, retry">
            <ErrorDemo kind="network" />
          </Specimen>
          <Specimen label="error · import, with reference">
            <ErrorDemo kind="import" />
          </Specimen>
          <Specimen
            label="error · default copy, retry reloads (page size)"
            className="md:col-span-2 xl:col-span-3"
            surface="dusk"
          >
            <ErrorState size="page" />
          </Specimen>
        </Section>

        <Section
          id="badges"
          name="SampleBadge · FieldBadge · IllustrationBadge"
          file="Badges.tsx"
          desc="design.s.badges"
        >
          <Specimen label="on paper">
            <div className="flex flex-wrap gap-2">
              <SampleBadge />
              <FieldBadge />
              <IllustrationBadge />
            </div>
          </Specimen>
          <Specimen label="on ink" surface="ink">
            <div className="flex flex-wrap gap-2">
              <SampleBadge onDark />
              <FieldBadge onDark />
              <IllustrationBadge onDark />
            </div>
          </Specimen>
          <Specimen label="in context · a number with its source">
            <p className="font-display text-[40px] leading-none font-extrabold text-ink">9 / 12</p>
            <p className="mt-2 text-base text-ink-3">
              <Bi k="how.4.title" sub={false} />
            </p>
            <div className="mt-3 flex gap-2">
              <SampleBadge />
            </div>
          </Specimen>
        </Section>

        <Section id="chips" name="Chip · ChipGroup · ChipTag" file="Chip.tsx" desc="design.s.chips">
          <Specimen label="single choice · radiogroup, arrow keys">
            <p className="mb-3 font-display text-[18px] font-bold text-ink">
              <Bi k="chip.problem.label" subClassName="font-sans text-[14px] font-medium" />
            </p>
            <ChoiceChipsDemo />
          </Specimen>
          <Specimen label="multiple choice · toggles">
            <p className="mb-3 font-display text-[18px] font-bold text-ink">
              <Bi k="chip.grade.label" subClassName="font-sans text-[14px] font-medium" />
            </p>
            <MultiChipsDemo />
          </Specimen>
          <Specimen label="action chips + disabled · tags">
            <ActionChipsDemo />
            <div className="mt-5 flex flex-wrap gap-2">
              <ChipTag text={{ kn: "ಹತ್ತು ಕಡ್ಡಿಗಳು", en: "10 sticks" }} />
              <ChipTag text={{ kn: "ಒಂದು ರಬ್ಬರ್ ಬ್ಯಾಂಡ್", en: "a rubber band" }} />
              <ChipTag text={{ kn: "ಸ್ಲೇಟು", en: "a slate" }} />
            </div>
          </Specimen>
        </Section>

        <Section id="toast" name="Toast" file="Toast.tsx" desc="design.s.toast">
          <Specimen label="success · with action · caring">
            <ToastSpecimens />
          </Specimen>
          <Specimen label="live · bottom of the screen, polite">
            <ToastDemo />
          </Specimen>
        </Section>

        <Section id="skeleton" name="Skeleton" file="Skeleton.tsx" desc="design.s.skeleton">
          <Specimen label="card (answer shape)">
            <SkeletonCard />
          </Specimen>
          <Specimen label="lines · medallions">
            <div className="flex items-center gap-4">
              <SkeletonMedallion size="sm" />
              <SkeletonMedallion size="md" />
              <SkeletonMedallion size="lg" />
            </div>
            <div className="mt-6 space-y-3">
              <SkeletonLine />
              <SkeletonLine width="82%" />
              <SkeletonLine width="64%" />
            </div>
          </Specimen>
        </Section>

        <Section id="dots" name="ProgressDots" file="ProgressDots.tsx" desc="design.s.dots">
          <Specimen label="step 1 of 5 · step 3 of 5 · last">
            <div className="flex flex-col gap-6">
              <ProgressDots count={5} current={0} />
              <ProgressDots count={5} current={2} />
              <ProgressDots count={5} current={4} />
            </div>
          </Specimen>
          <Specimen label="on ink" surface="ink">
            <ProgressDots count={4} current={1} onDark />
          </Specimen>
        </Section>

        <Section
          id="field"
          name="FieldTestCard (/how)"
          file="components/how/FieldTest.tsx"
          desc="design.s.field"
        >
          <Specimen
            label="numbers · Sample numbers and placeholder words, to show the layout"
            className="md:col-span-2 xl:col-span-3"
          >
            <FieldTestCard
              badge={<SampleBadge />}
              body={{ kind: "numbers", summary: FIELD_SPECIMEN }}
              changes={[FIELD_CHANGE_SPECIMEN]}
            />
          </Specimen>
          <Specimen
            label="early days · fewer than 5 teachers, kept private"
            className="md:col-span-2 xl:col-span-3"
          >
            <FieldTestCard
              badge={<SampleBadge />}
              body={{ kind: "numbers", summary: FIELD_SPECIMEN_FEW }}
              changes={[]}
            />
          </Specimen>
          <Specimen label="empty · nothing on record yet" className="md:col-span-2 xl:col-span-3">
            <FieldTestCard badge={<FieldBadge />} body={{ kind: "empty" }} changes={[]} />
          </Specimen>
          <Specimen label="error · a read failed, retry reloads">
            <FieldTestCard badge={<FieldBadge />} body={{ kind: "error" }} changes={[]} />
          </Specimen>
          <Specimen label="loading · while the database answers">
            <SkeletonCard lines={5} />
          </Specimen>
        </Section>
        <EntrySection />
      </main>
    </div>
  );
}

function TimelineInPlace() {
  return (
    <div className="flex flex-col gap-4 pl-1">
      <SampleBadge className="self-start" />
      <Timeline steps={SAMPLE_TRACE.steps} />
    </div>
  );
}
