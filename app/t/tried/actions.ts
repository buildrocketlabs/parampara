"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { findDisclosures, findUnsafe, findWelfareSignals } from "@/ai";
import { getSessionFor } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { FIXTURE_ANSWER_ID, FIXTURE_TRIED_COOKIE, readFixtureTried } from "@/lib/tried/fixture";
import { redactFreeText } from "@/lib/redact-free-text";
import { decideNote, NOTE_MAX } from "@/lib/tried/note";
import { escalateWelfare, insertThanks, upsertTried } from "@/lib/tried/store";
import { OUTCOMES, THANK_PHRASES, type ThanksResult, type TriedResult } from "@/lib/tried/types";
import { messages } from "@/lib/i18n/messages";

// "Did it work?" (docs/BUILD.md M4.1). The teacher's own client, so RLS decides what she may write
// (0001 tried_own_insert, thanks_teacher_insert). Free text goes through decideNote first (Law 5).

const TriedInput = z.object({
  answerId: z.uuid(),
  outcome: z.enum(OUTCOMES),
  note: z
    .string()
    .max(NOTE_MAX * 4)
    .optional(),
});

const ThanksInput = z.object({
  answerId: z.uuid(),
  phrase: z.enum(THANK_PHRASES).nullable(),
  text: z
    .string()
    .max(NOTE_MAX * 4)
    .optional(),
});

const checks = { findUnsafe, findWelfareSignals, findDisclosures };

const FIXTURE_COOKIE_OPTS = { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" } as const;

export async function recordTried(input: unknown): Promise<TriedResult> {
  const parsed = TriedInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { answerId, outcome, note } = parsed.data;
  const session = await getSessionFor("teacher");
  if (!session) return { ok: false, error: "sign_in" };

  const decision = decideNote(note, checks);
  const redacted = isFixtureMode()
    ? { text: null, helpline: null }
    : await redactFreeText(decision.keep, session.lang);
  const kept = redacted.text;
  const noteDropped = Boolean(note?.trim()) && kept === null;
  const helpline = "helpline" in decision ? decision.helpline : redacted.helpline;

  if (isFixtureMode()) {
    if (answerId !== FIXTURE_ANSWER_ID) return { ok: false, error: "not_found" };
    const store = await cookies();
    const all = readFixtureTried(store.get(FIXTURE_TRIED_COOKIE)?.value);
    all[answerId] = { outcome, thanked: all[answerId]?.thanked ?? false };
    store.set(FIXTURE_TRIED_COOKIE, JSON.stringify(all), FIXTURE_COOKIE_OPTS);
    return { ok: true, outcome, noteDropped, helpline };
  }

  const db = await createClient();
  if (!db) return { ok: false, error: "failed" };
  const res = await upsertTried(db, session, answerId, outcome, kept);
  if (res === "denied") return { ok: false, error: "not_found" };
  if (res === "failed") return { ok: false, error: "failed" };
  if (helpline === "childline") await escalate(db, session, answerId);
  return { ok: true, outcome, noteDropped, helpline };
}

export async function sendThanks(input: unknown): Promise<ThanksResult> {
  const parsed = ThanksInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { answerId, phrase, text } = parsed.data;
  const session = await getSessionFor("teacher");
  if (!session) return { ok: false, error: "sign_in" };

  // A phrase is sent in Kannada, the master's language; her own words only if they are safe to keep.
  const own = decideNote(text, checks);
  const redacted = isFixtureMode()
    ? { text: null, helpline: null }
    : await redactFreeText(own.keep, session.lang);
  const helpline = "helpline" in own ? own.helpline : redacted.helpline;
  const message = [phrase ? messages.kn[phrase] : null, redacted.text].filter(Boolean).join(" ");
  if (!message)
    return helpline ? { ok: true, already: false, helpline } : { ok: false, error: "invalid" };

  if (isFixtureMode()) {
    if (answerId !== FIXTURE_ANSWER_ID) return { ok: false, error: "not_found" };
    const store = await cookies();
    const all = readFixtureTried(store.get(FIXTURE_TRIED_COOKIE)?.value);
    const record = all[answerId];
    if (!record) return { ok: false, error: "not_tried" };
    if (record.thanked) return { ok: true, already: true, helpline };
    all[answerId] = { ...record, thanked: true };
    store.set(FIXTURE_TRIED_COOKIE, JSON.stringify(all), FIXTURE_COOKIE_OPTS);
    return { ok: true, already: false, helpline };
  }

  const db = await createClient();
  if (!db) return { ok: false, error: "failed" };
  if (helpline === "childline") await escalate(db, session, answerId);
  const res = await insertThanks(db, session, answerId, message);
  if (res === "already") return { ok: true, already: true, helpline };
  if (res === "not_tried") return { ok: false, error: "not_tried" };
  if (res === "denied") return { ok: false, error: "not_found" };
  if (res === "failed") return { ok: false, error: "failed" };
  return { ok: true, already: false, helpline };
}

/** A child may be at risk: queue her question for a human, urgent (Law 5). Never blocks her flow. */
async function escalate(
  db: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: NonNullable<Awaited<ReturnType<typeof getSessionFor>>>,
  answerId: string,
) {
  const admin = createAdminClient();
  if (!admin) return;
  await escalateWelfare(db, admin, session, answerId).catch(() => false);
}
