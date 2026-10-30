# SETUP · Accounts, isolation and human key turns

This Mac has several projects, several GitHub accounts logged in, and other Vercel logins. **Parampara must never change anything outside this folder.** Everything below is scoped to this repo.

## 1. GitHub (account: `buildrocketlabs`)
- We never run `gh auth switch`, `gh auth login`, `gh auth logout` or `gh auth setup-git`; those change global state.
- `scripts/gh.sh` runs `gh` with `GH_TOKEN` taken from `gh auth token --hostname github.com --user buildrocketlabs`, which reads that account's existing token **without switching the active account**.
- `scripts/setup-accounts.sh` (run once) sets **repo local** git config only:
  - `user.name` = `buildrocketlabs`, `user.email` = the account's GitHub noreply address (`<id>+buildrocketlabs@users.noreply.github.com`).
  - A repo local credential helper that clears inherited helpers and answers with the `buildrocketlabs` token, so `git push` here always uses that account while every other repo keeps its own.
- Create the repo with: `./scripts/gh.sh repo create buildrocketlabs/parampara --private --source=. --remote=origin --push`
- If `buildrocketlabs` is not logged in to `gh`, the human adds it once with `gh auth login` (this adds an account; it does not log others out), then runs `gh auth switch` back to whatever was active before. The agent never does this.

## 2. Vercel
- Preferred: the human imports `buildrocketlabs/parampara` in the Vercel dashboard (signed in to the intended Vercel account) and sets env vars there. Pushes to `main` then deploy automatically. No CLI login needed at all.
- Optional CLI: `scripts/vc.sh` runs the Vercel CLI with `--global-config ./.vercel-cli`, so any login (`./scripts/vc.sh login`) is stored inside this folder (git ignored) and never touches the global Vercel login. The agent never runs `vercel env …` or production promotions.

## 3. Supabase (other projects on this Mac also use Supabase: D30)
- The folder holds **only project scoped credentials**: the project URL, its publishable and secret keys, and its database connection string. No personal access token, no `supabase login`, no `supabase link`. An account wide token could reach every project in the account; a project key cannot.
- `supabase/.project-ref` pins this folder to one project. `scripts/keys.sh` writes it the first time and refuses later if `.env.local` points anywhere else. `pnpm db:push` refuses unless `SUPABASE_DB_URL` matches the pin.
- Migrations: `ALLOW_DB_PUSH=1 pnpm db:push` (dry run: add `DRY=1`). It runs `supabase db push --db-url`, which needs no login and touches only this database.
- Hooks block every Supabase account level command (`link`, `projects`, `orgs`, `--linked`, `--project-ref`, access tokens).
- Do not use the Vercel ↔ Supabase marketplace integration, the Supabase GitHub integration or a Supabase MCP server. Env vars are pasted by hand.
- Use the **Session pooler** connection string (IPv4). The direct `db.<ref>.supabase.co` host is IPv6 only on the free plan.

## 4. Keys (human only, never pasted into chat)
Run `./scripts/keys.sh` in your own Terminal. Hidden input, writes `.env.local` (chmod 600), checks every key with free or tiny calls, prints only ✓ / ✗. Re-check any time with `./scripts/keys.sh --check`.
For Vercel: `./scripts/keys.sh --vercel` copies the runtime variables to the clipboard (wiped after 2 minutes); paste into Vercel → Settings → Environment Variables (it imports all lines). `SUPABASE_DB_URL` is never sent to Vercel.

| Name | From | Side |
|---|---|---|
| `ANTHROPIC_API_KEY` | hackathon key email (product only) | server |
| `SARVAM_API_KEY` | dashboard.sarvam.ai | server |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable) | Supabase project | client safe |
| `SUPABASE_SERVICE_ROLE_KEY` (secret) | Supabase project | server only |
| `SUPABASE_DB_URL` | Supabase → Connect → Session pooler | CLI only, never Vercel |
| `AI_BUDGET_USD_CAP`, `AI_DAILY_USD_CAP`, `AI_QUESTIONS_PER_SESSION_PER_HOUR`, `DEMO_MODE` | defaults written by keys.sh | server |

Never export `ANTHROPIC_API_KEY` in your shell: Claude Code would bill the hackathon key instead of your own login. `keys.sh` warns if it finds it.

## 5. Browser isolation
Create a Chrome profile named **Parampara**. Sign in to GitHub as `buildrocketlabs` there, and use "Continue with GitHub" for Supabase and Vercel in that profile only. Your other GitHub, Supabase and Vercel sessions live in other profiles and are never touched. When Vercel asks for GitHub access, choose **Only select repositories → parampara**.

## 6. Human key turns: see docs/HUMAN.md
