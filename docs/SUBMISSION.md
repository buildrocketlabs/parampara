# SUBMISSION · What the Hack2skill form needs
Deadline 1 Nov 2026, 23:59 IST. Submitted from this sheet on 30 Oct. Everything a box in the form asks for is here, checked on live the same day. `docs/RELEASE.md` explains how the public repository was made.

## Links

| Field | Value |
| --- | --- |
| Live link | https://parampara-eta.vercel.app (English: https://parampara-eta.vercel.app/?lang=en) |
| How it works, with live numbers | https://parampara-eta.vercel.app/how |
| Public repository (open source, Apache 2.0) | https://github.com/buildrocketlabs/parampara |
| Film (2 min 58 s, English subtitles) | https://youtu.be/JD4pzalBlUU |
| Deck (PDF, 13 slides) | https://drive.google.com/file/d/1h7FvnxmScGkeR0LD59qebQEyzOca3dU0/view?usp=sharing |
| Deck, same PDF in the repo and on the live site | `docs/deck/parampara-deck.pdf` · https://parampara-eta.vercel.app/deck/parampara-deck.pdf |
| Deck as text (all 13 slides and their sources) | https://github.com/buildrocketlabs/parampara/blob/main/docs/deck/DECK.md |
| Plain text summary for machine readers | https://parampara-eta.vercel.app/llms.txt |
| Open source consent | **Yes** (Apache 2.0, `LICENSE`; approved practice cards CC BY 4.0) |
| Freeze tag | `v1.0-submission`, moved on 30 Oct evening to the T11 release polish (private `parampara-dev` and public `parampara`; first set on `c19e078`) |
| Private working repository | `buildrocketlabs/parampara-dev` (private; Vercel production builds from it) |

## Summary (100 words)
Parampara (ಪರಂಪರೆ) puts the classroom wisdom of Karnataka's master teachers in every young government school teacher's pocket, by voice, in Kannada. An AI interviewer talks with a master teacher. Claude turns the conversation into practice cards, every step tied to the second of the recording it came from, and a human reviewer approves each card. At 9 pm a teacher asks by voice and hears a Kannada answer built only from approved, named practice, or goes to a person. A child at risk gets Childline 1098. Next day she taps It worked, and the master hears that their wisdom helped.

## Summary (50 words)
Parampara gives every young teacher in Karnataka a master teacher's answer at 9 pm, by voice, in Kannada. Claude turns a master's voice notes into practice cards cited to the second; a human approves each one. Answers use only approved, named practice, and the master hears when it worked.

<!-- field:start (written by pnpm field:numbers from the database; edits here are overwritten) -->
## Field: Koppal field test (read 30 Oct, 16:59 IST)

| Measure (field rows only) | Value |
|---|---|
| Master teachers with consent on record | 1 |
| Practice cards approved from field interviews | 6 (every step cites a second of his recording) |
| His interview | 7 voice notes, 5 min 42 s |
| Field teachers who joined and agreed in the app | 8 |
| Field questions asked | kept private (fewer than 5 teachers) |
| Answered from his approved cards / sent to a person | kept private (fewer than 5 teachers) |
| Tried: worked / partly / didn't | none yet |

From 29 Oct, his colleagues joined on their own phones through a link the headmaster forwarded on WhatsApp: 8 teachers so far. They began asking real questions in Kannada on 30 Oct. How many, and how each was answered, stay private until 5 different teachers have asked, as /how keeps them. No field teacher has told us yet whether an answer worked.
<!-- field:end -->

## Test credentials (also in README §Test credentials)

One tap entry on the home page needs none of these. `/login` takes them. They are Sample demo accounts and can only change Sample data, never field data (D38). Each was signed in on live on 30 Oct and landed on its page.

| Role           | Email                             | Password               | Lands on |
| -------------- | --------------------------------- | ---------------------- | -------- |
| Teacher        | `teacher@demo.parampara.invalid`  | `Hanate-teacher-2026`  | `/t`     |
| Master teacher | `master@demo.parampara.invalid`   | `Hanate-master-2026`   | `/m`     |
| Reviewer       | `reviewer@demo.parampara.invalid` | `Hanate-reviewer-2026` | `/r`     |
| Officer        | `officer@demo.parampara.invalid`  | `Hanate-officer-2026`  | `/i`     |

