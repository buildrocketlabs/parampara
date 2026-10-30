# PARAMPARA (ಪರಂಪರೆ) · Engineering Constitution

**What it is.** Parampara puts the lived wisdom of Karnataka's best master teachers (many of them retired headmasters) in every government school teacher's pocket, by voice, in Kannada.
1. An AI interviewer talks with a master teacher in Kannada and draws out exactly how they solved real classroom problems.
2. Claude turns each conversation into **practice cards** (problem, grade, steps, materials, whose method), every field cited to the moment in the recording. A human reviewer approves each card.
3. A teacher asks a voice question at 9 pm. She hears a Kannada answer built **only** from approved, named practice.
4. Next day she taps **worked / didn't work**. The library learns what works, and the master teacher hears that their wisdom helped.

**Why this repo exists.** AI for Foundational Learning Hackathon (ShikshaNext · Central Square Foundation · Anthropic). Team **Namma Shaale**, selected **Top 30** for **Challenge 3: Teacher Support & Training**. Build deliverables are submitted **31 Oct 2026** (hard deadline 1 Nov, 23:59 IST). Top 10 announced 10 Nov. In person finale with live demo 18 Nov. **The goal is first place.**

**Mascot.** Hanate (ಹಣತೆ), a small clay lamp. The whole product rests on one image: *one lamp lights another and loses nothing.*

## Read order (docs are the memory; chat is not)
1. `docs/BRIEF.md` · who judges, how we are scored, what wins, the judge's hour. Every decision is tested against it.
2. `docs/DECISIONS.md` · pre-answered questions and pinned versions. Check here before asking the founder anything.
3. `docs/DESIGN.md` · the design system. UI and UX are our first impression and are judged on every screen.
4. `docs/AI.md` · roles, the six layers, guardrails, evals, budget.
5. `docs/PLAN.md` · tickets T0 to T11 with dates and demo exits.
6. `docs/SETUP.md` · account isolation. Read it before ANY git, gh, vercel or supabase command.
7. `docs/FIELD.md` and `docs/field/` · consent, master teacher interviews, teacher testing. Real users are part of the 35% bucket.
8. `docs/JURY.md` · the eight jurors, the Tech4Dev evaluator, and the mentors.
9. `docs/handoff/` · newest note first. Write one at the end of every session.

## Stack (locked; a change needs a line in DECISIONS)
Next.js 16 App Router + TypeScript strict · pnpm · Tailwind v4 + shadcn/ui restyled to DESIGN.md · Motion (`motion/react`) · Supabase (Postgres, Auth, Storage) · Vercel AI SDK + `@ai-sdk/anthropic` (Claude Sonnet 5.5 and Haiku 5.5) · Zod · Sarvam AI (Saaras v4 speech to text, Bulbul v3 text to speech, `kn-IN`) · Serwist (PWA, offline) · Vitest · Playwright · Vercel. Verify exact versions with the `researcher` agent before installing and pin them in `docs/DECISIONS.md` §Versions.

## Commands (completed in T0)
`pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm e2e` · `pnpm evals` (replays recordings, spends nothing; `LIVE_EVALS=1` makes real calls) · `pnpm seed:demo` · `./scripts/gh.sh …` (never bare `gh`) · `./scripts/vc.sh …` (never bare `vercel`) · `./scripts/setup-accounts.sh` (once).

## Laws (hooks, tests and the database enforce them, not goodwill)
1. **Account isolation.** This folder uses the `buildrocketlabs` GitHub account and its own Vercel and Supabase credentials, scoped to this folder only. Other projects on this Mac must never notice we exist. Never `gh auth switch|login|logout|setup-git`, never `git config --global|--system`, never bare `gh` or `vercel`, never `supabase login`. If something seems to need a global change, stop and ask.
2. **Secrets never enter the conversation.** Never read, print, grep or cat `.env*` (only `.env.example` is readable). Keys live in `.env.local` (written by the human) and in the Vercel and Supabase dashboards. The hackathon Claude key is server only: never in client code, logs, traces, screenshots or commits. It is for the product, never for coding.
3. **All model calls live in `ai/`**, through roles in `ai/router.ts`. Every output is Zod validated structured output. Bounded retry of 2, then a safe fallback (`needs_human`). Prompts are versioned TypeScript constants. Never `JSON.parse` free text.
4. **Grounded or silent.** A teacher answer contains only steps that cite an approved practice card. The grounding check runs on every answer; an ungrounded step is removed, and if too little remains the question goes to a human. Never invent pedagogy.
5. **Children are safe by construction.** Teachers are asked to say *a child*, not a name, and the triage step redacts any child name before storage, answering, logs and traces. No advice involving punishment, shaming or fear, ever. A child welfare disclosure escalates to a human and shows Childline 1098. No children's faces in the app or the repo.
6. **Teachers are never monitored.** No leaderboards, rankings or reports that name a teacher. Insights are anonymous and aggregate. Delight is personal, warm and private.
7. **Truth in the UI.** Every number shown is computed from the database. Real field data is labelled *Koppal field test*; synthetic data is labelled *Sample*. No invented testimonials, counts or quotes. AI generated images carry *Illustration*.
8. **Kannada first, English one tap away.** Teachers and masters default to Kannada. Jurors toggle English anywhere. Every answer carries an English rendering.
9. **Works on bad networks.** Offline library, queued voice questions, text fallback, graceful degradation. Evaluators will throttle the network.
10. **Budget is a feature.** Every AI call is logged with tokens and cost in `ai_calls`. A hard cap (`AI_BUDGET_USD_CAP`) and per session rate limits protect the credits until 20 Nov. When the cap is near, the app serves cached answers and says so kindly.

## Boundaries (hooks enforce; listed so you do not fight them)
No writes outside the repo, to `.env*`, `.mcp.json` or `scripts/hooks/`. No reads of `.env*`. No global auth or config changes. No `git push --force`. No `vercel env …` from the agent. `supabase db push` only with `ALLOW_DB_PUSH=1` written in that command by the human. No new dependency without a one line reason in DECISIONS §Dependencies.

## Definition of done (every ticket)
Ticket ID in the commit message · works at 390 px and 1280 px, in Kannada and English · loading, empty, error and offline states designed, never default · reduced motion respected · Playwright screenshots in `docs/demos/<ticket>/` · `pnpm typecheck && pnpm lint && pnpm test` green (plus `pnpm evals` if `ai/` changed) · `design-critic` reviewed every UI ticket and `jury` reviewed every milestone · handoff note written.

## Agents and skills
Agents (`.claude/agents/`): `researcher` (read only, versions and docs) · `verifier` (runs the ladder, never fixes) · `design-critic` (world class UI review from screenshots) · `jury` (plays each juror and the Tech4Dev evaluator) · `safety-auditor` · `eval-runner`.
Skills (`.claude/skills/`): `ui-screen` · `mascot-and-motion` · `ai-role` · `field-data` · `demo-path` · `release`. Use them; they encode decisions already made.

## Style
Small modules, explicit names, no clever abstractions. Server Components by default, client components only for interaction. Comments only where the why is not obvious. User facing English copy: warm, short, respectful, no em dashes and no hyphenated filler.

**North star.** *A young teacher alone at 9 pm should feel that the best teacher Karnataka ever had just answered her. A juror should feel the same thing within 30 seconds of opening the link.*
