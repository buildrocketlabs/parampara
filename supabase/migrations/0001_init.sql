-- Parampara 0001: core data model, RLS and aggregate views.
-- Applied by the human only: ALLOW_DB_PUSH=1 pnpm db:push (DECISIONS D16).
--
-- Access model (CLAUDE.md Laws 5 to 7):
--   teacher   sees own questions, answers, tried and thanks, plus approved cards.
--   master    sees own interviews, segments, cards and the thanks sent to them.
--   reviewer  sees drafts, segments, the human queue and redacted questions; never teacher profiles.
--   officer   sees aggregate views only, never a row about an individual teacher.
-- Server routes write with the service role (bypasses RLS). ai_calls, jobs and invites have no
-- client policies at all.
-- Real field data and synthetic data are separated by is_sample (D7).

create extension if not exists pgcrypto;

-- ── Types ────────────────────────────────────────────────────────────────────
create type public.app_role as enum ('teacher', 'master', 'reviewer', 'officer');
create type public.lang as enum ('kn', 'en');
create type public.show_name as enum ('full', 'first', 'anon');
create type public.interview_status as enum ('consented', 'recording', 'transcribing', 'extracting', 'done', 'failed');
create type public.card_status as enum ('draft', 'approved', 'rejected');
create type public.grounding_verdict as enum ('supported', 'partial', 'unsupported');
create type public.answer_status as enum ('pending', 'answered', 'needs_human', 'escalated', 'failed');
create type public.tried_outcome as enum ('worked', 'partly', 'didnt');
create type public.queue_reason as enum ('no_card', 'unsupported', 'safety');
create type public.queue_status as enum ('open', 'in_progress', 'resolved');
create type public.job_status as enum ('queued', 'running', 'done', 'failed');

-- ── Helpers ──────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Tables ───────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'teacher',
  display_name text,
  district text,
  lang public.lang not null default 'kn',
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

-- Reads the caller's role without tripping RLS on profiles.
create or replace function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = (select auth.uid())
$$;
revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create table public.masters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  years int check (years between 0 and 70),
  school text,
  classes text,
  signature_line_kn text,
  signature_line_en text,
  consent_audio_path text,
  consented_at timestamptz,
  show_name public.show_name not null default 'first',
  show_photo boolean not null default false,
  voice_public boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters (id) on delete cascade,
  status public.interview_status not null default 'consented',
  audio_path text,
  started_at timestamptz,
  ended_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index interviews_master_idx on public.interviews (master_id);

-- Transcript segments. Text is stored only after the redaction pass (Law 5).
create table public.segments (
  id bigint generated always as identity primary key,
  interview_id uuid not null references public.interviews (id) on delete cascade,
  idx int not null,
  start_ms int not null check (start_ms >= 0),
  end_ms int not null,
  text_kn text not null,
  text_en text,
  redacted boolean not null default false,
  unique (interview_id, idx),
  check (end_ms >= start_ms)
);

-- Practice cards. steps: [{ kn, en, evidence_segment_ids: bigint[] }]. Every field cites segments.
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters (id) on delete cascade,
  interview_id uuid references public.interviews (id) on delete set null,
  title_kn text not null,
  title_en text not null,
  problem_kn text not null,
  problem_en text not null,
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) > 0),
  materials jsonb not null default '[]'::jsonb check (jsonb_typeof(materials) = 'array'),
  why_kn text,
  why_en text,
  grade_band text,
  subject text,
  topic text,
  evidence_segment_ids bigint[] not null default '{}',
  status public.card_status not null default 'draft',
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An approved card must cite the recording (Law 4).
  check (status <> 'approved' or cardinality(evidence_segment_ids) > 0)
);
create index cards_status_idx on public.cards (status);
create index cards_master_idx on public.cards (master_id);
create index cards_filter_idx on public.cards (grade_band, subject) where status = 'approved';
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();

-- Only redacted text is stored; the raw transcript never reaches the database (Law 5).
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  audio_path text,
  text_redacted text not null,
  lang public.lang not null default 'kn',
  topic text,
  grade_band text,
  safety_flags text[] not null default '{}',
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index questions_teacher_idx on public.questions (teacher_id, created_at desc);

