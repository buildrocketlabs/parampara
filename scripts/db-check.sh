#!/usr/bin/env bash
# Applies 0001 to a THROWAWAY Postgres and runs the RLS assertions. Never point this at the hosted
# project: it creates schemas and roles. Usage: DB_CHECK_URL=postgres://… pnpm db:check
set -euo pipefail
: "${DB_CHECK_URL:?set DB_CHECK_URL to a throwaway Postgres database}"
case "$DB_CHECK_URL" in *supabase.co*|*supabase.com*) echo "refused: db:check is for throwaway databases only" >&2; exit 1 ;; esac
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
run() { psql "$DB_CHECK_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }
run "$ROOT/supabase/tests/supabase_shim.sql"
for m in "$ROOT"/supabase/migrations/*.sql; do run "$m"; done
run "$ROOT/supabase/tests/rls_check.sql" 2>&1 | grep -E "ok |FAILED|passed"
