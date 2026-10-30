/**
 * Postgres or PostgREST saying a column or function does not exist: a migration the code already
 * knows about (0007) is not applied yet, so the caller falls back to what the database has.
 */
export function isMissingSchema(code: string | undefined): boolean {
  return code === "42703" || code === "PGRST204" || code === "42883" || code === "PGRST202";
}
