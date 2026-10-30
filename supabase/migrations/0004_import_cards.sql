-- Parampara 0004: details the import pipeline needs (docs/BUILD.md M2).
-- Applied by the human only: ALLOW_DB_PUSH=1 pnpm db:push

-- The segment that best carries the master's own voice for "Hear it from the master".
alter table public.cards
  add column if not exists quote_segment_id bigint references public.segments (id) on delete set null;

-- One extraction job per window of an interview, even when two tabs ask at once.
create unique index if not exists jobs_window_uniq
  on public.jobs (interview_id, kind, ((payload ->> 'window')))
  where kind = 'extract_window';

-- Segments are read in time order for extraction and for the reviewer's transcript.
create index if not exists segments_interview_time_idx on public.segments (interview_id, start_ms);

-- claim_job is called by the server with the service role only (0003 revoked it from browsers).
grant execute on function public.claim_job(uuid, text[], int) to service_role;

-- No consent, no published cards (docs/field-data skill, CLAUDE.md Law 4 and 7): a card can be
-- approved only when its master's consent is on record. Enforced here, not only in the app.
create or replace function public.cards_require_consent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (old is null or old.status is distinct from 'approved') then
    if not exists (select 1 from public.masters m where m.id = new.master_id and m.consented_at is not null) then
      raise exception 'master consent is not recorded' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cards_require_consent on public.cards;
create trigger cards_require_consent before insert or update of status on public.cards
  for each row execute function public.cards_require_consent();

-- ── Answers: cache, replay and the rest of the answer card (docs/BUILD.md M3, D35) ──
-- steps: [{ kn, en, hi?, card_id, verdict }]. A replay points at the answer it repeats, so the trace
-- can say "first answered at …" honestly.
alter table public.answers
  add column if not exists lang public.lang not null default 'kn',
  add column if not exists cache_key text,
  add column if not exists replayed_from uuid references public.answers (id) on delete set null,
  add column if not exists title_hi text,
  add column if not exists materials jsonb not null default '[]'::jsonb check (jsonb_typeof(materials) = 'array'),
  add column if not exists why jsonb;
create index if not exists answers_cache_idx on public.answers (cache_key, created_at)
  where cache_key is not null and status = 'answered';
create index if not exists questions_recent_idx on public.questions (teacher_id, created_at);

-- ── Safety audit, 24 Oct (teacher question path) ────────────────────────────
-- What kind of answer this is, so a revisit shows the right care: a teacher in distress must never
-- be shown child safety copy, and the other way round.
alter table public.answers
  add column if not exists outcome text check (outcome is null or outcome in
    ('answered', 'no_card', 'needs_human', 'child_safety', 'distress', 'care')),
  -- Keyed hash of the question as asked (HMAC with a server secret, never reversible without it),
  -- so an identical question finds its cached answer even when triage is unavailable (budget cap).
  add column if not exists raw_key text;
create index if not exists answers_raw_key_idx on public.answers (raw_key, created_at)
  where raw_key is not null and status = 'answered';

-- Reviewers answer teachers' questions but never read a teacher's own distress, and never read
-- answers at all (their traces carry the teacher's words). Teachers read only their own.
create or replace view public.v_review_questions
with (security_barrier = true) as
select q.id, q.text_redacted, q.lang, q.topic, q.grade_band, q.safety_flags, q.is_sample, q.created_at
from public.questions q
where public.current_app_role() = 'reviewer'
  and not ('teacher_distress' = any (q.safety_flags));

drop policy if exists answers_own on public.answers;
create policy answers_own on public.answers for select to authenticated using (
  question_id in (select id from public.questions where teacher_id = (select auth.uid()))
);
