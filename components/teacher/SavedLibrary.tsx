"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BookOpenText, Check, CloudOff, History } from "lucide-react";
import { savedBriefs, type SavedBrief } from "@/app/t/saved/actions";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { EmptyState } from "@/components/parampara/EmptyState";
import {
  RECENT_KEY,
  SAVED_KEY,
  parseIds,
  readMeta,
  writeMeta,
  type AnswerMeta,
} from "@/lib/answers/on-phone";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

// The on device library (DESIGN §8 /t/saved): answers she saved, opening even in airplane mode,
// and below them the last few she opened (F-P1), which open offline too without a Save tap.
// Ids come from AnswerScreen (lib/answers/on-phone); titles are fetched while online and kept in
// the meta store; the service worker is asked to keep each answer page ready (D52).

const noop = () => () => undefined;

function useStoredIds(key: string): string | null {
  // localStorage only exists in the browser: the server renders the skeleton of an empty list.
  return useSyncExternalStore(
    noop,
    () => {
      try {
        return window.localStorage.getItem(key) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => null,
  );
}

export function SavedLibrary() {
  const online = useOnline();
  const savedRaw = useStoredIds(SAVED_KEY);
  const recentRaw = useStoredIds(RECENT_KEY);
  const saved = parseIds(savedRaw);
  const recent = parseIds(recentRaw).filter((id) => !saved.includes(id));
  const all = [...saved, ...recent];
  const allKey = all.join(",");
  const [meta, setMeta] = useState<AnswerMeta>({});
  const [ready, setReady] = useState<Set<string>>(new Set());
  const [kept, setKept] = useState(0);

  useEffect(() => {
    queueMicrotask(() => setMeta(readMeta()));
  }, []);

  // While online: refresh titles, and ask the service worker to keep every listed page ready.
  useEffect(() => {
    if (!online || all.length === 0) return;
    let live = true;
    void savedBriefs(all).then((briefs: SavedBrief[]) => {
      if (!live || briefs.length === 0) return;
      const next = { ...readMeta() };
      for (const b of briefs) next[b.id] = { title: b.title, createdAt: b.createdAt };
      writeMeta(next);
      setMeta(next);
    });
    const worker = navigator.serviceWorker?.controller;
    if (worker) {
      // The worker answers on this channel once the pages are kept; then "Ready offline" shows.
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        if (live) setKept((n) => n + 1);
      };
      worker.postMessage({ type: "CACHE_PAGES", urls: all.map((id) => `/t/a/${id}`) }, [
        channel.port2,
      ]);
    }
    return () => {
      live = false;
    };
    // `all` is derived from the stored lists; re-run only when they or the network change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, allKey]);

  // Which pages the phone already holds (Cache Storage, written by the service worker).
  useEffect(() => {
    if (!("caches" in window) || all.length === 0) return;
    let live = true;
    void Promise.all(all.map(async (id) => ((await caches.match(`/t/a/${id}`)) ? id : null))).then(
      (hits) => {
        if (live) setReady(new Set(hits.filter((h): h is string => h !== null)));
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKey, online, meta, kept]);

  if (savedRaw === null || recentRaw === null)
    return <div className="mt-6 h-40" aria-busy="true" />;
  if (all.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        title="empty.saved.title"
        body="empty.saved.body"
        action={{ label: "empty.saved.action", href: "/t" }}
      />
    );
  }

  return (
    <>
      {!online && ready.size < all.length && (
        <p className="mt-4 rounded-button bg-cream px-4 py-3 text-[16px] text-ink-3">
          <Bi k="pwa.saved.notYet" sub={false} />
        </p>
      )}
      {saved.length > 0 && (
        <ul className="mt-6 flex flex-col gap-3">
          {saved.map((id) => (
            <AnswerRow key={id} id={id} meta={meta} ready={ready} online={online} />
          ))}
        </ul>
      )}
      {recent.length > 0 && (
        <section className="mt-8" aria-labelledby="recent-title" data-testid="saved-recent">
          <h2
            id="recent-title"
            className="flex items-center gap-2 font-display text-[20px] leading-tight font-bold"
          >
            <History className="size-5 text-ink-3" aria-hidden />
            <Bi k="pwa.saved.recent" sub={false} />
          </h2>
          <p className="mt-1 text-base text-ink-3">
            <Bi k="pwa.saved.recentSub" subClassName="text-[14px]" />
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {recent.map((id) => (
              <AnswerRow key={id} id={id} meta={meta} ready={ready} online={online} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function AnswerRow({
  id,
  meta,
  ready,
  online,
}: {
  id: string;
  meta: AnswerMeta;
  ready: Set<string>;
  online: boolean;
}) {
  const m = meta[id];
  const isReady = ready.has(id);
  const reachable = online || isReady;
  return (
    <li>
      {/* A plain link: offline, a full navigation lets the service worker answer. */}
      <a
        href={`/t/a/${id}`}
        aria-disabled={!reachable || undefined}
        className={cn(
          "flex min-h-20 items-center gap-4 rounded-card border border-border bg-paper px-4 py-3 shadow-warm-sm transition-[box-shadow,translate] hover:-translate-y-px hover:shadow-warm",
          !reachable && "opacity-70",
        )}
      >
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-chip bg-sage text-moss"
        >
          <BookOpenText className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[19px] leading-snug font-bold text-ink">
            <BiText
              text={m?.title.kn || m?.title.en ? m.title : "pwa.saved.untitled"}
              subClassName="font-sans text-[15px] font-medium"
            />
          </span>
          <span
            className={cn(
              "mt-1.5 inline-flex items-center gap-1.5 rounded-chip px-2.5 py-0.5 text-[14px] font-semibold",
              isReady ? "bg-sage text-moss" : "bg-cream text-ink-3",
            )}
          >
            {isReady ? (
              <Check className="size-4" strokeWidth={3} aria-hidden />
            ) : (
              <CloudOff className="size-4" aria-hidden />
            )}
            <Bi k={isReady ? "pwa.saved.ready" : "pwa.saved.notReady"} sub={false} />
          </span>
        </span>
      </a>
    </li>
  );
}
