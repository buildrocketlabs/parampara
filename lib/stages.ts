import type { MessageKey } from "@/lib/i18n";

// Honest progress for long jobs (DESIGN §4 LampLoader). Pure logic so LampLoader, StageList and the
// trace agree on what "done", "now" and "next" mean, and so it is unit tested.

export type Stage = { key: string; label: MessageKey };
export type StageStatus = "done" | "current" | "pending";
export type StageView = Stage & { status: StageStatus; index: number };

/** Pass as `current` once every stage has finished. */
export const DONE = "done";

/** The answer pipeline's streamed stages (docs/AI.md §4). */
export const ANSWER_STAGES: Stage[] = [
  { key: "understanding", label: "stage.understanding" },
  { key: "finding", label: "stage.finding" },
  { key: "checking", label: "stage.checking" },
  { key: "voicing", label: "stage.voicing" },
];

/** "Show me" (M5.3): the photo is looked at first, then the same grounded stages. */
export const PHOTO_ANSWER_STAGES: Stage[] = [
  { key: "seeing", label: "stage.seeing" },
  ...ANSWER_STAGES,
];

/** Importing a master's recording (docs/BUILD.md M2): decode, store, transcribe, redact, extract. */
export const IMPORT_STAGES: Stage[] = [
  { key: "reading", label: "stage.import.reading" },
  { key: "uploading", label: "stage.import.uploading" },
  { key: "transcribing", label: "stage.import.transcribing" },
  { key: "redacting", label: "stage.import.redacting" },
  { key: "extracting", label: "stage.import.extracting" },
];

/**
 * Status of every stage. A stage is done if it is listed in `done` or comes before `current`
 * (the pipeline only moves forward). `current` is the one running now; `DONE` (or any key not in
 * the list once all are done) finishes them all.
 */
export function stageViews(
  stages: readonly Stage[],
  current: string,
  done: readonly string[] = [],
): StageView[] {
  const at = stages.findIndex((s) => s.key === current);
  const finished = current === DONE;
  return stages.map((s, index) => {
    let status: StageStatus = "pending";
    if (finished || done.includes(s.key) || (at >= 0 && index < at)) status = "done";
    else if (index === at) status = "current";
    return { ...s, status, index };
  });
}

export function isComplete(views: readonly StageView[]): boolean {
  return views.length > 0 && views.every((v) => v.status === "done");
}

/** The stage running now, or undefined when nothing is (complete, or `current` is unknown). */
export function currentView(views: readonly StageView[]): StageView | undefined {
  return views.find((v) => v.status === "current");
}

export function clamp01(n: number | undefined): number {
  if (n === undefined || Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Overall progress 0..1: finished stages count whole, the current one counts by its own `progress`
 * (0 when the caller does not know it; we never invent progress).
 */
export function overallProgress(views: readonly StageView[], progress?: number): number {
  if (views.length === 0) return 0;
  const doneCount = views.filter((v) => v.status === "done").length;
  const running = currentView(views) ? clamp01(progress) : 0;
  return Math.min(1, (doneCount + running) / views.length);
}
