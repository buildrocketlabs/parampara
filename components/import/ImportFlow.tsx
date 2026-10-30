"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  FileAudio,
  GripVertical,
  Plus,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bi } from "@/components/parampara/Bi";
import { SampleBadge } from "@/components/parampara/Badges";
import { BiText } from "@/components/parampara/BiText";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { LampLoader } from "@/components/parampara/LampLoader";
import { AudioPrepError, type PreparedAudio } from "@/lib/audio";
import { otherLang, type MessageKey } from "@/lib/i18n";
import { useLang } from "@/lib/i18n/provider";
import {
  continueImport,
  ImportError,
  prepare,
  startImport,
  type ImportStage,
  type Line,
} from "@/lib/import/client";
import { AUDIO_EXTENSIONS, isOggName, looksLikeAudio } from "@/lib/import/mime";
import {
  orderVoiceNotes,
  parseNoteStamp,
  sameFile,
  stampLabel,
  type OrderBasis,
} from "@/lib/import/order";
import { isConsentPart, type ConsentMode } from "@/lib/import/plan";
import { DONE, type Stage } from "@/lib/stages";
import { haptics, vibrate } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type MasterOption = {
  id: string;
  name: string | null;
  years: number | null;
  district: string | null;
  consented: boolean;
  isSample: boolean;
};

type Running = { stage: ImportStage; done: number; total: number };
type Resume = { interviewId: string; files: Array<{ name: string; size: number }> };

const RESUME_KEY = "parampara.import.resume";
const BIG_PART_BYTES = 50 * 1024 * 1024;

const ERROR_COPY: Record<string, MessageKey> = {
  decode_failed: "import.err.decode",
  unsupported_format: "import.err.decode",
  empty: "import.err.decode",
  too_long: "import.err.too_long",
  ai_not_ready: "import.err.not_ready",
  speech_not_configured: "import.err.not_ready",
  not_configured: "import.err.not_ready",
  files_differ: "import.err.files_differ",
  files_needed: "import.resume.body",
  some_chunks_failed: "import.err.chunks",
  consent_missing: "import.err.consent",
  consent_part_too_large: "import.err.consent_part",
  first_note_alone: "import.err.first_note_alone",
  consent_silent: "import.err.consent_silent",
  opus_unsupported: "import.err.opus",
  sign_in_needed: "import.err.sign_in",
  not_allowed: "import.err.sign_in",
  offline: "import.err.offline",
};

function readResume(): Resume | null {
  try {
    const raw = window.localStorage.getItem(RESUME_KEY);
    return raw ? (JSON.parse(raw) as Resume) : null;
  } catch {
    return null;
  }
}

function writeResume(r: Resume | null) {
  try {
    if (r) window.localStorage.setItem(RESUME_KEY, JSON.stringify(r));
    else window.localStorage.removeItem(RESUME_KEY);
  } catch {
    // Private mode: resume works only while the page stays open.
  }
}

function clock(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

const fileKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

/**
 * Each note's length, read from the file's own header by the browser (no decoding, nothing sent).
 * A browser that cannot read a format (Safari and some Ogg notes) leaves it out; the size is shown.
 */
function useNoteLengths(files: File[]): Map<string, number> {
  const [lengths, setLengths] = useState<Map<string, number>>(new Map());
  const asked = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    for (const f of files) {
      const key = fileKey(f);
      if (asked.current.has(key)) continue;
      asked.current.add(key);
      const url = URL.createObjectURL(f);
      const audio = new Audio();
      audio.preload = "metadata";
      const done = (ms: number | null) => {
        URL.revokeObjectURL(url);
        audio.removeAttribute("src");
        if (mounted.current && ms !== null) setLengths((prev) => new Map(prev).set(key, ms));
      };
      audio.onloadedmetadata = () =>
        done(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : null);
      audio.onerror = () => done(null);
      audio.src = url;
    }
  }, [files]);
  return lengths;
}

/** WhatsApp's .opus and .amr are not "audio/*" everywhere, so the picker names them too. */
const ACCEPT = ["audio/*", "audio/ogg", "audio/opus", "video/mp4", "video/webm"]
  .concat(AUDIO_EXTENSIONS.map((e) => `.${e}`))
  .join(",");

const CONSENT_MODES = ["in_recording", "separate_clip", "recorded_earlier"] as const;

