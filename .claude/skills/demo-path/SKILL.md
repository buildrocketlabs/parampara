---
name: demo-path
description: Keep the judge's hour perfect (one tap roles, sample inputs, trace drawer, English toggle, offline). Use before every deploy that judges might see.
---
# The judge's hour
Run `pnpm e2e --project=judge` which walks, on a 390px viewport with Slow 3G throttling:
1. `/` loads under 3 s; four role doors visible; English toggle works.
2. Teacher door → home → tap each of the five sample chips (letters, number sense, multi level class, a safety case, a no card case). Each streams stages and ends in the right outcome: grounded answer with master credit, safety escalation with Childline 1098, honest "no master has answered this yet, sent to reviewers".
3. Open TraceDrawer on one answer: retrieved cards, judge verdict, cost, latency, prompt versions.
4. Tried → It worked → celebration → thank you note reaches the master.
5. Master door → impact screen shows that thank you.
6. Reviewer door → queue shows the no card question.
7. Officer door → `/i` with labelled field vs sample numbers.
8. Go offline → saved answers still open; a new question queues and sends on reconnect.
Also confirm: test credentials in README work; budget remaining is above the reserve for evaluators; `DEMO_MODE=true` on the judged deployment. Any failure blocks the deploy.
