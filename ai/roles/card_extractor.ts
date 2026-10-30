import { z } from "zod";
import { FlnTopic, GradeBand, Subject } from "@/lib/domain/fln";
import {
  CARD_EXTRACTOR_PROMPT_VERSION,
  CARD_EXTRACTOR_SYSTEM_V2,
  renderCardExtractorPrompt,
} from "../prompts/card_extractor";
import { unsupportedNumbers } from "../grounding";
import { modelIdFor } from "../router";
import { runStructured, type NeedsHumanReason, type RunDeps } from "../run";
import { hasChildNamePattern } from "../safety/names";
import { findUnsafe, findWelfareSignals, scanUnsafe, type UnsafeCategory } from "../safety/patterns";
import type { Span } from "../span";

// Card extractor (Sonnet, card_extractor@v1). One window of redacted segments in, draft practice
// cards out, every step citing the segments it came from (Law 4). Cards land as drafts for a
// human reviewer; nothing here reaches a teacher before approval.

// ── What the model returns (segment refs, not database ids) ─────────────────
const Ref = z.string().regex(/^S\d+$/).describe("A segment ref from this window, like S3");
const Bi = z.object({ kn: z.string().min(1), en: z.string().min(1) });

export const DROP_REASONS = ["punishment", "shaming", "not_a_practice", "unclear", "child_identifying"] as const;
export const DropReason = z.enum(DROP_REASONS);
export type DropReason = z.infer<typeof DropReason>;

export const MODEL_FLAGS = ["evidence_weak", "partial_story", "grade_uncertain", "child_name_redacted"] as const;

export const ModelCard = z.object({
  titleKn: z.string().min(1),
  titleEn: z.string().min(1),
  problemKn: z.string().min(1),
  problemEn: z.string().min(1),
  gradeBand: GradeBand,
  subject: Subject,
  topic: FlnTopic,
  steps: z
    .array(z.object({ kn: z.string().min(1), en: z.string().min(1), evidence: z.array(Ref).min(1) }))
    .min(2)
    .max(7),
  materials: z.array(Bi).max(10),
  whyKn: z.string().min(1),
  whyEn: z.string().min(1),
  quoteRef: Ref.nullable(),
  flags: z.array(z.enum(MODEL_FLAGS)).max(4),
});
export type ModelCard = z.infer<typeof ModelCard>;

export const ExtractorOutput = z.object({
  cards: z.array(ModelCard).max(6),
  dropped: z.array(z.object({ reason: DropReason, summaryEn: z.string().min(1).max(400) })).max(12),
});
export type ExtractorOutput = z.infer<typeof ExtractorOutput>;

// ── What callers get (database segment ids) ─────────────────────────────────
export type ExtractSegment = {
  id: number;
  startMs: number;
  endMs: number;
  textKn: string;
  textEn: string | null;
  speaker: string | null;
  /** A name was taken out of this segment's text, so its audio still has it: never a quote clip. */
  redacted?: boolean;
};

export type ExtractInput = {
  master: { name: string | null; years: number | null; classes: string | null };
  segments: ExtractSegment[];
  traceId?: string;
  /** Eval case id; product calls leave it out. */
  itemId?: string;
  /** Default keeps one call, retries included, inside the 300 s function limit (D40). */
  timeBudgetMs?: number;
};

export type ExtractedCard = {
  titleKn: string;
  titleEn: string;
  problemKn: string;
  problemEn: string;
  gradeBand: GradeBand;
  subject: Subject;
  topic: FlnTopic;
  steps: Array<{ kn: string; en: string; evidenceSegmentIds: number[] }>;
  materials: Array<{ kn: string; en: string }>;
  whyKn: string;
  whyEn: string;
  evidenceSegmentIds: number[];
  quoteSegmentId: number | null;
  flags: string[];
};

export type DroppedItem = { reason: DropReason; summaryEn: string };

export type ExtractResult =
  | {
      status: "ok";
      cards: ExtractedCard[];
      dropped: DroppedItem[];
      /** Segments that may disclose harm to a child or a teacher in distress: show a human. */
      welfareSegmentIds: number[];
      attempts: number;
      replayed: boolean;
      span: Span;
    }
  | { status: "needs_human"; reason: NeedsHumanReason; problems: string[]; span: Span };

export const DEFAULT_TIME_BUDGET_MS = 240_000;

