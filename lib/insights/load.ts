import { z } from "zod";
import type { ServerClient } from "@/lib/supabase/server";
import {
  DistrictDbRow,
  emptySide,
  joinLamps,
  LampDbRow,
  LampMasterDbRow,
  PlatformDbRow,
  PracticeDbRow,
  sideFromSummary,
  SummaryRow,
  TopicDbRow,
  type Lamps,
  type Pulse,
  type PulseSide,
} from "./types";

// Reads the officer's aggregates through the signed in person's own client: the insights_*
// functions (0006) return rows only to an officer or reviewer, already suppressed and split by
// is_sample. Nothing here can see a teacher, because the functions never return one.

export class InsightsUnavailable extends Error {
  constructor(what: string, code?: string) {
    super(`insights ${what} failed${code ? ` (${code})` : ""}`);
    this.name = "InsightsUnavailable";
  }
}

async function rows<T>(
  what: string,
  call: PromiseLike<{ data: unknown; error: { code?: string } | null }>,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const { data, error } = await call;
  if (error) throw new InsightsUnavailable(what, error.code);
  const parsed = z.array(schema).safeParse(data ?? []);
  if (!parsed.success) throw new InsightsUnavailable(`${what} shape`);
  return parsed.data;
}

async function side(db: ServerClient, isSample: boolean): Promise<PulseSide> {
  const p = { p_is_sample: isSample };
  const [summary, topics, districts, practices] = await Promise.all([
    rows("summary", db.rpc("insights_summary", p), SummaryRow),
    rows("topics", db.rpc("insights_topics", p), TopicDbRow),
    rows("districts", db.rpc("insights_districts", p), DistrictDbRow),
    rows("practices", db.rpc("insights_practices", { ...p, p_limit: 5 }), PracticeDbRow),
  ]);
  const s = summary[0];
  if (!s) {
    const now = new Date().toISOString();
    return emptySide(isSample, now, now);
  }
  return sideFromSummary(s, { topics, districts, practices });
}

export async function loadPulse(db: ServerClient): Promise<Pulse> {
  const [field, sample, platform] = await Promise.all([
    side(db, false),
    side(db, true),
    rows("platform cost", db.rpc("insights_platform_cost"), PlatformDbRow),
  ]);
  return { field, sample, platform: platform[0] ?? null };
}

export async function loadLamps(db: ServerClient): Promise<Lamps> {
  const one = async (isSample: boolean) => {
    const p = { p_is_sample: isSample };
    const [lamps, masters] = await Promise.all([
      rows("lamps", db.rpc("insights_lamps", p), LampDbRow),
      rows("lamp masters", db.rpc("insights_lamp_masters", p), LampMasterDbRow),
    ]);
    return joinLamps(lamps, masters);
  };
  const [field, sample] = await Promise.all([one(false), one(true)]);
  return { field, sample };
}
