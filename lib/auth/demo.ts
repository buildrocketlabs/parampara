import { APP_ROLES, DEMO_ACCOUNTS, type DemoAccount } from "./roles";

// The README credentials, matched the way a person types them: email case and stray spaces do
// not matter, the password does.
export function matchDemoAccount(email: string, password: string): DemoAccount | null {
  const typed = email.trim().toLowerCase();
  for (const role of APP_ROLES) {
    const account = DEMO_ACCOUNTS[role];
    if (account.email === typed && account.password === password) return account;
  }
  return null;
}

/** "Deepa (Sample)" reads as "Deepa" beside a Sample badge, which already says it. */
export function plainName(displayName: string | null): string | null {
  const name = displayName?.replace(/\s*\(Sample\)\s*$/i, "").trim();
  return name ? name : null;
}
