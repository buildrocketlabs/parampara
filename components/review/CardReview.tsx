"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, Pause, Pencil, Play, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { FieldBadge } from "@/components/parampara/Badges";
import { MasterMedallion } from "@/components/parampara/MasterMedallion";
import { ShareCard } from "@/components/parampara/ShareCard";
import { SegmentPlayer } from "@/components/parampara/VoicePlayer";
import { useToast } from "@/components/parampara/Toast";
import {
  approveCard,
  rejectCard,
  saveCardEdits,
  type CardEdits,
  type ReviewResult,
} from "@/app/r/cards/actions";
import type { MessageKey } from "@/lib/i18n";
import type { ReviewCard, ReviewSegment } from "@/lib/review/types";
import { cn } from "@/lib/utils";

const REJECT_REASONS = ["not_a_practice", "unclear", "duplicate", "unsafe"] as const;
const RESULT_COPY: Record<Exclude<ReviewResult, { ok: true }>["error"], MessageKey> = {
  sign_in_needed: "review.sign_in",
  not_allowed: "review.card.not_allowed",
  consent_missing: "review.card.consent_missing",
  invalid: "review.card.failed",
  failed: "review.card.failed",
};

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

type Clip = { url: string; startMs: number; endMs: number };

/** Plays one moment of the original recording: fetch a signed clip, seek, stop at its end. */
function useClipPlayer(onUnavailable: () => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<number, Clip>());
  const stopAt = useRef<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [loading, setLoading] = useState<number | null>(null);

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    const onTime = () => {
      if (stopAt.current !== null && a.currentTime * 1000 >= stopAt.current) {
        a.pause();
        setPlaying(null);
      }
    };
    const onEnd = () => setPlaying(null);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    audioRef.current = a;
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(null);
  }, []);

  const play = useCallback(
    async (segmentId: number) => {
      const a = audioRef.current;
      if (!a) return;
      if (playing === segmentId) return stop();
      setLoading(segmentId);
      try {
        let clip = cache.current.get(segmentId);
        if (!clip) {
          const res = await fetch(`/api/audio/segments/${segmentId}`);
          if (!res.ok) throw new Error(String(res.status));
          clip = (await res.json()) as Clip;
          cache.current.set(segmentId, clip);
        }
        // Signed URLs differ per request; only reload when the file itself changes.
        const file = clip.url.split("?")[0];
        if (a.src.split("?")[0] !== file) {
          a.src = clip.url;
          await new Promise<void>((resolve, reject) => {
            a.addEventListener("loadedmetadata", () => resolve(), { once: true });
            a.addEventListener("error", () => reject(new Error("load")), { once: true });
          });
        }
        a.currentTime = clip.startMs / 1000;
        stopAt.current = clip.endMs;
        await a.play();
        setPlaying(segmentId);
      } catch {
        setPlaying(null);
        onUnavailable();
      } finally {
        setLoading(null);
      }
    },
    [onUnavailable, playing, stop],
  );

  return { play, stop, playing, loading };
}

