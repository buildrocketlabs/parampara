import { cookies } from "next/headers";
import { getSessionFor } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  FIXTURE_ANSWER,
  FIXTURE_ANSWER_ID,
  FIXTURE_TRIED_COOKIE,
  readFixtureTried,
} from "./fixture";
import { getTriedAnswer, getTriedRecord } from "./store";
import type { TriedAnswer, TriedRecord } from "./types";

// Everything the "Did it work?" page and the home prompt need, in fixture or Supabase mode.
// Reads cookies, so callers sit inside <Suspense> (Cache Components, DECISIONS D22).
export type TriedLoad =
  | { kind: "sign_in" }
  | { kind: "not_found" }
  | { kind: "ok"; answer: TriedAnswer; record: TriedRecord | null };

export async function loadTried(answerId: string): Promise<TriedLoad> {
  const session = await getSessionFor("teacher");
  if (!session) return { kind: "sign_in" };

  if (isFixtureMode()) {
    if (answerId !== FIXTURE_ANSWER_ID) return { kind: "not_found" };
    const saved = readFixtureTried((await cookies()).get(FIXTURE_TRIED_COOKIE)?.value)[answerId];
    return { kind: "ok", answer: FIXTURE_ANSWER, record: saved ?? null };
  }

  const db = await createClient();
  if (!db) return { kind: "not_found" };
  const answer = await getTriedAnswer(db, session, answerId);
  if (!answer) return { kind: "not_found" };
  return { kind: "ok", answer, record: await getTriedRecord(db, session, answerId) };
}