/** A window as the model sees it: S1.. in time order, mapped back to ids by us, never by it. */
export type ExtractWindow = {
  segments: Array<ExtractSegment & { ref: string }>;
  byRef: Map<string, ExtractSegment>;
};

export function toWindow(segments: ExtractSegment[]): ExtractWindow {
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs || a.id - b.id);
  const withRefs = sorted.map((s, i) => ({ ...s, ref: `S${i + 1}` }));
  return { segments: withRefs, byRef: new Map(withRefs.map((s) => [s.ref, s])) };
}

const KN_LETTER = /[\u0C80-\u0CFF]/gu;
const LATIN_LETTER = /[A-Za-z]/g;
const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;
/** With speaker labels, a step must rest on the master's own words; without any, nothing can. */
function speaksForMaster(win: ExtractWindow) {
  const labelled = win.segments.some((s) => s.speaker === "master");
  return (s: ExtractSegment | undefined) =>
    !!s && (labelled ? s.speaker === "master" : s.speaker !== "interviewer" && s.speaker !== "other");
}

export { numbersIn } from "../grounding";

function cardTexts(c: ModelCard) {
  return {
    kn: [c.titleKn, c.problemKn, ...c.steps.map((s) => s.kn), ...c.materials.map((m) => m.kn), c.whyKn],
    en: [c.titleEn, c.problemEn, ...c.steps.map((s) => s.en), ...c.materials.map((m) => m.en), c.whyEn],
  };
}

/** The parts of a card that tell a teacher what to do. Harm here drops the card. */
function adviceText(c: ModelCard): string {
  return [
    c.titleKn,
    c.titleEn,
    ...c.steps.flatMap((s) => [s.kn, s.en]),
    ...c.materials.flatMap((m) => [m.kn, m.en]),
    c.whyKn,
    c.whyEn,
  ].join("\n");
}

/**
 * Deterministic checks; each message goes back to the model on retry (Law 3). Harmful practice is
 * not here: it is dropped after validation instead, so a bad story never costs a retry.
 */
export function validateExtraction(win: ExtractWindow, out: ExtractorOutput): string[] {
  const problems: string[] = [];
  const last = win.segments.length;
  const known = (ref: string) => win.byRef.has(ref);
  const isMaster = speaksForMaster(win);
  out.cards.forEach((card, ci) => {
    const c = `Card ${ci + 1}`;
    card.steps.forEach((step, si) => {
      const unknown = step.evidence.filter((r) => !known(r));
      if (unknown.length) {
        problems.push(`${c} step ${si + 1} cites ${unknown.join(", ")}, not in this window. Cite only S1 to S${last}.`);
      } else if (!step.evidence.some((r) => isMaster(win.byRef.get(r)))) {
        problems.push(`${c} step ${si + 1} does not cite the master's own words. Cite where the master says it, or leave the step out.`);
      } else {
        const cited = step.evidence.map((r) => win.byRef.get(r)!);
        if (cited.every((seg) => seg.textEn)) {
          const extra = unsupportedNumbers(step.en, cited.map((seg) => `${seg.textEn} ${seg.textKn}`).join(" "));
          if (extra.length) {
            problems.push(`${c} step ${si + 1} says ${extra.join(", ")}, which the segments it cites do not say. Cite the segment that says it, or leave the number out.`);
          }
        }
      }
    });
    if (card.quoteRef && !known(card.quoteRef)) problems.push(`${c} quoteRef ${card.quoteRef} is not in this window.`);

    const texts = cardTexts(card);
    if (texts.kn.some((t) => count(t, KN_LETTER) === 0)) {
      problems.push(`${c}: every Kannada field (titleKn, problemKn, steps kn, materials kn, whyKn) must be written in Kannada script.`);
    }
    if (texts.en.some((t) => count(t, KN_LETTER) > count(t, LATIN_LETTER))) {
      problems.push(`${c}: every English field must be written in English; Kannada may appear only as a short quoted word.`);
    }
    const all = [...texts.kn, ...texts.en].join("\n");
    const wording = findUnsafe(all);
    if (wording.includes("label") || wording.includes("diagnosis")) {
      problems.push(`${c} labels or diagnoses a child. Describe what the child finds hard instead, for example ಓದಲು ಕಷ್ಟಪಡುವ ಮಗು / "a child who finds reading hard".`);
    }
  });
  return problems;
}

const PUNISHING: UnsafeCategory[] = ["physical_punishment", "threat", "withholding"];
const tidyEn = (s: string) => s.replace(/\s*[—–]\s*/g, ", ").trim();

