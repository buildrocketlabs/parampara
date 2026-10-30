"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, Square, Volume2 } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { haptics, vibrate } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { Hanate } from "./hanate/Hanate";

// The consent text with Hanate beside it, and "Hear it" when this phone can actually speak it:
// a recorded reading from `audioUrl` if the server has one, else the browser's own Kannada voice.
// With neither, the button never appears and the lead line says "read", never "read or hear"
// (F-P1: most Android phones have no Kannada voice). Consent never waits on audio (DESIGN §2.7).
// On a phone a long text opens at about six lines with "Read all", so the pinned I agree tray
// never cuts a line in half; the whole text is in the page all along, for screen readers too.
type ConsentReaderProps = {
  /** The Kannada text the browser voice reads when no recording exists. */
  speech: string;
  audioUrl?: string;
  title: React.ReactNode;
  /** The line under the title: one version when this phone can read the text aloud, one when not. */
  lead?: { hear: MessageKey; read: MessageKey; className?: string; subClassName?: string };
  /** Below md, open at about six lines with "Read all" (pages whose I agree tray is pinned). */
  clampOnPhone?: boolean;
  children: React.ReactNode;
};

// The browser's Kannada voice, by name (a primitive, so the snapshot is stable between reads).
function subscribeVoices(onChange: () => void) {
  if (!("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}
function kannadaVoiceName(): string | null {
  if (!("speechSynthesis" in window)) return null;
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith("kn"));
  return voice?.name ?? null;
}

export function ConsentReader({
  speech,
  audioUrl,
  title,
  lead,
  clampOnPhone = false,
  children,
}: ConsentReaderProps) {
  const voiceName = useSyncExternalStore(subscribeVoices, kannadaVoiceName, () => null);
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  // Phones only (the tray is pinned below md): opened by "Read all", or not needed (a short text).
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(true);
  const textBox = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = textBox.current;
    if (!clampOnPhone || !el || !("ResizeObserver" in window)) return;
    const measure = () => setLong(el.scrollHeight > el.clientHeight + 4);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [clampOnPhone]);
  const clamped = clampOnPhone && !open && long;

  // A HEAD request is a few hundred bytes: cheap enough on 2G to learn whether a reading exists.
  useEffect(() => {
    if (!audioUrl) return;
    let live = true;
    fetch(audioUrl, { method: "HEAD" })
      .then((r) => r.ok && (r.headers.get("content-type") ?? "").startsWith("audio/"))
      .catch(() => false)
      .then((ok) => live && setRecording(ok));
    return () => {
      live = false;
    };
  }, [audioUrl]);

  useEffect(
    () => () => {
      audio.current?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  const stop = () => {
    audio.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(false);
  };

  const speak = () => {
    const voice = window.speechSynthesis?.getVoices().find((v) => v.name === voiceName);
    if (!voice) {
      setFailed(true);
      setPlaying(false);
      return;
    }
    const line = new SpeechSynthesisUtterance(speech);
    line.voice = voice;
    line.lang = voice.lang;
    line.rate = 0.9;
    line.onend = () => setPlaying(false);
    line.onerror = () => setPlaying(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(line);
    setPlaying(true);
  };

  const hear = () => {
    vibrate(haptics.press);
    if (playing) return stop();
    if (recording && audioUrl) {
      const a = new Audio(audioUrl);
      audio.current = a;
      a.onended = () => setPlaying(false);
      a.onerror = () => (voiceName ? speak() : setFailed(true));
      a.play()
        .then(() => setPlaying(true))
        .catch(() => (voiceName ? speak() : setFailed(true)));
      return;
    }
    speak();
  };

  const canHear = !failed && (recording || Boolean(voiceName));

  return (
    <>
      <div className="relative flex justify-center">
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame/25 blur-3xl"
        />
        <Hanate
          state={playing ? "speaking" : "idle"}
          size={92}
          label="Hanate"
          className="relative rise max-sm:h-[75px] max-sm:w-[64px]"
        />
      </div>
      {title}
      {lead && (
        <p
          className={cn("mt-3 rise text-center text-[17px] text-ink-3", lead.className)}
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <Bi k={canHear ? lead.hear : lead.read} subClassName={lead.subClassName} />
        </p>
      )}
      {/* data-keep-clear: the feedback button never covers words someone is agreeing to. */}
      <div
        data-keep-clear
        className="mt-5 rise rounded-card border border-border bg-paper p-5 shadow-warm sm:p-7"
        style={{ "--i": 3 } as React.CSSProperties}
      >
        {canHear && (
          <div className="-mt-1 mb-3 flex justify-end">
            <button
              type="button"
              onClick={hear}
              aria-pressed={playing}
              className={cn(
                "inline-flex h-12 items-center gap-2 rounded-chip border px-4 font-display text-base font-bold transition-colors duration-150",
                playing
                  ? "border-transparent bg-ink text-white"
                  : "border-border bg-cream text-ink hover:bg-sage",
              )}
            >
              {playing ? (
                <Square className="size-4 fill-current" aria-hidden />
              ) : (
                <Volume2 className="size-5" aria-hidden />
              )}
              <Bi k={playing ? "welcome.hearing" : "welcome.hear"} sub={false} />
            </button>
          </div>
        )}
        <div
          ref={textBox}
          id="consent-text"
          className={cn(
            "relative",
            // About six lines of 19 to 21 px Kannada at line height 1.625.
            clamped && "max-md:max-h-[12.5rem] max-md:overflow-hidden",
          )}
        >
          {children}
          {clamped && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-paper to-paper/0 md:hidden"
            />
          )}
        </div>
        {clamped && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            aria-controls="consent-text"
            data-testid="consent-read-all"
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-chip border border-border bg-cream px-4 font-display text-base font-bold text-ink hover:bg-sage md:hidden"
          >
            <Bi k="welcome.readAll" sub={false} />
            <ChevronDown className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </>
  );
}
