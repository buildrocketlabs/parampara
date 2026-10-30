#!/usr/bin/env bash
# PreToolUse(Bash). Exit 2 blocks the command and shows the reason to Claude.
# Protects: other GitHub accounts, other Vercel logins, global git config, secrets.
INPUT="$(cat)"
CMD="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input.command||"")}catch{}})')"
[ -z "$CMD" ] && exit 0
block() { echo "BLOCKED by guard-commands: $1. See CLAUDE.md Law 1/2 and docs/SETUP.md." >&2; exit 2; }
has() { printf '%s' "$CMD" | grep -Eq -- "$1"; }
SEG='(^|[;&|(`]|\$\()[[:space:]]*'   # start of a shell command segment

# 1. GitHub: never touch global gh auth; never call gh directly (use ./scripts/gh.sh)
has "gh[[:space:]]+auth[[:space:]]+(switch|login|logout|setup-git|refresh)" && block "global gh auth change"
has "${SEG}(command[[:space:]]+)?gh([[:space:]]|$)" && block "call ./scripts/gh.sh instead of gh (pins the buildrocketlabs account)"
has "GH_TOKEN=|GITHUB_TOKEN=|GH_CONFIG_DIR=" && block "token or gh config override outside scripts/gh.sh"

# 2. git: repo local only
has "git[[:space:]]+config[[:space:]]+(.*[[:space:]])?--(global|system)" && block "global or system git config"
has "git[[:space:]]+push.*([[:space:]]-f([[:space:]]|$)|--force|--mirror|--delete|[[:space:]]:)" && block "force push, mirror or remote delete"
has "git[[:space:]]+remote[[:space:]]+(add|set-url)" && ! has "https://github\.com/buildrocketlabs/" && block "remote must be https://github.com/buildrocketlabs/..."
has "git[[:space:]]+(reset[[:space:]]+--hard|clean[[:space:]]+-[a-z]*f)" && block "destructive git command; ask the human"
has "git[[:space:]]+filter-(branch|repo)" && block "history rewrite; ask the human"

# 3. Vercel: only through ./scripts/vc.sh (folder local login); env and prod are human only
has "${SEG}((npx|pnpm[[:space:]]+(dlx|exec)|bunx|yarn)[[:space:]]+)?vercel([@[:space:]]|$)" && block "call ./scripts/vc.sh instead of vercel (keeps login inside this folder)"
has "vc\.sh[[:space:]]+(env|login|logout|switch|teams|link[[:space:]].*--yes|promote|rollback|remove|rm|alias)" && block "Vercel account, env or production action is human only"
has "vc\.sh.*--prod" && block "production deploys happen from git, by the human"

# 4. Other global logins
has "supabase[[:space:]]+login" && block "supabase login is global; use SUPABASE_ACCESS_TOKEN from .env.local"
has "(npm|pnpm|yarn)[[:space:]]+(login|adduser|publish)" && block "package registry login or publish"
has "supabase[[:space:]]+db[[:space:]]+(push|reset)" && ! has "ALLOW_DB_PUSH=1" && block "database push/reset needs ALLOW_DB_PUSH=1 from the human"
has "supabase[[:space:]]+(start|stop)" && block "local Supabase Docker stack is off (D16); use the hosted project"
# Supabase account isolation (D30): other projects on this Mac use Supabase. Never use the global
# CLI login or an account wide token; only the project scoped DB URL through pnpm db:push.
has "supabase[[:space:]]+(link|unlink|projects|orgs|logout|secrets|functions|branches|config[[:space:]]+push|sso|domains|vanity-subdomains|network-restrictions|ssl-enforcement|postgres-config|snippets|storage|backups|inspect|migration[[:space:]]+(repair|fetch|list[[:space:]]+--linked))" && block "Supabase account level command; only pnpm db:push is allowed"
has "supabase.*--linked|supabase.*--project-ref" && block "linked/project-ref Supabase commands use the global login"
has "SUPABASE_ACCESS_TOKEN|sbp_[A-Za-z0-9]" && block "account wide Supabase token"
has "keys\.sh" && block "scripts/keys.sh is human only (run it in your own Terminal)"

# 5. Secrets never enter the conversation
has "(cat|less|more|head|tail|bat|grep|rg|awk|sed|strings|xxd|od|cp|mv|source|\.)[[:space:]].*\.env([^.a-zA-Z]|$|\.local|\.production|\.development)" && ! has "\.env\.example" && block "reading or copying .env files"
has "\.vercel-cli|\.config/gh|\.ssh/|\.netrc|\.gitconfig|osxkeychain|security[[:space:]]+find" && block "credential stores are off limits"
has "${SEG}(printenv|env|set|export[[:space:]]+-p|declare[[:space:]]+-x)([[:space:]]*($|[;&|]))" && block "dumping the environment"
has "echo.*\\\$\{?[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD)" && block "printing a secret variable"
has "gh\.sh[[:space:]]+auth[[:space:]]+token" && block "printing a token"

# 6. Stay inside this folder
has "rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*[[:space:]]+(/|~|\\\$HOME)([[:space:]]|/?$)" && block "recursive delete outside the project"
has "(^|[[:space:]])(sudo|chown|chmod[[:space:]]+-R[[:space:]]+/)" && block "system level change"
has "(npm|pnpm|yarn)[[:space:]]+(add|install|i)[[:space:]].*(-g|--global)" && block "global package install"
has "brew[[:space:]]+(install|uninstall|upgrade|link)" && block "system package change; ask the human"
exit 0
