# Parampara deck: the text of all 13 slides

The submitted deck as plain text, slide by slide, with each slide's sources line. The PDF is [`docs/deck/parampara-deck.pdf`](parampara-deck.pdf) (13 slides, 1920 × 1080). The same file is on [Google Drive](https://drive.google.com/file/d/1h7FvnxmScGkeR0LD59qebQEyzOca3dU0/view?usp=sharing) and on the live site at https://parampara-eta.vercel.app/deck/parampara-deck.pdf.

The text was taken from the PDF with `pdftotext` and then put back in reading order. Nothing was reworded. The deck was built in code on 30 Oct 2026 (`deck/`), and its numbers were read at build time from the files that own them (`deck/scripts/numbers.mjs`). The table at the end lists every number and where it comes from. Each slide has the same footer, "Team Namma Shaale · Challenge 3", and a top navigation: Problem · Parampara · AI · Trust · Reach · Field · Roadmap.

---

## Slide 1 · His wisdom won't retire.
TEAM NAMMA SHAALE · CHALLENGE 3: TEACHER SUPPORT & TRAINING

**Parampara ಪರಂಪರೆ**

A headmaster's 32 years of classroom wisdom, in every young teacher's pocket, by voice, in Kannada.

- Live app: parampara-eta.vercel.app
- 3 min film: youtu.be/JD4pzalBlUU

Mahesh Bedavatti ಮಹೇಶ ಬೆದವಟ್ಟಿ. Headmaster, Talakal, Koppal. 32 years in government schools. The team lead's father.

*Sources: Photo: Mahesh Bedavatti, shown with his consent, given in his first voice note · Team lead: Prajwal Bedavatti*

## Slide 2 · 01 · The problem
**Every master teacher's knowledge has a retirement date.**

When the colleague who solved her problem retires, the answer leaves too.

KARNATAKA · UDISE+ 2025-26
- **15.4%** of Class 3 children in Karnataka government schools read a Class 2 text.
- **8,042** Karnataka schools with one teacher. No colleague to ask.
- **98%** of teachers already have a smartphone.
- **60** Retirement age. Decades of craft walk out with it.
- **0.49 SD** Coaching changes practice this much, but rarely reaches scale.

*Sources: UDISE+ 2025-26 · ASER 2024 · KCSR Rule 95 · CSF EdTech BaSE 2025 · Kraft et al. 2018; Popova et al. 2022 · backdrop: the blackboard at Talakal, 29 Oct*

## Slide 3 · 02 · What Parampara is
**One lamp lights another and loses nothing.**
ಒಂದು ದೀಪ ಇನ್ನೊಂದು ದೀಪ ಹಚ್ಚುತ್ತದೆ

A living library of Karnataka's best teaching (Illustration). The loop:
1. Capture: A master talks
2. Check: A person approves
3. Deliver: A teacher asks
4. Learn: It worked: he hears
5. Spread: Other languages

*Sources: The loop as built in the live app: /m/import and /m/talk · /r · /t · /t/tried · /i*

## Slide 4 · 03 · Deliver
**Ask at 9 pm. Hear a real master by name.**

Built only from approved practice, and it says whose. His own voice is one tap away.

ಕನ್ನಡ · English · हिन्दी · Voice or text

Three phone screens: 1 She asks by voice → 2 Credited to him → 3 His own voice.

Sample teacher, his real approved card. One tap demo for every role. (Backdrop: illustration)

*Sources: Live app, 30 Oct, Sample demo teacher (ಮಾದರಿ ದತ್ತಾಂಶ = Sample), answered from his approved field card*

## Slide 5 · 04 · Capture and check
**Seven WhatsApp voice notes. Six checked practice cards.**

His seven notes, with their lengths: consent 0:32 · letters 0:57 · blending 1:03 · number sense 0:59 · two classes 0:46 · a quiet child 0:52 · to young teachers 0:33.

APPROVED CARD, HIS WORDS: From lines and circles to writing letters (ಗೆರೆ, ವೃತ್ತದಿಂದ ಅಕ್ಷರ ಬರವಣಿಗೆ). Step 1: First let the child practise drawing lines, circles, and upper and lower half moons. ▶ 0:35 to 0:43 of his recording.

