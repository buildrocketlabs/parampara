"use server";

import { z } from "zod";
import { findDisclosures, findUnsafe, findWelfareSignals } from "@/ai";
import type { AppRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import type { ChangeWho } from "@/lib/field/changes";
import { isMissingSchema } from "@/lib/supabase/missing-schema";
import { isFixtureMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { FEEDBACK_MAX, type FeedbackResult } from "@/lib/feedback";
import { redactFreeText } from "@/lib/redact-free-text";
import { decideNote } from "@/lib/tried/note";

// Feedback from any screen (docs/BUILD.md M4.5), into the feedback table (0005). Text is kept only
// when it is short, the safety patterns find nothing, and the redactor has removed any name
// (lib/redact-free-text, fail closed: no redactor, no text). A welfare signal is never stored and
// shows the helpline instead. Voice feedback: TODO (audio_path).
const Input = z.object({
  route: z.string().trim().min(1).max(200),
  text: z.string().max(FEEDBACK_MAX * 2),
  /** Spoken (her words came through speech to text and she checked them) or typed. */
  kind: z.enum(["text", "voice"]).default("text"),
  /** Her own yes to being quoted, without her name (D82). Off unless she ticked it. */
  quoteOk: z.boolean().default(false),
});

/** The role word stored with feedback (0007, D82), from the fixed list in lib/field/changes.ts. */
const ROLE_WORD: Record<AppRole, ChangeWho> = {
  teacher: "teacher",
  master: "master",
  reviewer: "reviewer",
  officer: "officer",
};

/** Fixture mode keeps feedback in memory only (no database yet), so the flow can be seen and tested. */
const fixtureFeedback: Array<{ route: string; text: string | null; at: string }> = [];

export async function sendFeedback(input: unknown): Promise<FeedbackResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const route = parsed.data.route.split("?")[0]?.slice(0, 200) || "/";
  const decision = decideNote(
    parsed.data.text,
    { findUnsafe, findWelfareSignals, findDisclosures },
    FEEDBACK_MAX,
  );
  if (decision.keep === null && decision.reason === "empty") return { ok: false, error: "invalid" };
  if (decision.keep === null && decision.reason === "welfare") {
    return { ok: true, kept: false, helpline: decision.helpline };
  }
  if (isFixtureMode()) {
    // No database and no redactor here: only the fact that this page got feedback is kept.
    fixtureFeedback.push({ route, text: null, at: new Date().toISOString() });
    return { ok: true, kept: decision.keep !== null, helpline: null };
  }
  const session = await getSession();
  const redacted = await redactFreeText(decision.keep, session?.lang ?? "kn");
  if (redacted.helpline) return { ok: true, kept: false, helpline: redacted.helpline };
  const text = redacted.text;
  // Unsafe or too long: the words are not kept, but the team still learns this page needs a look.
  const row = { route, kind: parsed.data.kind, text_redacted: text };
  if (session) {
    const db = await createClient();
    if (!db) return { ok: false, error: "failed" };
    const own = { ...row, profile_id: session.userId, is_sample: session.isSample };
    // Who said it is a role word only, never a name (D82); a quote needs words to quote.
    const quotable = {
      ...own,
      quote_ok: parsed.data.quoteOk && text !== null,
      role_word: ROLE_WORD[session.role],
    };
    let { error } = await db.from("feedback").insert(quotable);
    // Before 0007 the two columns do not exist: keep her words, not quotable (fail closed).
    if (error && isMissingSchema(error.code)) ({ error } = await db.from("feedback").insert(own));
    return error
      ? { ok: false, error: "failed" }
      : { ok: true, kept: text !== null, helpline: null };
  }
  // A visitor without a session (a juror before choosing a role): written by the server, as Sample.
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "failed" };
  const { error } = await admin
    .from("feedback")
    .insert({ ...row, profile_id: null, is_sample: true });
  return error ? { ok: false, error: "failed" } : { ok: true, kept: text !== null, helpline: null };
}
