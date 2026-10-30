"use client";

import type { InterviewTopic } from "@/lib/domain/interview";
import type { Line, SavedTurn } from "./client";

// Sample mode has no server, so a Sample talk is kept on this phone, in the same shape the server
// returns (lib/talk/client loadTalk), and reopened through the same code. A real talk is always
// reopened from the server, never from here. Wrapped in try/catch: storage can be blocked.

const KEY = "parampara.talk.sample.v1.";
const WINDOW_MS = 6 * 60 * 60_000;

export type SampleTalk = { updatedAt: number; elapsedMs: number; turns: SavedTurn[] };

/** The stored text itself (a stable value for useSyncExternalStore), or null. */
export function sampleTalkRaw(masterId: string): string | null {
  try {
    return window.localStorage.getItem(KEY + masterId);
  } catch {
    return null;
  }
}

export function parseSampleTalk(raw: string | null, now = Date.now()): SampleTalk | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as SampleTalk;
    if (!Array.isArray(saved.turns) || saved.turns.length === 0 || now - saved.updatedAt > WINDOW_MS) return null;
    return saved;
  } catch {
    return null;
  }
}

export function loadSampleTalk(masterId: string, now = Date.now()): SampleTalk | null {
  return parseSampleTalk(sampleTalkRaw(masterId), now);
}

export function saveSampleTurn(
  masterId: string,
  elapsedMs: number,
  turn: { kind: "typed" | "skip"; topic: InterviewTopic; probe: boolean; question: { kn: string; en: string }; lines: Line[] },
) {
  try {
    const turns = loadSampleTalk(masterId)?.turns ?? [];
    const next: SampleTalk = { updatedAt: Date.now(), elapsedMs, turns: [...turns, { ...turn, pending: 0 }] };
    window.localStorage.setItem(KEY + masterId, JSON.stringify(next));
  } catch {
    // Without storage a Sample talk simply cannot be reopened.
  }
}

export function clearSampleTalk(masterId: string) {
  try {
    window.localStorage.removeItem(KEY + masterId);
  } catch {
    // Nothing to clear.
  }
}
