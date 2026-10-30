-- 0005 · What a master's wisdom did (docs/BUILD.md M4.2).
-- A master never reads questions, answers or tried rows (Law 6). These functions count across
-- them as their owner and return only numbers about the calling master's own approved cards:
-- never a teacher id, never a row. A group of fewer than three teachers comes back as null and
-- the room says "a few", so no single teacher can stand out. Field and Sample never mix (Law 7):
-- a field master counts field answers only, a Sample master Sample answers only.

-- n when it is 0 or at least 3, else null ("a few").
create or replace function public.count_or_few(n bigint) returns int
language sql immutable
as $$ select case when n between 1 and 2 then null else n::int end $$;

-- The calling master's reach, in one row (no row for anyone who is not a master).
create or replace function public.master_impact()
returns table (
  is_sample boolean,
  approved_cards int,
  teachers_reached int,
  teachers_tried int,
  teachers_worked int,
  thanks int
)
language sql stable security definer set search_path = public, pg_temp
as $$
  with me as (
    select m.id, m.is_sample
    from public.masters m
    where m.profile_id = (select auth.uid()) and public.current_app_role() = 'master'
  ),
  my_cards as (
    select c.id from public.cards c join me on me.id = c.master_id where c.status = 'approved'
  ),
  used as (
    select a.id, q.teacher_id
    from public.answers a
    join public.questions q on q.id = a.question_id
    join me on a.is_sample = me.is_sample
    where a.status = 'answered' and a.card_ids && array(select id from my_cards)
  ),
  outcomes as (
    select t.teacher_id, bool_or(t.outcome = 'worked') as worked
    from public.tried t
    join used u on u.id = t.answer_id
    group by t.teacher_id
  ),
  tried_n as (select count(*) as n from outcomes)
  select
    me.is_sample,
    (select count(*) from my_cards)::int,
    public.count_or_few((select count(distinct teacher_id) from used)),
    public.count_or_few((select n from tried_n)),
    -- Worked is shown only when enough teachers tried for it to say nothing about any one of them.
    case
      when (select n from tried_n) between 1 and 2 then null
      else (select count(*) from outcomes where worked)::int
    end,
    (select count(*) from public.thanks th where th.master_id = me.id)::int
  from me;
$$;

-- Per approved card: how many teachers tried an answer built on it, and how many said it worked.
-- Both are null when fewer than three teachers tried it.
create or replace function public.master_card_impact()
returns table (card_id uuid, teachers_tried int, teachers_worked int)
language sql stable security definer set search_path = public, pg_temp
as $$
  with me as (
    select m.id, m.is_sample
    from public.masters m
    where m.profile_id = (select auth.uid()) and public.current_app_role() = 'master'
  ),
  my_cards as (
    select c.id from public.cards c join me on me.id = c.master_id where c.status = 'approved'
  ),
  per_teacher as (
    select c.id as card_id, t.teacher_id, bool_or(t.outcome = 'worked') as worked
    from my_cards c
    join public.answers a on c.id = any (a.card_ids) and a.status = 'answered'
    join me on a.is_sample = me.is_sample
    join public.tried t on t.answer_id = a.id
    group by c.id, t.teacher_id
  )
  select
    c.id,
    public.count_or_few(count(p.teacher_id)),
    case
      when count(p.teacher_id) between 1 and 2 then null
      else (count(p.teacher_id) filter (where p.worked))::int
    end
  from my_cards c
  left join per_teacher p on p.card_id = c.id
  group by c.id;
$$;

-- The master opened their room: their thank you notes are now delivered (the teacher was told
-- "on its way" until this moment). Masters cannot update thanks rows directly.
create or replace function public.mark_my_thanks_read()
returns int
language sql volatile security definer set search_path = public, pg_temp
as $$
  with done as (
    update public.thanks th
    set delivered_at = now()
    where th.delivered_at is null
      and public.current_app_role() = 'master'
      and th.master_id in (select m.id from public.masters m where m.profile_id = (select auth.uid()))
    returning 1
  )
  select count(*)::int from done;
$$;

revoke all on function public.count_or_few(bigint) from public;
revoke all on function public.master_impact() from public, anon;
revoke all on function public.master_card_impact() from public, anon;
revoke all on function public.mark_my_thanks_read() from public, anon;
grant execute on function public.count_or_few(bigint) to authenticated;
grant execute on function public.master_impact() to authenticated;
grant execute on function public.master_card_impact() to authenticated;
grant execute on function public.mark_my_thanks_read() to authenticated;

-- ── Feedback from any screen (docs/BUILD.md M4.5) ───────────────────────────
-- Written by the person giving it (or by the server for a visitor without a session). Clients can
-- never read it back. Text is kept only after the server's safety and length checks; voice comes
-- later (audio_path stays null until then).
create type public.feedback_kind as enum ('text', 'voice');

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  route text not null check (char_length(route) between 1 and 200),
  kind public.feedback_kind not null default 'text',
  text_redacted text check (char_length(text_redacted) <= 500),
  audio_path text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
-- Your own row only, and a Sample account writes Sample rows only (D38). No select policy at all.
create policy feedback_insert_own on public.feedback for insert to authenticated with check (
  profile_id = (select auth.uid()) and is_sample = public.current_is_sample()
);
revoke all on public.feedback from anon;
