import type { AppRole } from "@/lib/auth/roles";

// One invite link (supabase/migrations 0001, 0003 and 0007, table invites).
export type Invite = {
  code: string;
  role: AppRole;
  district: string | null;
  label: string | null;
  isSample: boolean;
  createdBy: string | null;
  createdAt: string;
  usedBy: string | null;
  useCount: number;
  lastUsedAt: string | null;
  revokedAt: string | null;
  /** A group invite (one QR, many teachers, D80): how many people may join through it. */
  maxUses: number | null;
  /** A group invite takes no new people after this time. */
  expiresAt: string | null;
  /** A person's own invite, minted by a scan of a group, points back at the group. */
  parentCode: string | null;
};

/** Roles a reviewer can invite from /r/invites. Officers get accounts another way. */
export const INVITABLE_ROLES = [
  "teacher",
  "master",
  "reviewer",
] as const satisfies readonly AppRole[];
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(value: unknown): value is InvitableRole {
  return typeof value === "string" && (INVITABLE_ROLES as readonly string[]).includes(value);
}

export const MAX_INVITES_PER_BATCH = 50;
export const MAX_LABEL_LENGTH = 60;
export const MAX_DISTRICT_LENGTH = 40;

export type InviteStatus =
  { kind: "revoked" } | { kind: "unopened" } | { kind: "opened"; count: number };

export function inviteStatus(invite: Pick<Invite, "revokedAt" | "useCount">): InviteStatus {
  if (invite.revokedAt) return { kind: "revoked" };
  if (invite.useCount <= 0) return { kind: "unopened" };
  return { kind: "opened", count: invite.useCount };
}

// ── Group invites (D80) ─────────────────────────────────────────────────────

/** One QR for many teachers; every other invite brings one person. */
export function isGroupInvite(invite: Pick<Invite, "maxUses">): boolean {
  return invite.maxUses !== null;
}

/** The 0007 check allows 1 to 200 people per group. */
export const MAX_GROUP_USES = 200;
export const DEFAULT_GROUP_HOURS = 48;

export type GroupState =
  { kind: "open"; left: number } | { kind: "full" } | { kind: "expired" } | { kind: "closed" };

/**
 * Whether a group takes one more person now: closed (revoked) first, then expiry, then places.
 * A group's `useCount` counts people who joined through it, never one person's opens (D46).
 */
export function groupState(
  invite: Pick<Invite, "revokedAt" | "maxUses" | "expiresAt" | "useCount">,
  now: Date = new Date(),
): GroupState {
  if (invite.revokedAt) return { kind: "closed" };
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= now.getTime()) return { kind: "expired" };
  const left = Math.max(0, (invite.maxUses ?? 0) - invite.useCount);
  return left > 0 ? { kind: "open", left } : { kind: "full" };
}

export type GroupJoin =
  | { status: "ok"; child: Invite }
  | { status: "full" | "expired" | "closed" | "unknown" }
  /** 0007 is not applied yet: the group cannot take anyone, and says so (fail closed). */
  | { status: "not_ready" };
