# Dress rehearsal · the five sample questions

Not run yet against the live deployment. It asks each sample question cold (a new phone) and warm
(the same phone again) and records the time to the first stage, the time until the outcome shows,
the outcome, and whether the answer was replayed. Run it once the founder approves, since a cold
miss on the answer cache spends a few cents:

```
PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=rehearse
```

Add `REHEARSE_SLOW=1` for a slow 3G network. The run rewrites this file with a dated table.

## 28 Oct 2026 · WhatsApp voice notes import on live (F-A1)
Seven synthetic Kannada voice notes (the product's own Bulbul voice reading `tests/rehearsal/notes.kn.ts`, looped to 3, 4, 5, 3.5, 4.5, 3 and 4 min; Opus in Ogg, 16 kHz, named `PTT-20261028-WA0003..0009.opus` with shuffled file times) picked in shuffled order at `/m/import` on https://parampara-eta.vercel.app, headless Chromium at 1280 px, as a field reviewer created for the rehearsal (revoked after), for a Sample rehearsal master without consent.
- **Order:** WA0003 to WA0009, from WhatsApp's names ("Put in order by the time WhatsApp gave each note").
- **Consent:** "The first voice note is the consent"; the master showed consent recorded once part 0 was confirmed in storage (D53, D78). All 7 parts stored.
- **Time:** reading and upload about 10 s; 68 pieces transcribed in about 3 min 50 s; cards drafted in about 40 s; **4 min 52 s** from Begin to "Cards are ready for review" for 27:00 of audio. No HTTP errors, no console errors.
- **Cards:** 6 drafts, one per question (letters, blending, number sense, two classes in one room, the absent child, the quiet child). The earliest evidence any card cites starts at 3:00, the first second of note 2: nothing came from the consent note.
- **Labels:** interview, master and cards `is_sample = true` (Law 7).
- **Cost:** speech to text $0.142, redaction $0.038, card extraction $0.197 (about $0.38), plus the voices for the notes (about $0.17).
- Cleaned up with `scripts/rehearsal-master.mjs --clean`. Not rehearsed: Safari (the WebCodecs fallback is proven only in Chromium, F-A1 report).
