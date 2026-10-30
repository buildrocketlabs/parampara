"use server";

import { redirect } from "next/navigation";
import {
  recordFixtureConsent,
  recordFixtureLang,
  rememberScreenLang,
} from "@/lib/auth/fixture-cookies";
import { ROLE_HOME } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { CONSENT_VERSION } from "@/lib/consent";
import { isFixtureMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// First open after an invite: consent, then language (docs/field/consent.md, BUILD M1.3).

/** "I agree": records when and which text. Own profile only; consent columns are server only. */
export async function agreeToConsent() {
  const session = await getSession();
  if (!session) redirect("/welcome");
  const at = new Date().toISOString();

  if (isFixtureMode()) {
    await recordFixtureConsent(at);
    redirect("/welcome/language");
  }

  let saved = false;
  try {
    const admin = createAdminClient();
    if (admin) {
      const { error } = await admin
        .from("profiles")
        .update({ consented_at: at, consent_version: CONSENT_VERSION[session.role] })
        .eq("id", session.userId);
      saved = !error;
    }
  } catch {
    saved = false;
  }
  redirect(saved ? "/welcome/language" : "/welcome?e=1");
}

const LANGS = ["kn", "en", "hi"] as const;
type AnswerLang = (typeof LANGS)[number];

/** Language for answers. Hindi answers arrive in M3; the screens stay Kannada or English. */
export async function chooseLanguage(form: FormData) {
  const session = await getSession();
  if (!session) redirect("/welcome");
  const raw = form.get("lang");
  const lang = LANGS.find((l) => l === raw) as AnswerLang | undefined;
  if (!lang) redirect("/welcome/language");

  if (lang !== "hi") await rememberScreenLang(lang);

  if (isFixtureMode()) {
    await recordFixtureLang(lang);
    redirect(ROLE_HOME[session.role]);
  }

  let saved = false;
  try {
    // lang is one of the two columns a person may change on their own row (0003 column grants).
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.from("profiles").update({ lang }).eq("id", session.userId);
      saved = !error;
    }
  } catch {
    saved = false;
  }
  redirect(saved ? ROLE_HOME[session.role] : "/welcome/language?e=1");
}
