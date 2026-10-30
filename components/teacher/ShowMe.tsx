"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, FlaskConical, Images, Lock, ScanFace, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IllustrationBadge, SampleBadge } from "@/components/parampara/Badges";
import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import type { MessageKey } from "@/lib/i18n";
import { useLang } from "@/lib/i18n/provider";
import { haptics, vibrate } from "@/lib/motion";
import { PhotoError, preparePhoto, type PreparedPhoto } from "@/lib/photo/prepare";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

// "Show me" (docs/BUILD.md M5.3): one photo of a slate, a notebook, a worksheet or the blackboard.
// The line about faces comes before the camera opens; the tick is required before the photo can be
// used. The photo is resized and re-encoded here (no EXIF survives), kept in memory only, and sent
// once with the question. The browser's face detector, where there is one, only ever warns.
// "Try a sample slate" is for jurors on a laptop: a slate we drew (an Illustration, labelled Sample),
// sent through exactly the same path, so the real reader reads it.

/** Our drawn slate (public/samples/slate-sample.svg): chalk letters, no hands, no faces, no names. */
export const SAMPLE_SLATE = "/samples/slate-sample.svg";

type State =
  | { k: "pick" }
  | { k: "preparing" }
  | { k: "ready"; photo: PreparedPhoto; url: string; sample: boolean }
  | { k: "error"; code: MessageKey };

