"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { matchDemoAccount } from "@/lib/auth/demo";
import { signInErrorKey } from "@/lib/auth/errors";
import { enterFixtureDemo, leaveFixture } from "@/lib/auth/fixture-cookies";
import { APP_ROLES, DEMO_ACCOUNTS, isAppRole, ROLE_HOME, type AppRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { isFixtureMode } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n";
import { createClient, type ServerClient } from "@/lib/supabase/server";

// Sign in and out. Every action re-checks its input: a bound role or a form field is only a wish.

const ENTER_FAILED = "/?enter=failed#doors";

/** The role a signed in user really holds, read through RLS (own profile row only). */
async function profileRole(supabase: ServerClient) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role, consented_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  const row = z
    .object({ role: z.enum(APP_ROLES), consented_at: z.string().nullable() })
    .safeParse(data);
  return row.success ? row.data : null;
}

/** Where to land after entering: a page inside the role's own area (/r/invites), else its home. */
function landing(role: AppRole, next: unknown): string {
  const home = ROLE_HOME[role];
  if (typeof next !== "string") return home;
  const inArea = next === home || next.startsWith(`${home}/`);
  return inArea && /^\/[a-z0-9/_-]*$/i.test(next) ? next : home;
}

/** One tap demo entry from the landing doors and from a page visited without a session. */
export async function enterAs(role: AppRole, next?: string) {
  if (!isAppRole(role)) redirect(ENTER_FAILED);
  const destination = landing(role, next);

  if (isFixtureMode()) {
    await enterFixtureDemo(role);
    redirect(destination);
  }

  // Already here in this role (a demo account, or a field teacher's own invite): keep that
  // session rather than swap a real person for the demo account.
  const current = await getSession();
  if (current?.role === role) redirect(destination);

  let entered = false;
  try {
    const supabase = await createClient();
    if (supabase) {
      const account = DEMO_ACCOUNTS[role];
      const { error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      // A demo login without its seeded profile would open a room that cannot see anyone.
      entered = !error && (await profileRole(supabase))?.role === role;
      if (!error && !entered) await supabase.auth.signOut();
    }
  } catch {
    entered = false;
  }
  redirect(entered ? destination : ENTER_FAILED);
}

export async function signOut() {
  if (isFixtureMode()) {
    await leaveFixture();
  } else {
    try {
      await (await createClient())?.auth.signOut();
    } catch {
      // Even if the network drops, the local cookies are cleared by the client on the next visit.
    }
  }
  redirect("/");
}

export type LoginState = { error: MessageKey | null; email: string };

const LoginForm = z.object({
  email: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(200),
});

/** /login, for evaluators who prefer typing the README credentials. */
export async function signInWithEmail(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = LoginForm.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = typeof form.get("email") === "string" ? String(form.get("email")).slice(0, 200) : "";
  if (!parsed.success) return { error: "login.error.empty", email };

  if (isFixtureMode()) {
    const account = matchDemoAccount(parsed.data.email, parsed.data.password);
    if (!account) return { error: "login.error.wrong", email };
    await enterFixtureDemo(account.role);
    redirect(ROLE_HOME[account.role]);
  }

  let destination: string | null = null;
  let error: MessageKey = "login.error.network";
  try {
    const supabase = await createClient();
    if (supabase) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
      });
      if (authError) {
        error = signInErrorKey(authError);
      } else {
        const profile = await profileRole(supabase);
        if (profile) {
          destination = profile.consented_at ? ROLE_HOME[profile.role] : "/welcome";
        } else {
          // An account with no role (for example an anonymous one) is not let in (BUILD §1).
          await supabase.auth.signOut();
          error = "login.error.noRole";
        }
      }
    }
  } catch {
    error = "login.error.network";
  }
  if (destination) redirect(destination);
  return { error, email };
}
