# Answer latency on the live site

The judged path, timed on the live deployment: a teacher taps a sample chip or types a question on
`/t/ask`, the stages stream, the answer's text appears, then its voice. Gate (docs/AI.md §4): text
p50 under 10 s, p95 under 18 s, voice under 4 s after the text. Track B, 28 Oct (D85 to D87).

## Method

`tests/e2e/latency.spec.ts` (Playwright project `latency`) signs in as the one tap Sample teacher
on an emulated Pixel 7 and:

1. taps the five sample chips in English, then in Kannada (they should come back from the answer
   cache, D35);
2. types `LATENCY_QUESTIONS` fresh questions (default 8, at most 15), each aimed at a problem the
   Sample library answers, worded afresh on every run (class size and opening change), so the
   cache cannot hit them.

For each it records, from the tap and on the page's own clock: when each streamed stage arrived,
the outcome, the first answer step on screen (**time to text**) and the reply of the answer's voice
request (**voice ready**, the moment the play button can play). For answered fresh questions it
also opens "How this answer was made" and reads each stage's own span from the trace (triage with
the second name reader, ranking, drafting, the slowest judge, safety).

Spend guard: more than 15 fresh questions is refused, and asking stops once the fresh answers'
traces add up to `LATENCY_MAX_USD` (default $0.50). A fresh answer costs about 3 to 4 US cents of
model time plus Sarvam speech. Raw numbers per run: `docs/evals/latency/<stamp>-<label>.json`.

After a deploy, the lead runs (it appends an `after` section and a before and after table here):

```
pnpm latency:live                       # live site, label "after", 8 fresh questions
LATENCY_QUESTIONS=6 pnpm latency:live   # fewer
```

## Where the time went (baseline, 5 answered fresh questions)

