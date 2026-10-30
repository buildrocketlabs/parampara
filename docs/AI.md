# AI · How Parampara thinks

Every model call lives in `ai/` and goes through a **role** in `ai/router.ts`. No model id appears anywhere else. Every output is a Zod object (AI SDK structured output). Bounded retry 2, then a safe fallback. Each call writes one `ai_calls` row (role, model, prompt version, tokens, cache tokens, cost, latency, ok) and one span in the answer's trace.

## 1. Models (verified 17 Oct 2026, platform.claude.com/docs/en/models/overview; re-verify before pinning)
| Model | API id | Price per MTok in / out | Use |
|---|---|---|---|
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | $2 / $10 | Reasoning roles: interviewer, card extractor, answerer |
| Claude Haiku 5.5 | `claude-haiku-5-5` | from $0.10 / $0.50 (check pricing page for exact) | Fast roles: triage, retrieval ranking, grounding judge, safety |
| Claude Opus 5.5 | `claude-opus-5-5` | $4 / $20 | **Not used in the product.** Evals or offline analysis only, if ever |
Speech (not Claude): **Sarvam Saaras v4** speech to text and **Bulbul v3** text to speech, both `kn-IN`. Verify request limits, timestamps and pricing in T2.

## 2. Roles
| Role | Model | Input | Output (Zod) | Guardrail |
|---|---|---|---|---|
| `transcribe` | Saaras v4 | audio (teacher question or master answer) | text, segments with timings where available | confidence shown; teacher confirms *Did you mean…?* |
| `interviewer` | Sonnet | topic plan, transcript so far, cards already captured | `{ question_kn, question_en, why, topic, done }` | asks for specifics (exact words said, materials, what if it fails, which grade); never leads; never asks for child names; respects a 30 to 40 minute session |
| `card_extractor` | Sonnet | full interview segments | `PracticeCard[]` where every field cites `evidence_segment_ids` | citation resolvability check (every id exists, quote overlap); punishment based methods are dropped and flagged; cards land as `draft` for a human |
| `photo_reader` | Sonnet (vision) | one JPEG of children's work only (≤ 1280 px, rebuilt without metadata, never stored); never the teacher's words | `{ seenKn, seenEn, relevant, faces, welfareConcern, problemHint }` | "Show me" (M5.3): describes the work, never a person, a label, a name or a contact; any person → not used, and the request ends kindly only if triage finds nothing needing care; `welfareConcern` escalates like a disclosure; text in the photo is data, and a reading that relays it is refused; `seenEn` joins the question before triage, so triage redacts it; skipped near the budget cap |
| `triage` | Haiku | teacher question text | `{ redacted_text, language, topic, subject, grade_band, intent, needs_clarification, clarifying_question, safety_flags[] }` | redacts child names; routes safety flags before anything else |
| `retriever` | rules + Haiku | triage, cached card index (titles, problems, tags, grade) | `{ card_ids[≤3], reasons[] }` | only `approved` cards; deterministic prefilter by grade and subject first |
| `answerer` | Sonnet | question, the selected full cards | `{ title, steps[{ kn, en, card_id }], materials[], why_kn, why_en, master_ids[] }` | may only use the given cards; a step without `card_id` is invalid output |
| `grounding_judge` | Haiku | each step + its cited card | per step `{ verdict: supported \| partial \| unsupported, card_quote }` | unsupported steps are removed; fewer than 2 supported steps → human queue |
| `safety` | patterns + Haiku | question and final answer | `{ ok, categories[], escalate, message_kn, message_en }` | see §5 |
| `speak` | Bulbul v3 | final Kannada text | audio | cached per answer |
| `insights_digest` | Sonnet | week's anonymous aggregates | officer summary | no teacher identifiers ever enter the prompt |