Koppal field test · 1 master, 1 school. His other approved cards:
- ✓ Joining letters to read words
- ✓ Teaching ones and tens places
- ✓ Showing sums again and again on the board
- ✓ Two classes in one room
- ✓ A child who stays away or sits quietly

- **7** WhatsApp voice notes
- **5 min 42 s** of his voice in all
- **6** cards approved by a person, every step tied to the second he said it

One master, nothing new to learn. He used what he already uses. (Backdrop: illustration)

*Sources: Koppal field test, 28 Oct, from the database · lengths from the audio files · card titles from /api/open/cards*

## Slide 6 · 05 · AI use and technical strength
**Where Claude works, layer by layer.**

Claude drafts from his words. Code decides what ships.

| Layer | What | Does |
|---|---|---|
| Input | Sarvam Saaras v4 | Hears Kannada as teachers speak it, or reads what they type. |
| Processing | Claude Sonnet 5.5 and Haiku 5.5 | Sonnet turns his words into cited cards and answers. Haiku sorts and ranks. |
| Guardrails | Code first, then a second model | Names held back. Every step judged against its card. |
| Evaluation | 637 eval checks | Replays cost nothing, so no prompt change ships unchecked. |
| Output | Sarvam Bulbul v3 | A Kannada voice, English text, and his own clip. |

How this answer was made. Each step checked by Claude Haiku 5.5: 5 kept, 0 removed.
- ✓ Supported. First let the child practise lines, circles, and upper and lower half-moons. "ಮೊದಲು ಮಗುವಿಗೆ ಗೆರೆ ಎಳೆಯುವುದು, ವೃತ್ತ ಹಾಕುವುದು, ಮೇಲಿನ ಮತ್ತು ಕೆಳಗಿನ ಅರ್ಧಚಂದ್ರ ಹಾಕುವುದನ್ನು ರೂಢಿ ಮಾಡಿಸಿ."
- ✓ Supported. Then call the child up and show how to write a letter. "ನಂತರ ಮಗುವನ್ನು ಕರೆದು ಅಕ್ಷರ ಹೇಗೆ ಬರೆಯಬೇಕು ಎಂದು ತೋರಿಸಿ."
- Three more steps, all supported. Each quote is his card's own words.

Roles and versions: card_extractor@v2 · answerer@v3 · grounding_judge@v1 · triage@v4 · patterns@v4

*Sources: Roles: ai/router.ts · versions: docs/evals/latest.json · trace: live app, 30 Oct, his answer to a Sample teacher*

## Slide 7 · 06 · Guardrails
**Grounded, or silent.** Enforced by code, the database and tests. Parampara never invents pedagogy.

On screen: ಇದನ್ನು ಹಿರಿಯರೊಂದಿಗೆ ಮಾತಾಡೋಣ (Let us ask an elder about this).

1. **Every step cites a card.** A second model checks each step against his card. Unsupported steps go. Too little left, and a person answers.
2. **Children safe by construction.** A child's name becomes ಒಂದು ಮಗು (a child) before storage. No punishment or fear, ever. Harm to a child: Childline 1098 and a person.
3. **Teachers never monitored.** No rankings, no names in reports. Officers see a group only when 5 or more teachers are in it.
4. **Budget is a feature.** Total, daily and per session caps. Near a cap, checked answers replay and say so kindly.

Our own eval set, recorded model outputs replayed 24 Oct · 4 of 67 drafted steps were removed before shipping
- **100%** Steps grounded (16 answers, 63 steps)
- **0** Unsafe advice shipped (16 answers checked)
- **14 of 14** Safety cases escalated (child harm, to a person)
- **14 of 14** Right card in top three (5 of 5 with no card left empty)

*Sources: Gates: docs/evals/latest.md, recorded model outputs replayed 24 Oct · rules: CLAUDE.md Laws 4, 5, 6 and 10*

## Slide 8 · 07 · Low connectivity, low data, low cost
**Works on a weak network, at a price a state can pay.**

Works with no network:
- → Saved answers open, text first
- → A question waits and sends on reconnect
- → Recordings upload in pieces and resume

Needs the network:
- → Voice and photos. Typing still works.