| Stage (p50) | Seconds | On the critical path? |
|---|---:|---|
| Tap to first streamed stage (session, hourly cap) | 0.3 | yes |
| Triage plus the second name reader (trace span) | 3.0 | yes, includes the spend total on an idle instance |
| Ranking (starts at triage's first reading) | 2.0 | partly: about 0.7 s past the name reader |
| Drafting (Sonnet) | 6.4 | yes, the largest single cost |
| Slowest step judge (Haiku, 2 to 5 in parallel) | 3.3 | yes, runs only after the whole draft |
| Final safety reading (Haiku, beside the judges) | 1.9 | hidden by the judges |
| Outcome to text on screen | 0.5 | yes |
| Text to voice ready (voice made on the answer page) | 3.6 | yes for the voice |

Sample chips (tapped a few minutes earlier by two aborted first attempts of this run, so this is
the warm state a juror meets): the three answered chips replay in about 1 s, but the Kannada ones wait about 4 s
for their voice on every tap (their original answers never kept a voice file, so each replay made
one again). The safety chip (4 to 5 s) and the no card chip (4 to 5 s) are not cached by design:
a disclosure always goes through triage and the urgent queue, and "no card" is not an answer.

## What changed (D85 to D87) and the expected saving

| Change | Expected saving, from the stage times above |
|---|---|
| The answer streams, and each step goes to its judge the moment it is written (D86) | most of the 3.3 s judge wait: after the draft only the last step's judge and the safety reading (about 1.9 s) remain, so about 1 to 1.5 s off time to text |
| The voice is made during checking, a line per request side by side, and kept on the answer before the page asks (D86) | text to voice ready from 3.6 s to about 0.5 to 1 s |
| A replay's voice is kept on its original too (D86) | Kannada chips: voice ready from about 5 s to about 1.5 s after the first play (or after `pnpm warm:chips`) |
| The chosen cards are read while the name reader runs; the redacted cache lookup runs while the question is stored (D85) | about 0.1 to 0.2 s |
| The spend total is served from memory while it refreshes; the ask screen warms the function, its database connection and the spend total on open, with no model call (D85) | 0 s on a busy instance; on an idle or cold one, the paged spend sum and the cold start no longer sit in front of triage |

Expected time to text p50: about 14 s, down from 15.8 s. **This does not reach the 10 s gate.** The
remaining time is the model work itself: triage and the name reader (3 s), ranking (about 0.7 s
beyond them), drafting (6.4 s) and the final reading (about 2 s). The levers left are decisions,
not code: the answerer on Haiku (docs/evals/answerer-compare.md: drafting 4.4 s against 5.8 s and
checking 2.0 s against 3.4 s, at a seventh of the cost, but 5 of 6 shipped against 6 of 6 and the
founder must read the Kannada), fewer steps or materials per answer (drafting is bound by output
tokens, and Kannada is token heavy), or a prompt change that trims output; each needs new eval
recordings and live eval spend (D42). Jurors mostly tap the sample chips, which replay in about
1 s with their voice ready.

## before · 2026-10-27 21:26 UTC

Against https://parampara-eta.vercel.app, one emulated Pixel 7 (Chromium) as the one tap Sample teacher, on the runner's own network, by `tests/e2e/latency.spec.ts` (Playwright project `latency`). Times are from the tap, on the page's own clock: each streamed stage (u understanding, f finding, c checking), the outcome, the first answer step on screen (text) and the reply of the answer's voice request (voice ready to play). Stage times inside the trace are the server's own spans. About $0.220 of model time spent (fresh answers' traces).

| Question | Lang | Outcome | Replayed | Stages (s) | Outcome (s) | Text (s) | Voice ready (s) | Voice request (s) | Trace spans (s) | Trace total (s) |
|---|---|---|---|---|---:|---:|---:|---:|---|---:|
| chip letters | en | answered | yes | u 1.0 | 1.7 | 2.5 | 4.0 | 1.5 | replayed | n/a |
| chip numbers | en | answered | yes | u 0.3 | 0.6 | 1.1 | 1.8 | 0.7 | replayed | n/a |
| chip multilevel | en | answered | yes | u 0.4 | 1.0 | 1.5 | 1.7 | 0.3 | replayed | n/a |
| chip safety | en | escalated | n/a | u 1.3 | 5.0 | n/a | n/a | n/a | n/a | n/a |
| chip nocard | en | no-card | n/a | u 0.3, f 4.5 | 4.5 | n/a | n/a | n/a | n/a | n/a |
| chip letters | kn | answered | yes | u 0.3 | 1.1 | 1.6 | 5.6 | 4.0 | replayed | n/a |
| chip numbers | kn | answered | yes | u 0.3 | 0.5 | 1.1 | 4.8 | 3.8 | replayed | n/a |
| chip multilevel | kn | answered | yes | u 0.3 | 0.6 | 1.0 | 5.3 | 4.3 | replayed | n/a |
| chip safety | kn | escalated | n/a | u 0.3 | 4.0 | n/a | n/a | n/a | n/a | n/a |
| chip nocard | kn | no-card | n/a | u 0.7, f 4.8 | 5.3 | n/a | n/a | n/a | n/a | n/a |
| fresh 1 | kn | answered | no | u 0.3, f 3.3, c 9.2 | 12.5 | 12.9 | 16.4 | 3.5 | triage 2.8, retrieval 1.3, draft 5.8, grounding 3.3, safety 1.9 | n/a |
| fresh 2 | en | answered | no | u 0.3, f 3.5, c 10.8 | 16.6 | 17.0 | 21.1 | 4.1 | triage 3.0, retrieval 1.2, draft 7.3, grounding 5.7, safety 1.6 | n/a |
| fresh 3 | kn | answered | no | u 0.4, f 3.1, c 10.4 | 15.3 | 15.8 | 19.8 | 4.1 | triage 2.7, retrieval 3.3, draft 5.0, grounding 4.8, safety 1.6 | n/a |
| fresh 4 | en | answered | no | u 0.3, f 3.8, c 11.0 | 13.5 | 14.0 | 17.4 | 3.5 | triage 3.3, retrieval 2.4, draft 6.4, grounding 2.1, safety 2.2 | n/a |
| fresh 5 | kn | answered | no | u 0.5, f 4.3, c 14.0 | 16.1 | 16.6 | 20.2 | 3.6 | triage 3.6, retrieval 2.0, draft 9.4, grounding 2.1, safety 1.9 | n/a |
| fresh 6 | en | no-card | n/a | u 0.4, f 3.2 | 3.9 | n/a | n/a | n/a | n/a | n/a |
| fresh 7 | kn | no-card | n/a | u 1.2, f 6.6 | 7.0 | n/a | n/a | n/a | n/a | n/a |
| fresh 8 | en | no-card | n/a | u 0.3, f 3.5 | 5.5 | n/a | n/a | n/a | n/a | n/a |

Summary (before): fresh answered 5 of 8; time to text p50 **15.8 s**, p95 **17.0 s**; time to voice ready p50 **19.8 s**. Sample chips: 6 of 10 served from the cache or under 3 s, outcome p50 1.4 s, slowest 5.3 s.

Trace span p50 (fresh answers): triage with the name reader 3.0 s · ranking 2.0 s · drafting 6.4 s · grounding (slowest judge) 3.3 s · safety 1.9 s · trace total n/a s.
Wall clock phase p50: tap to finding 3.1 s · finding to checking 7.3 s · checking to outcome 3.3 s · outcome to text on screen 0.5 s · text to voice ready 3.6 s.

## after · 2026-10-27 21:51 UTC

Against https://parampara-eta.vercel.app, one emulated Pixel 7 (Chromium) as the one tap Sample teacher, on the runner's own network, by `tests/e2e/latency.spec.ts` (Playwright project `latency`). Times are from the tap, on the page's own clock: each streamed stage (u understanding, f finding, c checking), the outcome, the first answer step on screen (text) and the reply of the answer's voice request (voice ready to play). Stage times inside the trace are the server's own spans. About $0.240 of model time spent (fresh answers' traces).

| Question | Lang | Outcome | Replayed | Stages (s) | Outcome (s) | Text (s) | Voice ready (s) | Voice request (s) | Trace spans (s) | Trace total (s) |
|---|---|---|---|---|---:|---:|---:|---:|---|---:|
| chip letters | en | answered | yes | u 0.3 | 0.7 | 1.0 | 1.3 | 0.2 | replayed | n/a |
| chip numbers | en | answered | yes | u 0.3 | 0.4 | 0.9 | 1.1 | 0.3 | replayed | n/a |
| chip multilevel | en | answered | yes | u 0.3 | 0.9 | 1.4 | 1.6 | 0.3 | replayed | n/a |
| chip safety | en | escalated | n/a | u 0.4 | 4.3 | n/a | n/a | n/a | n/a | n/a |
| chip nocard | en | no-card | n/a | u 0.3, f 3.5 | 3.6 | n/a | n/a | n/a | n/a | n/a |
| chip letters | kn | answered | yes | u 0.2 | 0.4 | 0.9 | 1.1 | 0.2 | replayed | n/a |
| chip numbers | kn | answered | yes | u 0.2 | 0.4 | 0.9 | 1.1 | 0.2 | replayed | n/a |
| chip multilevel | kn | answered | yes | u 0.2 | 0.4 | 0.8 | 1.1 | 0.2 | replayed | n/a |
| chip safety | kn | escalated | n/a | u 0.3 | 3.7 | n/a | n/a | n/a | n/a | n/a |
| chip nocard | kn | no-card | n/a | u 0.2, f 2.7 | 2.8 | n/a | n/a | n/a | n/a | n/a |
| fresh 1 | kn | answered | no | u 0.4, f 3.4, c 11.2 | 12.6 | 13.1 | 13.7 | 0.6 | triage 3.0, retrieval 2.3, draft 6.7, grounding 3.3, safety 1.3 | n/a |
| fresh 2 | en | answered | no | u 0.3, f 3.5, c 11.6 | 13.2 | 13.6 | 13.9 | 0.2 | triage 3.1, retrieval 3.0, draft 6.9, grounding 3.2, safety 1.5 | n/a |
| fresh 3 | kn | answered | no | u 0.3, f 3.9, c 10.6 | 12.6 | 13.2 | 13.4 | 0.3 | triage 3.4, retrieval 3.2, draft 4.5, grounding 2.1, safety 1.9 | n/a |
| fresh 4 | en | answered | no | u 0.3, f 3.0, c 10.5 | 12.2 | 12.7 | 12.9 | 0.2 | triage 2.3, retrieval 1.7, draft 6.9, grounding 3.7, safety 1.8 | n/a |
| fresh 5 | kn | answered | no | u 0.3, f 3.2, c 9.3 | 11.5 | 12.0 | 12.2 | 0.3 | triage 2.8, retrieval 1.8, draft 5.1, grounding 3.2, safety 2.2 | n/a |
| fresh 6 | en | no-card | n/a | u 0.3, f 2.9 | 3.0 | n/a | n/a | n/a | n/a | n/a |
| fresh 7 | kn | no-card | n/a | u 0.3, f 4.7 | 5.5 | n/a | n/a | n/a | n/a | n/a |
| fresh 8 | en | answered | no | u 0.3, f 3.7, c 10.7 | 12.2 | 12.7 | 13.9 | 1.3 | triage 3.3, retrieval 3.1, draft 6.0, grounding 2.5, safety 1.4 | n/a |

Summary (after): fresh answered 6 of 8; time to text p50 **12.9 s**, p95 **13.6 s**; time to voice ready p50 **13.5 s**. Sample chips: 7 of 10 served from the cache or under 3 s, outcome p50 0.8 s, slowest 4.3 s.

Trace span p50 (fresh answers): triage with the name reader 3.0 s · ranking 2.6 s · drafting 6.3 s · grounding (slowest judge) 3.2 s · safety 1.6 s · trace total n/a s.
Wall clock phase p50: tap to finding 3.1 s · finding to checking 7.3 s · checking to outcome 1.6 s · outcome to text on screen 0.5 s · text to voice ready 0.3 s.

### Before and after (2026-10-27 → 2026-10-27)

| Measure | before | after |
|---|---:|---:|
| Time to text, p50 (fresh) | 15.8 s | 12.9 s |
| Time to text, p95 (fresh) | 17.0 s | 13.6 s |
| Time to voice ready, p50 (fresh) | 19.8 s | 13.5 s |
| Sample chip outcome, p50 | 1.4 s | 0.8 s |
| Sample chip outcome, slowest | 5.3 s | 4.3 s |
| Sample chips cached or under 3 s | 6 of 10 | 7 of 10 |
| Trace total, p50 (fresh) | n/a | n/a |