## Five sample inputs (one tap chips on the teacher screen; README §Five sample inputs)

1. ಒಂದನೇ ತರಗತಿಯ ಒಂದು ಮಗು ಆರು ತಿಂಗಳಾದರೂ ಅಕ್ಷರ ಗುರುತಿಸುತ್ತಿಲ್ಲ. ನಾಳೆ ಏನು ಮಾಡಲಿ? _A child in Class 1 still cannot recognise letters after six months. What can I do tomorrow?_ → a grounded answer, every step citing a named master's card.
2. ಮಕ್ಕಳು ಒಂದರಿಂದ ನೂರರವರೆಗೆ ಬಾಯಿಪಾಠ ಹೇಳುತ್ತಾರೆ, ಆದರೆ ಎಷ್ಟು ಎಂದು ಗೊತ್ತಾಗುವುದಿಲ್ಲ. _The children recite one to a hundred by heart, but they do not know how many._ → number sense from a named Sample master's card, read aloud in Kannada.
3. ಒಂದು ಮತ್ತು ಎರಡನೇ ತರಗತಿ ಒಟ್ಟಿಗೆ, ನಲವತ್ತು ಮಕ್ಕಳು, ನಾನೊಬ್ಬಳೇ. ಹೇಗೆ ನಡೆಸಲಿ? _Class 1 and Class 2 together, forty children, and only me. How do I run it?_ → a multi grade classroom.
4. ಒಂದು ಮಗು ಮನೆಯಲ್ಲಿ ಅಪ್ಪ ದಿನಾ ಹೊಡೆಯುತ್ತಾರೆ ಅಂತ ಹೇಳಿತು. ನಾನು ಏನು ಮಾಡಲಿ? _A child told me her father beats her at home every day. What should I do?_ → the safety path: Childline 1098, a person, no pedagogy.
5. ಮಕ್ಕಳಿಗೆ ಕಂಪ್ಯೂಟರ್ ಕೋಡಿಂಗ್ ಹೇಗೆ ಕಲಿಸಲಿ? _How do I teach computer coding to my children?_ → no master has answered this: the honest path to a reviewer.

To hear a real master in his own voice, type the film's question, answered from Mahesh Bedavatti's approved field card, then tap **Hear Mahesh Bedavatti say it**: ಒಂದನೇ ತರಗತಿಯ ಒಂದು ಮಗುವಿಗೆ ಇನ್ನೂ ಅಕ್ಷರ ಬರೆಯಲು ಬರುತ್ತಿಲ್ಲ. ಗೆರೆ, ವೃತ್ತದಿಂದ ಹೇಗೆ ಶುರು ಮಾಡಲಿ?

## The Sample reviewer queue (what a juror sees at `/r/queue`)
Tidied on 30 Oct to six clear Sample items: an urgent child safety question, the coding question no card answers yet, a home language question (Lambani), a multi grade question the check was not sure enough about, the prompt injection attempt, and a parents question. Every other open Sample copy was marked handled with the note "duplicate Sample test question (tidy, 30 Oct)". Field rows were not read or touched. A Sample urgent item stops counting as urgent a day after it was asked (D98); a juror's own tap of the safety chip makes a fresh one.

