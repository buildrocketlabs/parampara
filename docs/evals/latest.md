# Evals · latest

Written by `pnpm evals` (evals/reporter.ts) on 2026-10-24. Replay only: no model was called and nothing was spent.
A gate's value comes only from recorded model outputs. Until the first approved live run (`pnpm evals:live`) records them, a gate says *not measured yet* and shows no number.

Suites: 11 files, 637 passed, 0 failed, 2 todo (model cases waiting for a recording), 0 skipped.

## Gates (docs/AI.md §6)

| Gate | Target | Value | Rests on | Measured from | Result |
|---|---|---|---|---|---|
| Grounding: shipped steps that cite an approved card and were judged supported | 100% | **100%** | 16 recorded | recorded model outputs | pass |
| Unsafe advice in shipped answers | 0 | **0** | 16 recorded | recorded model outputs | pass |
| Safety escalation recall on the safety set | 100% | **100%** | 14 recorded | recorded model outputs | pass |
| Retrieval: the expected card in the top three | ≥ 80% | **100%** | 14 recorded | recorded model outputs | pass |
| Card evidence: every citation resolves to the recording | 100% | **100%** | 13 recorded | recorded model outputs | pass |
| Questions sent to a person instead of answered | reported | **0%** | 16 recorded | recorded model outputs |  |
| Answer latency per question, p50 and p95 | p50 < 10 s, p95 < 18 s | **p50 13.1 s · p95 29.8 s** | 235 recorded | recorded model outputs | **fail** |
| Model cost per answered question | about 2 to 3 US cents | **$0.0152** | 235 recorded | recorded model outputs | pass |

Details:
- Grounding: shipped steps that cite an approved card and were judged supported: 63 steps in 16 shipped answers; 4 of 67 drafted steps removed before shipping.
- Unsafe advice in shipped answers: 16 shipped answers checked with patterns@v4; 0 unsafe drafts or answers stopped before shipping.
- Safety escalation recall on the safety set: 14 of 14 recorded cases escalated (14 in the safety set).
- Retrieval: the expected card in the top three: 14 of 14 questions with a right card; 5 of 5 with no fitting card correctly left empty.
- Card evidence: every citation resolves to the recording: 13 drafted cards from 13 recorded interviews.
- Questions sent to a person instead of answered: 0 of 16 recorded questions (no card, too few supported steps, or the final safety check).
- Answer latency per question, p50 and p95: the sum of each stage's own percentile (an upper estimate), with the name reader and the ranker side by side: understanding p50 2.3 s (34), name reader with finding p50 2.1 s (34 and 20), drafting p50 6.2 s (16), checking p50 2.5 s (16).
- Model cost per answered question: mean recorded cost of each step, the judge 4.2 times per answer; calls: triage 34, name_check 34, retriever 20, answerer 16, grounding_judge 90, safety 41.

## What the deterministic guardrails did on the hand written cases

Not gate values: these show the code that runs whatever the model says.

| Gate | Held | Cases | What |
|---|---|---|---|
| Grounding: shipped steps that cite an approved card and were judged supported | 17 | 17 | hand written answers that cite no given card or break the rules are refused; a lenient judge is overruled by the card's own words |
| Unsafe advice in shipped answers | 13 | 13 | unsafe answers caught by the patterns alone, even when the model says all is well |
| Safety escalation recall on the safety set | 10 | 14 | escalated by the deterministic patterns alone; the model can only add escalations |
| Retrieval: the expected card in the top three | 53 | 53 | hand written picks of unknown, unapproved or too many cards are refused |
| Card evidence: every citation resolves to the recording | 6 | 6 | hand written extractions that cite missing segments or break the rules are refused |

## Recordings for the current prompts

| Role | Eval cases | Recorded |
|---|---|---|
| triage | 34 | 34 |
| retriever | 20 | 20 |
| answerer | 16 | 16 |
| grounding_judge | 23 | 23 |
| safety | 25 | 25 |
| card_extractor | 13 | 13 |

## Versions

| Role | Prompt | Model |
|---|---|---|
| triage | triage@v4 | claude-haiku-5-5 |
| retriever | retriever@v2 | claude-haiku-5-5 |
| answerer | answerer@v3 | claude-sonnet-5-5 |
| grounding_judge | grounding_judge@v1 | claude-haiku-5-5 |
| safety | safety@v3 | claude-haiku-5-5 |
| card_extractor | card_extractor@v2 | claude-sonnet-5-5 |
| redactor | redactor@v1 | claude-haiku-5-5 |
| name_check | name_check@v2 | claude-haiku-5-5 |
| interviewer | interviewer@v2 | claude-sonnet-5-5 |
| insights_digest | insights_digest@v2 | claude-sonnet-5-5 |
| safety patterns | patterns@v4 | deterministic |
