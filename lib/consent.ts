import type { AppRole } from "@/lib/auth/roles";
import type { MessageKey } from "@/lib/i18n";

// What each role agrees to on first open (docs/field/consent.md). The version is stored with the
// time in profiles.consent_version, so a changed text never silently covers an older agreement.
// Masters also give a recorded voice consent before every interview (that lives in /m).
export const CONSENT_VERSION: Record<AppRole, string> = {
  teacher: "teacher@v2", // v2 (24 Oct): photos (Show me)
  master: "master@v1",
  reviewer: "reviewer@v1",
  officer: "officer@v1",
};

export const CONSENT_TEXT: Record<AppRole, MessageKey> = {
  teacher: "consent.teacher",
  master: "consent.master",
  reviewer: "consent.staff",
  officer: "consent.staff",
};

/** Only the teacher text has a recorded reading so far (GET /api/voice/consent-teacher). */
export const CONSENT_AUDIO: Partial<Record<AppRole, string>> = {
  teacher: "/api/voice/consent-teacher",
};