## Release record (30 Oct)
- Private commit `c19e078`: CI green (check, db, e2e) and deployed to production by Vercel. Tagged `v1.0-submission` and the tag pushed.
- Private repo renamed `buildrocketlabs/parampara` → `buildrocketlabs/parampara-dev`; this clone's `origin` repointed and fetched. The live site kept serving throughout (`/api/health` green after the rename).
- Public repo `buildrocketlabs/parampara` created from the reviewed snapshot of `c19e078`: one commit `be8d2bf` ("Parampara: submission snapshot (private c19e078)"), 1418 files, every scan clean. Description, homepage and topics (education, kannada, teachers, foundational-learning, claude, anthropic, voice-ai, open-source, india) set.
- The script's guard took GitHub's redirect from the old name for an existing repo; a copy with the guard fixed (compares the real name) did the publish. The tracked script is unchanged, so the tag stays as reviewed.
- Checked on the public repo, signed out: README renders with the live, film, deck and /how links and the mermaid diagram; LICENSE detected as Apache 2.0; a fresh clone has no audio or video, no key shaped strings, `scripts/check-secrets.mjs` clean, and none of the left out files; the only photos of people are Mahesh Bedavatti (consented, D102) and the adults in the Talakal photos (agreed, no children's faces).

- **T11 release polish, 30 Oct evening** (`9dda149`, `15ae713`, `b85acac` and the handoff commit after them): README "For evaluators" criterion map and the sourced "What we heard and what we changed" table (`docs/field/heard.json`, mirrored in `docs/field/CHANGES.md` and on /how); the deck PDF in the repo and at https://parampara-eta.vercel.app/deck/parampara-deck.pdf (the same file as on Drive, 8,351,945 bytes) with its text in `docs/deck/DECK.md`; https://parampara-eta.vercel.app/llms.txt; on /how a real shipped answer from his field card, the total spend summed a page at a time with its rupee amount (it had read $2.107 because one query is capped at 1,000 rows), field answers private under 5 teachers, "misses target" and "Reported only, no target", the measured Slow 3G numbers; a quiet "For judges" link on the home page (D104). CI green, Vercel production Ready, judge path 9 of 9 on live (the new ninth check: /how signed out has no placeholder and every rupee has a number), screenshots in `docs/demos/T11/`. A field count kept private now reads "Kept private, until 5 teachers have asked" on /how, because two AI grader runs read "Fewer than 5 teachers" as a count of 5. The public repo got a second snapshot commit from it, and the tag moved on both repos.

## Final checklist (30 Oct)

- [x] CI green on `main` (check, db, e2e). The e2e smoke failure ("two Sample mode notes", red since 29 Oct) fixed in the test: the Sample reviewer banner is a second note on the import page, so the test now checks the import's own note.
- [x] `pnpm warm:chips` passed on live: the three answered chips replay in under 2 s with voice, in English and Kannada; safety and no card under 8 s.
- [x] Judge path on live: 8 of 8 (`PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=judge --workers=1`).
- [x] Every one tap role (Teacher, Master teacher, Reviewer, Officer) lands on its page on live.
- [x] All four test credentials sign in at `/login` and land on their page.
- [x] The five sample inputs behave as README says (judge path); the field question plays Mahesh Bedavatti's own voice.
- [x] `/how` loads; "From the field" matches the Field section above (1 master, 6 cards, 8 teachers, questions private).
- [x] `/api/health` on live: `mode: live`, anthropic, sarvam and supabase all true.
- [x] The demo teacher's answer language is Kannada (`profiles.lang = kn`).
- [x] Film public on YouTube; plays without sign in.
- [x] Deck shared "anyone with the link can view"; opens without sign in. The uploaded PDF is final and was not rebuilt.
- [x] README, this sheet and `video/out/youtube.md` carry the film and deck links. Field numbers written by `pnpm field:numbers` on the day.
- [x] Sample reviewer queue tidied to six representative items; field rows untouched.
- [x] Freeze tag `v1.0-submission` on the private commit `c19e078`, pushed.
- [x] Private repo renamed to `buildrocketlabs/parampara-dev`; the live deployment is untouched and healthy. Still to see once in the Vercel dashboard: Settings → Git names `buildrocketlabs/parampara-dev` (no push was made to test a new deploy).
- [x] Public repo `buildrocketlabs/parampara` created from the reviewed snapshot of `c19e078`; description, homepage and topics set.
- [x] Public repo checked: README renders with every link, LICENSE shows Apache 2.0, secret scan clean, no real recordings, photos of adults who agreed only, CI green.
- [ ] Form: live link, public repo link, test credentials, film link, deck link, open source **yes**. Screenshot the confirmation (kept locally, not committed).
- [ ] No commits after 1 Nov 23:59 IST in either repo.
