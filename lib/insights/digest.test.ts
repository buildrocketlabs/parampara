import { describe, expect, it, vi } from "vitest";
import type { DigestOutput, DigestResult } from "@/ai";
import { istDate, weekStartOf } from "./digest-input";
import {
  digestForPage,
  digestInputHash,
  refreshDigest,
  type CachedDigest,
  type RefreshDeps,
} from "./digest";
import { samplePulse } from "./fixture";
import type { PulseSide } from "./types";

// The live bug (24 Oct): a note written while the Sample week had fewer than 5 teachers stayed on
// the board after seed:pulse filled it, saying "fewer than 5 teachers asked" above "47 asked".

const side: PulseSide = samplePulse(Date.parse("2026-10-24T06:00:00Z")).sample;
const busier: PulseSide = {
  ...side,
  funnel: { ...side.funnel, asked: { n: 47, hidden: false } },
};
const NOTE: DigestOutput = {
  headlineKn: "ಈ ವಾರದ ಟಿಪ್ಪಣಿ",
  headlineEn: "This week's note",
  actions: [
    { kn: "ಮೊದಲ ಹೆಜ್ಜೆ ಇಲ್ಲಿ", en: "First step here" },
    { kn: "ಎರಡನೇ ಹೆಜ್ಜೆ ಇಲ್ಲಿ", en: "Second step here" },
  ],
  watch: [],
};
const cached = (inputHash: string | null): CachedDigest => ({
  digest: NOTE,
  at: "2026-10-24T03:00:00Z",
  from: "2026-10-18",
  to: "2026-10-24",
  inputHash,
});

describe("which note the board shows", () => {
  it("shows a note written from these very numbers", () => {
    const board = digestForPage(cached(digestInputHash(side)), side);
    expect(board.show).toBe("digest");
  });

  it("hides a note written from other numbers, and says a fresh one is coming", () => {
    expect(digestForPage(cached(digestInputHash(side)), busier)).toEqual({
      show: "derived",
      stale: true,
    });
    // A row from before the hash was read is treated as other numbers.
    expect(digestForPage(cached(null), side)).toEqual({ show: "derived", stale: true });
  });

  it("promises nothing when there is no note, or no numbers to write about", () => {
    expect(digestForPage(null, side)).toEqual({ show: "derived", stale: false });
    const empty: PulseSide = {
      ...side,
      funnel: {
        asked: { n: 0, hidden: false },
        answered: { n: 0, hidden: false },
        tried: { n: 0, hidden: false },
        worked: { n: 0, hidden: false },
      },
      topics: [],
      practices: [],
    };
    expect(digestForPage(cached("other"), empty).show).toBe("derived");
  });
});

// ── A stand in for the insights_digests row and the two ways to claim it ─────────────────────────
type DigestRow = {
  week_start: string;
  is_sample: boolean;
  attempted_on: string;
  status: string;
  digest: unknown;
  digest_at: string | null;
  input_hash: string | null;
  updated_at: string;
};

/**
 * Applies each statement whole, like Postgres does for one UPDATE on a locked row: when two
 * callers race, the second sees the first one's write. Supports exactly the filters digest.ts uses.
 */
function fakeDb(row: DigestRow | null, now: () => Date) {
  const state = { row, claims: 0 };
  const today = () => istDate(now().toISOString());
  const admin = {
    async rpc(name: string, args: { p_week: string; p_is_sample: boolean }) {
      expect(name).toBe("claim_insights_digest");
      await Promise.resolve();
      if (!state.row) {
        state.row = {
          week_start: args.p_week,
          is_sample: args.p_is_sample,
          attempted_on: today(),
          status: "running",
          digest: null,
          digest_at: null,
          input_hash: null,
          updated_at: now().toISOString(),
        };
        state.claims++;
        return { data: true, error: null };
      }
      if (state.row.attempted_on < today()) {
        Object.assign(state.row, {
          attempted_on: today(),
          status: "running",
          updated_at: now().toISOString(),
        });
        state.claims++;
        return { data: true, error: null };
      }
      return { data: false, error: null };
    },
    from(table: string) {
      expect(table).toBe("insights_digests");
      return {
        update(values: Partial<DigestRow>) {
          const tests: Array<(r: DigestRow) => boolean> = [];
          let select = false;
          const builder = {
            eq(col: keyof DigestRow, v: unknown) {
              tests.push((r) => r[col] === v);
              return builder;
            },
            match(where: Partial<DigestRow>) {
              for (const [k, v] of Object.entries(where))
                tests.push((r) => r[k as keyof DigestRow] === v);
              return builder;
            },
            or(expr: string) {
              const parts = expr.split(",").map((p) => {
                const [col, op, ...rest] = p.split(".");
                const val = rest.join(".");
                return (r: DigestRow) =>
                  op === "is" && val === "null"
                    ? r[col as keyof DigestRow] === null
                    : op === "neq" && r[col as keyof DigestRow] !== val;
              });
              tests.push((r) => parts.some((t) => t(r)));
              return builder;
            },
            lt(col: keyof DigestRow, v: string) {
              tests.push((r) => Date.parse(String(r[col])) < Date.parse(v));
              return builder;
            },
            select() {
              select = true;
              return builder;
            },
            then(resolve: (v: { data: unknown; error: null }) => void) {
              const r = state.row;
              const hit = r !== null && tests.every((t) => t(r));
              if (hit) Object.assign(r, values);
              if (hit && values.status === "running") state.claims++;
              resolve({
                data: select ? (hit ? [{ week_start: r.week_start }] : []) : null,
                error: null,
              });
            },
          };
          return builder;
        },
      };
    },
  };
  return { admin: admin as unknown as NonNullable<RefreshDeps["admin"]>, state };
}

