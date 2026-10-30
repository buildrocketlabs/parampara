# The submission video

The three minute video (1920 × 1080, 30 fps, ends at 2:58) is composed in code with
[Remotion](https://www.remotion.dev). This folder is its own package with its own lockfile: the
app never installs it, and Vercel never sees it (D93 in `docs/DECISIONS.md`).

- `script.json`: the one place for timing and words. Each scene has `start` and `end` (seconds),
  a `picture` (what is on screen and which file), the `kannada` line, the `english` subtitle, the
  `voiceover` words, and its `audio` cues. It starts from `docs/story/STORY.md` §2; change the
  words here, then copy the change back there. Since 29 Oct it is rebuilt from
  `craft/CREATIVE-BRIEF.md` (25 scenes); the storyboard stills are in `craft/storyboard/`.
- `numbers.json`: every computed number, each with its source. They stay `null` until they are
  read from the database (field rows only). `voice_notes`, `cards` and `voice_seconds` were read on
  29 Oct; the rest on 30 Oct. Never type a number from memory.
- `public/`: the fonts (committed) and the founder's media and the app clips (git ignored).

## Commands

Run once: `pnpm --dir video install`. Node 23.6 or newer.

| Command | What it does |
|---|---|
| `pnpm --dir video studio` | Opens the preview in the browser. Scrub, play, see every scene. |
| `pnpm --dir video still <scene>` | One PNG in `video/out/stills/`, 70% into that scene (`still deliver 2.5` for 2.5 s in). `still fonts` checks Kannada shaping. |
| `pnpm --dir video check` | Checks `script.json` and `numbers.json`, lists what is still missing, writes `out/subtitles.srt`. |
| `pnpm --dir video render:draft` | The whole video at 960 × 540 with a DRAFT watermark, missing things shown as labelled cards. A few minutes (12 s took 14 s on this Mac). `out/draft.mp4`. |
| `pnpm --dir video render:final` | The real thing, 1920 × 1080 H.264, `out/parampara.mp4`. Refuses until every file exists, every number in `numbers.json` is filled, and no line says TODO. |
| `pnpm --dir video typecheck` | TypeScript for this folder. |

The first render downloads Chrome Headless Shell into `video/node_modules` (once).

## What the founder drops in

Put each file at exactly this path (or change the path in `script.json`). Run
`pnpm --dir video check` after: it lists what is still missing.

### Photos: `video/public/photos/`

JPEG or PNG, landscape, at least 1920 × 1080 (bigger is fine; the slow zoom needs room). Never a
child's face: classrooms from behind or empty, hands, slates, screens. Adults only with their yes.

| File | What |
|---|---|
| `mahesh.jpg` | Mahesh Bedavatti, a warm portrait (his yes is his first voice note). |
| `classroom-empty.jpg` | An empty classroom, or one from behind with no faces. Sits dimmed behind the problem numbers. |
| `talkal-qr.jpg` | (Not used.) Planned as a QR on the headmaster's phone; in the end teachers joined through a link he forwarded on WhatsApp (D103). |
| `talkal-teachers.jpg` | Teachers with the app, hands and screens, no children's faces. Dimmed behind the field numbers. |

Each photo scene says `"faces": "none"` or `"faces": "adults-consented"` in `script.json`; set the
one that is true. A generated picture gets `"illustration": true` and carries the word
*Illustration*. The pan and zoom are `zoom` (from, to; 1 to 1.4) and `pan` (from, to; −0.1 to 0.1).

### The selfie clip: `video/public/selfie/prajwal-selfie.mp4`

MP4 (H.264) or MOV from the phone, landscape if possible, 4 seconds are used (`close-selfie`). It
plays muted under the voiceover; set `"muted": false` in `script.json` to use its own sound, and
`"from": 12` to start 12 s into it. To use a photo of father and son instead, change that scene's
picture to `{ "kind": "photo", "src": "photos/mahesh-and-prajwal.jpg", "faces": "adults-consented" }`.

### Voiceover and his voice: `video/public/audio/`

MP3, WAV or M4A all work (write the real file name in `script.json` if it is not `.mp3`). One file
per scene that has narration, named `vo-<scene id>.mp3` (`pnpm --dir video check` lists every one
still missing). The words are the scene's `voiceover`. The narration is an AI voice (chosen from the
auditions in `public/audio/auditions/`, see `craft/ASSETS.md`); the credits say so.

