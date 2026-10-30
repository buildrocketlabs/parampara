import type { Session } from "@/lib/auth/session";

// Who may import for a master and touch their interviews (docs/BUILD.md M2.2, D38).
// A reviewer may import on any master's behalf; a master only for themselves. A sample account
// (demo login) may only touch sample masters and sample interviews.

export type MasterAccess = { id: string; profileId: string; isSample: boolean };

export function canImportFor(session: Session, master: MasterAccess): boolean {
  if (session.isSample && !master.isSample) return false;
  if (session.role === "reviewer") return true;
  return session.role === "master" && master.profileId === session.userId;
}

/** Sample accounts may try the pipeline with a short recording; field imports have no cap. */
export const SAMPLE_IMPORT_MAX_MS = 10 * 60_000;
/** Field recordings: three hours in parts, generous for a 40 minute interview in pieces. */
export const FIELD_IMPORT_MAX_MS = 3 * 60 * 60_000;

export function maxImportMs(session: Session): number {
  return session.isSample ? SAMPLE_IMPORT_MAX_MS : FIELD_IMPORT_MAX_MS;
}