const NOW = new Date("2026-10-24T10:00:00Z");
const ok = (): DigestResult =>
  ({
    status: "ok",
    digest: NOTE,
    attempts: 1,
    replayed: false,
    span: {},
  }) as unknown as DigestResult;

function rowFor(hash: string | null, updatedMinutesAgo: number, attemptedToday = true): DigestRow {
  return {
    week_start: weekStartOf(side.until),
    is_sample: true,
    attempted_on: attemptedToday ? istDate(NOW.toISOString()) : "2026-10-23",
    status: "ok",
    digest: { output: NOTE, from: "2026-10-18", to: "2026-10-24" },
    digest_at: new Date(NOW.getTime() - updatedMinutesAgo * 60_000).toISOString(),
    input_hash: hash,
    updated_at: new Date(NOW.getTime() - updatedMinutesAgo * 60_000).toISOString(),
  };
}

describe("refreshing the note", () => {
  it("fresh: same numbers, already tried today, so no model call", async () => {
    const { admin, state } = fakeDb(rowFor(digestInputHash(busier), 180), () => NOW);
    const summarize = vi.fn(async () => ok());
    await refreshDigest(busier, { admin, summarize, now: () => NOW });
    expect(summarize).not.toHaveBeenCalled();
    expect(state.claims).toBe(0);
  });

  it("stale: other numbers and the last try over an hour ago, so one call writes a matching note", async () => {
    const { admin, state } = fakeDb(rowFor(digestInputHash(side), 75), () => NOW);
    const summarize = vi.fn(async () => ok());
    await refreshDigest(busier, { admin, summarize, now: () => NOW });
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(state.row?.input_hash).toBe(digestInputHash(busier));
    expect(state.row?.status).toBe("ok");
    // The page now shows it beside these numbers.
    const shown = digestForPage(cached(state.row!.input_hash), busier);
    expect(shown.show).toBe("digest");
  });

  it("stale but tried within the hour: waits", async () => {
    const { admin } = fakeDb(rowFor(digestInputHash(side), 20), () => NOW);
    const summarize = vi.fn(async () => ok());
    await refreshDigest(busier, { admin, summarize, now: () => NOW });
    expect(summarize).not.toHaveBeenCalled();
  });

  it("a failed try keeps the old note hidden and retries only after the hour", async () => {
    const { admin, state } = fakeDb(rowFor(digestInputHash(side), 90), () => NOW);
    const failing = vi.fn(async () => {
      throw new Error("model down");
    });
    await refreshDigest(busier, { admin, summarize: failing, now: () => NOW });
    expect(failing).toHaveBeenCalledTimes(1);
    expect(state.row?.status).toBe("failed");
    expect(state.row?.input_hash).toBe(digestInputHash(side));
    const again = vi.fn(async () => ok());
    await refreshDigest(busier, { admin, summarize: again, now: () => NOW });
    expect(again).not.toHaveBeenCalled();
    const later = new Date(NOW.getTime() + 61 * 60_000);
    await refreshDigest(busier, { admin, summarize: again, now: () => later });
    expect(again).toHaveBeenCalledTimes(1);
  });

  it("two servers racing on stale numbers: exactly one asks the model", async () => {
    const { admin, state } = fakeDb(rowFor(digestInputHash(side), 120), () => NOW);
    const summarize = vi.fn(async () => ok());
    await Promise.all([
      refreshDigest(busier, { admin, summarize, now: () => NOW }),
      refreshDigest(busier, { admin, summarize, now: () => NOW }),
    ]);
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(state.claims).toBe(1);
  });

  it("two servers racing on a new day: the daily claim lets exactly one through", async () => {
    const { admin } = fakeDb(rowFor(digestInputHash(busier), 600, false), () => NOW);
    const summarize = vi.fn(async () => ok());
    await Promise.all([
      refreshDigest(busier, { admin, summarize, now: () => NOW }),
      refreshDigest(busier, { admin, summarize, now: () => NOW }),
    ]);
    expect(summarize).toHaveBeenCalledTimes(1);
  });
});
