#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit): format the touched file. Never fails the edit.
INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input.file_path||"")}catch{}})')"
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
[ -z "$FILE" ] || [ ! -f "$FILE" ] && exit 0
case "$FILE" in *.ts|*.tsx|*.js|*.mjs|*.json|*.css|*.md|*.mdx|*.yml|*.yaml) ;; *) exit 0 ;; esac
[ -x "$ROOT/node_modules/.bin/prettier" ] && "$ROOT/node_modules/.bin/prettier" --write --log-level silent "$FILE" >/dev/null 2>&1
exit 0