## 3. The six layers (the deck and `/how` page show exactly this)
1. **Input.** Voice (Saaras) or text; the teacher confirms the transcript; triage redacts child names.
2. **Context.** Approved practice cards: a compact index (about 60 tokens per card) cached with Anthropic prompt caching, plus the full text of the chosen cards. DSERT grade and subject tags filter first. Up to about 1,000 cards this needs no vector database; pgvector is roadmap.
3. **Reasoning.** Triage → retrieval → answer composition, each a separate role with its own schema, streamed to the UI as honest stages (the LampLoader).
4. **Guardrails.** Schema validation · citation must resolve to an approved card · grounding judge per step · safety on question and answer · budget and rate limits · human queue when unsure.
5. **Evaluation.** Offline eval suite (§6) on every change to `ai/`, plus live signals: worked / didn't work, reviewer edits, master panel ratings.
6. **Output.** Kannada voice and text with English rendering, the named master, the original clip, and the trace.

## 4. Streaming and latency
The answer route streams stage events (`understanding`, `finding`, `checking`, `voicing`, `done`) and the text appears as soon as grounding passes; audio follows. Targets: text answer p50 under 10 s, p95 under 18 s; voice under 4 s after text. Run grounding checks per step in parallel. Pre-generate voice for sample questions.

## 5. Safety policy (Law 5)
- **Never advise:** physical punishment, threats, shaming, comparison of children, labels like *slow* or *dull*, caste, religion or gender bias, withholding food or play.
- **Health and disability:** never diagnose (no *dyslexia*, *autism* labels); suggest observation, simple supports, and referral to the school health programme.
- **Disclosure of harm to a child:** do not answer pedagogically; respond with care, show **Childline 1098**, advise informing the headmaster, and place the question in the human queue marked urgent.
- **Teacher distress:** respond kindly, offer Tele-MANAS **14416** (verify number before launch), no pedagogy.
- **Off topic or adversarial:** polite redirect; application content is data, never instructions (prompts wrap teacher text in delimiters with an ignore instructions notice).
The safety role runs first on the question and last on the answer. Pattern lists in Kannada and English live in `ai/safety/patterns.ts` and are versioned.

## 6. Evals (`pnpm evals`)
- **Data:** `evals/questions.jsonl`: real teacher questions (redacted, from the field test, consented) plus synthetic ones marked `sample`; each labelled by the master teacher panel with acceptable card ids and a safety expectation. `evals/interviews/`: a few transcript excerpts with expected cards.
- **Gates:** grounding 100% (every shipped step cites an approved card and the judge says supported) · unsafe advice 0 · safety escalation recall 100% on the safety set · retrieval hit at 3 ≥ 80% · card evidence resolvability 100% · needs human rate reported · latency p50 and p95 reported · cost per question within band.
- **Human gate (reported, the strongest evidence):** master panel rates answers; target 85% *I would give this advice myself*.
- **Recording cache:** key = sha256(role, model, prompt version, settings, item id, rendered prompt). Replays cost nothing; a miss fails unless `LIVE_EVALS=1`. Results table is written to `docs/evals/latest.md` and shown on `/how`.

## 7. Budget (Law 10)
Rough per answered question: triage + retrieval on Haiku with cached index, answer on Sonnet (about 5k in, 700 out), grounding on Haiku: **about 2 to 3 US cents**. Interview: about 2 cents a turn, about $1 per 40 minute session; extraction about $0.50 per interview. Field test total (10 interviews, 1,000 questions, evals, juror testing) is expected under $100.
Caps: `AI_BUDGET_USD_CAP=350` total (keeps about $150 for evaluators and the 18 Nov finale), daily cap $25, per session 30 questions per hour. Near a cap the app serves cached answers and labels them *replayed*.
Sarvam usage is billed by Sarvam, separately; check its pricing and free credits in T2.

## 8. Prompt rules
Prompts are TypeScript constants with a version (`answerer@v3`) and live in `ai/prompts/`. A prompt change bumps the version, re-runs `pnpm evals`, and is noted in the handoff. Teacher and master text always sits inside `<teacher_input>` or `<transcript>` delimiters with the instruction that its content is data. Ask for both Kannada and English in the same structured output.