His voice is cut from his own notes by `pnpm --dir video cut:mahesh` (`scripts/cut-mahesh.ts`):
`mahesh-open.mp3`, `mahesh-hear.mp3` (and `mahesh-hear-full.mp3`), `mahesh-close.mp3`. The cuts, their
transcriptions and their English are in `craft/ASSETS.md`.

Cue fields: `at` (seconds after the scene starts), `from` (seconds into the file), `duration`,
`volume` (0 to 1).

### Words still marked TODO

None since 29 Oct: his lines are cut and written in `script.json`. A teacher's quote is not used
(the photos show colleagues opening the app for the first time; nobody is quoted).

### Numbers: `video/numbers.json`

On 30 Oct, read each from the app's field totals (/how "From the field", `lib/field/summary.ts`;
cost from /how "What it costs") and write `value`. A number the app keeps private (fewer than 5
teachers behind it) gets `"hidden": true` and stays `null`: the video then says "kept private" in
words. Never round up, never estimate.

### App clips: `video/public/clips/`

Recorded by Playwright on the live site (`docs/story/README.md` has the steps):

```sh
PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=story --workers=1
STORY_WIDTH=1280 PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=story --workers=1
```

| Clip | Frame | Recorded by the spec? |
|---|---|---|
| `1-teacher-asks.webm` | phone | yes (live) |
| `2-it-worked.webm` | phone | yes (live) |
| `3-master-talk.webm` | phone | yes |
| `4-reviewer-approves-1280.webm` | laptop | yes, with `STORY_WIDTH=1280` (live) |
| `7-offline.webm` | phone | yes (live) |
| `8-master-impact.webm` | phone | yes (new) |
| `9-officer-pulse-1280.webm` | laptop | yes, with `STORY_WIDTH=1280` (new) |
| `10-lamps-1280.webm` | laptop | yes, with `STORY_WIDTH=1280` (new) |
| `11-trace-drawer-1280.webm` | laptop | yes, with `STORY_WIDTH=1280` (new, live) |
| `5-officer-pulse-lamps-1280.webm` | laptop | yes, with `STORY_WIDTH=1280` |
| `12-master-import-1280.webm` | laptop | no: screen record `/m/import` with his seven notes (no phone numbers or contact names on screen) |
| `13-hindi-answer.webm` | phone | no: a Hindi question on the live site, recorded by hand |

A clip's `from` in `script.json` skips its first seconds; `playbackRate` (0.25 to 4) speeds a slow
part. A clip shorter than its scene holds its last frame.

## How it is built

- `src/Root.tsx` registers `Story` (the video) and `FontCheck` (one frame of Kannada in each face).
- `src/Story.tsx` places every scene at its time with its picture, subtitles and audio; in a draft
  it adds the watermark and the scene clock.
- `src/components/`: `TitleCard`, `NumberReveal` (numbers one by one, each with its source),
  `ClipFrame` (phone or laptop), `LampRow` (Hanate lights a row of lamps), `Photo` (Ken Burns, and
  the full frame selfie), `Subtitles` (Kannada over English, split into readable lines),
  `Placeholder` (a missing file, named), `Hanate`, `IndiaMap` (the vision map, drawn from real
  boundaries in `src/data/india-states.json`, made by `scripts/india-map.mjs` from DataMeet's
  Survey of India based states, CC BY 4.0).
- Hanate is the app's own artwork and keyframes (`components/parampara/hanate/`), run on the
  video's frame clock. Colours come from `lib/tokens.ts`; Baloo Tamma 2 and Plus Jakarta Sans from
  `assets/fonts`; Noto Sans Kannada (OFL) is in `public/fonts`.
- `src/schema.ts` is the Zod schema for both JSON files: scenes in order, none overlapping, total
  under 180 s, every number with a source, every photo with its faces policy.

Review stills of the machine itself are in `docs/demos/F-E/` (the phone and laptop ones use a
screenshot as a stand in clip).

Licence: Remotion is free for an individual or a company of up to 3 employees
(remotion.dev/license); above that a Company License is needed.
