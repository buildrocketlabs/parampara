import { z } from "zod";
import { APP_ROLES } from "@/lib/auth/roles";
import { isFixtureMode } from "@/lib/env";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import { isMissingSchema } from "@/lib/supabase/missing-schema";
import { generateInviteCode } from "./code";
import { fixtureInvites } from "./fixture-store";
import { groupState, type GroupJoin, type InvitableRole, type Invite } from "./types";

// Invite reads and writes. The invites table has no client policies (0001), so live mode always
// uses the service role here, and every caller has already checked who is asking.
// Fixture mode reads the in-memory sample store and never touches Supabase.

const InviteRow = z.object({
  code: z.string(),
  role: z.enum(APP_ROLES),
  district: z.string().nullable(),
  label: z.string().nullable(),
  is_sample: z.boolean(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  used_by: z.string().nullable(),
  use_count: z.number().int(),
  last_used_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  // 0007 (group invites). Absent until the founder applies it: read as a one person link.
  max_uses: z.number().int().nullable().default(null),
  expires_at: z.string().nullable().default(null),
  parent_code: z.string().nullable().default(null),
});

const BASE_COLUMNS =
  "code, role, district, label, is_sample, created_by, created_at, used_by, use_count, last_used_at, revoked_at";
const GROUP_COLUMNS = `${BASE_COLUMNS}, max_uses, expires_at, parent_code`;

function fromRow(row: z.infer<typeof InviteRow>): Invite {
  return {
    code: row.code,
    role: row.role,
    district: row.district,
    label: row.label,
    isSample: row.is_sample,
    createdBy: row.created_by,
    createdAt: row.created_at,
    usedBy: row.used_by,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    maxUses: row.max_uses,
    expiresAt: row.expires_at,
    parentCode: row.parent_code,
  };
}

function admin(): AdminClient {
  const client = createAdminClient();
  if (!client) throw new Error("invites: database is not configured");
  return client;
}

/**
 * Runs a select with the 0007 columns, and once more without them if the database does not have
 * them yet, so every one person link keeps working before the migration (fail closed for groups).
 */
async function selectInvites<T>(
  run: (columns: string) => PromiseLike<{ data: T | null; error: { code?: string } | null }>,
): Promise<T | null> {
  const first = await run(GROUP_COLUMNS);
  if (!first.error) return first.data;
  if (!isMissingSchema(first.error.code))
    throw new Error(`invites: read failed (${first.error.code})`);
  const second = await run(BASE_COLUMNS);
  if (second.error) throw new Error(`invites: read failed (${second.error.code})`);
  return second.data;
}

export async function getInvite(code: string): Promise<Invite | null> {
  if (isFixtureMode()) {
    const found = fixtureInvites().get(code);
    return found ? { ...found } : null;
  }
  const db = admin();
  const data = await selectInvites((columns) =>
    db.from("invites").select(columns).eq("code", code).maybeSingle(),
  );
  const row = InviteRow.safeParse(data);
  return row.success ? fromRow(row.data) : null;
}

/**
 * Links one person made, newest first. Nobody sees another reviewer's links, except that a field
 * reviewer also sees the field group QRs the founder made in Terminal (`pnpm invite --uses`, no
 * owner), so they can show and close them. People who joined through a group are listed under it.
 */
export async function listInvitesBy(
  userId: string,
  opts: { fieldGroups?: boolean } = {},
  limit = 200,
): Promise<Invite[]> {
  if (isFixtureMode()) {
    return [...fixtureInvites().values()]
      .filter(
        (i) =>
          i.createdBy === userId ||
          (opts.fieldGroups && i.createdBy === null && !i.isSample && i.maxUses !== null),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.code.localeCompare(b.code))
      .slice(0, limit)
      .map((i) => ({ ...i }));
  }
  const db = admin();
  const mine = await selectInvites((columns) =>
    db
      .from("invites")
      .select(columns)
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .order("code")
      .limit(limit),
  );
  const rows = z
    .array(InviteRow)
    .parse(mine ?? [])
    .map(fromRow);
  if (!opts.fieldGroups) return rows;

  // The founder's Terminal groups and the people who joined through them. Before 0007 there are
  // none, and the missing column simply means an empty list here.
  const groups = await db
    .from("invites")
    .select(GROUP_COLUMNS)
    .is("created_by", null)
    .eq("is_sample", false)
    .not("max_uses", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (groups.error) {
    if (isMissingSchema(groups.error.code)) return rows;
    throw new Error(`invites: list failed (${groups.error.code})`);
  }
  const owned = z
    .array(InviteRow)
    .parse(groups.data ?? [])
    .map(fromRow);
  const codes = owned.map((g) => g.code);
  const children = codes.length
    ? await db.from("invites").select(GROUP_COLUMNS).in("parent_code", codes).limit(limit)
    : { data: [], error: null };
  if (children.error) throw new Error(`invites: list failed (${children.error.code})`);
  const seen = new Set(rows.map((r) => r.code));
  const extra = [
    ...owned,
    ...z
      .array(InviteRow)
      .parse(children.data ?? [])
      .map(fromRow),
  ].filter((i) => !seen.has(i.code));
  return [...rows, ...extra].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || a.code.localeCompare(b.code),
  );
}

export type NewInvites = {
  count: number;
  role: InvitableRole;
  label: string | null;
  district: string | null;
  createdBy: string;
  /** D38: links a sample account makes are sample links. */
  isSample: boolean;
};

function blankInvite(code: string, input: Omit<NewInvites, "count">, createdAt: string): Invite {
  return {
    code,
    role: input.role,
    district: input.district,
    label: input.label,
    isSample: input.isSample,
    createdBy: input.createdBy,
    createdAt,
    usedBy: null,
    useCount: 0,
    lastUsedAt: null,
    revokedAt: null,
    maxUses: null,
    expiresAt: null,
    parentCode: null,
  };
}

export async function createInvites(input: NewInvites): Promise<string[]> {
  const createdAt = new Date().toISOString();
  if (isFixtureMode()) {
    const store = fixtureInvites();
    const codes: string[] = [];
    while (codes.length < input.count) {
      const code = generateInviteCode();
      if (store.has(code)) continue;
      store.set(code, blankInvite(code, input, createdAt));
      codes.push(code);
    }
    return codes;
  }

  // 31^8 codes make a clash vanishingly rare; if one happens the whole batch is retried once.
  for (let attempt = 0; attempt < 2; attempt++) {
    const codes = Array.from(
      new Set(Array.from({ length: input.count }, () => generateInviteCode())),
    );
    const { error } = await admin()
      .from("invites")
      .insert(
        codes.map((code) => ({
          code,
          role: input.role,
          district: input.district,
          label: input.label,
          is_sample: input.isSample,
          created_by: input.createdBy,
        })),
      );
    if (!error) return codes;
    if (error.code !== "23505") throw new Error(`invites: create failed (${error.code})`);
  }
  throw new Error("invites: create failed twice on a code clash");
}

/**
 * Closes a link the person made. Live mode also bans the link's hidden user, because the link is
 * that user's only credential: their phone loses access at the next token refresh (within the
 * hour). A sample reviewer can only reach their own sample links (D38). A field reviewer can also
 * close a field group the founder made in Terminal. A group has no hidden user of its own, so
 * closing it stops new scans and leaves the people who joined through it in (D81).
 */
export async function revokeInvite(
  code: string,
  byUserId: string,
  opts: { fieldGroups?: boolean } = {},
): Promise<boolean> {
  const revokedAt = new Date().toISOString();
  if (isFixtureMode()) {
    const invite = fixtureInvites().get(code);
    if (!invite || invite.revokedAt) return false;
    const unownedFieldGroup =
      opts.fieldGroups &&
      invite.createdBy === null &&
      !invite.isSample &&
      (invite.maxUses !== null || invite.parentCode !== null);
    if (invite.createdBy !== byUserId && !unownedFieldGroup) return false;
    invite.revokedAt = revokedAt;
    return true;
  }
  const db = admin();
  let target = await db
    .from("invites")
    .update({ revoked_at: revokedAt })
    .eq("code", code)
    .eq("created_by", byUserId)
    .is("revoked_at", null)
    .select("used_by");
  if (target.error) throw new Error(`invites: revoke failed (${target.error.code})`);
  if (!target.data?.length && opts.fieldGroups) {
    target = await db
      .from("invites")
      .update({ revoked_at: revokedAt })
      .eq("code", code)
      .is("created_by", null)
      .eq("is_sample", false)
      // Only a Terminal group or someone who joined through one, never the founder's own links.
      .or("max_uses.not.is.null,parent_code.not.is.null")
      .is("revoked_at", null)
      .select("used_by");
    if (target.error && !isMissingSchema(target.error.code))
      throw new Error(`invites: revoke failed (${target.error.code})`);
  }
  if (!target.data?.length) return false;
  const usedBy = z.string().nullable().catch(null).parse(target.data[0]?.used_by);
  if (usedBy) {
    const { error: banError } = await db.auth.admin.updateUserById(usedBy, {
      ban_duration: "876000h",
    });
    if (banError)
      throw new Error(`invites: revoked, but the user could not be closed (${banError.code})`);
  }
  return true;
}

/** Counts an open of the link. A lost increment under two simultaneous opens is acceptable. */
export async function recordInviteOpen(invite: Invite): Promise<void> {
  const lastUsedAt = new Date().toISOString();
  if (isFixtureMode()) {
    const stored = fixtureInvites().get(invite.code);
    if (stored) {
      stored.useCount += 1;
      stored.lastUsedAt = lastUsedAt;
    }
    return;
  }
  const { error } = await admin()
    .from("invites")
    .update({ use_count: invite.useCount + 1, last_used_at: lastUsedAt })
    .eq("code", invite.code);
  if (error) throw new Error(`invites: open count failed (${error.code})`);
}

// ── Group invites: one QR, many teachers (D80) ──────────────────────────────

const JOIN_STATUSES = ["ok", "full", "expired", "closed", "unknown"] as const;

/**
 * One scan of a group takes one place and mints that person's own invite (their own hidden user,
 * D37), in one database transaction (`join_group_invite`, 0007), so eight phones scanning in the
 * same minute never pass the limit. Fixture mode does the same in memory (single threaded).
 */
export async function joinGroup(groupCode: string): Promise<GroupJoin> {
  if (isFixtureMode()) {
    const store = fixtureInvites();
    const group = store.get(groupCode);
    if (!group || group.maxUses === null || group.parentCode) return { status: "unknown" };
    const state = groupState(group);
    if (state.kind !== "open") return { status: state.kind };
    let code = generateInviteCode();
    while (store.has(code)) code = generateInviteCode();
    const now = new Date().toISOString();
    group.useCount += 1;
    group.lastUsedAt = now;
    const child: Invite = {
      ...group,
      code,
      createdAt: now,
      useCount: 0,
      lastUsedAt: null,
      usedBy: null,
      maxUses: null,
      expiresAt: null,
      parentCode: group.code,
    };
    store.set(code, child);
    return { status: "ok", child: { ...child } };
  }

  const db = admin();
  for (let attempt = 0; attempt < 2; attempt++) {
    const child = generateInviteCode();
    const { data, error } = await db.rpc("join_group_invite", {
      p_group: groupCode,
      p_child: child,
    });
    if (error) {
      if (isMissingSchema(error.code)) return { status: "not_ready" };
      if (error.code === "23505") continue; // the new code clashed: mint another
      throw new Error(`invites: group join failed (${error.code})`);
    }
    const status = z.enum(JOIN_STATUSES).catch("unknown").parse(data);
    if (status !== "ok") return { status };
    const invite = await getInvite(child);
    if (!invite) throw new Error("invites: group join lost its new link");
    return { status: "ok", child: invite };
  }
  throw new Error("invites: group join clashed twice");
}

/** The invite this person holds through a group, if they joined through it (a returning phone). */
export async function findGroupChildOf(groupCode: string, userId: string): Promise<Invite | null> {
  if (isFixtureMode()) return null; // fixture mode knows the person by the invite cookie instead
  const db = admin();
  const { data, error } = await db
    .from("invites")
    .select(GROUP_COLUMNS)
    .eq("parent_code", groupCode)
    .eq("used_by", userId)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error.code)) return null;
    throw new Error(`invites: group lookup failed (${error.code})`);
  }
  const row = InviteRow.safeParse(data);
  return row.success ? fromRow(row.data) : null;
}
