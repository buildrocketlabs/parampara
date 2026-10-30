---
name: release
description: Freeze, verify and submit (README, credentials, sample inputs, licence, repo access, video and deck links). Use on 30 and 31 Oct.
---
# Release checklist
1. `node scripts/check-secrets.mjs` clean; `git log -p | grep -iE "sk-ant|sarvam|service_role"` empty.
2. README complete: what, who, live link, test credentials per role, 3 to 5 sample inputs, setup, run locally, `.env.example`, **every AI service and model with what it does and which key**, architecture diagram, guardrails, evals table (from `docs/evals/latest.md`), field numbers (from `v_field_numbers`), limitations, roadmap, licence, team.
3. `demo-path` skill green on the production URL from a fresh phone.
4. Tag `v1.0-submission`; deploy from that tag; note the deployment URL. No commits after 1 Nov 23:59 IST.
5. Repo public (human: `./scripts/gh.sh repo edit buildrocketlabs/parampara --visibility public --accept-visibility-change-consequences`) or evaluator IDs added.
6. YouTube video public, 3:00 or less; deck PDF; links in README.
7. Submit on the Hack2skill dashboard; screenshot the confirmation into `docs/demos/T11/`.
