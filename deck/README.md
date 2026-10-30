# Deck

The submission deck: 13 slides at 1920 × 1080, built in code so it shares the app's and the film's brand (tokens from `docs/DESIGN.md`, the app's own fonts, Hanate's SVG from the live app, the film's India map data).

```
node deck/scripts/shots.mjs     # fresh screenshots of the live app (Sample demo teacher; his question replays from the cache)
node deck/scripts/build.mjs     # → deck/out/parampara-deck.pdf, deck/out/png/01.png … 13.png, deck/out/contact-sheet.png
```

- `src/slides/NN.html` one file per slide; its first line is a JSON comment (nav section, footer sources). `src/deck.css` holds the bezel, top navigation, footer and shared parts.
- **Field statements are read at build time.** `numbers.mjs` first runs `scripts/field-numbers.mjs` (the database, field rows only, the same loader as `/how`), which rewrites `video/numbers.json` and the README and SUBMISSION field blocks; the field sentences come from `scripts/field-lines.mjs`, so a count about fewer than 5 different teachers is never shown. Without database keys (or with `DECK_NO_DB=1`) the build uses the last read and says so.
- **Layout:** a 12 column grid inside the canvas (96 px side margins, 64 px top and bottom, 24 px gutters; place with `class="at" style="--c: start; --s: span"`), one card radius (28), padding (32) and shadow, sizes `--h` per slide plus `--t-lead`, `--t-body` (22) and `--t-label` (18). A slide's `src` becomes one 14 px "Sources" line at the bottom of its canvas; the footer is fixed.
- **Numbers are never typed.** A slide writes `{{n:key}}`; `scripts/numbers.mjs` reads each value from the file that owns it (`video/numbers.json`, `docs/evals/latest.json`, `docs/evals/network.md`, `lib/costs/model.ts` run as is, the audio files themselves, `pnpm test`, `docs/SUBMISSION.md`, `docs/story/STORY.md`). An unknown key stops the build. `out/numbers.md` lists every number shown and its source.
- Other placeholders: `{{img:file}}` (prepared once into `assets/img/`), `{{qr:app|film|code:size}}` (vector), `{{hanate:state:size}}`, `{{map:height}}`, `{{wave:note}}` (a voice note's real loudness, read with ffmpeg), `{{link:key}}`.
- The build fails if a font is not loaded (Kannada must be shaped by the real fonts) or the PDF is over 15 MB. `out/` is git ignored.