export function ImportFlow(props: {
  masters: MasterOption[];
  fixture: boolean;
  maxMs: number;
  canAddMaster: boolean;
  isSampleSession: boolean;
}) {
  const { t, say, lang } = useLang();
  const [masters, setMasters] = useState(props.masters);
  const [masterId, setMasterId] = useState<string | null>(
    props.masters.length === 1 ? props.masters[0]!.id : null,
  );
  const [adding, setAdding] = useState(props.masters.length === 0 && props.canAddMaster);
  const [consent, setConsent] = useState<ConsentMode | null>(null);
  const [consentClip, setConsentClip] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState<Running | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [stored, setStored] = useState<number[]>([]);
  const [plan, setPlan] = useState<PreparedAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [welfare, setWelfare] = useState(0);
  // How the notes came to be in this order, said under the list (F-A1).
  const [basis, setBasis] = useState<OrderBasis | "manual" | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const [errorPart, setErrorPart] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [sent, setSent] = useState(false);
  // Once the notes are ready (or the cards are), steps 1 to 3 fold into one line until "Change".
  const [editing, setEditing] = useState(false);
  const lengths = useNoteLengths(files);
  const resultRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const preparedRef = useRef<PreparedAudio | null>(null);
  const interviewRef = useRef<string | null>(null);

  useEffect(() => {
    // Reading storage after mount keeps server and first client render identical.
    const r = readResume();
    if (r) queueMicrotask(() => setResume(r));
    const sync = () => setOnline(navigator.onLine);
    queueMicrotask(sync);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      abortRef.current?.abort();
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const master = masters.find((m) => m.id === masterId) ?? null;
  // "The first note is the consent" needs a second note; with one file the choice is not offered.
  const consentMode: ConsentMode | null =
    consent === "first_note" && files.length < 2 ? null : consent;
  const consentModes: readonly ConsentMode[] =
    files.length > 1 ? ["first_note", ...CONSENT_MODES] : CONSENT_MODES;
  const busy =
    running !== null && running.stage !== "done" && running.stage !== "attention" && !error;
  // What still stands between the reviewer and Begin, said plainly under the button.
  const waitingFor: MessageKey | null = resume
    ? files.length === 0
      ? "import.why.files"
      : null
    : !master
      ? "import.why.master"
      : !consentMode || (consentMode === "recorded_earlier" && !master.consented)
        ? "import.why.consent"
        : consentMode === "separate_clip" && !consentClip
          ? "import.why.clip"
          : files.length === 0
            ? "import.why.files"
            : null;
  const canBegin = !busy && waitingFor === null;
  const runRef = useRef<HTMLDivElement | null>(null);

  const events = {
    stage: (stage: ImportStage, detail: { done: number; total: number }) => {
      if (stage === "done") vibrate(haptics.success);
      setRunning({ stage, ...detail });
    },
    lines: (more: Line[]) => setLines((prev) => [...prev, ...more].slice(-6)),
    interview: (id: string) => {
      interviewRef.current = id;
      setSent(true);
      const r = { interviewId: id, files: files.map((f) => ({ name: f.name, size: f.size })) };
      writeResume(r);
    },
    partStored: (n: number) => setStored((prev) => (prev.includes(n) ? prev : [...prev, n])),
    welfare: (n: number) => setWelfare(n),
  };

  async function begin() {
    setError(null);
    setErrorPart(null);
    setLines([]);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setRunning({ stage: "preparing", done: 0, total: files.length });
      const prepared = preparedRef.current ?? (await prepare(files, events, props.maxMs));
      preparedRef.current = prepared;
      if (props.fixture) {
        setPlan(prepared);
        setRunning(null);
        return;
      }
      const resumeId = interviewRef.current ?? resume?.interviewId ?? null;
      if (resumeId) {
        if (resume && !sameFiles(resume, files)) throw new ImportError("files_differ");
        interviewRef.current = resumeId;
        await continueImport({
          interviewId: resumeId,
          prepared,
          events,
          signal: controller.signal,
          files,
        });
      } else {
        await startImport({
          masterId: master!.id,
          files,
          prepared,
          consent: { mode: consentMode!, clip: consentClip ?? undefined },
          events,
          signal: controller.signal,
        });
      }
      writeResume(null);
    } catch (err) {
      const offline =
        err instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
      const failedFile = err instanceof AudioPrepError ? files[err.part ?? 0] : undefined;
      if (err instanceof AudioPrepError && files.length > 1) setErrorPart(err.part ?? null);
      const code =
        err instanceof AudioPrepError
          ? // Safari before 18.4 cannot read WhatsApp's Ogg notes: say so, and name Chrome.
            err.kind === "unsupported_format" && failedFile && isOggName(failedFile)
            ? "opus_unsupported"
            : err.kind
          : err instanceof ImportError
            ? err.code
            : offline
              ? "offline"
              : "generic";
      setError(code);
    }
  }

  async function skipFailed() {
    if (!interviewRef.current) return;
    await fetch(`/api/interviews/${interviewRef.current}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skipFailedChunks: true }),
    });
    await begin();
  }

  function changed() {
    setEditing(false);
    preparedRef.current = null;
    setPlan(null);
    setErrorPart(null);
    if (!interviewRef.current) {
      // Nothing sent yet: a decoding error is about the old list, so the run card goes away.
      setError(null);
      setRunning(null);
    }
  }

  function chooseFiles(list: FileList | null) {
    if (!list?.length) return;
    // Copy now: the input is cleared right after this call and its FileList empties with it.
    const picked = Array.from(list);
    const audio = picked.filter(looksLikeAudio);
    setSkipped(picked.length - audio.length);
    const fresh = audio.filter((f) => !files.some((p) => sameFile(p, f)));
    if (fresh.length === 0) return;
    changed();
    const all = [...files, ...fresh];
    if (resume) {
      // Resuming: the order is the one the server already holds, whatever WhatsApp's names say.
      const at = (f: File) => {
        const i = resume.files.findIndex((r) => r.name === f.name && r.size === f.size);
        return i < 0 ? Number.MAX_SAFE_INTEGER : i;
      };
      setFiles([...all].sort((a, b) => at(a) - at(b)));
      setBasis(null);
      return;
    }
    if (basis === "manual") {
      // The reviewer has set the order by hand: keep it, and add the new ones at the end.
      setFiles(all);
      return;
    }
    const ordered = orderVoiceNotes(all);
    setFiles(ordered.files);
    setBasis(all.length > 1 ? ordered.basis : null);
  }

  function moveTo(from: number, to: number) {
    if (from === to || to < 0 || to >= files.length) return;
    changed();
    const next = [...files];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setFiles(next);
    setBasis("manual");
    setAnnounce(say(lang, "import.files.moved", { n: to + 1 }));
  }

  function remove(i: number) {
    changed();
    setFiles((prev) => prev.filter((_, j) => j !== i));
  }

  const showRun = running !== null || error !== null;
  // In Sample mode the prepare step is quick and nothing is sent, so the form stays in place. A
  // note that could not be read is fixed in the list, so the form comes back before anything is sent.
  const hideForm = showRun && !props.fixture && !(error && !sent && !resume);
  useEffect(() => {
    // The run is now the page's one job: bring it into view and give it focus for screen readers.
    if (showRun) runRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [showRun]);
  const ready = (plan !== null && props.fixture) || running?.stage === "done";
  const folded = ready && !editing && files.length > 0;
  useEffect(() => {
    // Ready: the result is the page's one job now, so bring it into view.
    if (!ready) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (resultRef.current ?? runRef.current)?.scrollIntoView({
      block: "start",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [ready]);

  return (
    <div className="mt-8 space-y-5">
      {props.fixture && (
        <p role="note" className="rounded-card bg-sage px-5 py-4 text-base font-semibold text-ink">
          <Bi k="import.fixture" subClassName="text-[15px] font-normal" />
        </p>
      )}
      {props.isSampleSession && !props.fixture && !showRun && (
        <p className="flex items-center gap-2 text-base text-ink-3">
          <SampleBadge />
          <BiText
            text="import.sample_cap"
            vars={{ n: Math.round(props.maxMs / 60_000) }}
            sub={false}
            inline
          />
        </p>
      )}

      {folded && (
        <ReadySummary
          files={files}
          masterName={master?.name ?? null}
          consent={consentMode}
          onChange={props.fixture ? () => setEditing(true) : undefined}
        />
      )}

      {showRun && (
        <div ref={runRef} tabIndex={-1} className="scroll-mt-6 space-y-3 outline-none">
          {!folded && (
            <p className="text-base text-ink-3">
              {master?.name && <span>{master.name} · </span>}
              {files.length > 1 ? (
                <BiText text="import.files.count" vars={{ n: files.length }} sub={false} inline />
              ) : (
                files[0]?.name
              )}
            </p>
          )}
          <RunCard
            running={running}
            lines={lines}
            error={error}
            errorFile={
              errorPart !== null && files[errorPart]
                ? { n: errorPart + 1, total: files.length, name: files[errorPart].name }
                : null
            }
            consentNote={
              (consentMode === "first_note" || consentMode === "in_recording") && !master?.consented
                ? stored.includes(0)
                  ? "saved"
                  : "saving"
                : null
            }
            storedParts={stored.length}
            welfare={welfare}
            onRetry={begin}
            canRetry={canBegin}
            onSkip={error === "some_chunks_failed" ? skipFailed : undefined}
          />
        </div>
      )}

      {resume && !showRun && (
        <section className="rounded-card border border-border bg-paper p-6 shadow-warm">
          <h2 className="text-[22px] font-bold">
            <Bi k="import.resume.title" subClassName="font-sans text-base font-semibold" />
          </h2>
          <p className="mt-2 text-base text-ink-3">
            <Bi k="import.resume.body" />
          </p>
          <ul className="mt-3 space-y-1 text-[15px] text-ink-3">
            {resume.files.map((f) => (
              <li key={f.name}>
                {f.name} · {megabytes(f.size)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hideForm && !folded && (
        <StepCard n={1} title="import.files.title" index={1}>
          <p className="text-lg text-ink-3">
            <Bi k="import.files.hint" subClassName="text-base" />
          </p>
          {files.length > 1 && basis && (
            // Said before the rows, so the reviewer knows how to read the order.
            <p className="mt-4 text-base text-ink-3" data-testid="import-order-basis">
              <Bi k={`import.files.order.${basis}`} sub={false} />
            </p>
          )}
          {files.length > 0 && (
            <ol className="mt-3 space-y-2" data-testid="import-file-list">
              {files.map((f, i) => {
                const isConsent = isConsentPart(consentMode, i, files.length);
                const stamp = parseNoteStamp(f.name);
                const canDrag = !busy && files.length > 1;
                return (
                  <li
                    key={`${f.name}-${f.size}-${f.lastModified}`}
                    data-testid="import-file"
                    data-name={f.name}
                    data-consent={isConsent || undefined}
                    draggable={canDrag}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(i));
                      setDrag({ from: i, over: i });
                    }}
                    onDragOver={(e) => {
                      if (!canDrag) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (drag && drag.over !== i) setDrag({ ...drag, over: i });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      // The source travels with the drag itself, not only in React state.
                      const from = Number(e.dataTransfer.getData("text/plain"));
                      if (Number.isInteger(from)) moveTo(from, i);
                      setDrag(null);
                    }}
                    onDragEnd={() => setDrag(null)}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-button border bg-cream px-4 py-3 transition-[box-shadow,opacity] duration-150 motion-reduce:transition-none",
                      isConsent ? "border-moss" : "border-border",
                      canDrag && "pointer-fine:cursor-grab pointer-fine:active:cursor-grabbing",
                      drag?.from === i && "opacity-50",
                      drag && drag.over === i && drag.from !== i && "shadow-flame",
                      errorPart === i && "border-clay-cta shadow-flame",
                    )}
                  >
                    {canDrag && (
                      <GripVertical
                        aria-hidden
                        className="-mx-1 hidden size-5 shrink-0 text-ink-3 pointer-fine:block"
                      />
                    )}
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-chip font-display font-bold",
                        isConsent ? "bg-moss text-white" : "bg-flame",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      {isConsent && (
                        <span
                          className="mb-1 inline-flex items-center gap-1.5 rounded-chip bg-moss/15 px-2.5 py-0.5 text-sm font-bold text-moss"
                          data-testid="import-consent-tag"
                        >
                          <ShieldCheck className="size-4" aria-hidden />
                          {/* Both words at once, the page's language first: the reviewer and a
                              juror must both see at a glance which note holds the consent. */}
                          <span lang={lang}>{say(lang, "import.files.consent_tag")}</span>
                          <span aria-hidden>·</span>
                          <span lang={otherLang(lang)}>
                            {say(otherLang(lang), "import.files.consent_tag")}
                          </span>
                        </span>
                      )}
                      {stamp ? (
                        // A WhatsApp note is known by when it was sent and how long it is; its file
                        // name is only for finding it on the phone.
                        <>
                          <span className="block text-base leading-snug font-semibold tabular-nums">
                            {stampLabel(stamp)}
                            {" · "}
                            {lengths.has(fileKey(f))
                              ? clock(lengths.get(fileKey(f))!)
                              : megabytes(f.size)}
                          </span>
                          <span className="line-clamp-2 block text-sm leading-snug break-all text-ink-3 tabular-nums">
                            {f.name}
                            {lengths.has(fileKey(f)) && ` · ${megabytes(f.size)}`}
                          </span>
                        </>
                      ) : (
                        <>
                          {/* A plain recording's name is what the reviewer knows it by. */}
                          <span className="line-clamp-2 block text-sm leading-snug font-semibold break-all tabular-nums sm:text-base">
                            {f.name}
                          </span>
                          <span className="text-sm text-ink-3 tabular-nums">
                            {lengths.has(fileKey(f)) && `${clock(lengths.get(fileKey(f))!)} · `}
                            {megabytes(f.size)}
                          </span>
                        </>
                      )}
                      {isConsent && (
                        <span className="mt-1 block text-[15px] leading-snug text-ink-3">
                          <Bi k="import.files.consent_note" sub={false} />
                        </span>
                      )}
                      {f.size > BIG_PART_BYTES && (
                        <span className="mt-1 block text-sm text-ink-3">
                          <Bi k="import.files.big" sub={false} />
                        </span>
                      )}
                    </span>
                    {!busy && (
                      <span
                        className={cn(
                          "flex gap-2",
                          files.length > 1 ? "w-full justify-end sm:w-auto" : "ml-auto",
                        )}
                      >
                        {files.length > 1 && (
                          <>
                            <IconButton
                              label={`${t("import.files.up")} · ${f.name}`}
                              onClick={() => moveTo(i, i - 1)}
                              disabled={i === 0}
                            >
                              <ArrowUp className="size-5" />
                            </IconButton>
                            <IconButton
                              label={`${t("import.files.down")} · ${f.name}`}
                              onClick={() => moveTo(i, i + 1)}
                              disabled={i === files.length - 1}
                            >
                              <ArrowDown className="size-5" />
                            </IconButton>
                          </>
                        )}
                        <IconButton
                          label={`${t("import.files.remove")} · ${f.name}`}
                          onClick={() => remove(i)}
                        >
                          <X className="size-5" />
                        </IconButton>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
          {skipped > 0 && (
            <p className="mt-2 text-base text-ink-3" role="status">
              <BiText text="import.files.skipped" vars={{ n: skipped }} sub={false} inline />
            </p>
          )}
          {!busy && (
            <label
              className={cn(
                "mt-4 flex min-h-14 cursor-pointer items-center justify-center gap-3 px-4 font-display text-lg font-bold focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-clay",
                files.length === 0
                  ? "rounded-button bg-clay-cta py-4 text-white lip-clay active:translate-y-1 active:shadow-none"
                  : "rounded-card border-2 border-dashed border-moss bg-cream py-5 text-ink hover:border-clay",
              )}
            >
              <FileAudio
                className={cn("size-6", files.length === 0 ? "text-white" : "text-clay")}
                aria-hidden
              />
              <Bi k={files.length ? "import.files.more" : "import.files.choose"} sub={false} />
              <input
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                data-testid="import-files"
                onChange={(e) => {
                  chooseFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </StepCard>
      )}
      {!resume && !hideForm && !folded && (
        <StepCard n={2} title="import.who.title" index={2}>
          {masters.length === 0 && !adding && (
            <p className="text-base text-ink-3">
              <Bi k="import.who.none" />
            </p>
          )}
          <div
            role="radiogroup"
            aria-label={t("import.who.title")}
            className="grid gap-3 sm:grid-cols-2"
          >
            {masters.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={m.id === masterId}
                disabled={busy}
                onClick={() => setMasterId(m.id)}
                className={cn(
                  "flex min-h-16 items-center gap-4 rounded-card border p-4 text-left transition-[box-shadow,translate] duration-150 active:translate-y-px",
                  m.id === masterId
                    ? "border-clay bg-paper shadow-flame"
                    : "border-border bg-paper hover:shadow-warm",
                )}
              >
                <span
                  aria-hidden
                  className="grid size-12 shrink-0 place-items-center rounded-chip bg-clay font-display text-xl font-bold text-white"
                >
                  {(m.name ?? "?").slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg font-bold">
                    {m.name ?? ""}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[15px] text-ink-3">
                    {m.years != null && (
                      <span>
                        {m.years} <Bi k="import.who.years" sub={false} className="inline" />
                      </span>
                    )}
                    {m.district && <span>{m.district}</span>}
                    {m.isSample && <SampleBadge />}
                  </span>
                  {m.consented && (
                    <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-moss">
                      <Check className="size-4" aria-hidden />
                      <Bi k="import.who.consented" sub={false} className="inline" />
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {props.canAddMaster && !adding && (
            <Button
              variant="paper"
              size="md"
              className="mt-4"
              onClick={() => setAdding(true)}
              disabled={busy}
            >
              <Plus aria-hidden />
              <Bi k="import.who.add" sub={false} />
            </Button>
          )}
          {adding && (
            <AddMasterForm
              onCancel={masters.length ? () => setAdding(false) : undefined}
              onSaved={(m) => {
                setMasters((prev) => [m, ...prev]);
                setMasterId(m.id);
                setAdding(false);
              }}
              isSample={props.isSampleSession}
              fixture={props.fixture}
            />
          )}
        </StepCard>
      )}

      {!resume && !hideForm && !folded && (
        <StepCard n={3} title="import.consent.title" index={3}>
          <div role="radiogroup" aria-label={t("import.consent.title")} className="space-y-2">
            {consentModes.map((mode) => {
              const unavailable = mode === "recorded_earlier" && !master?.consented;
              const on = consentMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={busy || unavailable}
                  onClick={() => {
                    setConsent(mode);
                    changed();
                  }}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-button border px-4 py-3 text-left text-base font-semibold disabled:opacity-50",
                    on ? "border-clay bg-paper shadow-warm-sm" : "border-border bg-paper",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-chip border-2",
                      on ? "border-clay-cta bg-clay-cta" : "border-ink-3",
                    )}
                  >
                    {on && <span className="size-2 rounded-chip bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Bi k={`import.consent.${mode}`} subClassName="text-[15px] font-normal" />
                  </span>
                </button>
              );
            })}
          </div>
          {consentMode === "separate_clip" && (
            <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-button border border-dashed border-ink-3 bg-cream px-4 py-3 text-base font-semibold">
              <FileAudio className="size-5 text-clay" aria-hidden />
              {consentClip ? consentClip.name : <Bi k="import.consent.clip" sub={false} />}
              <input
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => setConsentClip(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
          <p id="import-consent-line" className="mt-5 text-base font-semibold text-ink">
            <Bi k="import.consent.line" subClassName="text-[15px] font-normal text-ink-3" />
          </p>
          <details
            className="group mt-2 rounded-button border border-border bg-cream text-[15px] text-ink-3"
            aria-labelledby="import-consent-line"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 font-semibold text-ink">
              <Bi k="import.consent.line_show" sub={false} className="inline" />
              <ChevronDown
                className="ml-auto size-5 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p lang="kn" className="px-4 pb-4 text-base leading-[1.65]">
              ನನ್ನ ಹೆಸರು ______. ನಾನು ______ ಶಾಲೆಯಲ್ಲಿ ______ ವರ್ಷ ಪಾಠ ಮಾಡಿದ್ದೇನೆ. ಪರಂಪರೆಯ ತಂಡವು
              ನನ್ನ ಬೋಧನಾ ಅನುಭವಗಳನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡಲು ಮತ್ತು ನನ್ನ ಹೆಸರಿನೊಂದಿಗೆ ಇತರ ಶಿಕ್ಷಕರ ಜೊತೆ
              ಹಂಚಿಕೊಳ್ಳಲು ನಾನು ಒಪ್ಪಿಗೆ ನೀಡುತ್ತೇನೆ. ಮಕ್ಕಳ ಹೆಸರುಗಳನ್ನು ನಾನು ಹೇಳುವುದಿಲ್ಲ. ಯಾವಾಗ ಬೇಕಾದರೂ
              ನಾನು ಈ ಒಪ್ಪಿಗೆಯನ್ನು ಹಿಂಪಡೆಯಬಹುದು ಎಂದು ನನಗೆ ತಿಳಿದಿದೆ.
            </p>
          </details>
        </StepCard>
      )}

      {plan && (
        <section
          ref={resultRef}
          className="rise scroll-mt-6 rounded-card bg-paper p-6 shadow-warm"
          data-testid="import-plan"
          data-parts={plan.parts.length}
          data-chunks={plan.chunks.length}
          data-consent-end-ms={consentMode === "first_note" ? plan.parts[0]?.endMs : undefined}
        >
          <div className="flex items-center gap-4">
            <Hanate state="happy" size={64} label="" />
            <div>
              <p className="flex items-center gap-2 font-display text-xl font-bold text-moss">
                <Check className="size-6" aria-hidden />
                <Bi k="import.plan" sub={false} />
              </p>
              <p className="mt-2 text-lg tabular-nums">
                {/* The length in words: "16:30" reads as a clock time to a headmaster (design review). */}
                <BiText
                  text={
                    Math.round(plan.durationMs / 1000) % 60
                      ? "import.len.min_sec"
                      : "import.len.min"
                  }
                  vars={{
                    m: Math.floor(Math.round(plan.durationMs / 1000) / 60),
                    s: Math.round(plan.durationMs / 1000) % 60,
                  }}
                  sub={false}
                  inline
                />
                {plan.parts.length > 1 && (
                  <>
                    {" · "}
                    <BiText
                      text="import.files.count"
                      vars={{ n: plan.parts.length }}
                      sub={false}
                      inline
                    />
                  </>
                )}
              </p>
            </div>
          </div>
          {plan.parts.length > 1 && (
            // One timeline: each note's place on it, so the reviewer sees the order really held.
            <ol className="mt-4 grid gap-1.5 sm:grid-cols-2" aria-label={t("import.files.title")}>
              {plan.parts.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-button bg-cream px-3 py-2 text-base tabular-nums"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-chip text-sm font-bold",
                      isConsentPart(consentMode, i, plan.parts.length)
                        ? "bg-moss text-white"
                        : "bg-flame",
                    )}
                  >
                    {i + 1}
                  </span>
                  {/* Its place on the one timeline, start to end. */}
                  <span className="font-semibold">
                    {clock(p.startMs)} → {clock(p.endMs)}
                  </span>
                  {isConsentPart(consentMode, i, plan.parts.length) && (
                    <span className="ml-auto text-sm font-bold text-moss">
                      <Bi k="import.files.consent_tag" sub={false} />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {plan && props.fixture ? (
        <div className="space-y-3">
          <p className="text-base text-ink-3">
            <Bi k="import.fixture.next" subClassName="text-[15px]" />
          </p>
          <Button asChild className="w-full">
            <Link href="/r/cards">
              <Bi k="import.fixture.see_cards" sub={false} />
            </Link>
          </Button>
        </div>
      ) : running?.stage === "done" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/r/cards">
              <Bi k="import.done.review" sub={false} />
            </Link>
          </Button>
          <Button
            variant="paper"
            className="w-full sm:w-auto"
            onClick={() => window.location.reload()}
          >
            <Bi k="import.again" sub={false} />
          </Button>
        </div>
      ) : (
        !busy &&
        !error && (
          <div className="sticky bottom-0 z-10 -mx-5 space-y-1 bg-cream px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] shadow-warm-lg sm:mx-0 sm:rounded-card sm:px-3">
            {!online && !props.fixture && (
              <p
                role="status"
                className="flex items-start gap-2 px-1 pb-1 text-base font-semibold text-ink-3"
              >
                <WifiOff className="mt-0.5 size-5 shrink-0" aria-hidden />
                <Bi k="import.offline" sub={false} />
              </p>
            )}
            <Button
              className="w-full"
              disabled={!canBegin}
              onClick={begin}
              data-testid="import-begin"
            >
              <Bi k="import.begin" sub={false} />
            </Button>
            {waitingFor && (
              <button
                type="button"
                aria-live="polite"
                onClick={() => {
                  // Step cards: 1 the recording, 2 whose wisdom, 3 consent.
                  const step =
                    waitingFor === "import.why.files"
                      ? 1
                      : waitingFor === "import.why.master"
                        ? 2
                        : 3;
                  const el = document.getElementById(`import-step-${step}`);
                  el?.scrollIntoView({ block: "center", behavior: "smooth" });
                  el?.focus({ preventScroll: true });
                }}
                className="flex min-h-12 w-full items-center justify-center gap-1 rounded-button text-base font-semibold text-ink-3 underline-offset-4 hover:underline"
              >
                <Bi k={waitingFor} sub={false} />
                <ArrowDown className="size-4" aria-hidden />
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}

function sameFiles(r: Resume, files: File[]): boolean {
  return (
    r.files.length === files.length &&
    r.files.every((f, i) => f.name === files[i]!.name && f.size === files[i]!.size)
  );
}

/** Steps 1 to 3 folded into one line once the notes are ready: what, whose, and the consent. */
function ReadySummary(props: {
  files: File[];
  masterName: string | null;
  consent: ConsentMode | null;
  onChange?: () => void;
}) {
  return (
    <section
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-border bg-paper px-5 py-3 shadow-warm-sm"
      data-testid="import-summary"
    >
      <Check className="size-5 shrink-0 text-moss" aria-hidden />
      <p className="min-w-0 flex-1 text-base leading-snug text-ink">
        <span className="font-semibold">
          {props.files.length > 1 ? (
            <BiText text="import.files.count" vars={{ n: props.files.length }} sub={false} inline />
          ) : (
            <span className="break-all">{props.files[0]?.name}</span>
          )}
        </span>
        {props.masterName && <span> · {props.masterName}</span>}
        {props.consent && (
          <span className="text-ink-3">
            {" · "}
            <Bi k={`import.consent.${props.consent}`} sub={false} className="inline" />
          </span>
        )}
      </p>
      {props.onChange && (
        <Button variant="paper" size="md" onClick={props.onChange} data-testid="import-change">
          <Bi k="import.change" sub={false} />
        </Button>
      )}
    </section>
  );
}

function StepCard({
  n,
  title,
  index = 0,
  children,
}: {
  n: number;
  title: MessageKey;
  index?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`import-step-${n}`}
      tabIndex={-1}
      className="rise scroll-mt-6 rounded-card border border-border bg-paper p-5 shadow-warm outline-none focus-visible:shadow-flame sm:p-6"
      style={{ "--i": index } as React.CSSProperties}
    >
      <h2 className="mb-4 flex items-start gap-3 text-[22px] leading-snug font-bold">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-chip bg-flame font-display text-lg font-extrabold"
        >
          {n}
        </span>
        <span className="min-w-0 pt-1">
          <Bi k={title} subClassName="font-sans text-base font-semibold" />
        </span>
      </h2>
      {children}
    </section>
  );
}

function IconButton({
  label,
  children,
  ...rest
}: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid size-12 place-items-center rounded-button text-ink-3 hover:bg-sage disabled:opacity-30"
      {...rest}
    >
      {children}
    </button>
  );
}

// The pipeline's real stages. Uploading the originals and hiding children's names happen alongside
// listening, so they are shown as notes, not as stages that would pretend to run in turn.
const RUN_STAGES = [
  { key: "reading", label: "stage.import.reading" },
  { key: "transcribing", label: "stage.import.transcribing" },
  { key: "extracting", label: "stage.import.extracting" },
] as const satisfies readonly Stage[];
const STAGE_KEY: Record<ImportStage, string> = {
  preparing: "reading",
  listening: "transcribing",
  reading: "extracting",
  done: DONE,
  attention: "extracting",
};

function RunCard(props: {
  running: Running | null;
  lines: Line[];
  error: string | null;
  /** Which note could not be read, when there are several. */
  errorFile?: { n: number; total: number; name: string } | null;
  /** The consent is in the first part and not yet on record: say whether its audio is stored. */
  consentNote?: "saving" | "saved" | null;
  storedParts: number;
  welfare?: number;
  onRetry: () => void;
  /** False while something still stands between the reviewer and a new try (files, master). */
  canRetry: boolean;
  onSkip?: () => void;
}) {
  const { running, lines, error } = props;
  const current = running?.stage ?? "preparing";
  const known = running && running.total > 0;
  const progress = known ? Math.min(1, running.done / running.total) : undefined;
  const detail =
    known && current === "preparing" && running.total > 1 ? (
      // Notes are read one at a time; the bar moves a note at a time and says which.
      <BiText
        text="import.detail.notes"
        vars={{ n: Math.min(running.done + 1, running.total), total: running.total }}
        sub={false}
        inline
      />
    ) : known && current === "listening" ? (
      <BiText
        text="import.detail.pieces"
        vars={{ n: running.done, total: running.total }}
        sub={false}
        inline
      />
    ) : known && current === "reading" ? (
      <BiText
        text="loader.part"
        vars={{ n: Math.min(running.done + 1, running.total), total: running.total }}
        sub={false}
        inline
      />
    ) : undefined;

  return (
    <section
      className="rounded-card border border-border bg-paper p-5 shadow-warm-lg sm:p-8"
      data-testid="import-run"
    >
      {!error && current !== "done" && (
        // Said first and plainly: closing the page is the one thing that stops the work.
        <p
          className="mb-5 flex items-start gap-3 rounded-button bg-flame/20 px-4 py-3 text-lg leading-snug font-semibold text-ink"
          data-testid="import-keep-open"
        >
          <Smartphone className="mt-0.5 size-6 shrink-0 text-clay" aria-hidden />
          <span className="min-w-0">
            <Bi k="import.keep_open" subClassName="text-base font-normal text-ink-3" />
          </span>
        </p>
      )}
      {error ? (
        <div className="flex flex-col items-center text-center" role="alert">
          <Hanate state="caring" size={112} label="" />
          <p className="mt-4 max-w-md text-lg font-semibold">
            <Bi
              k={ERROR_COPY[error] ?? "import.err.generic"}
              subClassName="text-base font-normal"
            />
          </p>
          {props.errorFile && (
            <div className="mt-2 max-w-md text-ink-3" data-testid="import-error-part">
              <p className="text-base">
                <BiText
                  text="import.err.part"
                  vars={{ n: props.errorFile.n, total: props.errorFile.total }}
                  sub={false}
                  inline
                />
              </p>
              {/* The file's own name, small: a master knows the note by its place, not its name. */}
              <p className="mt-1 font-mono text-sm break-all text-mist">{props.errorFile.name}</p>
            </div>
          )}
          {/* The way on sits right under what went wrong. */}
          <div className="mt-5 flex w-full max-w-sm flex-col gap-3">
            <Button
              className="w-full"
              onClick={props.onRetry}
              disabled={!props.canRetry}
              data-testid="import-retry"
            >
              <Bi k="import.retry" sub={false} />
            </Button>
            {props.onSkip && (
              <Button variant="paper" size="md" className="w-full" onClick={props.onSkip}>
                <Bi k="import.skip_failed" sub={false} />
              </Button>
            )}
          </div>
        </div>
      ) : current === "done" && running ? (
        <div className="flex flex-col items-center text-center">
          <Hanate state="happy" size={112} label="" />
          <p className="mt-3 font-display text-[44px] leading-none font-extrabold text-clay">
            {running.total}
          </p>
          <p className="mt-1 font-display text-[24px] font-bold">
            <Bi k="import.stage.done" subClassName="font-sans text-base font-semibold" />
          </p>
          <p className="mt-2 max-w-md text-base text-ink-3">
            <Bi k="import.done.body" />
          </p>
        </div>
      ) : (
        <LampLoader
          stages={RUN_STAGES}
          current={STAGE_KEY[current]}
          progress={progress}
          detail={detail}
          tone={current === "attention" ? "caring" : "default"}
        />
      )}

      {lines.length > 0 && (
        <div className="mt-6 rounded-card bg-ink p-5 text-white" aria-live="polite">
          <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-mist">
            <Bi k="import.heard" sub={false} />
            <Bi k="import.heard.note" sub={false} className="font-normal" />
          </p>
          <ul className="mt-3 space-y-3">
            {lines.map((l, i) => (
              <li key={`${l.startMs}-${i}`} className="rise">
                <span className="mr-2 text-sm text-mist tabular-nums">{clock(l.startMs)}</span>
                <span lang="kn" className="text-lg leading-[1.65]">
                  {l.kn}
                </span>
                {l.en && <span className="mt-0.5 block text-[15px] text-mist">{l.en}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {current === "done" && (props.welfare ?? 0) > 0 && (
        <p
          role="note"
          className="mt-4 flex items-start gap-3 rounded-button bg-flame/25 px-4 py-3 text-base font-semibold"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <BiText
            text="import.welfare"
            vars={{ n: props.welfare ?? 0 }}
            subClassName="text-[15px] font-normal"
          />
        </p>
      )}
      {props.consentNote && !error && current !== "preparing" && (
        // D53: the consent counts only once its audio is stored, so say which it is.
        <p
          className={cn(
            "mt-2 flex items-center gap-2 text-[15px] font-semibold",
            props.consentNote === "saved" ? "text-moss" : "text-ink-3",
          )}
          data-testid="import-consent-status"
        >
          {props.consentNote === "saved" ? (
            <ShieldCheck className="size-4" aria-hidden />
          ) : (
            <span
              aria-hidden
              className="size-2 animate-pulse rounded-chip bg-ink-3 motion-reduce:animate-none"
            />
          )}
          <Bi
            k={props.consentNote === "saved" ? "import.consent.saved" : "import.consent.saving"}
            sub={false}
          />
        </p>
      )}
      {props.storedParts > 0 && (
        <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-moss">
          <Check className="size-4" aria-hidden />
          <Bi k="import.part_saved" sub={false} />
        </p>
      )}
    </section>
  );
}

function AddMasterForm(props: {
  onSaved: (m: MasterOption) => void;
  onCancel?: () => void;
  isSample: boolean;
  fixture: boolean;
}) {
  const { t } = useLang();
  const [show, setShow] = useState<"full" | "first" | "anon">("first");
  const [voice, setVoice] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save(form: FormData) {
    setSaving(true);
    setFailed(false);
    const body = {
      displayName: String(form.get("name") ?? ""),
      school: String(form.get("school") ?? "") || undefined,
      years: form.get("years") ? Number(form.get("years")) : undefined,
      classes: String(form.get("classes") ?? "") || undefined,
      district: String(form.get("district") ?? "") || undefined,
      showName: show,
      voicePublic: voice,
    };
    try {
      const id = props.fixture
        ? crypto.randomUUID()
        : (
            (await (
              await fetch("/api/masters", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              })
            ).json()) as { masterId?: string }
          ).masterId;
      if (!id) throw new Error("save");
      props.onSaved({
        id,
        name: body.displayName,
        years: body.years ?? null,
        district: body.district ?? null,
        consented: false,
        isSample: props.isSample || props.fixture,
      });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const field =
    "mt-1 h-12 w-full rounded-button border border-input bg-paper px-4 text-lg outline-none focus:border-clay focus:shadow-flame";
  return (
    <form action={save} className="mt-4 grid gap-4 rounded-card bg-cream p-5 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="font-semibold">
          <Bi k="import.form.name" sub={false} />
        </span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          className={field}
        />
      </label>
      <label>
        <span className="font-semibold">
          <Bi k="import.form.school" sub={false} />
        </span>
        <input name="school" maxLength={120} className={field} />
      </label>
      <label>
        <span className="font-semibold">
          <Bi k="import.form.district" sub={false} />
        </span>
        <input name="district" maxLength={60} defaultValue="Koppal" className={field} />
      </label>
      <label>
        <span className="font-semibold">
          <Bi k="import.form.years" sub={false} />
        </span>
        <input name="years" type="number" min={0} max={70} inputMode="numeric" className={field} />
      </label>
      <label>
        <span className="font-semibold">
          <Bi k="import.form.classes" sub={false} />
        </span>
        <input name="classes" maxLength={40} placeholder="1 to 4" className={field} />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="font-semibold">
          <Bi k="import.form.show" sub={false} />
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["full", "first", "anon"] as const).map((v) => (
            <Choice key={v} on={show === v} onClick={() => setShow(v)}>
              <Bi k={`import.form.show.${v}`} sub={false} />
            </Choice>
          ))}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="font-semibold">
          <Bi k="import.form.voice" sub={false} />
        </legend>
        <div className="mt-2 flex gap-2">
          <Choice on={voice} onClick={() => setVoice(true)}>
            <Bi k="import.form.yes" sub={false} />
          </Choice>
          <Choice on={!voice} onClick={() => setVoice(false)}>
            <Bi k="import.form.no" sub={false} />
          </Choice>
        </div>
      </fieldset>
      {failed && (
        <p role="alert" className="text-base font-semibold text-clay-cta sm:col-span-2">
          <Bi k="import.err.generic" sub={false} />
        </p>
      )}
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" size="md" disabled={saving} aria-label={t("import.form.save")}>
          <Bi k="import.form.save" sub={false} />
        </Button>
        {props.onCancel && (
          <Button type="button" variant="ghost" size="md" onClick={props.onCancel}>
            <Bi k="import.form.cancel" sub={false} />
          </Button>
        )}
      </div>
    </form>
  );
}

function Choice({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-chip px-5 font-display text-base font-semibold transition-colors",
        on ? "bg-clay-cta text-white" : "border border-border bg-paper text-ink hover:bg-sage",
      )}
    >
      {children}
    </button>
  );
}
