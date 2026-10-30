#!/usr/bin/env bash
# HUMAN ONLY. Run in your own Terminal, inside this folder (never through Claude).
#   ./scripts/keys.sh            enter or update keys (hidden input), then check them
#   ./scripts/keys.sh --check    check the keys already in .env.local
#   ./scripts/keys.sh --vercel   copy the runtime env vars to the clipboard for Vercel "Import .env"
# Writes only .env.local (git ignored, chmod 600) and supabase/.project-ref (not secret).
# Never prints a secret. Uses only project scoped Supabase credentials (no account wide token).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
ENV=".env.local"; PIN="supabase/.project-ref"
umask 077; touch "$ENV"; chmod 600 "$ENV"
G='\033[32m'; Y='\033[33m'; R='\033[31m'; B='\033[1m'; N='\033[0m'
ok(){ printf "  ${G}✓${N} %s\n" "$1"; }
warn(){ printf "  ${Y}!${N} %s\n" "$1"; }
bad(){ printf "  ${R}✗${N} %s\n" "$1"; }

get(){ grep -E "^$1=" "$ENV" 2>/dev/null | tail -1 | cut -d= -f2-; }
put(){ NAME="$1" VAL="$2" node -e '
  const fs=require("fs"),f=".env.local",n=process.env.NAME,line=n+"="+process.env.VAL;
  let s=fs.existsSync(f)?fs.readFileSync(f,"utf8"):""; const re=new RegExp("^"+n+"=.*$","m");
  s=re.test(s)?s.replace(re,()=>line):(s&&!s.endsWith("\n")?s+"\n":s)+line+"\n";
  fs.writeFileSync(f,s,{mode:0o600});'; }
drop(){ NAME="$1" node -e '
  const fs=require("fs"),f=".env.local";const re=new RegExp("^"+process.env.NAME+"=.*\\n?","mg");
  fs.writeFileSync(f,fs.readFileSync(f,"utf8").replace(re,""),{mode:0o600});'; }
ask(){ # name, label, secret(1|0), default
  local cur; cur="$(get "$1")"; local hint=""; [ -n "$cur" ] && hint=" (Enter keeps current)"
  [ -z "$cur" ] && [ -n "${4:-}" ] && hint=" (Enter = $4)"
  local v; if [ "$3" = 1 ]; then read -r -s -p "  $2$hint: " v; echo; else read -r -p "  $2$hint: " v; fi
  v="$(printf '%s' "$v" | tr -d '[:space:]')"
  [ -z "$v" ] && v="${cur:-${4:-}}"; put "$1" "$v"; }
code(){ # method url header... (headers via files so secrets never hit the process list)
  local m="$1" u="$2"; shift 2; local args=() h
  for h in "$@"; do args+=(-H "@$h"); done
  curl -s -o /dev/null -w '%{http_code}' -X "$m" --max-time 20 "${args[@]}" "$u" 2>/dev/null || echo 000; }
hdr(){ local f; f="$(mktemp)"; chmod 600 "$f"; printf '%s\n' "$@" > "$f"; echo "$f"; }

check(){
  echo -e "\n${B}Checking keys${N} (nothing is printed)"
  [ -n "${ANTHROPIC_API_KEY:-}" ] && bad "ANTHROPIC_API_KEY is exported in this terminal. Claude Code would bill the hackathon key. Remove it from ~/.zshrc and open a new terminal."
  local a; a="$(get ANTHROPIC_API_KEY)"
  if [ -z "$a" ]; then bad "ANTHROPIC_API_KEY missing"; else
    local h; h="$(hdr "x-api-key: $a" "anthropic-version: 2023-06-01")"
    local c; c="$(code GET https://api.anthropic.com/v1/models "$h")"; rm -f "$h"
    [ "$c" = 200 ] && ok "Anthropic key works (free check, no tokens spent)" || bad "Anthropic key rejected (HTTP $c)"; fi
  local s; s="$(get SARVAM_API_KEY)"
  if [ -z "$s" ]; then warn "SARVAM_API_KEY missing (needed for T2 on 19 Oct)"; else
    local h; h="$(hdr "api-subscription-key: $s" "Content-Type: application/json")"
    local c; c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H "@$h" -X POST https://api.sarvam.ai/translate \
      -d '{"input":"ok","source_language_code":"en-IN","target_language_code":"kn-IN"}' 2>/dev/null || echo 000)"; rm -f "$h"
    case "$c" in 200) ok "Sarvam key works (one tiny translate call)";; 401|403) bad "Sarvam key rejected (HTTP $c)";; *) warn "Sarvam key saved; could not verify (HTTP $c). T2 will test it.";; esac; fi
  local url ref anon sec db; url="$(get NEXT_PUBLIC_SUPABASE_URL)"; anon="$(get NEXT_PUBLIC_SUPABASE_ANON_KEY)"; sec="$(get SUPABASE_SERVICE_ROLE_KEY)"; db="$(get SUPABASE_DB_URL)"
  if [[ "$url" =~ ^https://([a-z0-9]{20})\.supabase\.co$ ]]; then ref="${BASH_REMATCH[1]}"; ok "Supabase URL looks right (project $ref)"
  else bad "NEXT_PUBLIC_SUPABASE_URL should look like https://<20 letters>.supabase.co"; return; fi
  if [ -f "$PIN" ] && [ "$(cat "$PIN")" != "$ref" ]; then bad "This folder is pinned to project $(cat "$PIN") but .env.local points at $ref. Stopping."; return; fi
  [ -f "$PIN" ] || { echo "$ref" > "$PIN"; chmod 644 "$PIN"; ok "pinned this folder to Supabase project $ref ($PIN)"; }
  if [ -n "$anon" ]; then
    local h; h="$(hdr "apikey: $anon")"; local body; body="$(curl -s --max-time 20 -H "@$h" "$url/auth/v1/settings" 2>/dev/null)"; rm -f "$h"
    if printf '%s' "$body" | grep -q '"external"'; then ok "publishable (anon) key works"
      printf '%s' "$body" | grep -q '"anonymous_users":true' && ok "anonymous sign ins are ON" || warn "anonymous sign ins look OFF: Authentication → Sign In / Providers → Allow anonymous sign ins"
    else bad "publishable (anon) key rejected"; fi
  else bad "NEXT_PUBLIC_SUPABASE_ANON_KEY missing"; fi
  if [ -n "$sec" ]; then
    local h; if [[ "$sec" == eyJ* ]]; then h="$(hdr "apikey: $sec" "Authorization: Bearer $sec")"; else h="$(hdr "apikey: $sec")"; fi
    local c; c="$(code GET "$url/auth/v1/admin/users?per_page=1" "$h")"; rm -f "$h"
    [ "$c" = 200 ] && ok "secret (service role) key works" || bad "secret (service role) key rejected (HTTP $c)"
  else bad "SUPABASE_SERVICE_ROLE_KEY missing"; fi
  if [ -z "$db" ]; then bad "SUPABASE_DB_URL missing"
  else case "$db" in
    *"[YOUR-PASSWORD]"*) bad "SUPABASE_DB_URL still has [YOUR-PASSWORD]";;
    *"//postgres.$ref:"*pooler.supabase.com*|*"//postgres.$ref@"*pooler.supabase.com*) ok "database URL is the session pooler for $ref";;
    *"db.$ref.supabase.co"*) warn "database URL is the direct (IPv6 only) host; if db:push fails, use the Session pooler string";;
    *) bad "SUPABASE_DB_URL does not point at project $ref. Stopping."; return;; esac; fi
  [ -n "$(get SUPABASE_ACCESS_TOKEN)" ] && { drop SUPABASE_ACCESS_TOKEN; ok "removed account wide SUPABASE_ACCESS_TOKEN (not needed)"; }
  echo -e "\nNext: ${B}ALLOW_DB_PUSH=1 pnpm db:push${N}   then   ${B}./scripts/keys.sh --vercel${N}"
}

