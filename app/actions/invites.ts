"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { enterFixtureInvite, recordFixtureConsent } from "@/lib/auth/fixture-cookies";
import { signInWithInvite } from "@/lib/auth/invite-sign-in";
import { ROLE_HOME } from "@/lib/auth/roles";
import { getSessionFor } from "@/lib/auth/session";
import { CONSENT_VERSION } from "@/lib/consent";
import { isFixtureMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MessageKey } from "@/lib/i18n";
import { isInviteCodeShape, normalizeInviteCode } from "@/lib/invites/code";
import { rememberedGroupChild, rememberGroupChild } from "@/lib/invites/group-cookie";
import {
  createInvites,
  getInvite,
  joinGroup,
  recordInviteOpen,
  revokeInvite,
} from "@/lib/invites/store";
import {
  type GroupJoin,
  INVITABLE_ROLES,
  isGroupInvite,
  type Invite,
  MAX_DISTRICT_LENGTH,
  MAX_INVITES_PER_BATCH,
  MAX_LABEL_LENGTH,
} from "@/lib/invites/types";

// Invite links (DECISIONS D37, D38).

/** Begin on /join/<code>: sign in as the invite's person, then consent or their room. */
export async function beginInvite(rawCode: string) {
  const code = normalizeInviteCode(String(rawCode));
  if (!isInviteCodeShape(code)) redirect("/join/unknown");
  const joinPage = `/join/${encodeURIComponent(code)}`;

  let invite: Invite | null = null;
  try {
    invite = await getInvite(code);
  } catch {
    redirect(`${joinPage}?e=1`);
  }
  // Unknown or revoked: the page itself explains, kindly. A group QR is never one person's
  // credential (it has no hidden user): only joinGroupInvite takes a place in it (D80).
  if (!invite || invite.revokedAt || isGroupInvite(invite)) redirect(joinPage);

  if (isFixtureMode()) {
    const { consented } = await enterFixtureInvite(invite.role, code);
    await recordInviteOpen(invite);
    redirect(consented ? ROLE_HOME[invite.role] : "/welcome");
  }

  let destination: string | null = null;
  try {
    const { consented } = await signInWithInvite(invite);
    destination = consented ? ROLE_HOME[invite.role] : "/welcome";
  } catch {
    destination = null;
  }
  redirect(destination ?? `${joinPage}?e=1`);
}

/**
 * "I agree, let us begin" on a group QR (D80, D83): this phone's own link from the group (a
 * returning phone reuses it; a new one takes one place), sign in, record the agreement she just
 * read on the same page, and straight to asking. One tap from scan to the mic.
 */
export async function joinGroupInvite(rawCode: string) {
  const code = normalizeInviteCode(String(rawCode));
  if (!isInviteCodeShape(code)) redirect("/join/unknown");
  const joinPage = `/join/${encodeURIComponent(code)}`;

  let group: Invite | null = null;
  try {
    group = await getInvite(code);
  } catch {
    redirect(`${joinPage}?e=1`);
  }
  if (!group || !isGroupInvite(group)) redirect(joinPage);

  // A phone that joined before comes back to its own account, even after the group is full.
  let child: Invite | null = null;
  const remembered = await rememberedGroupChild(code);
  if (remembered) {
    const mine = await getInvite(remembered).catch(() => null);
    if (mine && mine.parentCode === code && !mine.revokedAt) child = mine;
  }
  if (!child) {
    let joined: GroupJoin | null = null;
    try {
      joined = await joinGroup(code);
    } catch {
      joined = null;
    }
    if (!joined) redirect(`${joinPage}?e=1`);
    // Full, expired, closed or not ready: the page itself explains, kindly.
    if (joined.status !== "ok") redirect(`${joinPage}?s=${joined.status}`);
    child = joined.child;
    await rememberGroupChild(code, child.code);
  }

  if (isFixtureMode()) {
    await enterFixtureInvite(child.role, child.code);
    await recordFixtureConsent(new Date().toISOString());
    await recordInviteOpen(child);
    redirect(ROLE_HOME[child.role]);
  }

  let ok = false;
  try {
    await signInWithInvite(child, { agreed: { version: CONSENT_VERSION[child.role] } });
    ok = true;
  } catch {
    ok = false;
  }
  redirect(ok ? ROLE_HOME[child.role] : `${joinPage}?e=1`);
}

export type MakeInvitesState = { error: MessageKey | null };

const MakeInvitesForm = z.object({
  count: z.coerce.number().int().min(1).max(MAX_INVITES_PER_BATCH),
  role: z.enum(INVITABLE_ROLES),
  label: z.string().trim().max(MAX_LABEL_LENGTH),
  district: z.string().trim().max(MAX_DISTRICT_LENGTH),
});

const SAMPLE_PER_PRESS = 5;
const SAMPLE_PER_DAY = 100;

/** /r/invites: a reviewer makes 1 to 50 links. A sample reviewer makes sample links (D38). */
export async function makeInvites(
  _prev: MakeInvitesState,
  form: FormData,
): Promise<MakeInvitesState> {
  const session = await getSessionFor("reviewer");
  if (!session) return { error: "invites.error.reviewerOnly" };

  const parsed = MakeInvitesForm.safeParse({
    count: form.get("count"),
    role: form.get("role") ?? "teacher",
    label: form.get("label") ?? "",
    district: form.get("district") ?? "",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "count" ? "invites.error.count" : "invites.error.form" };
  }

  // The demo reviewer is public: keep Sample links small per press and per day, because every
  // opened link creates an auth user on the free project (verifier, M1).
  if (session.isSample) {
    if (parsed.data.count > SAMPLE_PER_PRESS) return { error: "invites.error.sampleCap" };
    const admin = createAdminClient();
    if (admin) {
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const { count } = await admin
        .from("invites")
        .select("code", { count: "exact", head: true })
        .eq("created_by", session.userId)
        .gte("created_at", since);
      if ((count ?? 0) + parsed.data.count > SAMPLE_PER_DAY)
        return { error: "invites.error.sampleCap" };
    }
  }

  let made = 0;
  try {
    const codes = await createInvites({
      count: parsed.data.count,
      role: parsed.data.role,
      label: parsed.data.label || null,
      district: parsed.data.district || null,
      createdBy: session.userId,
      isSample: session.isSample,
    });
    made = codes.length;
  } catch {
    return { error: "invites.error.save" };
  }
  redirect(`/r/invites?made=${made}#made`);
}

/** Closes one link the reviewer made. Two steps in the UI; here it simply happens. */
export async function closeInvite(rawCode: string) {
  const session = await getSessionFor("reviewer");
  if (!session) redirect("/r/invites");
  const code = normalizeInviteCode(String(rawCode));
  let ok = false;
  if (isInviteCodeShape(code)) {
    try {
      // A field reviewer may also close the founder's Terminal group QRs and their people (D81).
      ok = await revokeInvite(code, session.userId, { fieldGroups: !session.isSample });
    } catch {
      ok = false;
    }
  }
  redirect(ok ? `/r/invites?closed=${encodeURIComponent(code)}` : "/r/invites?e=revoke");
}
