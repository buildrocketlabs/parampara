"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, Pause, Play, RotateCcw, VolumeX } from "lucide-react";
import { useLang } from "@/lib/i18n/provider";
import { fill, type Text, type Vars } from "@/lib/i18n/fill";
import { haptics, vibrate } from "@/lib/motion";
import {
  clipBounds,
  clipFraction,
  findCue,
  formatTime,
  isPastEnd,
  nextSpeed,
  resamplePeaks,
  seekWithin,
  withMediaFragment,
  type Cue,
  type Speed,
  parseSegmentAudio,
  type SegmentAudio,
} from "@/lib/player";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";
import { Hanate } from "./hanate/Hanate";

// The voice of an answer, or the master's own seconds from a long recording (DESIGN §4). A big play
// button, bars from optional peaks (no decoding here), 0.8x / 1x / 1.2x, the sentence being spoken
// lit like karaoke, English subtitles one tap away. Every state is designed: loading, ready, playing,
// error (kind words and a retry), offline, and unavailable (calm, for parts we may not play).
export type PlayerStatus = "loading" | "ready" | "error" | "offline" | "unavailable";

export type VoicePlayerProps = {
  /** Audio URL. `null` while the voice is still being made (shows loading, honestly). */
  src: string | null;
  /** Play only this part of the file: seek here first, stop at `endMs`. File time, ms. */
  startMs?: number;
  endMs?: number;
  /** Mime type when known; a format this browser cannot play shows the calm unavailable state. */
  mime?: string;
  /** 0..1 loudness samples across the clip, any length. Without them a calm bar is drawn. */
  peaks?: readonly number[];
  /** Sentences in file time, for the karaoke highlight and subtitles. Sorted by start. */
  cues?: readonly Cue[];
  /** Language the audio is spoken in; subtitles show the other one. */
  spokenLang?: "kn" | "en";
  title?: Text;
  titleVars?: Vars;
  /** Small line above, for example "From the original recording". */
  eyebrow?: Text;
  /** Force a status the caller already knows (gallery, tests, or a route that said 409). */
  status?: Exclude<PlayerStatus, "ready">;
  onRetry?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
  className?: string;
};

const BARS = 44;

