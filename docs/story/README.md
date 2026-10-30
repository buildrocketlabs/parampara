# Story clips for the submission video

Clips of the live deployment, recorded by the Playwright project `story`
(`tests/e2e/story.spec.ts`) with the Sample demo accounts. The app is in Kannada; a small English
caption bar at the top carries one line per beat. The bar is injected by the test and is not part
of the app. Pauses are 1.5 to 2 seconds per beat, so a viewer can read along. Each clip is kept
under 8 MB: a larger one is re-encoded with ffmpeg at a lower frame rate.

The clips land in `video/public/clips/` (git ignored), where the video (`video/script.json`) picks
them up by name. The story itself, with its sources, is `STORY.md`; how the video is put together
is `video/README.md`.

## Recording

1. Reset the Sample data (the reviewer clip approves one draft card):
   `pnpm seed:library` then `pnpm seed:pulse`.
2. Warm the answer cache, so every chip answers from it:
   `PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=judge`.
3. Record the phone clips (390 × 844):
   `PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=story --workers=1`.
4. Record the laptop clips (1280 × 800, named `…-1280.webm`), after `pnpm seed:library` again
   (step 3 approved the draft):
   `STORY_WIDTH=1280 PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=story --workers=1`.

One worker keeps the pacing steady. `-g "8 master|11 trace"` records only the named clips.
`STORY_OUT=<folder>` writes somewhere else.

`STORY_SHOW_ME=1` adds clip 6, which makes one live photo read (a model call), so it is off by
default. Without `PW_BASE_URL`, `STORY_DRY=1` runs the clips that work on the local fixture build
(3, 5, 8, 9 and 10), and writes them to `coverage/story-dry/`. That folder is not committed.

The clips never make an invite link, never type a name and never send a thank you. Every account
and every row they touch is Sample. The offline clip's queued question is dropped when the clip
ends, while the phone is still offline, so nothing is asked live.

## The clips

| File | What it shows | Used in the video |
|---|---|---|
| `1-teacher-asks.webm` | The teacher's home at 9 pm, the ask screen, a sample chip (letters), the Kannada answer with the master's name, "Hear the master", then "How this answer was made". A Sample card made without a recording shows its words instead of a voice, and the caption says so. | `deliver` (phone) |
| `2-it-worked.webm` | The next day: "Did yesterday's idea work?", one tap on "It worked", then the lamps of the celebration. It stops before the thank you, so nothing is sent. | `learn-worked` (phone) |
| `3-master-talk.webm` | The master's room with his computed reach (Sample), then "Record a new story". His consent is already on record, so the talk begins without recording, and Hanate asks the first question in Kannada. | `capture-talk` (phone) |
| `4-reviewer-approves.webm` | The reviewer's cards, one Sample draft, the moment in the recording that a step cites, then Approve. | `check` uses the 1280 version |
| `5-officer-pulse-lamps.webm` | The officer's Teacher Pulse (Sample week), then the Lamps of Karnataka and Koppal. The long version of clips 9 and 10. | spare |
| `6-show-me.webm` | Show me: the eval slate photo, the no faces tick, the question with the photo, what the slate shows, the answer. Only with `STORY_SHOW_ME=1`. | spare |
| `7-offline.webm` | An answer is saved and "Ready offline". The network goes; a question typed offline waits on the phone, and the saved answer still opens. | `trust-offline` (phone) |
| `8-master-impact.webm` | The master's room: how many teachers his practice reached, counted from the database. | `learn-master` (phone) |
| `9-officer-pulse.webm` | Teacher Pulse alone: what teachers asked this week, what worked, and the "fewer than 5 teachers" rule. | `spread-pulse` uses the 1280 version |
| `10-lamps.webm` | Lamps of Karnataka alone, then a tap on Koppal. | `spread-lamps` uses the 1280 version |
| `11-trace-drawer.webm` | An answer, then "How this answer was made" opened and read slowly: triage, cards, draft, the per step check, safety, model, time and cost. | `trust-trace` uses the 1280 version |

Every clip above can also be recorded at 1280 px (step 4).

## Still to record by hand (no spec yet)

| File | What it shows | Why not in the spec |
|---|---|---|
| `12-master-import.webm` (phone) | The master's WhatsApp voice notes going into `/m/import`, ordered, the first marked as consent. | `/m/import` is being changed by Track A today; add a spec clip once it lands, or screen record it at 390 px. Keep phone numbers and WhatsApp contact names off screen. |
| `13-hindi-answer.webm` (phone) | The same card answered in Hindi, still in the master's name. | Needs a Hindi Sample question chosen against the live cache. |
