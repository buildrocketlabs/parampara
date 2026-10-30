#!/usr/bin/env bash
# The public snapshot of Parampara (docs/RELEASE.md). Prepared by the agent, run by the founder.
#
#   ./scripts/release-snapshot.sh              dry run (default): build the snapshot, scan it, print
#                                              every file that would be published. Changes nothing
#                                              outside .release/ (git ignored) and nothing on GitHub.
#   ./scripts/release-snapshot.sh --execute    the same, then, after a typed confirmation, create the
#                                              public repo and push the snapshot as one commit.
#
# The snapshot is `git archive` of a commit (HEAD, or RELEASE_REF=<tag or sha>), never the working
# directory, so untracked and ignored files (.env.local, field-private/, recordings) cannot leak.
# Extra private patterns (the founder's email, phone numbers, real names that must never appear)
# go one per line in field-private/release-patterns.txt, which is never in git; any hit blocks.
# Works with macOS bash 3.2 (no associative arrays).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
MODE="dry"
case "${1:-}" in
  "" | --dry-run) MODE="dry" ;;
  --execute) MODE="execute" ;;
  *) echo "usage: $0 [--dry-run | --execute]" >&2; exit 2 ;;
esac
REF="${RELEASE_REF:-HEAD}"
PUBLIC_REPO="${PUBLIC_REPO:-buildrocketlabs/parampara}"
GH_USER="${PARAMPARA_GH_USER:-buildrocketlabs}"
OUT="$ROOT/.release"
SNAP="$OUT/snapshot"
PRIVATE_PATTERNS="$ROOT/field-private/release-patterns.txt"

# Removed from the public snapshot, with the reason (reviewed 28 Oct; docs/DECISIONS.md D91).
REMOVE=(
  "docs/BRIEF.md|strategy: scoring, the competition, what wins"
  "docs/JURY.md|profiles of the jurors, the evaluator and the mentors"
  "docs/HUMAN.md|the founder's personal to do list"
  "KICKOFF.md|the first prompt to the coding agent"
  "docs/PLAN.md|internal schedule; names the mentors"
  "docs/BUILD.md|internal build brief; names jurors and family, working notes"
  "docs/handoff|session notes: internal state, self scores, founder key turns (incl. *architect*, *final*)"
  "docs/story/STORY.md|video strategy notes"
  "docs/field/messages.md|family and recruitment messages; the founder's full name and contact line"
  "docs/field/appa-messages.md|private messages with the first master"
  "docs/field/import-day.md|the founder's private runbook (reviewer link, keys)"
  "docs/field/kannada-review.md|generated working copy, stale; lib/i18n is the source"
  "field-private|never in git; listed so it can never slip in"
  ".claude/agents/jury.md|the simulated jury: profiles of real jurors"
  "video/craft/CREATIVE-BRIEF.md|names each juror and what they must feel: strategy, like docs/JURY.md"
  "deck/craft|the deck brief: private planning notes, names the jurors"
  ".claude/skills/remotion-markup|copied from remotion-dev/skills, which has no licence file"
)

# The best 20 screenshots: the judge's path, phone and desktop, Kannada and English, offline.
# Every other file in docs/demos is left out of the public snapshot.
KEEP_DEMOS=(
  "docs/demos/M6/desktop-landing-390-kn.png"
  "docs/demos/M6/desktop-landing-1280-en.png"
  "docs/demos/M6/desktop-t-home-390-kn.png"
  "docs/demos/M6/desktop-t-ask-390-en.png"
  "docs/demos/M6/desktop-t-answer-390-kn.png"
  "docs/demos/M6/desktop-t-answer-1280-en.png"
  "docs/demos/M6/desktop-s-trace-1280-en.png"
  "docs/demos/M6/desktop-t-tried-390-kn.png"
  "docs/demos/M6/desktop-s-celebrate-390-en.png"
  "docs/demos/M6/hunger-note-no-card-390-en.png"
  "docs/demos/M6/desktop-s-showme-390-en.png"
  "docs/demos/M6/desktop-m-home-390-kn.png"
  "docs/demos/M6/desktop-m-talk-1280-en.png"
  "docs/demos/M6/desktop-r-card-1280-en.png"
  "docs/demos/M6/desktop-r-queue-390-kn.png"
  "docs/demos/M6/desktop-i-home-1280-en.png"
  "docs/demos/M6/desktop-i-lamps-390-kn.png"
  "docs/demos/M6/desktop-how-1280-en.png"
  "docs/demos/M4/pwa-saved-offline-390-en.png"
  "docs/demos/M4/pwa-question-queued-390-en.png"
)

