import { createHash } from "node:crypto";
import { z } from "zod";
import { DigestOutput, INSIGHTS_DIGEST_PROMPT_VERSION, summarizeInsights } from "@/ai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServerClient } from "@/lib/supabase/server";
import { digestAggregates, istDate, weekStartOf } from "./digest-input";
import { hasPulse, type PulseSide } from "./types";

// The officer's weekly note from Claude, cached per week and kind (public.insights_digests, 0006).
// The page reads the last good digest with its date; after the page is sent, the server may ask
// the model again, so an officer never waits on a model.
//
// A note is shown only beside the numbers it was written from (Law 7): `input_hash` is the hash of
// the aggregates the stored note describes, and a note whose hash differs from the page's is never
// shown, not even labelled as older (a sentence like "fewer than 5 teachers asked" next to 47
// asked is wrong however it is labelled). The page then shows the actions derived from the
// numbers and says a fresh note is on its way.
//
// When a refresh may run (Law 10, at most one Sonnet call per claim):
//   * once a day per week and kind (claim_insights_digest, the 0006 rule), and
//   * when the numbers changed since the stored note and the last attempt is over an hour old.
//     That claim is one conditional UPDATE: Postgres locks the row, so when two servers race, the
//     second sees the first one's fresh updated_at and matches nothing.

export type CachedDigest = {
  digest: DigestOutput;
  at: string;
  from: string;
  to: string;
  /** Hash of the aggregates this note was written from; null on a row written before it existed. */
  inputHash: string | null;
};

export const STALE_RETRY_MS = 60 * 60 * 1000;

/** The hash of exactly what the model is given, so equal hashes mean the note fits these numbers. */
export function digestInputHash(side: PulseSide): string {
  return createHash("sha256")
    .update(JSON.stringify(digestAggregates(side)))
    .digest("hex");
}

const Row = z.object({
  digest: z.object({ output: DigestOutput, from: z.string(), to: z.string() }).nullable(),
  digest_at: z.string().nullable(),
  input_hash: z.string().nullable().optional(),
});

export async function readDigest(db: ServerClient, side: PulseSide): Promise<CachedDigest | null> {
  const { data, error } = await db
    .from("insights_digests")
    .select("digest, digest_at, input_hash")
    .eq("week_start", weekStartOf(side.until))
    .eq("is_sample", side.isSample)
    .maybeSingle();
  if (error || !data) return null;
  const parsed = Row.safeParse(data);
  if (!parsed.success || !parsed.data.digest || !parsed.data.digest_at) return null;
  const { output, from, to } = parsed.data.digest;
  return {
    digest: output,
    at: parsed.data.digest_at,
    from,
    to,
    inputHash: parsed.data.input_hash ?? null,
  };
}

export type DigestForPage =
  | { show: "digest"; digest: CachedDigest }
  /** A note exists but describes other numbers: hidden, and a fresh one is on its way. */
  | { show: "derived"; stale: true }
  | { show: "derived"; stale: false };

/** What the board shows: the note only when it was written from these very numbers. */
export function digestForPage(cached: CachedDigest | null, side: PulseSide): DigestForPage {
  if (!cached) return { show: "derived", stale: false };
  if (cached.inputHash !== null && cached.inputHash === digestInputHash(side)) {
    return { show: "digest", digest: cached };
  }
  // A refresh runs only while there are numbers to write about; otherwise promise nothing.
  return { show: "derived", stale: hasPulse(side) };
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type RefreshDeps = {
  admin: Admin | null;
  summarize: typeof summarizeInsights;
  now: () => Date;
};

const defaultDeps = (): RefreshDeps => ({
  admin: createAdminClient(),
  summarize: summarizeInsights,
  now: () => new Date(),
});

/**
 * Claims the right to write this week's note. True for exactly one caller: today's first attempt,
 * or, when the numbers changed, the first attempt after an hour.
 */
export async function claimDigest(
  admin: Admin,
  side: PulseSide,
  inputHash: string,
  now: Date,
): Promise<boolean> {
  const week = weekStartOf(side.until);
  const { data: daily, error } = await admin.rpc("claim_insights_digest", {
    p_week: week,
    p_is_sample: side.isSample,
  });
  if (!error && daily === true) return true;
  if (error) return false;

  // The numbers moved since the stored note. Retake the claim, at most once an hour.
  const { data, error: staleError } = await admin
    .from("insights_digests")
    .update({
      status: "running",
      attempted_on: istDate(now.toISOString()),
      updated_at: now.toISOString(),
    })
    .eq("week_start", week)
    .eq("is_sample", side.isSample)
    .or(`input_hash.is.null,input_hash.neq.${inputHash}`)
    .lt("updated_at", new Date(now.getTime() - STALE_RETRY_MS).toISOString())
    .select("week_start");
  return !staleError && Array.isArray(data) && data.length === 1;
}

/** Runs after the response: claims an attempt, asks the model, keeps a good answer. */
export async function refreshDigest(
  side: PulseSide,
  deps: RefreshDeps = defaultDeps(),
): Promise<void> {
  if (!hasPulse(side)) return;
  const { admin, summarize, now } = deps;
  if (!admin) return;
  const inputHash = digestInputHash(side);
  if (!(await claimDigest(admin, side, inputHash, now()))) return;

  const input = digestAggregates(side);
  const where = { week_start: weekStartOf(side.until), is_sample: side.isSample };
  try {
    const res = await summarize(input);
    if (res.status === "ok") {
      await admin
        .from("insights_digests")
        .update({
          status: "ok",
          digest: { output: res.digest, from: input.week.from, to: input.week.to },
          digest_at: now().toISOString(),
          input_hash: inputHash,
          prompt_version: INSIGHTS_DIGEST_PROMPT_VERSION,
        })
        .match(where);
      return;
    }
  } catch {
    // A model or network failure keeps the last note (hidden while its numbers differ) and the
    // deterministic actions; the next attempt comes after the hour.
  }
  await admin.from("insights_digests").update({ status: "failed" }).match(where);
}
