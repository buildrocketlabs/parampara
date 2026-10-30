# Parampara open practice cards

Parampara records how Karnataka's master teachers solved real classroom problems and turns each
conversation into **practice cards**: a problem, the steps, what you need, and whose method it is.
A human reviewer approves every card, and every step is checked against the master's own recorded
words. The approved library is a public good, so it is published as open data.

- **Endpoint:** `GET /api/open/cards` (for example `https://parampara-eta.vercel.app/api/open/cards`)
- **Auth:** none. CORS is open (`Access-Control-Allow-Origin: *`). Responses are cached for an hour.
- **Schema:** [`parampara-card.schema.json`](./parampara-card.schema.json) (JSON Schema 2020-12).
  `lib/open/cards.ts` is the matching Zod schema, and a unit test checks the route's output against it.
- **Licence:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Reuse, adapt and
  redistribute, also commercially, with credit. Each card carries a ready `credit` line; credit the
  collection as "Parampara (Team Namma Shaale) and the master teachers named on each card".
- **A printable card:** `GET /api/cards/{id}/image` returns the card as a 1080 x 1350 PNG.

## What is in it, and what is not

| In every card | Never in the data |
|---|---|
| Title, problem, steps, materials and why it works, in Kannada and English | The recording, the transcript or any segment of it |
| Grade band, subject, FLN topic | Which segments a step cites (kept private, checked before approval) |
| The master's credit exactly as they chose: full name, first name, or anonymous | Any teacher, any question a teacher asked, any child |
| `reviewed: true`, approval and update times, `isSample` | Reviewer identity, internal flags, draft or rejected cards |

Only cards whose master's consent is on record can be approved (enforced in the database), and
only approved cards are published (`public.open_cards()` in `supabase/migrations/0006_insights.sql`).
As a last safeguard, a card whose words involve punishment, threats, shaming or harm to a child,
or carry an instruction, a phone number, an email or a link, is left out even if it was approved;
the database function is callable by the server only, so this route is the one way in. A withdrawn
card leaves the library within the hour (tagged cache, revalidated on change). Cards with
`isSample: true` are synthetic demonstration cards: filter them out for real use.

## Example

```json
{
  "schemaVersion": "1.0",
  "name": "Parampara practice cards",
  "licence": { "id": "CC-BY-4.0", "name": "Creative Commons Attribution 4.0 International", "url": "https://creativecommons.org/licenses/by/4.0/" },
  "attribution": "Parampara (Team Namma Shaale) and the master teachers named on each card",
  "generatedAt": "2026-10-24T06:30:00.000Z",
  "count": 1,
  "cards": [
    {
      "id": "sample-card-01",
      "title": { "kn": "ಮರಳಲ್ಲಿ ದಿನಕ್ಕೊಂದು ಅಕ್ಷರ", "en": "One letter a day, written in sand" },
      "problem": { "kn": "ಒಂದನೇ ತರಗತಿಯ ಕೆಲವು ಮಕ್ಕಳು ತಿಂಗಳುಗಟ್ಟಲೆ ಆದರೂ ಒಂದು ಅಕ್ಷರವನ್ನೂ ಗುರುತಿಸಲ್ಲ.", "en": "Some children in Class 1 cannot recognise a single letter even after months." },
      "steps": [
        { "kn": "ಎಲ್ಲಾ ಅಕ್ಷರ ಒಟ್ಟಿಗೆ ಕಲಿಸೋದು ಬಿಡಿ. ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ.", "en": "Stop teaching all the letters together. Just one letter a day." }
      ],
      "materials": [{ "kn": "ಮರಳು ಹಾಕಿದ ತಟ್ಟೆ", "en": "a plate of sand" }],
      "why": { "kn": "ಒಂದೇ ಅಕ್ಷರ ಗಟ್ಟಿಯಾದ ಮೇಲೆ ಮುಂದೆ ಹೋಗೋದು.", "en": "One letter at a time, moving on only when it is firm." },
      "gradeBand": "1",
      "subject": "kannada",
      "topic": "letters",
      "languages": ["kn", "en"],
      "master": { "name": "Sharanappa", "district": "Koppal", "yearsTeaching": 32, "anonymous": false },
      "credit": "Sharanappa, master teacher, Koppal. Shared through Parampara under CC BY 4.0.",
      "licence": "CC-BY-4.0",
      "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
      "reviewed": true,
      "isSample": true,
      "approvedAt": "2026-10-23T00:00:00.000Z",
      "updatedAt": "2026-10-23T00:00:00.000Z"
    }
  ]
}
```

(Shortened to one step; the real card has five.)

## Using it from DIKSHA or another Sunbird based system

Each card is a small, self contained teacher resource in two languages, so it maps onto a content
or "teacher resource" item. A suggested mapping (check the field names against your instance's
content schema before an import):

| Parampara | Sunbird / DIKSHA content metadata |
|---|---|
| `title.kn` / `title.en` | `name` (one item per medium, or one bilingual item) |
| `problem` and `steps` | `description`, or the body of a simple HTML or PDF resource |
| `languages` | `medium` (Kannada, English) |
| `gradeBand` | `gradeLevel` (Class 1, Class 2, Class 3) |
| `subject`, `topic` | `subject`, `keywords` |
| `licence` | `license` ("CC BY 4.0") |
| `credit`, `master.name` | `attributions`, `author` |
| `id`, `updatedAt` | an external id and version, so a re-import updates instead of duplicating |

A nightly job can fetch `/api/open/cards`, drop `isSample` cards, and upsert by `id`. Because every
card is reviewed and credited, a state team can also print the Tomorrow card image for a cluster
meeting or a staff room wall.

## Versioning

The schema is strict (no unknown fields), so `schemaVersion` and the schema's `$id`
(`urn:parampara:open:cards:1.0`) change whenever a field is added, removed or changes meaning.