# Kept, but a person should read them once more on the day (they change in the field week).
REVIEW=(
  "README.md|the Field section: every {…} filled from the database, nothing typed by hand"
  "docs/field/log.md|first names or roles only"
  "docs/field/mentor-input.md|mentor names only if they agreed to be credited"
  "docs/field/changes.json|role words only; before and after shots without faces or names"
  "CLAUDE.md|still points to files that are left out (BRIEF, JURY, PLAN, handoffs)"
)

BLOCK=0
block() { echo "  BLOCK  $*"; BLOCK=$((BLOCK + 1)); }
note() { echo "  note   $*"; }

# 1. Build the snapshot from the commit.
SHA="$(git rev-parse --short "$REF")"
rm -rf "$SNAP"
mkdir -p "$SNAP"
git archive --format=tar "$REF" | tar -x -C "$SNAP"

# 2. Remove what is not public.
REMOVED_LINES=()
for entry in "${REMOVE[@]}"; do
  path="${entry%%|*}"
  why="${entry#*|}"
  if [ -e "$SNAP/$path" ]; then
    n="$(find "$SNAP/$path" -type f | wc -l | tr -d ' ')"
    rm -rf "${SNAP:?}/$path"
    REMOVED_LINES+=("$path ($n file(s)): $why")
  else
    REMOVED_LINES+=("$path (not in this commit): $why")
  fi
done

# 3. Trim docs/demos to the kept 20.
for keep in "${KEEP_DEMOS[@]}"; do
  [ -f "$SNAP/$keep" ] || { echo "missing kept screenshot: $keep" >&2; exit 1; }