export function ShowMe({
  onUse,
  onCancel,
}: {
  onUse: (photo: PreparedPhoto, from: { sample: boolean }) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<State>({ k: "pick" });
  const [ticked, setTicked] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  // "Another photo" goes back to where the first one came from.
  const [source, setSource] = useState<"camera" | "gallery" | "sample">("gallery");
  // The preview's object URL lives only as long as this preview.
  const urlRef = useRef<string | null>(null);
  const letGo = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };
  useEffect(() => letGo, []);

  // With a photo ready, the photo, the tick and the button fit one phone screen: once the preview
  // has its size, the panel moves to the top.
  const bringIntoView = () =>
    requestAnimationFrame(() =>
      panel.current?.scrollIntoView({ block: "start", behavior: reduced ? "instant" : "smooth" }),
    );
  // The panel is the whole task: it starts at the top of the screen, and comes back there when a
  // photo could not be opened.
  useEffect(() => {
    if (state.k === "pick" || state.k === "error") bringIntoView();
    // bringIntoView only reads refs; it is recreated each render on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.k]);

  async function pick(file: File | undefined, sample = false) {
    if (!file) return;
    // Our own drawing has no faces, so its tick comes already ticked (and can be unticked).
    setTicked(sample);
    letGo();
    setState({ k: "preparing" });
    try {
      const photo = await preparePhoto(file);
      urlRef.current = URL.createObjectURL(photo.blob);
      setState({ k: "ready", photo, url: urlRef.current, sample });
    } catch (err) {
      setState({
        k: "error",
        code:
          err instanceof PhotoError && err.code === "too_large"
            ? "ask.photo.error.send"
            : "ask.photo.error.open",
      });
    }
  }

  // The sample slate takes the same road as a photo: drawn on a canvas, re-encoded as a JPEG.
  async function trySample() {
    setSource("sample");
    setState({ k: "preparing" });
    try {
      const res = await fetch(SAMPLE_SLATE);
      if (!res.ok) throw new Error(String(res.status));
      const svg = new File([await res.blob()], "sample-slate.svg", { type: "image/svg+xml" });
      await pick(svg, true);
    } catch {
      setState({ k: "error", code: "ask.photo.error.open" });
    }
  }

  const choose = (from: "camera" | "gallery" | "sample") => {
    if (from === "sample") {
      setState({ k: "pick" });
      return;
    }
    const input = from === "camera" ? camera.current : gallery.current;
    if (!input) return;
    setSource(from);
    input.value = ""; // the same photo chosen twice still fires a change
    input.click();
  };

  const ready = state.k === "ready";
  // When the browser itself saw a face, taking another photo is the easy path, not using this one.
  const doubted = ready && state.photo.faceSeen === true;

  return (
    <section
      ref={panel}
      aria-labelledby="showme-title"
      className="mt-6 w-full max-w-xl scroll-mt-4 rounded-card bg-paper p-6 shadow-warm-lg sm:p-8"
      data-testid="show-me"
    >
      <div className="flex rise items-start justify-between gap-3">
        <h2 id="showme-title" className="text-[26px] leading-tight font-bold">
          <Bi k="ask.photo.title" subClassName="font-sans text-base font-semibold" />
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("ask.photo.cancel")}
          className="-mt-2 -mr-3 grid size-12 shrink-0 place-items-center rounded-chip text-ink-3 hover:bg-sage hover:text-ink"
        >
          <X className="size-6" aria-hidden />
        </button>
      </div>

      {/* Before the camera opens, and first: what never belongs in the photo. */}
      <p
        className={cn(
          "mt-4 flex rise items-start gap-3 rounded-button bg-flame/30 px-4 font-semibold text-ink",
          ready ? "py-2.5 text-[16px] leading-snug" : "py-3 text-[18px] leading-snug",
        )}
        style={{ "--i": 1 } as React.CSSProperties}
        data-testid="no-faces-line"
        data-keep-clear
      >
        <UserX
          className={cn("shrink-0 text-ink-2", ready ? "size-5" : "mt-0.5 size-6")}
          aria-hidden
        />
        <span className="min-w-0 text-balance">
          <Bi
            k="ask.photo.no_faces"
            sub={!ready}
            subClassName="font-sans text-[15px] font-medium text-ink-3"
          />
        </span>
      </p>
      {state.k === "pick" && (
        <p className="mt-3 rise text-lg text-ink-3" style={{ "--i": 2 } as React.CSSProperties}>
          <Bi k="ask.photo.sub" subClassName="text-base" />
        </p>
      )}

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="photo-camera"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="photo-gallery"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {(state.k === "pick" || state.k === "error") && (
        <>
          {state.k === "error" && (
            <div
              role="alert"
              className="mt-4 flex rise items-center gap-3"
              data-testid="photo-error"
            >
              <Hanate state="caring" size={56} label="" />
              <p className="text-lg font-semibold">
                <Bi k={state.code} subClassName="text-base font-normal" />
              </p>
            </div>
          )}
          <div
            className="mt-5 grid rise gap-3 sm:grid-cols-2"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            <Button className="w-full" onClick={() => choose("camera")}>
              <Camera aria-hidden />
              <Bi k="ask.photo.camera" sub={false} />
            </Button>
            <Button variant="paper" className="w-full" onClick={() => choose("gallery")}>
              <Images aria-hidden />
              <Bi k="ask.photo.gallery" sub={false} />
            </Button>
          </div>
          {/* For a juror without a slate at hand: our drawing, read by the real reader. */}
          <Button
            variant="ghost"
            size="md"
            className="mt-2 w-full rise text-ink-2 underline decoration-ink/20 underline-offset-4"
            style={{ "--i": 4 } as React.CSSProperties}
            onClick={() => void trySample()}
            data-testid="photo-sample"
          >
            <FlaskConical aria-hidden />
            <Bi k="ask.photo.sample" sub={false} />
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="w-full rise text-ink-3"
            style={{ "--i": 5 } as React.CSSProperties}
            onClick={onCancel}
          >
            <Bi k="ask.photo.cancel" sub={false} />
          </Button>
        </>
      )}

      {state.k === "preparing" && (
        <div
          role="status"
          className="relative mt-5 grid h-56 place-items-center overflow-hidden rounded-button"
          data-testid="photo-preparing"
        >
          {/* Only the ground pulses; the words stay at full strength. */}
          <span aria-hidden className="absolute inset-0 bg-cream motion-safe:animate-pulse" />
          <p className="relative text-lg font-semibold text-ink-3">
            <Bi k="ask.photo.preparing" sub={false} />
          </p>
        </div>
      )}

      {state.k === "ready" && (
        <>
          {/* The photo sits on a plate, its labels above it, so nothing covers the slate. */}
          <figure className="mt-4 flex rise flex-col items-center rounded-button border border-border bg-sage/50 p-3">
            {state.sample && (
              // Law 7: our drawing says what it is, right above it.
              <figcaption
                className="mb-2 flex w-full flex-wrap gap-1.5"
                data-testid="sample-labels"
              >
                <SampleBadge />
                <IllustrationBadge />
              </figcaption>
            )}
            {/* A blob URL from this phone, never uploaded or cached: next/image has nothing to do. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.url}
              alt={t(state.sample ? "ask.photo.sample.alt" : "ask.photo.preview_alt")}
              width={state.photo.width}
              height={state.photo.height}
              className="max-h-[34dvh] w-auto rounded-[10px] object-contain shadow-warm-sm"
              onLoad={bringIntoView}
              data-testid="photo-preview"
            />
          </figure>
          {state.sample && (
            <p className="mt-2 pl-1 text-[15px] text-ink-3" data-testid="sample-why">
              <Bi k="ask.photo.sample.why" sub={false} />
            </p>
          )}

          {doubted && (
            <p
              role="alert"
              className="mt-3 flex rise items-start gap-3 rounded-button border-l-4 border-flame-deep bg-flame/30 px-4 py-3 text-[17px] leading-snug font-semibold text-ink"
              data-testid="face-warning"
              data-keep-clear
            >
              <ScanFace className="mt-0.5 size-6 shrink-0 text-ink-2" aria-hidden />
              <span className="min-w-0">
                <Bi
                  k="ask.photo.face_warning"
                  subClassName="font-sans text-[15px] font-medium text-ink-3"
                />
              </span>
            </p>
          )}

          <label
            className={cn(
              "mt-4 flex min-h-16 rise cursor-pointer items-center gap-3 rounded-button border-2 border-border bg-paper px-4 py-3 transition-colors duration-150",
              "has-[:checked]:border-moss has-[:checked]:bg-sage",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-clay",
            )}
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <input
              type="checkbox"
              className="peer sr-only"
              checked={ticked}
              required
              onChange={(e) => {
                setTicked(e.target.checked);
                if (e.target.checked) vibrate(haptics.press);
              }}
              data-testid="no-faces-tick"
            />
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-[8px] border-2 border-ink-3 bg-paper text-transparent transition-colors duration-150 peer-checked:border-moss peer-checked:bg-moss peer-checked:text-white"
            >
              <Check className="size-5" strokeWidth={3} />
            </span>
            <span className="text-[18px] leading-snug font-semibold">
              <Bi k="ask.photo.tick" subClassName="font-sans text-[15px] font-medium text-ink-3" />
            </span>
          </label>
          {!ticked && (
            <p id="photo-tick-first" className="mt-2 pl-1 text-[15px] text-ink-3">
              <Bi k="ask.photo.tick_first" sub={false} />
            </p>
          )}

          <div
            className={cn(
              "mt-4 flex rise gap-3",
              doubted ? "flex-col sm:flex-row" : "flex-col sm:flex-row-reverse",
            )}
            style={{ "--i": 2 } as React.CSSProperties}
          >
            <Button
              variant={doubted ? "paper" : "clay"}
              className="w-full sm:flex-1"
              disabled={!ticked}
              aria-describedby={ticked ? undefined : "photo-tick-first"}
              onClick={() => {
                vibrate(haptics.success);
                // Hand the photo on; this preview's URL is let go when the panel closes.
                onUse(state.photo, { sample: state.sample });
              }}
              data-testid="photo-use"
            >
              <Bi k="ask.photo.use" sub={false} />
            </Button>
            <Button
              variant={doubted ? "clay" : "paper"}
              className={cn(doubted && "w-full sm:flex-1")}
              onClick={() => choose(source)}
            >
              {source === "camera" ? <Camera aria-hidden /> : <Images aria-hidden />}
              <Bi k="ask.photo.another" sub={false} />
            </Button>
          </div>
        </>
      )}

      <p className="mt-5 flex items-start gap-2 text-[16px] leading-snug text-ink-3">
        <Lock className="mt-1 size-4 shrink-0" aria-hidden />
        <Bi k="ask.photo.not_kept" sub={false} />
      </p>
    </section>
  );
}

/** The photo waiting for her question: small, with a way to take it back. */
export function PhotoAttached({
  url,
  onRemove,
  sample = false,
  className,
}: {
  /** An object URL the caller owns (and lets go of when the photo is sent or removed). */
  url: string;
  onRemove: () => void;
  /** Our sample slate: says so, with its labels. */
  sample?: boolean;
  className?: string;
}) {
  const { t } = useLang();

  return (
    <div
      className={cn(
        "flex w-full max-w-sm rise items-center gap-3 rounded-card border border-border bg-paper p-2.5 shadow-warm-sm",
        className,
      )}
      data-testid="photo-attached"
    >
      <span className="size-14 shrink-0 overflow-hidden rounded-lg bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="size-full object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-display text-[17px] font-bold text-moss">
          <Check className="size-4" strokeWidth={3} aria-hidden />
          <Bi k={sample ? "ask.photo.sample.added" : "ask.photo.added"} sub={false} />
        </span>
        <span className="block text-[15px] text-ink-3">
          <Bi k={sample ? "ask.photo.sample.added_sub" : "ask.photo.added_sub"} sub={false} />
        </span>
        {sample && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            <SampleBadge />
            <IllustrationBadge />
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("ask.photo.remove")}
        className="grid size-12 shrink-0 place-items-center rounded-chip text-ink-3 hover:bg-sage hover:text-ink"
        data-testid="photo-remove"
      >
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}
