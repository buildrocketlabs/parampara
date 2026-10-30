-- Parampara 0003: invite links, teacher consent, recording import pipeline (docs/BUILD.md M1, M2).
-- Applied by the human only: ALLOW_DB_PUSH=1 pnpm db:push
--
-- D37 Invite links are bearer links: each invite owns one hidden auth user, and opening the link
--     signs that user in on the server (admin generated one time token, no email, no password).
--     The same link works again on a second phone or after cleared storage.
-- D38 Sample accounts (demo logins, anyone a demo reviewer invites) are is_sample and can change
--     only sample rows, so jurors can press every button without touching field data.

-- Hindi for teachers (M3). A new enum value cannot be used in the same transaction, so nothing
-- below refers to it.
alter type public.lang add value if not exists 'hi';

-- ── Profiles: the teacher's consent record ──────────────────────────────────
alter table public.profiles
  add column if not exists consented_at timestamptz,
  add column if not exists consent_version text;

create or replace function public.current_is_sample() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_sample from public.profiles where id = (select auth.uid())), true)
$$;
revoke all on function public.current_is_sample() from public;
grant execute on function public.current_is_sample() to authenticated;

-- ── Invites ─────────────────────────────────────────────────────────────────
-- used_by is the profile the link signs in as. It is set on first open, or at creation for a
-- master added by a reviewer. Service role only (no client policies, as in 0001).
alter table public.invites
  add column if not exists label text,
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists is_sample boolean not null default false,
  add column if not exists revoked_at timestamptz,
  add column if not exists last_used_at timestamptz,
  add column if not exists use_count int not null default 0;
create index if not exists invites_created_by_idx on public.invites (created_by, created_at desc);

-- ── Masters added on their behalf ───────────────────────────────────────────
alter table public.masters
  add column if not exists added_by uuid references public.profiles (id) on delete set null,
  add column if not exists consent_text_kn text;

-- ── Interviews: live or imported, in one or more parts ──────────────────────
do $$ begin
  create type public.interview_source as enum ('live', 'import');
exception when duplicate_object then null; end $$;

-- parts: [{ path, name, mime, bytes, start_ms, duration_ms, stored }] laid end to end; a segment's
-- start_ms is on this shared timeline, so playback finds the part and the offset inside it.
alter table public.interviews
  add column if not exists source public.interview_source not null default 'import',
  add column if not exists title text,
  add column if not exists parts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(parts) = 'array'),
  add column if not exists duration_ms int check (duration_ms is null or duration_ms >= 0),
  add column if not exists chunk_count int check (chunk_count is null or chunk_count >= 0),
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists error text,
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists interviews_touch on public.interviews;
create trigger interviews_touch before update on public.interviews
  for each row execute function public.touch_updated_at();

-- ── Audio chunks: the unit of resumable speech to text (D34) ───────────────
-- The browser cuts the recording into chunks under the speech API limit and sends each one; the
-- server transcribes, redacts and stores segments, then marks the chunk. Nothing raw is kept.
do $$ begin
  create type public.chunk_status as enum ('pending', 'transcribed', 'silent', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.audio_chunks (
  interview_id uuid not null references public.interviews (id) on delete cascade,
  idx int not null check (idx >= 0),
  start_ms int not null check (start_ms >= 0),
  end_ms int not null,
  status public.chunk_status not null default 'pending',
  attempts int not null default 0,
  error text,
  updated_at timestamptz not null default now(),
  primary key (interview_id, idx),
  check (end_ms > start_ms)
);
drop trigger if exists audio_chunks_touch on public.audio_chunks;
create trigger audio_chunks_touch before update on public.audio_chunks
  for each row execute function public.touch_updated_at();
alter table public.audio_chunks enable row level security;

-- ── Segments: which chunk, which speaker ────────────────────────────────────
alter table public.segments
  add column if not exists chunk_idx int,
  add column if not exists speaker text check (speaker is null or speaker in ('master', 'interviewer', 'other'));

-- ── Cards: extractor provenance and flags ───────────────────────────────────
-- flags: e.g. 'punishment_dropped', 'evidence_weak', 'child_name_redacted'.
alter table public.cards
  add column if not exists flags text[] not null default '{}',
  add column if not exists prompt_version text,
  add column if not exists edited_by_reviewer boolean not null default false;

-- ── Jobs: resumable steps of one interview ──────────────────────────────────
alter table public.jobs
  add column if not exists interview_id uuid references public.interviews (id) on delete cascade,
  add column if not exists attempts int not null default 0,
  add column if not exists locked_until timestamptz;
create index if not exists jobs_interview_idx on public.jobs (interview_id, status, created_at);

-- Claims the next runnable job of an interview (queued, or running with an expired lock).
-- Two browser tabs or a retry never run the same step twice at once.
create or replace function public.claim_job(p_interview uuid, p_kinds text[], p_lock_seconds int default 280)
returns setof public.jobs
language sql security definer set search_path = public as $$
  update public.jobs j
  set status = 'running', attempts = j.attempts + 1,
      locked_until = now() + make_interval(secs => p_lock_seconds)
  where j.id = (
    select id from public.jobs
    where interview_id = p_interview
      and kind = any (p_kinds)
      and (status = 'queued' or (status = 'running' and locked_until < now()))
    order by created_at, id
    for update skip locked
    limit 1
  )
  returning j.*
$$;
revoke all on function public.claim_job(uuid, text[], int) from public, anon, authenticated;

-- ── Sample accounts change only sample rows (D38) ───────────────────────────
drop policy if exists cards_review on public.cards;
create policy cards_review on public.cards for update to authenticated
  using (public.current_app_role() = 'reviewer' and (is_sample or not public.current_is_sample()))
  with check (public.current_app_role() = 'reviewer' and (is_sample or not public.current_is_sample()));

drop policy if exists queue_reviewer_update on public.human_queue;
create policy queue_reviewer_update on public.human_queue for update to authenticated
  using (public.current_app_role() = 'reviewer' and (is_sample or not public.current_is_sample()))
  with check (public.current_app_role() = 'reviewer' and (is_sample or not public.current_is_sample()));

-- ── Column level update rights ──────────────────────────────────────────────
-- Row policies say whose row; these say which columns. Without them a demo account could flip its
-- own is_sample through the REST API and escape D38, or a master could fake a consent time.
-- Role, is_sample, consent and district change only on the server (service role).
revoke update on public.profiles from authenticated, anon;
grant update (display_name, lang) on public.profiles to authenticated;
revoke update on public.masters from authenticated, anon;
grant update (show_name, show_photo, voice_public, signature_line_kn, signature_line_en)
  on public.masters to authenticated;
