"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Check,
  CloudOff,
  Download,
  ImageIcon,
  MessageCircle,
  RotateCcw,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/lib/i18n";
import type { Lookup } from "@/lib/i18n/fill";
import { haptics, vibrate } from "@/lib/motion";
import { useLang } from "@/lib/i18n/provider";
import type { CardLang } from "@/lib/share/draw-card";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import {
  cardImageFileName,
  cardImagePath,
  shareText,
  whatsappUrl,
  type ShareMeta,
} from "@/lib/share/card";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { Hanate } from "./hanate/Hanate";

// Share a practice as its Tomorrow card (docs/BUILD.md M5.4), for a WhatsApp group or a staff room
// wall. Best first: the phone's share sheet with the picture itself and the Kannada words; else
// WhatsApp with the words and the picture's link; else the picture saved to the phone. Every state
// is said plainly: getting it ready, shared, WhatsApp opened, saved, no network, could not.

type State =
  | "idle"
  | "preparing"
  | "shared"
  | "fellback"
  | "whatsapp"
  | "downloaded"
  | "offline"
  | "ready"
  | "prepared"
  | "not_shared"
  | "error";

const STATUS: Partial<Record<State, MessageKey>> = {
  preparing: "share.preparing",
  shared: "share.shared",
  fellback: "share.fellBack",
  whatsapp: "share.whatsapp",
  downloaded: "share.downloaded",
  offline: "share.offline",
  ready: "share.ready",
  prepared: "share.prepared",
  not_shared: "share.notShared",
  error: "share.error",
};

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

class NotShared extends Error {}

async function getMeta(id: string): Promise<ShareMeta> {
  const res = await fetch(`/api/cards/${encodeURIComponent(id)}/share`);
  if (res.status === 404) throw new NotShared();
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as ShareMeta;
}

/**
 * The card as a picture in the reader's language: drawn in the browser, which shapes Kannada
 * (Law 8, D57); the server's image (English words, Kannada wordmark) only if that cannot be done.
 */
async function cardFile(
  meta: ShareMeta,
  lang: CardLang,
  look: Lookup,
): Promise<{ file: File; drawn: boolean }> {
  // The drawing code (fonts, layout, district names) loads on the tap, not with the answer page.
  const { drawTomorrowCard } = await import("@/lib/share/draw-card");
  const drawn = await drawTomorrowCard(meta, lang, cardImageFileName(meta), look);
  return drawn ? { file: drawn, drawn: true } : { file: await getImage(meta), drawn: false };
}

async function getImage(meta: ShareMeta): Promise<File> {
  const res = await fetch(cardImagePath(meta.id));
  if (res.status === 404) throw new NotShared();
  if (!res.ok) throw new Error(String(res.status));
  return new File([await res.blob()], cardImageFileName(meta), { type: "image/png" });
}