export function CardReview({
  card,
  segments,
  nextId,
}: {
  card: ReviewCard;
  segments: ReviewSegment[];
  nextId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [draft, setDraft] = useState<CardEdits>(() => ({
    title: card.title,
    problem: card.problem,
    steps: card.steps,
    materials: card.materials,
    why: card.why,
    gradeBand: card.gradeBand,
    topic: card.topic,
  }));
  const segRefs = useRef(new Map<number, HTMLLIElement>());
  // The moment a chip points at: lit in the transcript on a laptop, quoted under the step on a phone.
  const [pointed, setPointed] = useState<number | null>(null);
  const [inline, setInline] = useState<number | null>(null);
  const approveTimer = useRef<number | null>(null);
  const transcript = useRef<HTMLElement>(null);
  useEffect(() => {
    // On a laptop the transcript scrolls on its own: start it at the first highlighted moment.
    const box = transcript.current;
    const first = card.evidenceSegmentIds[0];
    const row = first !== undefined ? segRefs.current.get(first) : undefined;
    if (!box || !row || !window.matchMedia("(min-width: 1024px)").matches) return;
    box.scrollTop += row.getBoundingClientRect().top - box.getBoundingClientRect().top - 140;
  }, [card.evidenceSegmentIds]);
  const evidence = new Set(card.evidenceSegmentIds);
  const decided = card.status !== "draft";

  const unavailable = useCallback(
    () => toast({ text: "review.card.voice_unavailable", tone: "caring" }),
    [toast],
  );
  const clip = useClipPlayer(unavailable);

  const playMoment = (id: number) => {
    // A phone keeps her place: the words open under the step instead of scrolling away.
    if (window.matchMedia("(min-width: 1024px)").matches) {
      segRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else setInline((at) => (at === id ? null : id));
    void clip.play(id);
  };

  function report(r: ReviewResult, success: MessageKey, then?: () => void) {
    if (r.ok) {
      toast({ text: success, tone: "success" });
      then?.();
    } else toast({ text: RESULT_COPY[r.error], tone: "caring", durationMs: 7000 });
  }

  const goNext = () => router.push(nextId ? `/r/cards/${nextId}` : "/r/cards");
  const approve = () =>
    start(async () => report(await approveCard(card.id), "review.card.approved", goNext));
  // The A key waits five seconds with Undo: a stray key press never approves a card.
  const approveSoon = () => {
    if (approveTimer.current) return;
    approveTimer.current = window.setTimeout(() => {
      approveTimer.current = null;
      approve();
    }, 5000);
    toast({
      text: "review.card.approving",
      tone: "success",
      durationMs: 5000,
      action: {
        label: "review.card.undo",
        onClick: () => {
          if (approveTimer.current) window.clearTimeout(approveTimer.current);
          approveTimer.current = null;
        },
      },
    });
  };
  const reject = (why: string) =>
    start(async () => report(await rejectCard(card.id, why), "review.card.rejected", goNext));
  const save = () =>
    start(async () =>
      report(await saveCardEdits(card.id, draft), "review.card.saved", () => {
        setEditing(false);
        router.refresh();
      }),
    );

  useEffect(() => {
    // Laptop reviewers: A approve, E edit, R set aside. Never while typing.
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (decided || editing || pending || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.key === "a" && card.master.consented) approveSoon();
      else if (e.key === "e") setEditing(true);
      else if (e.key === "r") setRejecting(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const v = editing ? draft : { ...card };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <article className="rounded-card border border-border bg-paper p-5 shadow-warm sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <MasterMedallion
            name={card.master.name}
            years={card.master.years}
            district={card.master.district}
            size="md"
            isSample={card.isSample}
          />
          <span className="flex-1" />
          {/* The medallion already says Sample; field work says so here. */}
          {!card.isSample && <FieldBadge />}
        </div>
        {card.quoteSegmentId != null && (
          <div className="mt-4">
            <SegmentPlayer
              segmentId={String(card.quoteSegmentId)}
              title="review.card.hear"
              eyebrow="review.card.quote"
            />
          </div>
        )}

        {!card.master.consented && (
          <p
            role="note"
            className="mt-4 flex items-start gap-3 rounded-button bg-flame/25 px-4 py-3 text-base font-semibold"
          >
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <Bi k="review.card.consent_missing" subClassName="text-[15px] font-normal" />
          </p>
        )}
        {card.status === "approved" && (
          // An approved card can travel: its Tomorrow card, credited as the master chose.
          <ShareCard cardId={card.id} className="mt-4" />
        )}
        {decided && (
          <p className="mt-4 rounded-button bg-sage px-4 py-3 font-display text-lg font-bold text-moss">
            <Bi
              k={
                card.status === "approved"
                  ? "review.card.status.approved"
                  : "review.card.status.rejected"
              }
              sub={false}
            />
          </p>
        )}

        <div className="mt-5">
          {editing ? (
            <BiFields
              label="review.card.steps"
              value={draft.title}
              onChange={(title) => setDraft({ ...draft, title })}
              large
            />
          ) : (
            <h1 className="text-[28px] leading-tight font-bold">
              <BiText text={v.title} subClassName="font-sans text-lg font-semibold text-ink-3" />
            </h1>
          )}
        </div>

        <Section title="review.card.problem">
          {editing ? (
            <BiFields
              value={draft.problem}
              onChange={(problem) => setDraft({ ...draft, problem })}
            />
          ) : (
            <BiPara value={v.problem} />
          )}
        </Section>

        <Section title="review.card.steps">
          <ol className="space-y-4">
            {v.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-chip bg-flame font-display font-bold"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <BiFields
                      value={draft.steps[i]!}
                      onChange={(val) =>
                        setDraft({
                          ...draft,
                          steps: draft.steps.map((x, j) => (j === i ? { ...x, ...val } : x)),
                        })
                      }
                    />
                  ) : (
                    <BiPara value={s} />
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.evidenceSegmentIds.map((id) => {
                      const seg = segments.find((x) => x.id === id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => playMoment(id)}
                          onMouseEnter={() => setPointed(id)}
                          onMouseLeave={() => setPointed(null)}
                          onFocus={() => setPointed(id)}
                          onBlur={() => setPointed(null)}
                          aria-expanded={inline === id}
                          className={cn(
                            "inline-flex min-h-12 items-center gap-1.5 rounded-chip px-3.5 text-sm font-semibold tabular-nums",
                            clip.playing === id
                              ? "bg-clay-cta text-white"
                              : "bg-flame/30 text-ink hover:bg-flame/50",
                          )}
                        >
                          {clip.playing === id ? (
                            <Pause className="size-4" aria-hidden />
                          ) : (
                            <Play className="size-4" aria-hidden />
                          )}
                          {seg ? clock(seg.startMs) : `#${id}`}
                        </button>
                      );
                    })}
                  </div>
                  {inline !== null && s.evidenceSegmentIds.includes(inline) && (
                    <InlineMoment segment={segments.find((x) => x.id === inline)} />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {v.materials.length > 0 && (
          <Section title="review.card.materials">
            <ul className="flex flex-wrap gap-2">
              {v.materials.map((m, i) => (
                <li
                  key={i}
                  className="rounded-chip border border-border bg-cream px-3 py-1.5 text-base"
                >
                  <BiText text={m} inline subClassName="ml-2 inline text-base text-ink-3" />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {v.why && (
          <Section title="review.card.why">
            {editing && draft.why ? (
              <BiFields value={draft.why} onChange={(why) => setDraft({ ...draft, why })} />
            ) : (
              <BiPara value={v.why} />
            )}
          </Section>
        )}
      </article>

      {/* Ends above the action bar, and opens at the card's first piece of evidence. */}
      <aside
        ref={transcript}
        className="rounded-card bg-ink p-5 text-white shadow-warm-lg sm:p-6 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-8.5rem)] lg:overflow-y-auto"
      >
        {/* The heading stays while the transcript scrolls, so the panel is never unlabelled. */}
        <div className="lg:sticky lg:-top-6 lg:z-10 lg:-mx-6 lg:-mt-6 lg:bg-ink lg:px-6 lg:pt-6 lg:pb-3">
          <h2 className="text-[20px] font-bold text-flame">
            <Bi
              k="review.card.transcript"
              subClassName="font-sans text-[15px] font-semibold text-mist"
            />
          </h2>
          <p className="mt-2 text-[15px] text-mist">
            <Bi k="review.card.evidence_hint" sub={false} />
          </p>
        </div>
        {segments.length === 0 ? (
          <p className="mt-6 text-base text-mist">
            <Bi k="review.card.no_transcript" sub={false} />
          </p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {segments.map((s) => {
              const isEvidence = evidence.has(s.id);
              const active = clip.playing === s.id;
              return (
                <li
                  key={s.id}
                  ref={(el) => {
                    if (el) segRefs.current.set(s.id, el);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => playMoment(s.id)}
                    aria-pressed={active}
                    className={cn(
                      "w-full rounded-button px-3 py-2 text-left transition-colors",
                      isEvidence
                        ? "border-l-4 border-flame bg-flame/25 hover:bg-flame/35"
                        : "hover:bg-ink-2",
                      (active || pointed === s.id) && "ring-2 ring-flame",
                      "focus-visible:outline-flame",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm text-mist tabular-nums">
                      {active ? (
                        <Pause className="size-3.5 text-flame" aria-hidden />
                      ) : (
                        <Play className="size-3.5" aria-hidden />
                      )}
                      {clock(s.startMs)}
                      {s.speaker === "interviewer" && (
                        <span>
                          · <Bi k="review.card.interviewer" sub={false} className="inline" />
                        </span>
                      )}
                      {s.redacted && (
                        <span className="text-clay-glow">
                          · <Bi k="review.card.child_redacted" sub={false} className="inline" />
                        </span>
                      )}
                      {clip.loading === s.id && (
                        <span
                          aria-hidden
                          className="ml-auto size-2 animate-pulse rounded-chip bg-flame motion-reduce:animate-none"
                        />
                      )}
                    </span>
                    <span
                      lang="kn"
                      className={cn(
                        "mt-1 block text-[17px] leading-[1.65]",
                        isEvidence ? "text-white" : "text-mist",
                      )}
                    >
                      {s.kn}
                    </span>
                    {s.en && <span className="mt-0.5 block text-[15px] text-mist">{s.en}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {!decided && (
        <div
          data-action-bar
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-paper px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] shadow-warm-lg lg:col-span-2"
        >
          {/* The same width and gutter as the room header, so Approve lines up with the card. */}
          <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_auto] items-center gap-2 sm:flex sm:flex-row sm:gap-3 sm:px-8">
            {rejecting ? (
              <div
                className="col-span-3 flex flex-1 flex-wrap items-center gap-2"
                role="group"
                aria-label="reject"
              >
                <span className="mr-1 font-display font-bold">
                  <Bi k="review.card.reject.title" sub={false} />
                </span>
                {REJECT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={pending}
                    onClick={() => reject(r)}
                    className="min-h-12 rounded-chip border border-border bg-paper px-4 font-display font-semibold hover:bg-sage"
                  >
                    <Bi k={`review.card.reject.${r}`} sub={false} />
                  </button>
                ))}
                <Button variant="ghost" size="md" onClick={() => setRejecting(false)}>
                  <X aria-hidden />
                  <Bi k="review.card.cancel" sub={false} />
                </Button>
              </div>
            ) : editing ? (
              <>
                <Button
                  className="col-span-2 sm:min-w-64 sm:flex-none"
                  onClick={save}
                  disabled={pending}
                >
                  <Check aria-hidden />
                  <Bi k="review.card.save" sub={false} />
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setEditing(false)}
                  disabled={pending}
                >
                  <Bi k="review.card.cancel" sub={false} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="sm:min-w-64 sm:flex-none"
                  onClick={approve}
                  disabled={pending || !card.master.consented}
                  aria-keyshortcuts="A"
                >
                  <Check aria-hidden />
                  <Bi k="review.card.approve" sub={false} />
                  <Kbd onDark>A</Kbd>
                </Button>
                <Button
                  variant="paper"
                  size="md"
                  onClick={() => setEditing(true)}
                  disabled={pending}
                  aria-keyshortcuts="E"
                  className="max-sm:w-12 max-sm:px-0 sm:h-14 sm:px-6"
                >
                  <Pencil aria-hidden />
                  {/* One row on a phone: Edit is its pencil there (the name stays for readers). */}
                  <span className="max-sm:sr-only">
                    <Bi k="review.card.edit" sub={false} />
                  </span>
                  <Kbd>E</Kbd>
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setRejecting(true)}
                  disabled={pending}
                  aria-keyshortcuts="R"
                  className="border border-border sm:h-14 sm:px-6"
                >
                  <Bi k="review.card.reject" sub={false} />
                  <Kbd>R</Kbd>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {decided && nextId && (
        <Button asChild className="lg:col-span-2">
          <Link href={`/r/cards/${nextId}`}>
            <Bi k="review.card.next" sub={false} />
          </Link>
        </Button>
      )}
    </div>
  );
}

/** On a phone the transcript is far below: the moment a chip points at opens right here. */
function InlineMoment({ segment }: { segment: ReviewSegment | undefined }) {
  if (!segment) return null;
  return (
    <blockquote className="mt-3 rounded-button bg-ink px-4 py-3 text-white lg:hidden">
      <p className="text-sm text-mist tabular-nums">{clock(segment.startMs)}</p>
      <p lang="kn" className="mt-1 text-[16px] leading-[1.65]">
        {segment.kn}
      </p>
      {segment.en && (
        <p lang="en" className="mt-1 text-[15px] text-mist">
          {segment.en}
        </p>
      )}
    </blockquote>
  );
}

/** The laptop shortcut, on the button it presses. */
function Kbd({ children, onDark = false }: { children: string; onDark?: boolean }) {
  return (
    <kbd
      aria-hidden
      className={cn(
        "ml-1 hidden rounded-md border px-1.5 font-sans text-sm leading-5 font-semibold lg:inline",
        onDark ? "border-white/40 text-white/85" : "border-ink/20 text-ink-3",
      )}
    >
      {children}
    </kbd>
  );
}

function Section({ title, children }: { title: MessageKey; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-display text-[15px] font-bold tracking-normal text-ink-3">
        <Bi k={title} sub={false} />
      </h2>
      {children}
    </section>
  );
}

function BiPara({ value }: { value: { kn: string; en: string } }) {
  // The reader's language leads; the other sits beneath (jurors read in English).
  return (
    <p>
      <BiText text={value} className="text-lg leading-[1.65]" subClassName="text-base text-ink-3" />
    </p>
  );
}

function BiFields({
  value,
  onChange,
  large = false,
}: {
  value: { kn: string; en: string };
  onChange: (v: { kn: string; en: string }) => void;
  label?: MessageKey;
  large?: boolean;
}) {
  const field =
    "w-full rounded-button border border-input bg-paper px-3 py-2 outline-none focus:border-clay focus:shadow-flame";
  return (
    <div className="space-y-2">
      <textarea
        lang="kn"
        aria-label="ಕನ್ನಡ"
        rows={large ? 2 : 3}
        className={cn(field, "leading-[1.65]", large ? "text-[22px] font-bold" : "text-lg")}
        value={value.kn}
        onChange={(e) => onChange({ ...value, kn: e.target.value })}
      />
      <textarea
        lang="en"
        aria-label="English"
        rows={2}
        className={cn(field, "text-base")}
        value={value.en}
        onChange={(e) => onChange({ ...value, en: e.target.value })}
      />
    </div>
  );
}
