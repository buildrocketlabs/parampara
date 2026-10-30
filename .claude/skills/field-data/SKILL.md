---
name: field-data
description: Handle real field data (interviews, teacher questions, consent, exports) safely and turn it into honest numbers. Use whenever real people's data is involved.
---
# Field data
- Real data lives only in Supabase (private buckets, RLS). Never in the repo, fixtures, screenshots, logs or commit messages.
- Every master has a consent record (audio + chosen visibility). No consent → no cards published.
- Child names: triage redacts; transcripts get a redaction pass before segments are stored; the reviewer sees redacted text.
- Demo and screenshots use `is_sample=true` data or field data the person agreed to show (first name and district).
- Numbers for README, video and deck come from SQL views in `supabase/views/` (`v_field_numbers`), never typed by hand. Paste the query output and date into `docs/field/log.md`.
- Deletion requests: `pnpm field:delete <invite_code>` removes questions, answers and audio for that teacher; log the date (not the name).