COST PER TEACHER A MONTH: **₹33**. At an assumed 12 questions a month, ₹2.76 per answered question: Claude ₹1.44, listening ₹0.12, speaking ₹1.20.

AT SCALE: **₹33,200** a month for 1,000 teachers.

SPEED, MEASURED:
- **28 of 28** network checks pass on the live site. Returning on Slow 3G, first words in 2.8 s. Offline 6 of 6.
- **12.9 s typical** for a new answer, live. 1 in 20 takes 29.8 s (eval, 24 Oct). Repeats 0.8 s.

*Sources: docs/evals/network.md (live site, 27 Oct) · lib/costs/model.ts, as /how shows it · screen: live app offline, 30 Oct, Sample*

## Slide 9 · 08 · User inputs
**Real school. Real headmaster.**

His school: Government Higher Primary School, Talakal, Koppal. ಸರಕಾರಿ ಹಿರಿಯ ಪ್ರಾಥಮಿಕ ಶಾಲೆ, ಅಂಬೇಡ್ಕರ ನಗರ, ತಳಕಲ್ಲ

Koppal field test:
- **8** colleagues joined since 29 Oct, from a link the headmaster forwarded on WhatsApp
- **6** practice cards approved, from 1 master
- **7** voice notes, 5 min 42 s

Real teachers have begun asking. Counts under 5 teachers stay private by design.

Photos: He shows a colleague, 29 Oct · On their own phones · A Talakal teacher reads an answer

*Sources: Field rows, read at build time, as /how shows · photos: Talakal, 29 Oct*

## Slide 10 · 09 · Testing
**How we tested, and what we changed.**

What the field taught us this week:
| We saw | We changed |
|---|---|
| He talks in voice notes, not apps. | Many voice notes now import as one interview, consent first. |
| A demo nearly mixed real and Sample data. | A clear Sample warning before any reviewer imports. |
| His years and school name were wrong in our notes. | Corrected from his own voice and the school board. |

What we run before every release:
- **637** Eval checks pass on our own recorded eval set
- **8 of 8** Judge path on the live site, 30 Oct
- **28 of 28** Network checks: Slow 3G, Fast 3G, offline
- **8** Safety fixes shipped from a red team audit of the teacher path
- **1,027** Unit tests, with design and jury reviews each milestone

Limits we state openly. No field teacher has reported back after trying an answer yet. The eval set is 16 recorded answers. A new answer takes 12.9 s typically, 29.8 s at p95 (eval).

*Sources: pnpm test · docs/evals/latest.md · docs/SUBMISSION.md · docs/evals/network.md · the 24 Oct safety audit · git log · field rows read at build time*

## Slide 11 · 10 · Future roadmap
A PLAN. **From one school to every state.**

A timeline with columns Nov 26 · Dec · Jan 27 · Feb · Mar · Apr to Jun · Jul to Sep · Oct to Dec. Each row has its name, a short line, and a bar with its label and its months:
- **Talakal cluster:** 10 masters, 100 teachers. Bar: Pilot (Nov 26)
- **Koppal district:** DIET and CRPs review cards. Bar: District, with the DIET (Dec to Feb)
- **Karnataka:** Samagra Shiksha, state helpline. Bar: State rollout (Mar to Oct to Dec)
- **Open Parampara Card:** Approved cards are open data today. Bar: Offer the open card format to DIKSHA (Jan 27 to Oct to Dec)
- **WhatsApp and a phone line:** For teachers with little data. Bar: WhatsApp, then a call line (Feb to Apr to Jun)
- **More languages:** Hindi works today. Bar: More Indian languages (Apr to Jun to Oct to Dec)

WHO PAYS: State teacher development budgets, through Samagra Shiksha: about ₹33 per teacher a month, at an assumed 12 questions.

OUR ASK: The Koppal DIET as card reviewers, and a line on the state teacher helpline.

*Sources: A plan, not a result · cost from lib/costs/model.ts at an assumed 12 questions a month*

## Slide 12 · 11 · The bigger picture
**Parampara is our first lamp. Namma Shaale is the house.**

- **Live:** Parampara ಪರಂಪರೆ. Teacher support: a master's practice, by voice, at 9 pm.
- **Next:** Kannadi ಕನ್ನಡಿ. A teacher sees every child's learning from a notebook photo.
- **Always:** One foundation. Open source, Kannada first, ready for any Indian language.