done
DEMOS_BEFORE="$(find "$SNAP/docs/demos" -type f | wc -l | tr -d ' ')"
mkdir -p "$OUT/keep"
rm -rf "$OUT/keep"/*
for keep in "${KEEP_DEMOS[@]}"; do
  mkdir -p "$OUT/keep/$(dirname "$keep")"
  cp "$SNAP/$keep" "$OUT/keep/$keep"
done
rm -rf "$SNAP/docs/demos"
cp -R "$OUT/keep/docs/demos" "$SNAP/docs/demos"
rm -rf "$OUT/keep"
DEMOS_AFTER="$(find "$SNAP/docs/demos" -type f | wc -l | tr -d ' ')"
REMOVED_LINES+=("docs/demos: $((DEMOS_BEFORE - DEMOS_AFTER)) of $DEMOS_BEFORE screenshots left out; the 20 in KEEP_DEMOS stay")

# 4. Scan the snapshot.
echo "== Scans (snapshot of $SHA) =="
# 4a. The repository's own secret and personal data scan, on exactly these files.
(
  cd "$SNAP"
  git init -q
  git add -A
  node scripts/check-secrets.mjs
) || block "scripts/check-secrets.mjs found something (above)"

# 4b. No env file but the example.
ENVS="$(cd "$SNAP" && find . -name '.env*' ! -name '.env.example' -print)"
[ -z "$ENVS" ] && echo "  ok     no .env file but .env.example" || block "env files: $ENVS"

# grep over the snapshot: options first, then one pattern (BSD grep stops at the first operand).
grep_snap() { (cd "$SNAP" && grep -rIE --exclude-dir=.git "$@" . 2>/dev/null) || true; }

# 4c. Key shaped strings. Bare mentions ("sk-ant", "sbp_") are fine in docs and in the scanners.
HITS="$(grep_snap -n 'sk-ant-[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{16,}')"
[ -z "$HITS" ] && echo "  ok     no key shaped strings (sk-ant-…, sbp_…, sb_secret_…)" || { echo "$HITS"; block "key shaped strings"; }
MENTIONS="$(grep_snap -l 'sk-ant|sbp_' | sed 's/^\.\///' | sort | tr '\n' ' ')"
[ -n "$MENTIONS" ] && note "bare mentions of sk-ant or sbp_ (scanner rules and docs, no keys): $MENTIONS"

# Tests and eval sets carry synthetic personal data on purpose (they test the redaction): a hit
# there is listed, not blocked. So is the one synthetic phone number the redaction code documents.
SYNTHETIC_PATH='^\./(evals|tests)/|^\./ai/evals/|\.test\.(ts|tsx|mjs):'
SYNTHETIC_LITERAL='98450[ -]?12345'
split_hits() { # $1 = hits (./path:...), $2 = label; blocks on real looking hits, notes the rest
  local real synthetic
  real="$(printf '%s\n' "$1" | grep -vE "$SYNTHETIC_PATH" | grep -vE "$SYNTHETIC_LITERAL" | grep -v '^$' || true)"
  synthetic="$(printf '%s\n' "$1" | grep -E "$SYNTHETIC_PATH|$SYNTHETIC_LITERAL" | cut -d: -f1 | sort -u | tr '\n' ' ' || true)"
  [ -n "$synthetic" ] && note "$2, synthetic, in tests or eval sets (expected): $synthetic"
  if [ -z "$real" ]; then echo "  ok     no $2 outside tests and eval sets"; else echo "$real"; block "$2"; fi
}

# 4d. Email addresses: personal mail providers block; anything off the allow list is listed.
PERSONAL_RE='@(gmail|googlemail|yahoo|outlook|hotmail|live|icloud|me|proton|protonmail|rediffmail|ymail)\.'
EMAILS="$(grep_snap -o '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')"
split_hits "$(printf '%s\n' "$EMAILS" | grep -iE "$PERSONAL_RE" || true)" "personal email addresses"
OTHER="$(printf '%s\n' "$EMAILS" | grep -viE "$PERSONAL_RE" \
  | grep -vE '@(demo\.)?parampara\.invalid|@users\.noreply\.github\.com|@example\.(com|org)|@anthropic\.com|^$' \
  | sed 's/^\.\///' | sort -u || true)"
[ -n "$OTHER" ] && { note "other addresses, read them once:"; printf '         %s\n' $OTHER; }

# 4e. Phone numbers, also written with a space or a dash (check-secrets catches the plain form).
split_hits "$(grep_snap -n '(^|[^0-9A-Za-z])(\+91[ -]?)?[6-9][0-9]{4}[ -][0-9]{5}([^0-9A-Za-z]|$)')" "phone numbers"

# 4f. A child named in prose that people read (case sensitive: a name starts with a capital).
PROSE="$(grep_snap -n --include='*.md' --include='*.tsx' --include='*.svg' --include='*.json' \
  --exclude-dir=evals '([Cc]hild|[Gg]irl|[Bb]oy|[Ss]tudent|[Pp]upil|[Dd]aughter|[Ss]on)( is)? (named|called) [A-Z][a-z]+' \
  | grep -vE '^\./(ai|tests)/' || true)"
PROSE_KN="$(grep_snap -n --include='*.md' --exclude-dir=evals 'ಮಗುವಿನ ಹೆಸರು [^ ,.]+')"
if [ -z "$PROSE$PROSE_KN" ]; then
  echo "  ok     no child named in docs or screens"
else
  echo "$PROSE$PROSE_KN"
  block "a child named in docs or screens (read each: synthetic and labelled is fine, real is not)"
fi
SYNTH="$(cd "$SNAP" && grep -rIlE '(named|called) [A-Z][a-z]+' evals ai tests lib 2>/dev/null | wc -l | tr -d ' ')"
note "$SYNTH files in evals, ai, lib and tests name a synthetic child on purpose (redaction tests)"

# 4g. The founder's private patterns, never stored in git.
if [ -f "$PRIVATE_PATTERNS" ]; then
  # Blank lines and # comments are dropped: an empty pattern would match every file.
  grep -vE '^[[:space:]]*(#|$)' "$PRIVATE_PATTERNS" > "$OUT/patterns.txt" || true
  if [ -s "$OUT/patterns.txt" ]; then
    HITS="$(cd "$SNAP" && grep -rIilF --exclude-dir=.git -f "$OUT/patterns.txt" . 2>/dev/null || true)"
  else
    HITS=""
  fi
  rm -f "$OUT/patterns.txt"
  [ -z "$HITS" ] && echo "  ok     none of the private patterns" || { echo "$HITS"; block "private patterns found in the files above"; }
else
  note "no field-private/release-patterns.txt: add the founder's email and phone, one per line, and run again"
fi

# 5. Print every published file, grouped by top level folder, with counts.
FILES="$OUT/files.txt"
(cd "$SNAP" && find . -type f ! -path './.git/*' | sed 's/^\.\///' | LC_ALL=C sort) > "$FILES"
TOTAL="$(wc -l < "$FILES" | tr -d ' ')"
echo
echo "== Published files: $TOTAL (list also in .release/files.txt) =="
for group in $(awk -F/ '{print (NF > 1 ? $1 "/" : $1)}' "$FILES" | LC_ALL=C sort -u); do
  if [ "${group%/}" != "$group" ]; then
    n="$(grep -c "^$group" "$FILES")"
    echo "-- $group ($n)"
    grep "^$group" "$FILES" | sed 's/^/   /'
  else
    echo "-- $group (1)"
  fi
done
echo
echo "== Counts =="
awk -F/ '{print (NF > 1 ? $1 "/" : "(root)")}' "$FILES" | LC_ALL=C sort | uniq -c | awk '{printf "  %5d  %s\n", $1, $2}'
printf '  %5d  total\n' "$TOTAL"
echo
echo "== Left out =="
for line in "${REMOVED_LINES[@]}"; do echo "  - $line"; done
echo
echo "== Read once more on the day =="
for entry in "${REVIEW[@]}"; do echo "  - ${entry%%|*}: ${entry#*|}"; done
echo
# The snapshot is a second copy of the source inside the repo; left there, it would trip the
# repo's own lint and Law 3 test. A dry run removes it unless KEEP_SNAPSHOT=1 (to browse it).
drop_snapshot() { [ "${KEEP_SNAPSHOT:-0}" = "1" ] || rm -rf "$SNAP"; }
if [ "$BLOCK" -gt 0 ]; then
  echo "RESULT: $BLOCK blocking finding(s). Fix them in the private repo, commit, and run again."
  [ "${KEEP_SNAPSHOT:-0}" = "1" ] || echo "(KEEP_SNAPSHOT=1 keeps .release/snapshot to look at)"
  drop_snapshot
  exit 1
fi
echo "RESULT: clean. Snapshot of $SHA ($TOTAL files). The list is in .release/files.txt."

if [ "$MODE" = "dry" ]; then
  drop_snapshot
  echo "Dry run: nothing was created or pushed."
  exit 0
fi

# --- Execute: only the founder, only after the dry run above is clean ---------------------------
[ -t 0 ] || { echo "refused: --execute needs a person at the keyboard" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "refused: commit or clean the working tree first, so the snapshot is what you reviewed" >&2; exit 1; }
if "$ROOT/scripts/gh.sh" repo view "$PUBLIC_REPO" >/dev/null 2>&1; then
  echo "refused: $PUBLIC_REPO already exists. Rename the private repo first (docs/RELEASE.md step 2)." >&2
  exit 1
fi
NAME="$(git config --local user.name)"
EMAIL="$(git config --local user.email)"
echo
echo "This creates PUBLIC github.com/$PUBLIC_REPO from commit $SHA ($TOTAL files) as $NAME <$EMAIL>."
printf 'Type exactly "publish %s" to go on: ' "$PUBLIC_REPO"
read -r answer
[ "$answer" = "publish $PUBLIC_REPO" ] || { echo "Not confirmed. Nothing was created."; exit 1; }

(
  cd "$SNAP"
  git checkout -q -b main 2>/dev/null || true
  git add -A
  git -c user.name="$NAME" -c user.email="$EMAIL" -c commit.gpgsign=false \
    commit -q -m "Parampara: submission snapshot (private $SHA)"
)
"$ROOT/scripts/gh.sh" repo create "$PUBLIC_REPO" --public \
  --description "Parampara: Karnataka's master teachers' practice, in Kannada, by voice. Team Namma Shaale." \
  --homepage "https://parampara-eta.vercel.app"
# Push with the same repo local credential helper as scripts/setup-accounts.sh (never global).
(
  cd "$SNAP"
  git -c credential.helper= \
    -c "credential.https://github.com.helper=!f() { test \"\$1\" = get || exit 0; echo username=$GH_USER; echo password=\$(gh auth token --hostname github.com --user $GH_USER); }; f" \
    push -q "https://github.com/$PUBLIC_REPO.git" main:main
)
rm -rf "$SNAP"
echo "Published https://github.com/$PUBLIC_REPO (from private $SHA). Next: docs/RELEASE.md step 5."
