import type { Invite } from "./types";

// Fixture mode only (no database yet, CI): invites live in this process's memory, seeded with
// labelled sample links. Restarting the server resets them. Never used when Supabase keys exist.
export const FIXTURE_REVIEWER_ID = "fixture-reviewer";

const SEEDED_AT = "2026-10-23T09:00:00.000Z";
/** Sample groups stay open in fixture mode, so CI never meets an expired seed by accident. */
const FAR_FUTURE = "2099-01-01T00:00:00.000Z";

function seed(
  code: string,
  role: Invite["role"],
  label: string,
  extra: Partial<Invite> = {},
): Invite {
  return {
    code,
    role,
    district: "Koppal",
    label,
    isSample: true,
    createdBy: FIXTURE_REVIEWER_ID,
    createdAt: SEEDED_AT,
    usedBy: null,
    useCount: 0,
    lastUsedAt: null,
    revokedAt: null,
    maxUses: null,
    expiresAt: null,
    parentCode: null,
    ...extra,
  };
}

const SEEDS: Invite[] = [
  seed("SAMPLE-T1", "teacher", "Sample teachers of Koppal"),
  seed("SAMPLE-M1", "master", "Sample master teacher"),
  seed("SAMPLE-R1", "reviewer", "Sample reviewer"),
  seed("SAMPLE-X1", "teacher", "Sample closed link", { revokedAt: SEEDED_AT }),
  // One QR, many teachers (D80): an open group, one with every place taken, one past its time.
  // Open for 48 hours from the server's start, as `pnpm invite --uses` makes it.
  seed("SAMPLE-G1", "teacher", "Sample school visit", {
    maxUses: 15,
    expiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString(),
  }),
  seed("SAMPLE-G0", "teacher", "Sample full group", {
    maxUses: 8,
    useCount: 8,
    expiresAt: FAR_FUTURE,
  }),
  seed("SAMPLE-GE", "teacher", "Sample group, time over", {
    maxUses: 15,
    useCount: 3,
    expiresAt: SEEDED_AT,
  }),
  // A field group with no data behind it, so a test can prove a field teacher never meets a Sample
  // chip or a Sample answer (D64). Nobody's real data: fixture mode has no database.
  seed("TEST-FIELD-G1", "teacher", "Field path test", {
    maxUses: 15,
    expiresAt: FAR_FUTURE,
    isSample: false,
  }),
];

const globalStore = globalThis as typeof globalThis & { __paramparaInvites?: Map<string, Invite> };

export function fixtureInvites(): Map<string, Invite> {
  globalStore.__paramparaInvites ??= new Map(SEEDS.map((i) => [i.code, { ...i }]));
  return globalStore.__paramparaInvites;
}
