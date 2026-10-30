import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { isFixtureMode } from "@/lib/env";
import { fixtureInvites } from "@/lib/invites/fixture-store";
import { createClient } from "@/lib/supabase/server";
import { APP_ROLES, DEMO_ACCOUNTS, isAppRole, type AppRole } from "./roles";

// Who is here, and in which role. Access always needs a profiles row with a role: a bare
// authenticated JWT (for example an anonymous sign in) is not enough (docs/BUILD.md §1).
export type Session = {
  userId: string;
  role: AppRole;
  displayName: string | null;
  district: string | null;
  lang: "kn" | "en" | "hi";
  isSample: boolean;
  consentedAt: string | null;
  source: "supabase" | "fixture";
};

/** Fixture mode only (no database yet): the one tap demo entry sets this cookie. */
export const FIXTURE_ROLE_COOKIE = "pp_fixture_role";
/** Fixture mode: the sample invite this browser opened (absent for a demo account). */
export const FIXTURE_INVITE_COOKIE = "pp_fixture_invite";
/** Fixture mode: when this browser agreed to the consent text (ISO time). */
export const FIXTURE_CONSENT_COOKIE = "pp_fixture_consent";
/** Fixture mode: the answer language chosen on /welcome (kn, en or hi). */
export const FIXTURE_LANG_COOKIE = "pp_fixture_lang";

/** Demo accounts are seeded already consented (scripts/seed-demo.mjs). */
const DEMO_CONSENTED_AT = "2026-10-23T00:00:00.000Z";

type FixtureState = {
  invite?: string | null;
  consentedAt?: string | null;
  lang?: string | null;
  /** The opened invite's own flag: only the fixture field group's people are not Sample (D80). */
  inviteIsSample?: boolean;
};

const ProfileRow = z.object({
  role: z.enum(APP_ROLES),
  display_name: z.string().nullable(),
  district: z.string().nullable(),
  lang: z.enum(["kn", "en", "hi"]),
  is_sample: z.boolean(),
  consented_at: z.string().nullable(),
});

/**
 * A fixture session: a demo account, or (with `invite`) the hidden user of a sample invite, who
 * has no name and has not agreed yet until the consent cookie says so. Everything is Sample.
 */
export function fixtureSession(role: AppRole, state: FixtureState = {}): Session {
  const lang =
    state.lang === "en" || state.lang === "hi" || state.lang === "kn" ? state.lang : "kn";
  if (state.invite) {
    return {
      userId: `fixture-invite-${state.invite.toLowerCase()}`,
      role,
      displayName: null,
      district: "Koppal",
      lang,
      isSample: state.inviteIsSample ?? true,
      consentedAt: state.consentedAt ?? null,
      source: "fixture",
    };
  }
  const a = DEMO_ACCOUNTS[role];
  return {
    userId: `fixture-${role}`,
    role,
    displayName: a.displayName,
    district: a.district,
    lang,
    isSample: true,
    consentedAt: state.consentedAt ?? DEMO_CONSENTED_AT,
    source: "fixture",
  };
}

export const getSession = cache(async (): Promise<Session | null> => {
  if (isFixtureMode()) {
    const jar = await cookies();
    const role = jar.get(FIXTURE_ROLE_COOKIE)?.value;
    if (!isAppRole(role)) return null;
    const invite = jar.get(FIXTURE_INVITE_COOKIE)?.value;
    return fixtureSession(role, {
      invite,
      consentedAt: jar.get(FIXTURE_CONSENT_COOKIE)?.value,
      lang: jar.get(FIXTURE_LANG_COOKIE)?.value,
      inviteIsSample: invite ? (fixtureInvites().get(invite)?.isSample ?? true) : true,
    });
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: row } = await supabase
    .from("profiles")
    .select("role, display_name, district, lang, is_sample, consented_at")
    .eq("id", user.id)
    .maybeSingle();
  const profile = ProfileRow.safeParse(row);
  if (!profile.success) return null;
  return {
    userId: user.id,
    role: profile.data.role,
    displayName: profile.data.display_name,
    district: profile.data.district,
    lang: profile.data.lang,
    isSample: profile.data.is_sample,
    consentedAt: profile.data.consented_at,
    source: "supabase",
  };
});

/** The session if it holds one of the roles, else null (the page shows its own way in). */
export async function getSessionFor(...roles: AppRole[]): Promise<Session | null> {
  const s = await getActiveSession();
  return s && roles.includes(s.role) ? s : null;
}

/**
 * A session that may use the product. Someone who arrived by invite agrees to the consent text
 * first (/welcome); until then every page, action and API treats them as not signed in, except
 * the rooms and /welcome, which read getSession() to send them back to agree.
 */
export async function getActiveSession(): Promise<Session | null> {
  const s = await getSession();
  return s?.consentedAt ? s : null;
}
