#!/usr/bin/env bash
# Run gh as buildrocketlabs for this repo only. Never switches the globally active gh account.
set -euo pipefail
GH_USER="${PARAMPARA_GH_USER:-buildrocketlabs}"
command -v gh >/dev/null 2>&1 || { echo "gh is not installed" >&2; exit 1; }
case "${1:-} ${2:-}" in
  "auth switch"|"auth login"|"auth logout"|"auth setup-git"|"auth refresh"|"auth token")
    echo "refused: '$1 $2' changes or prints global gh auth. See docs/SETUP.md." >&2; exit 1 ;;
esac
TOKEN="$(gh auth token --hostname github.com --user "$GH_USER" 2>/dev/null)" || {
  echo "The '$GH_USER' account is not logged in to gh on this Mac. Human step: docs/SETUP.md §1." >&2; exit 1; }
GH_TOKEN="$TOKEN" GH_HOST="github.com" GH_PROMPT_DISABLED=1 exec gh "$@"
