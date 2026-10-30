-- Parampara 0002: private storage buckets (architect R12, DECISIONS D18).
-- Applied by the human only: ALLOW_DB_PUSH=1 pnpm db:push
--
-- Every bucket is private and has NO policy on storage.objects, so a browser can neither list nor
-- read nor write objects directly. The server checks the person's role, then mints a short lived
-- signed URL (download) or signed upload token. supabase/tests/rls_check.sql asserts this.
--   interviews  master recordings as uploaded (original parts) and consent clips
--   questions   reserved; teacher question audio is NOT kept by default (privacy by design)
--   answers     synthesised answer voice (cached per answer)
--   thanks      voice thank you notes from teachers to masters
--   photos      M5 "Show me" photos of slates and notebooks (no faces)
-- The 0001 `audio` bucket is left empty and unused (Supabase blocks direct bucket deletes).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('interviews', 'interviews', false, 52428800, array[
    'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a',
    'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/opus', 'audio/webm', 'audio/flac', 'audio/amr',
    'audio/3gpp', 'video/mp4', 'video/webm', 'application/octet-stream'
  ]),
  ('questions', 'questions', false, 5242880, array['audio/wav', 'audio/webm', 'audio/mp4', 'audio/ogg']),
  ('answers', 'answers', false, 10485760, array['audio/wav', 'audio/mpeg', 'audio/mp3']),
  ('thanks', 'thanks', false, 5242880, array['audio/wav', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg']),
  ('photos', 'photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
