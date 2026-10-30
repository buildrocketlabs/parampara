import { randomBytes } from "node:crypto";
import { z } from "zod";
import { AUTH_EMAIL_DOMAIN } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import type { AdminClient } from "@/lib/supabase/admin";
import type { MasterAccess } from "@/lib/import/access";

// Master teachers as reviewers see them when importing a recording on their behalf. A master added
// by a reviewer gets a hidden account (D37) so they can later open their own room by invite link.

export type MasterSummary = MasterAccess & {
  displayName: string | null;
  district: string | null;
  years: number | null;
  school: string | null;
  consented: boolean;
  interviews: number;
};

export const NewMasterSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  district: z.string().trim().max(60).optional(),
  school: z.string().trim().max(120).optional(),
  years: z.coerce.number().int().min(0).max(70).optional(),
  classes: z.string().trim().max(40).optional(),
  showName: z.enum(["full", "first", "anon"]).default("first"),
  voicePublic: z.boolean().default(false),
});
export type NewMaster = z.infer<typeof NewMasterSchema>;

// masters links to profiles twice (profile_id and added_by, 0003), so every embed names its key:
// profiles!masters_profile_id_fkey(...). A bare profiles(...) fails with PGRST201.
export async function listMasters(db: AdminClient, session: Session): Promise<MasterSummary[]> {
  let q = db
    .from("masters")
    .select(
      "id, profile_id, is_sample, years, school, consented_at, profiles!masters_profile_id_fkey(display_name, district), interviews(count)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (session.isSample) q = q.eq("is_sample", true);
  if (session.role === "master") q = q.eq("profile_id", session.userId);
  const { data, error } = await q;
  if (error) throw new Error(`list masters failed (${error.code})`);
  return (data ?? []).map((m) => {
    // A many to one embed comes back as an object; without generated types it is typed as a list.
    const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as
      { display_name: string | null; district: string | null } | undefined;
    const iv = m.interviews as Array<{ count: number }> | null;
    return {
      id: m.id,
      profileId: m.profile_id,
      isSample: m.is_sample,
      displayName: p?.display_name ?? null,
      district: p?.district ?? null,
      years: m.years,
      school: m.school,
      consented: Boolean(m.consented_at),
      interviews: iv?.[0]?.count ?? 0,
    };
  });
}

export async function getMasterAccess(
  db: AdminClient,
  masterId: string,
): Promise<MasterAccess | null> {
  const { data } = await db
    .from("masters")
    .select("id, profile_id, is_sample")
    .eq("id", masterId)
    .maybeSingle();
  return data ? { id: data.id, profileId: data.profile_id, isSample: data.is_sample } : null;
}

/** Creates the hidden account, the profile and the masters row. Consent is recorded at import. */
export async function createMaster(
  db: AdminClient,
  session: Session,
  input: NewMaster,
): Promise<string> {
  const email = `master-${randomBytes(6).toString("hex")}@${AUTH_EMAIL_DOMAIN}`;
  const { data: created, error: userErr } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (userErr || !created.user)
    throw new Error(`create master account failed (${userErr?.status ?? "?"})`);
  const id = created.user.id;
  const { error: pErr } = await db.from("profiles").insert({
    id,
    role: "master",
    display_name: input.displayName,
    district: input.district ?? null,
    lang: "kn",
    is_sample: session.isSample,
  });
  if (pErr) {
    await db.auth.admin.deleteUser(id);
    throw new Error(`create master profile failed (${pErr.code})`);
  }
  const { data: m, error: mErr } = await db
    .from("masters")
    .insert({
      profile_id: id,
      years: input.years ?? null,
      school: input.school ?? null,
      classes: input.classes ?? null,
      show_name: input.showName,
      voice_public: input.voicePublic,
      is_sample: session.isSample,
      added_by: session.source === "supabase" ? session.userId : null,
    })
    .select("id")
    .single();
  if (mErr || !m) {
    await db.auth.admin.deleteUser(id);
    throw new Error(`create master failed (${mErr?.code ?? "?"})`);
  }
  return m.id;
}