DESIGNED TO FIT WHAT STATES ALREADY RUN:
- **DIKSHA:** cards as open data, live
- **NISHTHA:** a follow up after training
- **Samagra Shiksha:** DIET faculty review cards
- **CRC and BRC:** Teacher Pulse for visits
- **NIPUN Bharat:** Class 1 to 3, by grade

Map of India (Illustration · dots: the plan, not users)

*Sources: Map drawn in code from DataMeet boundaries (CC BY 4.0) · Koppal is the first lamp; the others are the plan*

## Slide 13 · Thank you
"ತಾವು ಹೆಚ್ಚಿನ ಪ್ರಯತ್ನವನ್ನು ಮಾಡಬೇಕೆಂಬುದು ನನ್ನ ಒಂದು ವಿನಂತಿ." My one request: that you make a greater effort.

ಧನ್ಯವಾದಗಳು · Thank you

Mahesh Bedavatti. Headmaster, Talakal, Koppal. 32 years in government schools. The team lead's father. To young teachers, in his last voice note.

Team Namma Shaale: Prajwal Bedavatti (lead), Mallikarjun Chougala, Mukesh Mahato, Vedant Mohod

Judge path 8 of 8 on the live site, 30 Oct · test credentials and five sample inputs in the README

- Try it: parampara-eta.vercel.app
- Watch: youtu.be/JD4pzalBlUU
- Read the code: github.com/buildrocketlabs/parampara

*Sources: His words: the last of his seven voice notes, 28 Oct*

---

## Notes for readers
- **Two Slow 3G numbers.** Slide 8's "first words in 2.8 s" is the teacher's screen (`/t`) on a return visit. The README's "2.7 s warm" is the home page. Both rows are in `docs/evals/network.md` (27 Oct).
- **Hindi.** A teacher can choose Hindi answers on first run (`/welcome/language`). The answer is then written in Hindi from the Kannada and English cards and spoken by Bulbul v3 (`hi-IN`). The screens stay Kannada or English. Few eval cases are in Hindi (2 answerer and 3 triage cases), so Hindi quality is measured less than Kannada.
- **His seconds.** Slide 5's "0:35 to 0:43" is the exact quoted moment, inside the cited segment that /how shows as card step 1, 0:32 to 0:57 of his interview.
- **Field numbers** on slides 5, 9 and 10 were read from the database at build time, 30 Oct (`pnpm field:numbers`), and match the README Field section.

## Every number on the slides, and its source
| Number | Source |
|---|---|
| 32 years | his consent note (ಕಳೆದ 32 ವರ್ಷಗಳಿಂದ), `docs/DECISIONS.md` D101 |
| 15.4% · 8,042 · 98% · 60 · 0.49 SD | ASER 2024 · UDISE+ 2025-26 · CSF EdTech BaSE 2025 · KCSR Rule 95 · Kraft, Blazar, Hogan 2018 and Popova et al. 2022 |
| 7 voice notes · 5 min 42 s · 6 cards · 1 master · 8 teachers · since 29 Oct | the database, field rows only, `scripts/field-numbers.mjs` (the same loader as /how) |
| note lengths 0:32 to 1:03 · 0:35 to 0:43 | the audio files (ffprobe) and his card's cited segment |
| 637 eval checks · 100% · 0 · 14 of 14 · 5 of 5 · 4 of 67 · 63 steps · 16 answers · 29.8 s | `docs/evals/latest.json` (replay of 24 Oct) |
| ₹33 · ₹2.76 · ₹1.44 · ₹0.12 · ₹1.20 · ₹33,200 · 12 questions · 1,000 teachers | `lib/costs/model.ts` (eval of 24 Oct, ₹94.9432 per US dollar) |
| 28 of 28 · 6 of 6 · 2.8 s · 12.9 s · 0.8 s | `docs/evals/network.md` and `docs/evals/latency.md` (27 Oct) |
| 8 of 8 judge path | `docs/SUBMISSION.md`, live, 30 Oct |
| 8 safety fixes | the 24 Oct safety audit of the teacher path |
| 1,027 unit tests | `pnpm test`, 29 Oct |
| prompt versions | `docs/evals/latest.json` |
