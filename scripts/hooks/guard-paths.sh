#!/usr/bin/env bash
# PreToolUse(Read|Edit|Write|MultiEdit|NotebookEdit). Exit 2 blocks.
INPUT="$(cat)"
read -r TOOL FILE < <(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const p=j.tool_input.file_path||j.tool_input.notebook_path||j.tool_input.path||"";process.stdout.write((j.tool_name||"")+" "+p)}catch{process.stdout.write(" ")}})')
[ -z "$FILE" ] && exit 0
block() { echo "BLOCKED by guard-paths: $1 ($FILE)" >&2; exit 2; }
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
case "$FILE" in /*) ABS="$FILE" ;; *) ABS="$ROOT/$FILE" ;; esac
BASE="$(basename "$ABS")"

# Secrets: never read or write
case "$BASE" in
  .env.example) ;;
  .env|.env.*) block "env files are human only; use .env.example for names" ;;
esac
case "$ABS" in
  */.vercel-cli/*|*/.vercel/*|*/supabase/.temp/*|*/.supabase/*|*/.config/gh/*|*/.ssh/*|*/.netrc|*/.gitconfig|*/.aws/*|*/.supabase/access-token*) block "credential store" ;;
esac

# Writes stay inside the project; never into git internals or lockfile by hand
if [ "$TOOL" != "Read" ]; then
  case "$ABS" in
    "$ROOT"/.git/*) block "git internals" ;;
    "$ROOT"/pnpm-lock.yaml) block "lockfile is written by pnpm only" ;;
    "$ROOT"/scripts/hooks/*|"$ROOT"/.githooks/*|"$ROOT"/.claude/settings.json|"$ROOT"/.mcp.json|"$ROOT"/scripts/gh.sh|"$ROOT"/scripts/vc.sh|"$ROOT"/scripts/setup-accounts.sh|"$ROOT"/scripts/keys.sh|"$ROOT"/scripts/db-push.sh|"$ROOT"/supabase/.project-ref) block "guardrail files are human only" ;;
    "$ROOT"/*) ;;
    *) block "writes must stay inside $ROOT" ;;
  esac
fi
exit 0
