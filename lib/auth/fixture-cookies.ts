import { cookies } from "next/headers";
import { LANG_STORAGE_KEY } from "@/lib/i18n";
import type { AppRole } from "./roles";
import {
  FIXTURE_CONSENT_COOKIE,
  FIXTURE_INVITE_COOKIE,
  FIXTURE_LANG_COOKIE,
  FIXTURE_ROLE_COOKIE,
} from "./session";

// Fixture mode stands in for Supabase auth with a few cookies (server actions only).
// Secure on Vercel; plain http on localhost so CI and Playwright work.
const OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: Boolean(process.env.VERCEL),
  maxAge: 60 * 60 * 24 * 30,
} as const;

export async function enterFixtureDemo(role: AppRole) {
  const jar = await cookies();
  jar.set(FIXTURE_ROLE_COOKIE, role, OPTIONS);
  jar.delete(FIXTURE_INVITE_COOKIE);
  jar.delete(FIXTURE_CONSENT_COOKIE);
  jar.delete(FIXTURE_LANG_COOKIE);
}

/** Opening a sample invite. Reopening the same link keeps the earlier agreement. */
export async function enterFixtureInvite(role: AppRole, code: string): Promise<{ consented: boolean }> {
  const jar = await cookies();
  const same = jar.get(FIXTURE_INVITE_COOKIE)?.value === code;
  const consented = same && Boolean(jar.get(FIXTURE_CONSENT_COOKIE)?.value);
  jar.set(FIXTURE_ROLE_COOKIE, role, OPTIONS);
  jar.set(FIXTURE_INVITE_COOKIE, code, OPTIONS);
  if (!same) {
    jar.delete(FIXTURE_CONSENT_COOKIE);
    jar.delete(FIXTURE_LANG_COOKIE);
  }
  return { consented };
}

export async function recordFixtureConsent(at: string) {
  (await cookies()).set(FIXTURE_CONSENT_COOKIE, at, OPTIONS);
}

export async function recordFixtureLang(lang: "kn" | "en" | "hi") {
  (await cookies()).set(FIXTURE_LANG_COOKIE, lang, OPTIONS);
}

export async function leaveFixture() {
  const jar = await cookies();
  for (const name of [
    FIXTURE_ROLE_COOKIE,
    FIXTURE_INVITE_COOKIE,
    FIXTURE_CONSENT_COOKIE,
    FIXTURE_LANG_COOKIE,
  ]) {
    jar.delete(name);
  }
}

/** The screen language cookie the client provider also writes (readable by the page script). */
export async function rememberScreenLang(lang: "kn" | "en") {
  (await cookies()).set(LANG_STORAGE_KEY, lang, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