function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], "card.png", { type: "image/png" });
    return (
      typeof navigator.share === "function" && navigator.canShare?.({ files: [probe] }) === true
    );
  } catch {
    return false;
  }
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ShareCard({ cardId, className }: { cardId: string; className?: string }) {
  const [state, setState] = useState<State>("idle");
  // The picture, once fetched: a slow network can outlast the browser's patience with a tap, so a
  // second tap shares at once instead of fetching again.
  const prepared = useRef<{ meta: ShareMeta; file: File; drawn: boolean; lang: CardLang } | null>(
    null,
  );
  const { lang, msg } = useLang();
  const box = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  // A press made offline is held (D47): when the network returns the button says it is ready.
  // Sharing needs a fresh tap (the browser asks for one), so it does not go by itself.
  useEffect(() => {
    if (online && state === "offline") queueMicrotask(() => setState("ready"));
  }, [online, state]);

  // Fetch the words and the picture once the button is on screen, so a tap shares at once on a
  // slow line (the browser only lets a tap open the share sheet for a few seconds). Not on a data
  // saver or a 2G connection: there the picture comes only when asked for.
  useEffect(() => {
    const el = box.current;
    const conn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    if (!el || !canShareFiles() || conn?.saveData || /2g/.test(conn?.effectiveType ?? "")) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || prepared.current || !navigator.onLine) return;
        io.disconnect();
        getMeta(cardId)
          .then(async (meta) => ({ meta, ...(await cardFile(meta, lang, msg)), lang }))
          .then((ready) => {
            prepared.current ??= ready;
          })
          .catch(() => undefined); // The tap will try again and say what happened.
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cardId, lang, msg]);

  async function share() {
    vibrate(haptics.press);
    if (!navigator.onLine) {
      setState("offline");
      return;
    }
    setState("preparing");
    try {
      const meta = prepared.current?.meta ?? (await getMeta(cardId));
      const text = shareText(meta);
      if (canShareFiles()) {
        // A card drawn in the other language is drawn again (the reader switched languages).
        const ready = prepared.current?.lang === lang ? prepared.current : null;
        const { file, drawn } = ready ?? (await cardFile(meta, lang, msg));
        prepared.current = { meta, file, drawn, lang };
        try {
          await navigator.share({ files: [file], text, title: meta.title.kn });
          // The Kannada card could not be drawn here: the server's card went instead, and we say so.
          setState(!drawn && lang === "kn" ? "fellback" : "shared");
          vibrate(haptics.success);
        } catch (err) {
          const name = (err as Error)?.name;
          // Closing the share sheet is a choice, not a failure. NotAllowed: the tap went stale
          // while the picture came down a slow line; it is ready now, one more tap shares it.
          setState(
            name === "AbortError" ? "idle" : name === "NotAllowedError" ? "prepared" : "error",
          );
        }
        return;
      }
      const imageUrl = new URL(cardImagePath(meta.id), window.location.origin).toString();
      const tab = window.open(whatsappUrl(text, imageUrl), "_blank");
      if (tab) {
        tab.opener = null;
        setState("whatsapp");
        return;
      }
      download((await cardFile(meta, lang, msg)).file);
      setState("downloaded");
    } catch (err) {
      setState(err instanceof NotShared ? "not_shared" : navigator.onLine ? "error" : "offline");
    }
  }

  const busy = state === "preparing";
  const status = STATUS[state];
  const Icon =
    state === "shared"
      ? Check
      : state === "whatsapp"
        ? MessageCircle
        : state === "downloaded"
          ? Download
          : state === "offline"
            ? CloudOff
            : state === "error"
              ? RotateCcw
              : Share2;

  return (
    // data-primary: the feedback tab steps aside for the share button and its status line.
    <div
      ref={box}
      className={cn("flex flex-col gap-2", className)}
      data-share-card={cardId}
      data-primary
    >
      <Button
        type="button"
        variant="paper"
        onClick={share}
        disabled={busy || state === "not_shared"}
        aria-busy={busy}
        className="h-auto min-h-14 w-full py-2 leading-tight whitespace-normal"
      >
        {busy ? (
          <ImageIcon aria-hidden className="animate-breathe" />
        ) : (
          <span
            key={state}
            className={cn("inline-flex", state === "shared" && !reduced && "animate-pop")}
          >
            <Icon aria-hidden />
          </span>
        )}
        <Bi k={state === "error" ? "share.retry" : "share.button"} sub={false} />
      </Button>
      <p
        role="status"
        aria-live="polite"
        data-share-state={state}
        className={cn(
          "min-h-5 px-1 text-center text-[15px] leading-snug",
          state === "shared" || state === "ready" ? "font-semibold text-moss" : "text-ink-3",
        )}
      >
        {state === "shared" && (
          // One lamp lights another: Hanate glows once beside the words.
          <Hanate state="happy" size={40} label="" className="mr-1.5 inline-block align-middle" />
        )}
        {status ? (
          <Bi k={status} sub={false} className="inline" />
        ) : (
          <Bi k="share.hint" sub={false} className="inline" />
        )}
      </p>
    </div>
  );
}
