import type { MessageKey } from "@/lib/i18n";

// Supabase auth errors become one kind sentence each; the raw message never reaches a screen.
type AuthErrorLike = { code?: string | null; status?: number | null } | null | undefined;

export function signInErrorKey(error: AuthErrorLike): MessageKey {
  const code = error?.code ?? "";
  if (code === "over_request_rate_limit" || error?.status === 429) return "login.error.busy";
  if (code === "user_banned") return "login.error.closed";
  if (code === "invalid_credentials" || code === "email_not_confirmed" || error?.status === 400) {
    return "login.error.wrong";
  }
  return "login.error.network";
}
