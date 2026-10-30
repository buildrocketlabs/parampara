#!/usr/bin/env bash
# One time, idempotent. Pins THIS folder to the buildrocketlabs GitHub account using
# repo local git config only. Changes nothing global. Safe to re-run.
set -euo pipefail
GH_USER="${PARAMPARA_GH_USER:-buildrocketlabs}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -f CLAUDE.md ] || { echo "Run from the parampara folder" >&2; exit 1; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

echo "Parampara account setup (repo local only)"
command -v git >/dev/null || die "git missing"
command -v gh  >/dev/null || die "gh missing"
command -v node >/dev/null || die "node missing"

ACTIVE_BEFORE="$(gh api user --jq .login 2>/dev/null || echo unknown)"
ok "globally active gh account is '$ACTIVE_BEFORE' (left unchanged)"

TOKEN="$(gh auth token --hostname github.com --user "$GH_USER" 2>/dev/null)" \
  || die "'$GH_USER' is not logged in to gh. Human: see docs/SETUP.md §1, then re-run."
INFO="$(GH_TOKEN="$TOKEN" gh api user --jq '[.login,.id]|@tsv')" || die "token for $GH_USER did not work"
LOGIN="$(printf '%s' "$INFO" | cut -f1)"; UID_GH="$(printf '%s' "$INFO" | cut -f2)"
[ "$LOGIN" = "$GH_USER" ] || die "token belongs to '$LOGIN', expected '$GH_USER'"
ok "found existing login for $GH_USER (id $UID_GH)"

[ -d .git ] || { git init -q -b main; ok "git init (branch main)"; }

git config --local user.name  "$GH_USER"
git config --local user.email "${UID_GH}+${GH_USER}@users.noreply.github.com"
ok "repo local identity: $GH_USER <${UID_GH}+${GH_USER}@users.noreply.github.com>"

# Credential helper: reset inherited helpers (osxkeychain, gh setup-git) for this repo only,
# then answer with the buildrocketlabs token, fetched fresh each time (never stored).
git config --local --unset-all credential.helper 2>/dev/null || true
git config --local --unset-all credential.https://github.com.helper 2>/dev/null || true
git config --local credential.helper ""
git config --local credential.https://github.com.helper ""
git config --local --add credential.https://github.com.helper \
  "!f() { test \"\$1\" = get || exit 0; echo username=$GH_USER; echo password=\$(gh auth token --hostname github.com --user $GH_USER); }; f"
git config --local credential.https://github.com.username "$GH_USER"
ok "repo local credential helper pinned to $GH_USER"

# Signing keys from other accounts must not be used here
git config --local commit.gpgsign false
git config --local tag.gpgsign false
# Commit hook: secret scan
git config --local core.hooksPath .githooks
ok "pre-commit secret scan enabled"

# Global URL rewrites (https -> ssh) would bypass the pinned helper and use another account's SSH key
if git config --get-regexp '^url\..*\.insteadof$' 2>/dev/null | grep -qi github; then
  warn "a global url.*.insteadOf rewrites github URLs (possibly to SSH)."
  warn "Pushes from here could use another account's SSH key. Tell Claude; we will add a repo local pushurl."
fi

if git remote get-url origin >/dev/null 2>&1; then
  URL="$(git remote get-url origin)"
  case "$URL" in https://github.com/$GH_USER/*) ok "origin is $URL" ;; *) warn "origin is $URL (expected https://github.com/$GH_USER/...)" ;; esac
fi

mkdir -p .vercel-cli && ok ".vercel-cli/ ready (folder local Vercel login, git ignored)"

ACTIVE_AFTER="$(gh api user --jq .login 2>/dev/null || echo unknown)"
[ "$ACTIVE_BEFORE" = "$ACTIVE_AFTER" ] && ok "global gh account still '$ACTIVE_AFTER'" || die "global gh account changed! ($ACTIVE_BEFORE -> $ACTIVE_AFTER)"
echo "Done. Nothing outside $ROOT was changed."
