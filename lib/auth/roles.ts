// The four roles (DECISIONS D4) and the public demo accounts jurors enter with one tap (D33).
// Demo passwords are deliberately public: they are the test credentials listed in the README.
// Every demo profile is is_sample, and sample accounts can only change sample rows (D38).

export const APP_ROLES = ["teacher", "master", "reviewer", "officer"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export const ROLE_HOME: Record<AppRole, string> = {
  teacher: "/t",
  master: "/m",
  reviewer: "/r",
  officer: "/i",
};

/** Hidden accounts (invites, masters added by a reviewer) use a reserved domain: no mail is ever sent. */
export const AUTH_EMAIL_DOMAIN = "parampara.invalid";

export type DemoAccount = {
  role: AppRole;
  email: string;
  password: string;
  displayName: string;
  district: string;
};

export const DEMO_ACCOUNTS: Record<AppRole, DemoAccount> = {
  teacher: {
    role: "teacher",
    email: `teacher@demo.${AUTH_EMAIL_DOMAIN}`,
    password: "Hanate-teacher-2026",
    displayName: "Deepa (Sample)",
    district: "Koppal",
  },
  master: {
    role: "master",
    email: `master@demo.${AUTH_EMAIL_DOMAIN}`,
    password: "Hanate-master-2026",
    displayName: "Sharanappa (Sample)",
    district: "Koppal",
  },
  reviewer: {
    role: "reviewer",
    email: `reviewer@demo.${AUTH_EMAIL_DOMAIN}`,
    password: "Hanate-reviewer-2026",
    displayName: "Reviewer (Sample)",
    district: "Koppal",
  },
  officer: {
    role: "officer",
    email: `officer@demo.${AUTH_EMAIL_DOMAIN}`,
    password: "Hanate-officer-2026",
    displayName: "Officer (Sample)",
    district: "Koppal",
  },
};