-- steps: [{ kn, en, card_id }]. trace: the "How this answer was made" timeline.
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  title_kn text,
  title_en text,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  card_ids uuid[] not null default '{}',
  verdict public.grounding_verdict,
  audio_path text,
  trace jsonb not null default '{}'::jsonb,
  cost_usd numeric(10, 6) not null default 0,
  latency_ms int,
  status public.answer_status not null default 'pending',
  replayed boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index answers_question_idx on public.answers (question_id);

create table public.tried (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  outcome public.tried_outcome not null,
  note_redacted text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  unique (answer_id, teacher_id)
);
create index tried_answer_idx on public.tried (answer_id);

-- A teacher's thank you to a master. The master never learns who sent it (Law 6).
create table public.thanks (
  id uuid primary key default gen_random_uuid(),
  tried_id uuid not null references public.tried (id) on delete cascade,
  master_id uuid not null references public.masters (id) on delete cascade,
  audio_path text,
  text text,
  delivered_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index thanks_master_idx on public.thanks (master_id, created_at desc);

create table public.human_queue (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  reason public.queue_reason not null,
  urgent boolean not null default false,
  status public.queue_status not null default 'open',
  assignee uuid references public.profiles (id) on delete set null,
  resolution_note text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index human_queue_open_idx on public.human_queue (status, urgent desc, created_at);

-- One row per model or speech call (Law 10). Service role only.
create table public.ai_calls (
  id bigint generated always as identity primary key,
  role text not null,
  model text not null,
  prompt_version text,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  latency_ms int,
  status text not null check (status in ('ok', 'retry', 'invalid', 'error', 'fallback', 'replayed')),
  trace_id uuid,
  error text,
  created_at timestamptz not null default now()
);
create index ai_calls_created_idx on public.ai_calls (created_at);
create index ai_calls_trace_idx on public.ai_calls (trace_id);

-- Long running work (card extraction) polled by the UI (D15). Service role only.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status public.job_status not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_status_idx on public.jobs (status, created_at);
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- Field teacher invites (D17). Service role only.
create table public.invites (
  code text primary key check (char_length(code) between 6 and 32),
  role public.app_role not null default 'teacher',
  district text,
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Row level security ───────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.masters enable row level security;
alter table public.interviews enable row level security;
alter table public.segments enable row level security;
alter table public.cards enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.tried enable row level security;
alter table public.thanks enable row level security;
alter table public.human_queue enable row level security;
alter table public.ai_calls enable row level security;
alter table public.jobs enable row level security;
alter table public.invites enable row level security;

-- profiles: your own row only. Master credit is read through v_master_credit, which honours
-- each master's show_name choice.
create policy profiles_self_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = public.current_app_role());

-- masters: the full row (consent audio, settings) for the master and reviewers only.
create policy masters_select on public.masters for select to authenticated using (
  profile_id = (select auth.uid()) or public.current_app_role() = 'reviewer'
);
create policy masters_self_update on public.masters for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- interviews and segments: the master who spoke, and reviewers.
create policy interviews_select on public.interviews for select to authenticated using (
  public.current_app_role() = 'reviewer'
  or master_id in (select id from public.masters where profile_id = (select auth.uid()))
);
create policy segments_select on public.segments for select to authenticated using (
  public.current_app_role() = 'reviewer'
  or interview_id in (
    select i.id from public.interviews i
    join public.masters m on m.id = i.master_id
    where m.profile_id = (select auth.uid())
  )
);

-- cards: approved ones for everyone; drafts for their master and reviewers; reviewers decide.
create policy cards_select on public.cards for select to authenticated using (
  status = 'approved'
  or public.current_app_role() = 'reviewer'
  or master_id in (select id from public.masters where profile_id = (select auth.uid()))
);
create policy cards_review on public.cards for update to authenticated
  using (public.current_app_role() = 'reviewer')
  with check (public.current_app_role() = 'reviewer');

-- questions: the asking teacher only. Reviewers read v_review_questions, which carries the
-- redacted text but never teacher_id or the teacher's voice (Law 6).
create policy questions_own on public.questions for select to authenticated using (
  teacher_id = (select auth.uid())
);
create policy answers_own on public.answers for select to authenticated using (
  public.current_app_role() = 'reviewer'
  or question_id in (select id from public.questions where teacher_id = (select auth.uid()))
);

-- tried: the teacher's own feedback.
create policy tried_own_select on public.tried for select to authenticated
  using (teacher_id = (select auth.uid()));
create policy tried_own_insert on public.tried for insert to authenticated with check (
  teacher_id = (select auth.uid())
  and answer_id in (
    select a.id from public.answers a
    join public.questions q on q.id = a.question_id
    where q.teacher_id = (select auth.uid())
  )
);
create policy tried_own_update on public.tried for update to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- thanks: the master receives; the teacher who tried sends and can see what they sent.
create policy thanks_master_select on public.thanks for select to authenticated using (
  master_id in (select id from public.masters where profile_id = (select auth.uid()))
  or tried_id in (select id from public.tried where teacher_id = (select auth.uid()))
);
-- A thank you can only go to a master whose card was used in the answer the teacher tried.
create policy thanks_teacher_insert on public.thanks for insert to authenticated with check (
  exists (
    select 1
    from public.tried t
    join public.answers a on a.id = t.answer_id
    join public.cards c on c.id = any (a.card_ids)
    where t.id = tried_id
      and t.teacher_id = (select auth.uid())
      and c.master_id = thanks.master_id
  )
);

-- human queue: reviewers only.
create policy queue_reviewer_select on public.human_queue for select to authenticated
  using (public.current_app_role() = 'reviewer');
create policy queue_reviewer_update on public.human_queue for update to authenticated
  using (public.current_app_role() = 'reviewer')
  with check (public.current_app_role() = 'reviewer');

-- ai_calls, jobs, invites: no policies, so only the service role can touch them.

-- ── Aggregate views (officer insights, landing counts) ──────────────────────
-- Views run as their owner and filter by role, so officers get numbers, never rows about a teacher.
-- Every view splits field data from sample data (Law 7).
-- Master credit as each master chose to be shown (show_name full | first | anon).
create view public.v_master_credit as
select
  m.id as master_id,
  case m.show_name
    when 'full' then p.display_name
    when 'first' then split_part(p.display_name, ' ', 1)
    else null
  end as display_name,
  case when m.show_name = 'anon' then null else p.district end as district,
  m.years,
  m.signature_line_kn,
  m.signature_line_en,
  m.voice_public,
  m.is_sample
from public.masters m
join public.profiles p on p.id = m.profile_id
where m.consented_at is not null;

-- What a reviewer needs to answer a question: the redacted text, never who asked or their voice.
create view public.v_review_questions
with (security_barrier = true) as
select q.id, q.text_redacted, q.lang, q.topic, q.grade_band, q.safety_flags, q.is_sample, q.created_at
from public.questions q
where public.current_app_role() = 'reviewer';

create view public.v_library_counts as
select
  is_sample,
  count(*) filter (where status = 'approved') as approved_cards,
  count(distinct master_id) filter (where status = 'approved') as masters_with_cards
from public.cards
group by is_sample;

create view public.v_weekly_funnel
with (security_barrier = true) as
select
  date_trunc('week', q.created_at) as week,
  q.is_sample,
  count(distinct q.id) as asked,
  count(distinct a.id) filter (where a.status = 'answered') as answered,
  count(distinct t.id) as tried,
  count(distinct t.id) filter (where t.outcome = 'worked') as worked,
  count(distinct h.id) as sent_to_humans
from public.questions q
left join public.answers a on a.question_id = q.id
left join public.tried t on t.answer_id = a.id
left join public.human_queue h on h.question_id = q.id
where public.current_app_role() in ('officer', 'reviewer')
group by 1, 2;

create view public.v_topic_gaps
with (security_barrier = true) as
select
  coalesce(q.topic, 'unknown') as topic,
  q.is_sample,
  count(*) as asked,
  count(*) filter (where h.reason = 'no_card') as no_card
from public.questions q
left join public.human_queue h on h.question_id = q.id
where public.current_app_role() in ('officer', 'reviewer')
  and q.created_at > now() - interval '30 days'
group by 1, 2;

revoke all on public.v_master_credit, public.v_review_questions, public.v_library_counts,
  public.v_weekly_funnel, public.v_topic_gaps from anon, public;
grant select on public.v_library_counts to anon, authenticated;
grant select on public.v_master_credit, public.v_review_questions, public.v_weekly_funnel,
  public.v_topic_gaps to authenticated;

-- ── Storage: private audio, short lived signed URLs from the server (D18) ───
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;
