#!/usr/bin/env bash
# Applies supabase/migrations to THIS project's hosted database only.
#   ALLOW_DB_PUSH=1 pnpm db:push          apply
#   ALLOW_DB_PUSH=1 DRY=1 pnpm db:push    show what would be applied
# Uses the project scoped SUPABASE_DB_URL (written by ./scripts/keys.sh) and refuses unless it
# points at the project pinned in supabase/.project-ref. Never uses an account wide token, never
# runs `supabase link`, so other Supabase projects on this Mac cannot be touched.
set -euo pipefail
[ "${ALLOW_DB_PUSH:-}" = "1" ] || { echo "refused: run ALLOW_DB_PUSH=1 pnpm db:push" >&2; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
[ -f supabase/.project-ref ] || { echo "No pinned project. Run ./scripts/keys.sh first." >&2; exit 1; }
REF="$(tr -d '[:space:]' < supabase/.project-ref)"
DB_URL="$(grep -E '^SUPABASE_DB_URL=' .env.local 2>/dev/null | tail -1 | cut -d= -f2- || true)"
[ -n "$DB_URL" ] || { echo "SUPABASE_DB_URL missing. Run ./scripts/keys.sh." >&2; exit 1; }
case "$DB_URL" in *"//postgres.$REF:"*|*"//postgres.$REF@"*|*"db.$REF.supabase.co"*) ;; *) echo "refused: SUPABASE_DB_URL is not project $REF" >&2; exit 1;; esac
unset SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF   # never fall back to the global CLI login
echo "Applying migrations to Supabase project $REF ${DRY:+(dry run)}"
pnpm exec supabase db push --db-url "$DB_URL" --workdir "$ROOT" ${DRY:+--dry-run} 2>&1 \
  | sed -E 's#postgres(ql)?://[^[:space:]]+#postgres://***#g'