/**
 * Model output to cards with database ids, plus the deterministic safety pass: a card whose advice
 * involves punishment, threats, withholding, shaming or bias is moved to `dropped`, never shipped.
 */
const segmentText = (s: ExtractSegment) => `${s.textKn}\n${s.textEn ?? ""}`;
/** Wording problems (labels, diagnoses) are rewritten; everything else is harm. */
const WORDING: UnsafeCategory[] = ["label", "diagnosis"];
const harmful = (text: string) => findUnsafe(text).some((h) => !WORDING.includes(h));

export function finalizeExtraction(
  win: ExtractWindow,
  out: ExtractorOutput,
): { cards: ExtractedCard[]; dropped: DroppedItem[]; welfareSegmentIds: number[] } {
  const cards: ExtractedCard[] = [];
  // A summary that may name a child is replaced, never stored (Law 5).
  const dropped: DroppedItem[] = out.dropped.map((d) => ({
    reason: d.reason,
    summaryEn: hasChildNamePattern(d.summaryEn) ? "Summary withheld: it may have named a child." : tidyEn(d.summaryEn),
  }));
  const idOf = (ref: string) => win.byRef.get(ref)?.id;
  const byId = new Map(win.segments.map((s) => [s.id, s]));

  for (const card of out.cards) {
    const texts = cardTexts(card);
    // Segments are redacted before this, so a name here is a miss upstream or a false alarm. Either
    // way the card is held back whole rather than retrying the window (Law 5).
    if (hasChildNamePattern([...texts.kn, ...texts.en].join("\n"))) {
      dropped.push({ reason: "child_identifying", summaryEn: "A card was held back because it may name a child." });
      continue;
    }
    const advice = adviceText(card);
    const harms = findUnsafe(advice).filter((h) => !WORDING.includes(h));
    if (harms.length > 0) {
      dropped.push({
        reason: harms.some((h) => PUNISHING.includes(h)) ? "punishment" : "shaming",
        summaryEn: `Held back by the safety check (${harms.join(", ").replace(/_/g, " ")}): ${tidyEn(card.titleEn)}`,
      });
      continue;
    }
    const flags = new Set<string>(card.flags);
    const problem = `${card.problemKn}\n${card.problemEn}`;
    if (harmful(problem)) flags.add("sensitive_context");
    if (scanUnsafe(advice).some((h) => h.negated)) flags.add("negated_harm_mention");
    if (findWelfareSignals(`${problem}\n${advice}`).length > 0) flags.add("welfare_signal");

    const steps = card.steps.map((s) => ({
      kn: s.kn.trim(),
      en: tidyEn(s.en),
      evidenceSegmentIds: [...new Set(s.evidence.map(idOf).filter((id): id is number => id !== undefined))],
    }));
    const evidence = [...new Set(steps.flatMap((s) => s.evidenceSegmentIds))].sort((a, b) => a - b);
    if (evidence.length < 2) flags.add("evidence_weak");
    if (evidence.some((id) => harmful(segmentText(byId.get(id)!)))) flags.add("evidence_mentions_harm");

    // "Hear it from the master" plays the original audio, so the clip must be one the card cites,
    // in the master's voice, with nothing redacted from it and nothing harmful in it.
    const playable = (s: ExtractSegment | undefined): s is ExtractSegment =>
      !!s &&
      evidence.includes(s.id) &&
      s.speaker === "master" &&
      !s.redacted &&
      !harmful(segmentText(s)) &&
      !hasChildNamePattern(segmentText(s));
    const preferred = card.quoteRef ? win.byRef.get(card.quoteRef) : undefined;
    const quote = playable(preferred) ? preferred : evidence.map((id) => byId.get(id)).find(playable);

    cards.push({
      titleKn: card.titleKn.trim(),
      titleEn: tidyEn(card.titleEn),
      problemKn: card.problemKn.trim(),
      problemEn: tidyEn(card.problemEn),
      gradeBand: card.gradeBand,
      subject: card.subject,
      topic: card.topic,
      steps,
      materials: card.materials.map((m) => ({ kn: m.kn.trim(), en: tidyEn(m.en) })),
      whyKn: card.whyKn.trim(),
      whyEn: tidyEn(card.whyEn),
      evidenceSegmentIds: evidence,
      quoteSegmentId: quote?.id ?? null,
      flags: [...flags],
    });
  }
  const welfareSegmentIds = win.segments.filter((s) => findWelfareSignals(segmentText(s)).length > 0).map((s) => s.id);
  return { cards, dropped, welfareSegmentIds };
}

