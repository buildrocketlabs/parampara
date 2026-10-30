# ASSETS · What we have and where (private media is git ignored)
## Real voice (consented, first note is consent)
`public/audio/mahesh-notes/` intro.mp3 (consent) · 1.mp3 letters · 2.mp3 blending · 3.mp3 number sense · 4.mp3 two classes · 5.mp3 absent or silent child · 6.mp3 his request to young teachers.
Lines to cut: OPEN "ಯುವ ಶಿಕ್ಷಕರಲ್ಲಿ ಒಂದು ವಿನಂತಿ … ಒಂದೇ ದೃಷ್ಟಿಕೋನದಿಂದ ನೋಡಿ" (6.mp3); HEAR "ಗೆರೆ ಎಳೆಯುವುದು, ವೃತ್ತ ಹಾಕುವುದು…" (1.mp3, the lines and circles card); CLOSE "ತಾವು ಹೆಚ್ಚಿನ ಪ್ರಯತ್ನವನ್ನು ಮಾಡಬೇಕೆಂಬುದು ನನ್ನ ಒಂದು ವಿನಂತಿ" (6.mp3).

### Cuts (29 Oct) · `pnpm --dir video cut:mahesh` rebuilds them (`scripts/cut-mahesh.ts`)
The field interview (`ead03d6f…`, 17 chunks, 341.8 s) is the 7 notes in order: intro 0 s, 1.mp3 at 32.433 s, 2 at 89.026, 3 at 152.459, 4 at 211.572, 5 at 257.085, 6 at 308.718. Database segments are chunk long (about 25 s), so the word edges inside them were found with `silencedetect` and Saaras v4 on the stretches between pauses. Every cut starts and ends in a pause and was transcribed back to check (Sarvam, 29 Oct):
| File | Source | Segment | Len | Transcribed back |
|---|---|---|---|---|
| mahesh-open.mp3 | 6.mp3 1.30–3.80 + 0.5 s pause + 14.95–18.85 | #956 | 6.9 s | ಯುವ ಶಿಕ್ಷಕರಲ್ಲಿ ಒಂದು ವಿನಂತಿ, ಎಲ್ಲಾ ಮಕ್ಕಳನ್ನು ಒಂದೇ ದೃಷ್ಟಿಕೋನದಿಂದ ನೋಡಿ. |
| mahesh-hear.mp3 | 1.mp3 2.75–11.06 | #943 (card step 1) | 8.3 s | ಮಗುವಿಗೆ ಮೊದಲು ರೇಖೆಗಳನ್ನು ಎಳೆಯುವುದು, ವೃತ್ತ ಹಾಕುವುದು, ಮೇಲಿನ ಅರ್ಧಚಂದ್ರ, ಕೆಳಗಿನ ಅರ್ಧಚಂದ್ರ. |
| mahesh-hear-full.mp3 | 1.mp3 1.45–16.70 | #943 | 15.3 s | 1ನೇ ತರಗತಿ ಮಗುವಿಗೆ ಮೊದಲು … ಹೀಗೆ ಗೆರೆ ಹಾಕುವುದನ್ನು ರೂಢಿ ಮಾಡುತ್ತೇವೆ. |
| mahesh-close.mp3 | 6.mp3 24.62–31.15 | #957 | 6.5 s | ತಾವು ಹೆಚ್ಚಿನ ಪ್ರಯತ್ನವನ್ನು ಮಾಡಬೇಕೆಂಬುದು ನನ್ನ ಒಂದು ವಿನಂತಿ. |
Each: 70 Hz high pass, 30 ms fade in, 120 ms fade out, two pass loudnorm to −16 LUFS (measured −16.1 to −16.9), peak about −4.3 dBFS, 48 kHz MP3. The open joins two phrases of one sentence; its subtitle keeps the ellipsis so the join is shown.
English for the subtitles (from the segment translations): open "A request to young teachers… look at every child the same way." · hear "First, let the child practise drawing lines, circles, the upper half moon, the lower half moon…" · close "My one request: that you make a greater effort."
## Photos `public/photos/` (adults consented; children only from behind or blurred)
mahesh.jpg (portrait, GPS stamp cropped) · talkal-board.jpg (school board, children cropped out) · talkal-blackboard.jpg · talkal-headmaster-shows-app.jpg · talkal-teachers.jpg · talkal-teacher-reads-app.jpg (best) · talkal-teacher-phone-1.jpg · talkal-teacher-phone-2.jpg · talkal-classroom-backs.jpg · talkal-two-teachers-phone.jpg · classroom-empty.jpg (children from behind, Sep) · smart-class-backs.jpg (Sep) · assembly-blurred-backdrop.jpg (heavily blurred, backdrop only)
School: Government Higher Primary School, Ambedkar Nagar, Talakal, Koppal (ಸರಕಾರಿ ಹಿರಿಯ ಪ್ರಾಥಮಿಕ ಶಾಲೆ, ಅಂಬೇಡ್ಕರ ನಗರ, ತಳಕಲ್ಲ).
## App clips
`public/clips/` from `pnpm exec playwright test --project=story` (390 and 1280). Re-record after the final warm.
## Illustrations (Higgsfield) `public/illustrations/` · prompts logged below
29 Oct · model `gpt_image_2_5` (GPT Image 2.5, flare), quality high, 2k, 16:9 (2688 × 1520), 2.75 credits each, 20 made (55 credits), 15 kept as JPEG q92. Every one carries *Illustration* on screen. No people, hands, children, classrooms or app screens. Contact sheet: `craft/storyboard/illustrations-contact.jpg`.
Shared tail on every prompt: "Warm amber/saffron light, deep indigo, film grain, no people, no text."
| Kept file | For | Prompt (abridged) | Variant of |
|---|---|---|---|
| diya-lights-diya.jpg ★ | 0:42 title, every flame transition | Side-on macro: two unglazed clay diyas on a worn plank, the left flame leaning into the right wick as it ignites, a thread of light between them, smoke curl | |
| diya-lights-diya-macro.jpg | alt | Extreme macro: a terracotta diya tilts toward an unlit one, the flame passes across the wicks | (a 2nd take, not kept) |
| lamps-row.jpg ★ | 0:42 "loses nothing" | A long row of clay diyas on a stone ledge lit one after another into the dark | |
| lamps-multiply.jpg ★ | 2:41 vision | Hundreds of diyas spreading outward from one bright lamp at the centre like ripples | |
| lamps-sky.jpg | alt | One diya in the foreground, flames multiplying into the distance like a night sky of lamps | |
| dusk-road.jpg ★ | 1:17 deliver open | Dusk on a red earth North Karnataka village road, tiled houses, granite boulder hills, one lit window | |
| dusk-village.jpg | alt | Deccan village at dusk, dirt lane, whitewashed houses, boulder hills, kitchen smoke | |
| dusk-road-low.jpg | alt | Low angle along an empty village road after sunset, boulder hills, lit doorways | |
| window-9pm.jpg ★ | 1:17 "nine at night" | 9 pm, a lime washed rural Karnataka house, one shuttered window glowing amber, tulsi planter | |
| lane-window-night.jpg | alt | Village lane at night, one lit window spilling onto the mud lane, moon | |
| phone-table.jpg ★ | 1:20 the phone | A phone face up on a worn wooden table, blank warm screen (no interface), notebooks, pencil, steel tumbler | |
| phone-table-top.jpg | alt | Top down: phone with blank glowing screen, a small unlit diya, a cloth bound register | |
| voice-to-card.jpg ★ | 0:52 capture | A golden sound waveform dissolving into particles that settle into a blank paper card | |
| voice-to-cards.jpg | alt | Ember particles flowing from a voice wave into a stack of blank cream cards | |
| voice-to-flame.jpg | alt / close | A golden sound wave whose dust gathers into a diya flame | |
Rejected: a chalk box that reads as a cigarette pack (window interior); a cold blue city phone shot; a night satellite view whose India outline is wrong and whose bright origin sits in Kerala; a fantasy style aerial of rivers and towns. **The India map is drawn in code instead** (an accurate outline with lamps lighting from Koppal), never generated: a wrong outline of India would be noticed at once.
## India map (drawn in code) `src/data/india-states.json`
DataMeet India community, `States/Admin2` (Survey of India based outline, J&K and Ladakh as India shows them), CC BY 4.0, github.com/datameet/maps; converted by `scripts/india-map.mjs` (35 states and UTs; Lakshadweep's islands are below a pixel and drop out). Koppal's lamp lights first (15.35 N, 76.15 E), then Karnataka, then every other state by its distance from Koppal. Labelled *Illustration*; the source line sits on the frame and in the end card.
## Narration auditions (29 Oct) `public/audio/auditions/`
Lines: the open ("…for thirty two years…") and the deliver line from the brief, joined by 1.2 s of silence, two pass loudnorm to −16 LUFS (measured −16.2 and −16.3).
| File | Voice | Settings |
|---|---|---|
| sarvam-kavya.mp3 | Sarvam Bulbul v3, Kavya (female), en-IN | pace 0.92, 24 kHz |
| sarvam-aditya.mp3 | Sarvam Bulbul v3, Aditya (male), en-IN | pace 0.92, 24 kHz |
ElevenLabs, 29 to 30 Oct (free plan, 10,000 characters a month). **Route A refused:** the three library voices saved in the account (Mridula `KaCAGkAghyX8sFEYByRC`, Maneesh `LolxzR74HCt7Un4IvoxI`, Kiaan `q6sKOYt93PwHufxlI93W`) answer 402 "Free users cannot use library voices via the API" on `eleven_v4` and `eleven_multilingual_v2`; Voice Design is 403 (paid). **Route B, rendered:** the three built-in voices best suited to a warm, calm, slow documentary read. None is Indian; ElevenLabs offers only American, British and Australian built-ins.
| File | Voice | Model and settings | Transcribed back (Saaras v4, en-IN) |
|---|---|---|---|
| elevenlabs-george.mp3 | George (`JBFqnCBsd6RMkjVDRZzb`), British, warm storyteller | `eleven_v4`, stability 0.5, similarity 0.8, style 0.05, speed 0.9 | every word right; "Kannada" heard as "Canada" (check by ear) |
| elevenlabs-sarah.mp3 | Sarah (`EXAVITQu4vr4xnSDxMaL`), American, mature and reassuring | same | every word right |
| elevenlabs-brian.mp3 | Brian (`nPczCjzI2devNBz1zQrb`), American, deep and comforting | same | every word right |
Open 10.9 to 11.5 s, deliver 14.3 to 14.9 s (about 2.6 words a second). Each file: open + 1.2 s + deliver, −16.0 to −16.4 LUFS. **Route C:** `craft/narration-lines.md` lists every line (file name, exact words, max length) for making them by hand on elevenlabs.io with a library voice. The free plan's licence is non commercial with attribution; the end card says "Narration voice: AI (ElevenLabs)".
## App clips re-recorded on his card (30 Oct)
The Sample demo teacher asks "ಒಂದನೇ ತರಗತಿಯ ಒಂದು ಮಗುವಿಗೆ ಇನ್ನೂ ಅಕ್ಷರ ಬರೆಯಲು ಬರುತ್ತಿಲ್ಲ. ಗೆರೆ, ವೃತ್ತದಿಂದ ಹೇಗೆ ಶುರು ಮಾಡಲಿ?" (and the same in Hindi). The Sample pool is "all", so it reaches Mahesh Bedavatti's approved field card "From lines and circles to writing letters". Every answer (5, checked in the database) cites only that card and credits "Mahesh" (`show_name = first`, his choice at import). Questions and answers are Sample rows, so no field data is made (master impact joins only rows with the same Sample flag, 0005). Clips 1 (ask, his voice), 2 (it worked, then the thanks screen with "Mahesh, 32 years, Koppal"; nothing sent), 7 (offline), 11 at 1280 (trace) and 13 (Hindi; the shared demo teacher was set back to Kannada after, checked). The answer screens show the Sample chip, because a demo teacher asked: that is true and stays.
Clip 12 (his card on the field reviewer's screen) needs the founder's own reviewer session; see the handoff.
## Storyboard (29 Oct) `craft/storyboard/`
`storyboard-contact.jpg` (25 scenes, ids and times) and `stills/<scene id>.jpg`, each a draft frame 70% into its scene. Rebuild: `pnpm --dir video still <id>`, or bundle once (`remotion bundle`) and run `remotion still <bundle> Story --frame=N` per scene.
## Narration (30 Oct) `public/audio/vo-*.mp3`
ElevenLabs **George** (`JBFqnCBsd6RMkjVDRZzb`), `eleven_v4`, stability 0.5, similarity 0.8, style 0.05, speed 0.9, free plan (non commercial with attribution; credited on screen). `pnpm --dir video narrate [ids]`, each take two pass loudnorm to −16 LUFS. Respellings tested by transcribing back: plain Koppal, Talakal, Ambedkar Nagar, Parampara and Kannadi came back right, respelled ones worse; Bedavatti came back "Vedavathi" until respelled "Bedavutti", and Kannada came back "Canada" once until respelled "Kunnada". Final check, all 22 lines: every word right except phonetic spellings of the right sounds ("Bedavuti", "Koppl", "Kanadi", "Kunnaada", "claud") and the homophone "here/hear".
## Music and sound
- **Music** `public/audio/music.mp3`: composed in code for this film by `scripts/score.ts` (no samples, nothing licensed): a tanpura drone on D (Pa Sa Sa low Sa, every 3.2 s), a bansuri-like phrase in raga Bhupali at Promise, Proof and Vision, soft piano from Deliver, a low string pad, a small hall reverb. The bed is −27 LUFS overall, ducked about 10 dB under every narration take and **silent (−inf dB, measured) under each of his three lines**, from a breath before to a breath after. Rebuild after any timing change: `pnpm --dir video score`.
- **Sound effects** `public/audio/sfx/` (ElevenLabs sound generation, free plan, 30 Oct): `match-strike` (the first flame), `lamp-crackle` (one lamp lights another), `paper-rustle` (cards), `chime` (it worked). Levelled with loudnorm.
- ElevenLabs Music is not available on the free plan (402), and Higgsfield offers no general music model, so no generated song is used.

## Review rounds (30 Oct)
| Round | design-critic | jury | Main fixes after it |
|---|---|---|---|
| 1 (draft 1) | 6.5 | 8.0 | recorder caption bar cropped out of every clip; English truth chips on every app clip ("Sample demo teacher · Mahesh Bedavatti's real approved card", "Sample data", "Koppal field test"); "a thank you" line no longer claims one was sent; "a second Claude model"; "District officers"; Pulse from "What to do this week"; trace from the 5 of 5 grounded verdict; 8,042 on screen when spoken; plain words sources; faces kept in frame; balanced subtitles; a warm flame glow at each cut; the Talakal cut moved before "Hear it from the master" and captioned as the field visit; AI narration chip on the first narrated scene; credits in three lines, URL larger |
| 2 | 7.5 | 8.6 | every clip re-recorded without the recorder's caption bar (`STORY_CAPTIONS=0`), so app headers are whole; the transition passes through dark with a stronger flame glow; chips 26 px, two lines, "field data" not "field test"; the trace re-recorded on a fresh answer (one step removed, models named); "open to every state"; side lines on the learn scenes; faces clear of captions |
| 3 | 8.4 | 8.9 | "Recorded tests, 24 Oct: 16 of 16 answers grounded · 14 of 14 safety cases caught" (computed from `docs/evals/latest.json`; the 235 there is model calls, not test cases, so it is not used); "This answer: 3 of 4 steps grounded · 1 removed" (checked in the database); the map captioned "Roadmap, not built yet"; proof "4 colleagues joined in the app" from `numbers.json`; count ups start at 80 %; offsets past scroll cuts |
| 4 | 8.7 | **9.0** | per clip `cropTop` for scrolled pages; Hindi and offline clips slowed over still moments; hear-master holds on the player while his voice plays; the safety row centred until the 1098 card arrives; shorter proof caption; 26 px tags |