vercel_copy(){
  local names="ANTHROPIC_API_KEY SARVAM_API_KEY NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY AI_BUDGET_USD_CAP AI_DAILY_USD_CAP AI_QUESTIONS_PER_SESSION_PER_HOUR DEMO_MODE"
  local out="" n v
  for n in $names; do v="$(get "$n")"; [ -n "$v" ] && out="$out$n=$v"$'\n'; done
  command -v pbcopy >/dev/null || { bad "pbcopy not found (macOS only)"; exit 1; }
  printf '%s' "$out" | pbcopy
  ok "copied: $names"
  echo "  Vercel → Project → Settings → Environment Variables → paste into the first Key box (it imports all lines)."
  echo "  Tick Production and Preview. SUPABASE_DB_URL is deliberately NOT copied (CLI only)."
  ( sleep 120; printf '' | pbcopy ) >/dev/null 2>&1 &
  warn "clipboard will be wiped in 2 minutes"
}

case "${1:-}" in
  --check) check; exit 0;;
  --vercel) vercel_copy; exit 0;;
esac

echo -e "${B}Parampara keys${N} · input is hidden · Enter keeps what is already saved\n"
echo -e "${B}1. Anthropic${N} (the hackathon key from the organiser email; product only)"
ask ANTHROPIC_API_KEY "ANTHROPIC_API_KEY" 1
echo -e "\n${B}2. Sarvam${N} (dashboard.sarvam.ai → API keys)"
ask SARVAM_API_KEY "SARVAM_API_KEY" 1
echo -e "\n${B}3. Supabase${N} (project parampara → Connect / Project Settings → API Keys)"
ask NEXT_PUBLIC_SUPABASE_URL "Project URL (https://xxxx.supabase.co)" 0
ask NEXT_PUBLIC_SUPABASE_ANON_KEY "Publishable key (sb_publishable_…) or legacy anon key" 1
ask SUPABASE_SERVICE_ROLE_KEY "Secret key (sb_secret_…) or legacy service_role key" 1
if [ -z "$(get SUPABASE_DB_URL)" ] || { read -r -p "  Replace saved database URL? [y/N]: " r; [ "$r" = y ]; }; then
  read -r -p "  Session pooler connection string (Connect → Session pooler, with [YOUR-PASSWORD]): " P
  read -r -s -p "  Database password: " PW; echo
  DB="$(P="$P" PW="$PW" node -e 'process.stdout.write(process.env.P.trim().replace("[YOUR-PASSWORD]",encodeURIComponent(process.env.PW)))')"
  put SUPABASE_DB_URL "$DB"; unset PW DB
fi
for kv in AI_BUDGET_USD_CAP=350 AI_DAILY_USD_CAP=25 AI_QUESTIONS_PER_SESSION_PER_HOUR=30 DEMO_MODE=false NEXT_PUBLIC_APP_URL=http://localhost:3000 PARAMPARA_GH_USER=buildrocketlabs; do
  [ -z "$(get "${kv%%=*}")" ] && put "${kv%%=*}" "${kv#*=}"; done
ok "saved .env.local (chmod 600)"
check
