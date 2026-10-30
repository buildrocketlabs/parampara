#!/usr/bin/env bash
# Stop: refuse to finish while the ladder is red. Honors stop_hook_active to avoid loops.
INPUT="$(cat)"
ACTIVE="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(!!JSON.parse(s).stop_hook_active))}catch{process.stdout.write("false")}})')"
[ "$ACTIVE" = "true" ] && exit 0
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT" || exit 0
[ -f package.json ] && [ -d node_modules ] || exit 0
# Skip when nothing in source changed since last commit
git diff --quiet HEAD -- app components lib ai supabase tests 2>/dev/null && git diff --cached --quiet 2>/dev/null && exit 0
OUT="$(node scripts/check-secrets.mjs 2>&1)" || { echo "Secret scan failed:\n$OUT" >&2; exit 2; }
OUT="$(pnpm -s typecheck 2>&1)" || { echo "Typecheck is red. Fix before stopping:" >&2; printf '%s\n' "$OUT" | tail -40 >&2; exit 2; }
OUT="$(pnpm -s test --run 2>&1)" || { echo "Unit tests are red. Fix before stopping:" >&2; printf '%s\n' "$OUT" | tail -60 >&2; exit 2; }
exit 0
