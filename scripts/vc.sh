#!/usr/bin/env bash
# Run the Vercel CLI with a config dir INSIDE this folder, so any Vercel login here
# never touches the global Vercel login used by other projects on this Mac.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CFG="$ROOT/.vercel-cli"
mkdir -p "$CFG"
BIN="$ROOT/node_modules/.bin/vercel"
[ -x "$BIN" ] || { echo "Vercel CLI not installed locally. Run: pnpm add -D vercel" >&2; exit 1; }
case "${1:-}" in
  env) echo "refused: env vars are set by the human in the Vercel dashboard" >&2; exit 1 ;;
esac
cd "$ROOT"
exec "$BIN" --global-config "$CFG" "$@"