export function VoicePlayer({
  src,
  startMs,
  endMs,
  mime,
  peaks,
  cues,
  spokenLang = "kn",
  title,
  titleVars,
  eyebrow,
  status: forced,
  onRetry,
  onPlayingChange,
  onEnded,
  className,
}: VoicePlayerProps) {
  const { lang, t } = useLang();
  const online = useOnline();
  const audio = useRef<HTMLAudioElement>(null);
  const [loaded, setLoaded] = useState<{
    src: string | null;
    status: PlayerStatus;
    durationMs?: number;
  }>({
    src: null,
    status: "loading",
  });
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [pos, setPos] = useState(startMs ?? 0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [subsChoice, setSubsChoice] = useState<boolean | null>(null);

  const fresh = loaded.src === src;
  let status: PlayerStatus = forced ?? (src === null || !fresh ? "loading" : loaded.status);
  if (!online && (status === "loading" || status === "error")) status = "offline";
  const ready = status === "ready";

  const bounds = clipBounds(fresh ? loaded.durationMs : undefined, startMs, endMs);
  const shownPos = ready ? pos : bounds.startMs;
  const fraction = clipFraction(shownPos, bounds);
  const cueIndex = cues ? findCue(cues, shownPos) : -1;
  const subs = subsChoice ?? lang !== spokenLang;

  // Keep the latest callback without restarting the frame loop, and report each end once.
  const endedRef = useRef(onEnded);
  const endReported = useRef(false);
  useEffect(() => {
    endedRef.current = onEnded;
  });
  const reportEnd = () => {
    if (endReported.current) return;
    endReported.current = true;
    endedRef.current?.();
  };

  // While playing, follow the audio every frame (state updates throttled to about 20 a second) and
  // stop exactly at the clip's end.
  const endAt = bounds.endMs;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const a = audio.current;
      if (!a) return;
      const ms = a.currentTime * 1000;
      if (Number.isFinite(endAt) && ms >= endAt - 40) {
        a.pause();
        setPos(endAt);
        if (!endReported.current) {
          endReported.current = true;
          endedRef.current?.();
        }
        return;
      }
      if (now - last > 50) {
        last = now;
        setPos(ms);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, endAt]);

  const seekTo = (ms: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = ms / 1000;
    setPos(ms);
  };

  const toggle = () => {
    const a = audio.current;
    if (!a || !ready) return;
    vibrate(haptics.press);
    if (!a.paused) {
      a.pause();
      return;
    }
    const cur = a.currentTime * 1000;
    const restart = isPastEnd(cur, bounds) || cur < bounds.startMs - 250;
    if (restart) seekTo(bounds.startMs);
    a.playbackRate = speed;
    const started = a.play();
    // iOS Safari can drop a seek made before play(); set it again once playback has begun.
    void started
      ?.then(() => {
        if (restart && Math.abs(a.currentTime * 1000 - bounds.startMs) > 300)
          seekTo(bounds.startMs);
      })
      .catch(() => undefined);
  };

  const retry = () => {
    setLoaded({ src, status: "loading" });
    audio.current?.load();
    onRetry?.();
  };

  const changeSpeed = () => {
    const next = nextSpeed(speed);
    setSpeed(next);
    if (audio.current) {
      audio.current.playbackRate = next;
      audio.current.defaultPlaybackRate = next;
    }
  };

  const heard = cues && cueIndex >= 0 ? cues[cueIndex] : undefined;
  const quiet = spokenLang === "kn" ? "en" : "kn";
  const speedLabel = `${speed}×`;

  // Nothing to play here: one calm line, not an empty player (the words are written beside it).
  if (status === "unavailable") {
    return (
      <div
        data-status={status}
        className={cn(
          "flex items-center gap-3 rounded-card border border-border bg-paper/70 px-3 py-2 sm:px-4 sm:py-3",
          className,
        )}
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-chip bg-cream text-ink-3"
        >
          <VolumeX className="size-5" />
        </span>
        <div className="min-w-0">
          {/* One line: the title would only repeat the button that opened it. */}
          <p role="status" className="text-[15px] leading-snug text-ink-3">
            <BiText text={STATUS_TEXT.unavailable} sub={false} />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-status={status}
      data-playing={playing || undefined}
      className={cn(
        "@container rounded-card border border-border bg-paper p-4 shadow-warm-sm sm:p-5",
        className,
      )}
    >
      {src && (
        <audio
          ref={audio}
          src={withMediaFragment(src, startMs, endMs)}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const a = e.currentTarget;
            const durationMs = a.duration * 1000;
            setLoaded({ src, status: "ready", durationMs });
            const b = clipBounds(durationMs, startMs, endMs);
            if (Math.abs(a.currentTime * 1000 - b.startMs) > 250) a.currentTime = b.startMs / 1000;
            a.playbackRate = speed;
            setPos(b.startMs);
          }}
          onError={(e) => {
            const unplayable = mime ? e.currentTarget.canPlayType(mime) === "" : false;
            setLoaded({ src, status: unplayable ? "unavailable" : "error" });
            setPlaying(false);
          }}
          onPlay={() => {
            endReported.current = false;
            setPlaying(true);
            onPlayingChange?.(true);
          }}
          onPause={() => {
            setPlaying(false);
            setBuffering(false);
            onPlayingChange?.(false);
          }}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
          onEnded={() => {
            setPlaying(false);
            setPos(bounds.endMs);
            reportEnd();
          }}
        />
      )}

      {eyebrow && (
        <p className="mb-3 text-[14px] font-semibold text-ink-3">
          <BiText text={eyebrow} sub={false} />
        </p>
      )}

      <div className="flex items-center gap-4">
        <MainButton
          status={status}
          playing={playing}
          buffering={buffering}
          onToggle={toggle}
          onRetry={retry}
        />

        <div className="min-w-0 flex-1">
          {title && (
            <p className="mb-1 font-display text-[18px] leading-snug font-bold text-ink">
              <BiText text={title} vars={titleVars} sub={false} />
            </p>
          )}
          <div className="relative h-12">
            <Track peaks={peaks} fraction={fraction} dim={!ready} />
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(fraction * 1000)}
              disabled={!ready || bounds.lengthMs <= 0}
              aria-label={t("voice.position")}
              aria-valuetext={fill(t("voice.timeOf"), {
                now: formatTime(shownPos - bounds.startMs),
                total: formatTime(bounds.lengthMs),
              })}
              onChange={(e) => seekTo(seekWithin(Number(e.currentTarget.value) / 1000, bounds))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
            />
          </div>
        </div>
      </div>

      {ready && (
        <div className="mt-2 flex flex-nowrap items-center gap-2">
          <span className="mr-auto pl-1 text-[15px] text-ink-3 tabular-nums">
            {formatTime(shownPos - bounds.startMs)}
            <span className="text-muted-foreground"> / {formatTime(bounds.lengthMs)}</span>
          </span>
          {cues && cues.length > 0 && (
            <button
              type="button"
              role="switch"
              aria-checked={subs}
              aria-label={t("voice.subtitles")}
              onClick={() => setSubsChoice(!subs)}
              className={cn(
                // Icon only on narrow cards, so time, subtitles and speed stay on one row.
                "inline-flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-chip px-3 font-display text-[15px] font-semibold transition-colors @max-[17.5rem]:px-0",
                subs ? "bg-ink text-white" : "text-ink-3 hover:bg-sage",
              )}
            >
              <Captions className="size-5" aria-hidden />
              <span className="@max-[17.5rem]:sr-only">
                <BiText
                  text={quiet === "en" ? "voice.subtitlesEn" : "voice.subtitlesKn"}
                  sub={false}
                  inline
                />
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={changeSpeed}
            aria-label={fill(t("voice.speedIs"), { speed: speedLabel })}
            className="inline-flex h-12 min-w-16 items-center justify-center rounded-chip border border-border bg-cream px-3 font-display text-[16px] font-bold text-ink tabular-nums hover:border-clay/45"
          >
            {speedLabel}
          </button>
        </div>
      )}

      {status !== "ready" && <StatusLine status={status} buffering={buffering} />}
      {ready && buffering && <StatusLine status="loading" buffering />}

      {cues && cues.length > 0 && (
        <div className="mt-4 rounded-button bg-cream px-4 py-3">
          <p lang={spokenLang} className="text-[18px] leading-[1.75] text-muted-foreground">
            {cues.map((c, i) => (
              <button
                key={`${c.startMs}-${i}`}
                type="button"
                disabled={!ready}
                onClick={() => seekTo(c.startMs)}
                aria-current={i === cueIndex ? "true" : undefined}
                className={cn(
                  "inline rounded-md [box-decoration-break:clone] px-0.5 text-left transition-colors duration-200",
                  i === cueIndex && "bg-flame/55 text-ink",
                  i < cueIndex && "text-ink-3",
                  cueIndex === -1 && i === 0 && !playing && "text-ink-3",
                )}
              >
                {c[spokenLang]}{" "}
              </button>
            ))}
          </p>
          {subs && (
            <p
              lang={quiet}
              aria-live="off"
              className="mt-2 min-h-[1.6em] border-t border-border pt-2 text-[16px] text-ink-3"
            >
              {heard ? heard[quiet] : (cues[0]?.[quiet] ?? "")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MainButton({
  status,
  playing,
  buffering,
  onToggle,
  onRetry,
}: {
  status: PlayerStatus;
  playing: boolean;
  buffering: boolean;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const { t } = useLang();
  const box = "grid size-16 shrink-0 place-items-center rounded-chip";

  if (status === "loading") {
    return (
      <span aria-hidden className={cn(box, "bg-sage")}>
        <svg viewBox="0 0 12 16" className="h-6 w-5 animate-ember">
          <path
            d="M6 0 C8 4 11 6.5 11 10 C11 13.5 8.8 16 6 16 C3.2 16 1 13.5 1 10 C1 6.5 4 4 6 0 Z"
            fill="var(--color-flame-deep)"
          />
        </svg>
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span aria-hidden className={cn(box, "bg-ink")}>
        <Hanate state="resting" size={40} label="" />
      </span>
    );
  }
  if (status === "unavailable") {
    return (
      <span aria-hidden className={cn(box, "bg-cream text-ink-3")}>
        <VolumeX className="size-7" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        aria-label={t("error.retry")}
        className={cn(
          box,
          "border border-border bg-paper text-ink lip-paper transition-[translate,box-shadow] active:translate-y-1 active:shadow-none",
        )}
      >
        <RotateCcw className="size-7" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={t(playing ? "voice.pause" : "voice.play")}
      aria-pressed={playing}
      className={cn(
        box,
        "bg-clay-cta text-white lip-clay transition-[translate,box-shadow] duration-100 hover:-translate-y-px active:translate-y-1 active:shadow-none",
        buffering && "animate-breathe",
      )}
    >
      {playing ? (
        <Pause className="size-7" fill="currentColor" aria-hidden />
      ) : (
        <Play className="ml-1 size-7" fill="currentColor" aria-hidden />
      )}
    </button>
  );
}

const STATUS_TEXT: Record<Exclude<PlayerStatus, "ready">, Text> = {
  loading: "voice.loading",
  error: "voice.error",
  offline: "voice.offline",
  unavailable: "voice.unavailable",
};

function StatusLine({
  status,
  buffering,
}: {
  status: Exclude<PlayerStatus, "ready">;
  buffering?: boolean;
}) {
  return (
    <p role="status" aria-live="polite" className="mt-3 text-[15px] leading-snug text-ink-3">
      <BiText
        text={buffering ? "voice.buffering" : STATUS_TEXT[status]}
        subClassName="text-[14px]"
      />
    </p>
  );
}

/** Bars when peaks exist, otherwise a calm bar. The played part is revealed by transform only. */
function Track({
  peaks,
  fraction,
  dim,
}: {
  peaks?: readonly number[];
  fraction: number;
  dim: boolean;
}) {
  const bars = peaks && peaks.length > 0 ? resamplePeaks(peaks, BARS) : null;
  const rest = Math.round((1 - fraction) * 1000) / 10;
  const hide = `translateX(${-rest}%)`;
  const show = `translateX(${rest}%)`;

  if (!bars) {
    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-chip bg-sage",
          dim && "opacity-60",
        )}
      >
        <div
          className="h-full w-full origin-left rounded-chip bg-flame-deep"
          style={{ transform: `scaleX(${Math.round(fraction * 1000) / 1000})` }}
        />
      </div>
    );
  }

  const row = (cls: string) => (
    <div className="flex h-full items-center gap-[3px]">
      {bars.map((v, i) => (
        <span
          key={i}
          className={cn("block flex-1 rounded-chip", cls)}
          style={{ height: `${Math.round(Math.max(14, v * 100))}%` }}
        />
      ))}
    </div>
  );

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 inset-y-1.5 overflow-hidden",
        dim && "opacity-50",
      )}
    >
      {row("bg-ink/15")}
      <div className="absolute inset-0 overflow-hidden" style={{ transform: hide }}>
        <div className="h-full" style={{ transform: show }}>
          {row("bg-clay")}
        </div>
      </div>
    </div>
  );
}

// "Hear it from the master": GET /api/audio/segments/<id> → { url, startMs, endMs, mime } where url
// is a short lived signed URL of the original recording part. 403, 404 and 409 mean this part may not
// or cannot be played: the calm unavailable state, never an error look.
type SegmentState =
  | { id: string; attempt: number; kind: "loading" }
  | { id: string; attempt: number; kind: "ready"; audio: SegmentAudio }
  | { id: string; attempt: number; kind: "unavailable" | "error" };

export type SegmentPlayerProps = Omit<
  VoicePlayerProps,
  "src" | "startMs" | "endMs" | "mime" | "status"
> & {
  segmentId: string;
  /** Defaults to /api/audio/segments/<id>. */
  endpoint?: (segmentId: string) => string;
};

export function SegmentPlayer({ segmentId, endpoint, onRetry, ...rest }: SegmentPlayerProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SegmentState>({ id: segmentId, attempt, kind: "loading" });

  const url = endpoint
    ? endpoint(segmentId)
    : `/api/audio/segments/${encodeURIComponent(segmentId)}`;
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        // 503: no recordings are served here at all (no database), so calm, not an error.
        if ([403, 404, 409, 503].includes(res.status)) {
          setState({ id: segmentId, attempt, kind: "unavailable" });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const audio = parseSegmentAudio(await res.json());
        setState(
          audio
            ? { id: segmentId, attempt, kind: "ready", audio }
            : { id: segmentId, attempt, kind: "error" },
        );
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ id: segmentId, attempt, kind: "error" });
      });
    return () => ctrl.abort();
  }, [url, segmentId, attempt]);

  const current = state.id === segmentId && state.attempt === attempt ? state : null;
  const retry = () => {
    setAttempt((n) => n + 1);
    onRetry?.();
  };

  if (current?.kind === "ready") {
    // A failed play usually means the signed URL expired: retry fetches a fresh one.
    return (
      <VoicePlayer
        {...rest}
        src={current.audio.url}
        startMs={current.audio.startMs}
        endMs={current.audio.endMs}
        mime={current.audio.mime}
        onRetry={retry}
      />
    );
  }
  return (
    <VoicePlayer
      {...rest}
      src={null}
      status={
        current?.kind === "unavailable"
          ? "unavailable"
          : current?.kind === "error"
            ? "error"
            : "loading"
      }
      onRetry={retry}
    />
  );
}