export function buildExtractorRequest(input: Pick<ExtractInput, "master" | "segments">) {
  const win = toWindow(input.segments);
  return {
    win,
    system: CARD_EXTRACTOR_SYSTEM_V2,
    prompt: renderCardExtractorPrompt({ master: input.master, segments: win.segments }),
  };
}

function emptySpan(): Span {
  return {
    role: "card_extractor",
    model: modelIdFor("card_extractor"),
    promptVersion: CARD_EXTRACTOR_PROMPT_VERSION,
    latencyMs: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    attempts: 0,
    replayed: false,
  };
}

export async function extractCards(input: ExtractInput, deps?: RunDeps): Promise<ExtractResult> {
  if (input.segments.length === 0) {
    return { status: "ok", cards: [], dropped: [], welfareSegmentIds: [], attempts: 0, replayed: false, span: emptySpan() };
  }
  const { win, system, prompt } = buildExtractorRequest(input);
  const res = await runStructured(
    {
      role: "card_extractor",
      promptVersion: CARD_EXTRACTOR_PROMPT_VERSION,
      system,
      prompt,
      schema: ExtractorOutput,
      traceId: input.traceId,
      itemId: input.itemId,
      timeBudgetMs: input.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS,
      validate: (out) => validateExtraction(win, out),
    },
    deps,
  );
  if (res.status !== "ok") return { status: "needs_human", reason: res.reason, problems: res.problems, span: res.span };
  return { status: "ok", ...finalizeExtraction(win, res.output), attempts: res.attempts, replayed: res.replayed, span: res.span };
}

// ── Windows and merging ─────────────────────────────────────────────────────

export const DEFAULT_WINDOW = { maxMs: 10 * 60_000, overlapMs: 60_000 };

/**
 * Splits a long interview into extraction windows of at most `maxMs` (a segment longer than that
 * gets a window of its own), each starting `overlapMs` before the previous one ended, so a story
 * told across a boundary appears whole in at least one window.
 */
export function windowSegments<T extends { startMs: number; endMs: number }>(
  segments: T[],
  opts: { maxMs: number; overlapMs: number } = DEFAULT_WINDOW,
): T[][] {
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  const windows: T[][] = [];
  let start = 0;
  while (start < sorted.length) {
    const t0 = sorted[start]!.startMs;
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1]!.endMs - t0 <= opts.maxMs) end++;
    windows.push(sorted.slice(start, end + 1));
    if (end === sorted.length - 1) break;
    const resumeAt = sorted[end]!.endMs - opts.overlapMs;
    let next = start + 1;
    while (next <= end && sorted[next]!.startMs < resumeAt) next++;
    start = Math.max(start + 1, next);
  }
  return windows;
}

/** Share of the smaller card's evidence that the two cards cite in common. */
export function evidenceOverlap(a: number[], b: number[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const x of sb) if (sa.has(x)) shared++;
  return shared / Math.min(sa.size, sb.size);
}

function richer(a: ExtractedCard, b: ExtractedCard): boolean {
  if (a.steps.length !== b.steps.length) return a.steps.length > b.steps.length;
  return a.evidenceSegmentIds.length > b.evidenceSegmentIds.length;
}

/**
 * Overlapping windows can return the same story twice. Two cards sharing at least half of the
 * smaller one's evidence are one practice: keep the richer (more steps, then more evidence).
 * Same rule as the import pipeline's check against cards already saved.
 */
export function mergeWindowCards(cardsPerWindow: ExtractedCard[][]): ExtractedCard[] {
  const kept: ExtractedCard[] = [];
  for (const card of cardsPerWindow.flat()) {
    const twin = kept.findIndex((k) => evidenceOverlap(k.evidenceSegmentIds, card.evidenceSegmentIds) >= 0.5);
    if (twin < 0) kept.push(card);
    else if (richer(card, kept[twin]!)) kept[twin] = card;
  }
  return kept;
}

export const cardExtractorRole = {
  id: "card_extractor",
  model: modelIdFor("card_extractor"),
  promptVersion: CARD_EXTRACTOR_PROMPT_VERSION,
  schema: ExtractorOutput,
  run: extractCards,
} as const;
