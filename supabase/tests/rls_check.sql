-- RLS assertions for 0001. Run against a throwaway database after the migration
-- (see supabase/tests/README.md). Any failed check raises and stops the script.
-- Synthetic ids only.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, role, display_name, is_sample) values
  ('00000000-0000-0000-0000-00000000000a', 'teacher', 'Sample teacher A', true),
  ('00000000-0000-0000-0000-00000000000b', 'teacher', 'Sample teacher B', true),
  ('00000000-0000-0000-0000-00000000000c', 'master', 'Sample master', true),
  ('00000000-0000-0000-0000-00000000000d', 'reviewer', 'Sample reviewer', true),
  ('00000000-0000-0000-0000-00000000000e', 'officer', 'Sample officer', true);
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000f');
insert into public.profiles (id, role, display_name, district, is_sample) values
  ('00000000-0000-0000-0000-00000000000f', 'master', 'Quiet Sample Master', 'Sample district', true);
update public.profiles set display_name = 'Sample Master Teacher', district = 'Sample district'
  where id = '00000000-0000-0000-0000-00000000000c';
insert into public.masters (id, profile_id, show_name, consented_at, is_sample) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'first', now(), true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000f', 'anon', now(), true);
insert into public.interviews (id, master_id, is_sample)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true);
insert into public.segments (interview_id, idx, start_ms, end_ms, text_kn)
  values ('20000000-0000-0000-0000-000000000001', 0, 0, 4000, 'ಮಾದರಿ');
insert into public.cards (id, master_id, title_kn, title_en, problem_kn, problem_en, steps, status, evidence_segment_ids, is_sample) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ಕಾ', 'Approved', 'ಸ', 'P', '[{"kn":"a","en":"a"}]', 'approved', '{1}', true),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'ಕಾ', 'Draft', 'ಸ', 'P', '[{"kn":"a","en":"a"}]', 'draft', '{1}', true);
insert into public.questions (id, teacher_id, text_redacted, topic, is_sample) values
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'q from A', 'letters', true),
  ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'q from B', 'numbers', true);
insert into public.answers (id, question_id, status, card_ids, is_sample)
  values ('50000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000a', 'answered',
          '{30000000-0000-0000-0000-000000000001}', true);
insert into public.ai_calls (role, model, status) values ('triage', 'claude-haiku-5-5', 'ok');

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'RLS CHECK FAILED: %', msg; end if;
  raise notice 'ok  %', msg;
end $$;

-- Constraint: an approved card must cite the recording.
do $$ begin
  begin
    insert into public.cards (master_id, title_kn, title_en, problem_kn, problem_en, steps, status)
    values ('10000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', '[{"kn":"a"}]', 'approved');
    raise exception 'RLS CHECK FAILED: approved card without evidence was accepted';
  exception when check_violation then raise notice 'ok  approved card without evidence is rejected';
  end;
end $$;

-- Teacher A
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.check((select count(*) from public.questions) = 1, 'teacher sees only her own question');
select pg_temp.check((select count(*) from public.answers) = 1, 'teacher sees her own answer');
select pg_temp.check((select count(*) from public.cards) = 1, 'teacher sees approved cards only');
select pg_temp.check((select count(*) from public.ai_calls) = 0, 'teacher cannot read ai_calls');
select pg_temp.check(not has_table_privilege('authenticated', 'public.v_weekly_funnel', 'select'), 'teacher gets no insights rows');
select pg_temp.check((select count(*) from public.profiles) = 1, 'teacher sees only her own profile');
select pg_temp.check((select count(*) from public.masters) = 0, 'teacher cannot read master settings or consent audio');
select pg_temp.check(
  (select display_name from public.v_master_credit where master_id = '10000000-0000-0000-0000-000000000001') = 'Sample',
  'master credit shows only the first name when the master chose first');
select pg_temp.check(
  (select display_name is null and district is null from public.v_master_credit
   where master_id = '10000000-0000-0000-0000-000000000002'),
  'an anonymous master is never named');
select pg_temp.check((select count(*) from public.v_review_questions) = 0, 'teacher gets no reviewer view');
select pg_temp.check((select count(*) from public.segments) = 0, 'teacher cannot read transcripts');
do $$ begin
  update public.profiles set role = 'reviewer' where id = '00000000-0000-0000-0000-00000000000a';
exception when insufficient_privilege then null;
end $$;
reset role;
select pg_temp.check(
  (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'teacher',
  'teacher cannot promote herself');
set role authenticated;

-- Teacher A can record that an idea worked, but not on teacher B's question.
insert into public.tried (answer_id, teacher_id, outcome)
  values ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'worked');
select pg_temp.check((select count(*) from public.tried) = 1, 'teacher records worked on her own answer');
insert into public.thanks (tried_id, master_id, text)
  select id, '10000000-0000-0000-0000-000000000001', 'Thank you' from public.tried;
select pg_temp.check((select count(*) from public.thanks) = 1, 'teacher thanks the master whose card helped');
do $$ begin
  insert into public.thanks (tried_id, master_id, text)
    select id, '10000000-0000-0000-0000-000000000002', 'Thank you' from public.tried;
  raise exception 'RLS CHECK FAILED: a thank you reached a master whose card was not used';
exception when insufficient_privilege then raise notice 'ok  a thank you cannot reach an unrelated master';
end $$;

-- Master
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.check((select count(*) from public.cards) = 2, 'master sees own drafts and approved');
select pg_temp.check((select count(*) from public.segments) = 1, 'master sees own transcript');
select pg_temp.check((select count(*) from public.questions) = 0, 'master never sees teacher questions');
select pg_temp.check((select count(*) from public.tried) = 0, 'master never sees who tried');
select pg_temp.check((select count(*) from public.thanks) = 1, 'master receives the thank you');
select pg_temp.check((select count(*) from public.masters) = 1, 'master reads only their own settings');

-- Reviewer
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select pg_temp.check((select count(*) from public.cards) = 2, 'reviewer sees drafts');
select pg_temp.check((select count(*) from public.questions) = 0, 'reviewer never reads question rows (teacher id, voice)');
select pg_temp.check((select count(*) from public.v_review_questions) = 2, 'reviewer sees redacted question text');
select pg_temp.check((select count(*) from public.profiles where role = 'teacher') = 0, 'reviewer never sees teacher profiles');

-- Officer
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select pg_temp.check((select count(*) from public.questions) = 0, 'officer sees no question rows');
select pg_temp.check((select count(*) from public.tried) = 0, 'officer sees no tried rows');
select pg_temp.check(
  not has_table_privilege('authenticated', 'public.v_weekly_funnel', 'select')
  and not has_table_privilege('authenticated', 'public.v_topic_gaps', 'select'),
  'the unsuppressed 0001 funnel and topic views are closed (0006 insights replace them)');

-- Anonymous visitor
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check((select count(*) from public.cards) = 0, 'anon reads no cards');
select pg_temp.check((select sum(approved_cards) from public.v_library_counts) = 1, 'anon reads library counts');
reset role;

-- ── 0002 storage and 0003 invites, import, sample isolation ───────────────────
-- Real (field) people and rows next to the sample ones.
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000010'), ('00000000-0000-0000-0000-000000000011');
insert into public.profiles (id, role, display_name, is_sample) values
  ('00000000-0000-0000-0000-000000000010', 'reviewer', 'Field reviewer', false),
  ('00000000-0000-0000-0000-000000000011', 'master', 'Field master', false);
insert into public.masters (id, profile_id, consented_at, is_sample)
  values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000011', now(), false);
insert into public.cards (id, master_id, title_kn, title_en, problem_kn, problem_en, steps, status, evidence_segment_ids, is_sample) values
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'ಕಾ', 'Field draft', 'ಸ', 'P', '[{"kn":"a","en":"a"}]', 'draft', '{1}', false);
insert into public.audio_chunks (interview_id, idx, start_ms, end_ms)
  values ('20000000-0000-0000-0000-000000000001', 0, 0, 25000);
insert into public.jobs (kind, interview_id) values ('transcribe', '20000000-0000-0000-0000-000000000001');
insert into public.invites (code, role, is_sample) values ('SAMPLE01', 'teacher', true);
insert into storage.objects (bucket_id, name) values ('interviews', 'x/part-0.m4a'), ('answers', 'y.wav');

select pg_temp.check(
  (select count(*) from storage.buckets where id in ('interviews','questions','answers','thanks','photos') and not public) = 5,
  'all five storage buckets exist and are private');
select pg_temp.check(
  not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'),
  'no migration adds a storage.objects policy (signed URLs only)');

-- Sample reviewer (demo login): can act on sample cards, never on field cards (D38).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select pg_temp.check((select count(*) from storage.objects) = 0, 'reviewer cannot list stored audio');
select pg_temp.check((select count(*) from public.audio_chunks) = 0, 'reviewer cannot read chunk bookkeeping');
select pg_temp.check((select count(*) from public.jobs) = 0, 'reviewer cannot read jobs');
select pg_temp.check((select count(*) from public.invites) = 0, 'reviewer cannot read invites');
update public.cards set status = 'approved' where id = '30000000-0000-0000-0000-000000000002';
update public.cards set status = 'approved' where id = '30000000-0000-0000-0000-000000000003';
reset role;
select pg_temp.check(
  (select status from public.cards where id = '30000000-0000-0000-0000-000000000002') = 'approved',
  'sample reviewer approves a sample card');
select pg_temp.check(
  (select status from public.cards where id = '30000000-0000-0000-0000-000000000003') = 'draft',
  'sample reviewer cannot approve a field card');
set role authenticated;
do $$ begin
  update public.profiles set is_sample = false where id = '00000000-0000-0000-0000-00000000000d';
  raise exception 'RLS CHECK FAILED: a demo account flipped its own is_sample';
exception when insufficient_privilege then raise notice 'ok  a demo account cannot make itself a field account';
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('interviews', 'sneaky.m4a');
  raise exception 'RLS CHECK FAILED: a browser wrote straight into storage';
exception when insufficient_privilege then raise notice 'ok  no direct uploads to storage';
end $$;
do $$ begin
  perform public.claim_job('20000000-0000-0000-0000-000000000001', array['transcribe']);
  raise exception 'RLS CHECK FAILED: claim_job is callable from the browser';
exception when insufficient_privilege then raise notice 'ok  claim_job is server only';
end $$;

-- Field reviewer: acts on field cards.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000010', false);
update public.cards set status = 'approved' where id = '30000000-0000-0000-0000-000000000003';
reset role;
select pg_temp.check(
  (select status from public.cards where id = '30000000-0000-0000-0000-000000000003') = 'approved',
  'field reviewer approves a field card');
update public.cards set status = 'draft' where id = '30000000-0000-0000-0000-000000000003';

-- Master: may change how they are shown, never their consent record.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update public.masters set show_name = 'full' where profile_id = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  update public.masters set consented_at = now() where profile_id = '00000000-0000-0000-0000-00000000000c';
  raise exception 'RLS CHECK FAILED: a master rewrote their consent time';
exception when insufficient_privilege then raise notice 'ok  consent is recorded only by the server';
end $$;
reset role;
select pg_temp.check(
  (select show_name from public.masters where profile_id = '00000000-0000-0000-0000-00000000000c') = 'full',
  'master changes how their name is shown');

-- A signed in user with no profile (for example an anonymous sign in) gets nothing private.
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000099');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', false);
select pg_temp.check((select count(*) from public.cards where status <> 'approved') = 0, 'no profile, no drafts');
select pg_temp.check((select count(*) from public.segments) = 0, 'no profile, no transcripts');
select pg_temp.check((select count(*) from public.v_review_questions) = 0, 'no profile, no reviewer view');
select pg_temp.check((select count(*) from public.insights_summary(false)) = 0, 'no profile, no insights');
select pg_temp.check(public.current_is_sample(), 'no profile counts as sample');
reset role;

-- 0004: a card cannot be approved before its master's consent is on record.
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000012');
insert into public.profiles (id, role, display_name, is_sample) values ('00000000-0000-0000-0000-000000000012', 'master', 'Not yet consented', false);
insert into public.masters (id, profile_id, is_sample) values ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000012', false);
insert into public.cards (id, master_id, title_kn, title_en, problem_kn, problem_en, steps, status, evidence_segment_ids, is_sample) values
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'ಕಾ', 'No consent', 'ಸ', 'P', '[{"kn":"a","en":"a"}]', 'draft', '{1}', false);
do $$ begin
  update public.cards set status = 'approved' where id = '30000000-0000-0000-0000-000000000004';
  raise exception 'RLS CHECK FAILED: a card was approved without the master''s consent';
exception when check_violation then raise notice 'ok  no consent, no approved card';
end $$;

-- ── 0006: Teacher Pulse, Lamps of Karnataka, digest cache, open data (M5) ────
-- Seven field teachers: six in Koppal (spelled four ways, folded into one district) and one in
-- Raichur, so Koppal is a group of 6 and Raichur a group of 1 (suppressed).
insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000031'), ('00000000-0000-0000-0000-000000000032'),
  ('00000000-0000-0000-0000-000000000033'), ('00000000-0000-0000-0000-000000000034'),
  ('00000000-0000-0000-0000-000000000035'), ('00000000-0000-0000-0000-000000000036'),
  ('00000000-0000-0000-0000-000000000037');
insert into public.profiles (id, role, district, is_sample) values
  ('00000000-0000-0000-0000-000000000031', 'teacher', 'Koppal', false),
  ('00000000-0000-0000-0000-000000000032', 'teacher', 'Koppal', false),
  ('00000000-0000-0000-0000-000000000033', 'teacher', ' koppala ', false),
  ('00000000-0000-0000-0000-000000000034', 'teacher', 'ಕೊಪ್ಪಳ', false),
  ('00000000-0000-0000-0000-000000000035', 'teacher', 'KOPPAL', false),
  ('00000000-0000-0000-0000-000000000036', 'teacher', 'Koppal', false),
  ('00000000-0000-0000-0000-000000000037', 'teacher', 'Raichur', false);
insert into public.cards (id, master_id, title_kn, title_en, problem_kn, problem_en, steps, status, evidence_segment_ids, topic, is_sample) values
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'ಗುಂಪು', 'Groups by level', 'ಸ', 'P',
   '[{"kn":"ಹಂತ","en":"step","evidence_segment_ids":[1]}]', 'approved', '{1}', 'multi_level', false);
insert into public.questions (id, teacher_id, text_redacted, topic, is_sample)
  select ('40000000-0000-0000-0000-0000000000' || n)::uuid, ('00000000-0000-0000-0000-0000000000' || n)::uuid,
         'field q', 'multi_level', false
  from generate_series(31, 36) as n;
insert into public.questions (id, teacher_id, text_redacted, topic, is_sample) values
  ('40000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-000000000037', 'field q', 'letters', false),
  ('40000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000037', 'field q', 'parents', false);
-- Asked ten days ago: outside this week.
insert into public.questions (id, teacher_id, text_redacted, topic, is_sample, created_at) values
  ('40000000-0000-0000-0000-000000000039', '00000000-0000-0000-0000-000000000031', 'old q', 'reading', false, now() - interval '10 days');
insert into public.answers (id, question_id, status, card_ids, cost_usd, is_sample)
  select ('50000000-0000-0000-0000-0000000000' || n)::uuid, ('40000000-0000-0000-0000-0000000000' || n)::uuid,
         'answered', '{30000000-0000-0000-0000-000000000005}', 0.02, false
  from generate_series(31, 37) as n;
insert into public.tried (answer_id, teacher_id, outcome, is_sample)
  select ('50000000-0000-0000-0000-0000000000' || n)::uuid, ('00000000-0000-0000-0000-0000000000' || n)::uuid,
         case when n = 36 then 'didnt' else 'worked' end::public.tried_outcome, false
  from generate_series(31, 37) as n;
insert into public.human_queue (question_id, reason, is_sample)
  values ('40000000-0000-0000-0000-000000000038', 'no_card', false);
insert into public.insights_digests (week_start, is_sample, attempted_on, status, digest, digest_at)
  values (current_date, false, current_date, 'ok', '{"headlineEn":"x"}', now());

-- Teacher A: no insights at all, and no digest rows.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.check((select count(*) from public.insights_summary(false)) = 0, 'teacher gets no pulse summary');
select pg_temp.check((select count(*) from public.insights_topics(false)) = 0, 'teacher gets no topics');
select pg_temp.check((select count(*) from public.insights_districts(false)) = 0, 'teacher gets no districts');
select pg_temp.check((select count(*) from public.insights_practices(false)) = 0, 'teacher gets no practices');
select pg_temp.check((select count(*) from public.insights_lamps(false)) = 0, 'teacher gets no lamps');
select pg_temp.check((select count(*) from public.insights_lamp_masters(false)) = 0, 'teacher gets no lamp masters');
select pg_temp.check((select count(*) from public.insights_platform_cost()) = 0, 'teacher gets no cost');
select pg_temp.check((select count(*) from public.insights_digests) = 0, 'teacher reads no digest');
do $$ begin
  perform public.claim_insights_digest(current_date, false);
  raise exception 'RLS CHECK FAILED: a browser can claim the digest';
exception when insufficient_privilege then raise notice 'ok  only the server claims the daily digest';
end $$;

-- A signed in user with no profile gets nothing either.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', false);
select pg_temp.check((select count(*) from public.insights_summary(false)) = 0, 'no profile, no pulse');
select pg_temp.check((select count(*) from public.insights_lamps(true)) = 0, 'no profile, no lamps');

-- Officer: aggregates only, small groups suppressed, field and Sample apart.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select pg_temp.check(
  (select asked = 8 and answered = 7 and tried = 7 and worked = 6 and teachers = 7 and not asked_suppressed
   from public.insights_summary(false)),
  'officer sees this week''s field funnel (the old question is not counted)');
select pg_temp.check(
  (select answer_cost_usd = 0.14 and cost_per_teacher_usd = 0.02 and cost_per_answer_usd = 0.02
   from public.insights_summary(false)),
  'cost per teacher and per answer are computed in SQL');
select pg_temp.check(
  (select asked is null and asked_suppressed and teachers is null and cost_per_teacher_usd is null
   from public.insights_summary(true)),
  'two Sample teachers are fewer than 5: the Sample funnel is suppressed, never summed with field');
select pg_temp.check(
  (select asked = 6 and not asked_suppressed from public.insights_topics(false) where topic = 'multi_level'),
  'a topic asked by 6 teachers is shown');
select pg_temp.check(
  (select asked is null and asked_suppressed from public.insights_topics(false) where topic = 'letters'),
  'a topic asked by 1 teacher says fewer than 5');
select pg_temp.check(
  (select waiting is null and waiting_suppressed from public.insights_topics(false) where topic = 'parents'),
  'a waiting need from 1 teacher is suppressed too');
select pg_temp.check(
  not exists (select 1 from public.insights_topics(false) where topic = 'reading'),
  'last week''s question is not this week''s topic');
select pg_temp.check(
  (select asked = 6 and not suppressed from public.insights_districts(false) where district = 'koppal'),
  'Koppal spelled four ways is one district of 6 teachers');
select pg_temp.check(
  not exists (select 1 from public.insights_districts(false) where district = 'raichur'),
  'a district of 1 teacher is never named');
select pg_temp.check(
  (select asked is null and suppressed from public.insights_districts(false) where district = 'elsewhere'),
  'small districts are counted together as elsewhere, and that small group is suppressed');
select pg_temp.check(
  (select answer_cost_usd is null from public.insights_summary(true)),
  'no cost total for a week of fewer than 5 teachers (cost over a typical answer would be a count)');
select pg_temp.check(
  (select asked = 6 and not asked_shielded from public.insights_topics(false) where topic = 'multi_level'),
  'with two small topics, nothing more needs hiding');
select pg_temp.check(
  (select tried = 7 and worked = 6 and master_name = 'Field' from public.insights_practices(false)
   where card_id = '30000000-0000-0000-0000-000000000005'),
  'the practice that worked, credited as the master chose');
select pg_temp.check(
  (select helped = 5 from public.insights_lamps(false) where district = 'koppal'),
  'Koppal has 5 lamps; the teacher who said it did not work is not a lamp');
select pg_temp.check(
  (select helped is null and suppressed from public.insights_lamps(false) where district = 'elsewhere')
  and not exists (select 1 from public.insights_lamps(false) where district = 'raichur'),
  'a single lamp in Raichur shares the unnamed elsewhere lamp and says fewer than 5');
select pg_temp.check(
  (select helped = 5 and master_name = 'Field' from public.insights_lamp_masters(false) where district = 'koppal'),
  'whose practice helped in Koppal');
select pg_temp.check((select count(*) from public.insights_platform_cost()) = 1, 'officer sees the whole system cost');
select pg_temp.check((select count(*) from public.insights_digests) = 1, 'officer reads the cached digest');
select pg_temp.check((select count(*) from public.questions) = 0, 'officer still reads no question rows');
do $$ begin
  insert into public.insights_digests (week_start, is_sample, attempted_on) values (current_date, true, current_date);
  raise exception 'RLS CHECK FAILED: a browser wrote a digest';
exception when insufficient_privilege then raise notice 'ok  only the server writes digests';
end $$;

-- Reviewer: the same aggregates.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select pg_temp.check((select asked = 8 from public.insights_summary(false)), 'reviewer sees the pulse too');
reset role;

-- District names fold into Karnataka's 31 before anything is counted.
select pg_temp.check(
  public.insights_district(' koppala ') = 'koppal' and public.insights_district('ಕೊಪ್ಪಳ') = 'koppal'
  and public.insights_district('Gulbarga') = 'kalaburagi' and public.insights_district('Bengaluru Urban') = 'bengaluru_urban'
  and public.insights_district('Ramanagara') = 'ramanagara' and public.insights_district('Somewhere') = 'other'
  and public.insights_district('  ') is null,
  'district spellings and old names fold into one key');

-- No insight ever returns a teacher id or a profile id.
select pg_temp.check(
  not exists (
    select 1 from pg_proc p, unnest(coalesce(p.proargnames, '{}')) as a(name)
    where p.pronamespace = 'public'::regnamespace and p.proname like 'insights\_%'
      and (a.name ilike '%teacher_id%' or a.name ilike '%profile%' or a.name ilike '%user%')
  ),
  'no insights function has a teacher, profile or user column');

-- Anonymous visitors: no insights, but the open library.
set role anon;
do $$ begin
  perform * from public.insights_summary(false);
  raise exception 'RLS CHECK FAILED: anon read the pulse';
exception when insufficient_privilege then raise notice 'ok  anon cannot call the pulse';
end $$;
do $$ begin
  perform * from public.insights_lamps(false);
  raise exception 'RLS CHECK FAILED: anon read the lamps';
exception when insufficient_privilege then raise notice 'ok  anon cannot call the lamps';
end $$;
do $$ begin
  perform * from public.open_cards();
  raise exception 'RLS CHECK FAILED: anon called open_cards directly, past the safety backstop';
exception when insufficient_privilege then raise notice 'ok  open cards go out only through the route (its safety backstop)';
end $$;
reset role;

-- The server reads the open library for /api/open/cards.
set role service_role;
select pg_temp.check((select count(*) from public.open_cards()) = 3, 'the server reads the approved cards of consented masters');
select pg_temp.check(
  not exists (select 1 from public.open_cards() where steps::text like '%evidence%'),
  'open cards carry the words only, never the evidence ids');
select pg_temp.check(
  (select master_name from public.open_cards('30000000-0000-0000-0000-000000000005')) = 'Field',
  'open cards credit the master as they chose');
select pg_temp.check((select count(*) from public.open_cards('30000000-0000-0000-0000-000000000004')) = 0, 'a draft is never open data');
select pg_temp.check(
  not exists (select 1 from public.open_cards() where master_name is null and master_years is not null),
  'an anonymous master''s years are never published');
reset role;

-- The digest is asked of the model at most once a day per week and kind.
select pg_temp.check(public.claim_insights_digest('2026-10-19', true), 'the first claim today wins');
select pg_temp.check(not public.claim_insights_digest('2026-10-19', true), 'a second claim the same day does not');

-- ── 0005: what a master's wisdom did, as numbers only (Law 6) ────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.check((select count(*) from public.master_impact()) = 1, 'a master gets one row about their own reach');
select pg_temp.check((select approved_cards from public.master_impact()) = 2, 'master impact counts their approved cards');
select pg_temp.check(
  (select teachers_reached is null and teachers_tried is null and teachers_worked is null from public.master_impact()),
  'one teacher is "a few", never a count');
select pg_temp.check((select thanks from public.master_impact()) = 1, 'master impact counts their thank you notes');
select pg_temp.check((select count(*) from public.master_card_impact()) = 2, 'card impact covers their approved cards only');
select pg_temp.check((select count(*) from public.tried) = 0, 'master still never reads tried rows');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.check((select count(*) from public.master_impact()) = 0, 'a teacher gets no master impact');
select pg_temp.check((select count(*) from public.master_card_impact()) = 0, 'a teacher gets no card impact');
select pg_temp.check(public.mark_my_thanks_read() = 0, 'a teacher cannot mark thanks read');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select pg_temp.check((select count(*) from public.master_impact()) = 0, 'an officer gets no master impact');
reset role;

-- Three more Sample teachers (two worked, one partly) make four: now real numbers. A field
-- teacher's answer on the same card never counts for a Sample master (Law 7).
insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000020'), ('00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000022'), ('00000000-0000-0000-0000-000000000023');
insert into public.profiles (id, role, display_name, is_sample) values
  ('00000000-0000-0000-0000-000000000020', 'teacher', 'Sample teacher C', true),
  ('00000000-0000-0000-0000-000000000021', 'teacher', 'Sample teacher D', true),
  ('00000000-0000-0000-0000-000000000022', 'teacher', 'Sample teacher E', true),
  ('00000000-0000-0000-0000-000000000023', 'teacher', 'Field teacher', false);
insert into public.questions (id, teacher_id, text_redacted, is_sample) values
  ('40000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000020', 'q', true),
  ('40000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000021', 'q', true),
  ('40000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000022', 'q', true),
  ('40000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000023', 'q', false);
insert into public.answers (id, question_id, status, card_ids, is_sample) values
  ('50000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000020', 'answered', '{30000000-0000-0000-0000-000000000001}', true),
  ('50000000-0000-0000-0000-000000000021', '40000000-0000-0000-0000-000000000021', 'answered', '{30000000-0000-0000-0000-000000000001}', true),
  ('50000000-0000-0000-0000-000000000022', '40000000-0000-0000-0000-000000000022', 'answered', '{30000000-0000-0000-0000-000000000001}', true),
  ('50000000-0000-0000-0000-000000000023', '40000000-0000-0000-0000-000000000023', 'answered', '{30000000-0000-0000-0000-000000000001}', false);
insert into public.tried (answer_id, teacher_id, outcome, is_sample) values
  ('50000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000020', 'worked', true),
  ('50000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000021', 'worked', true),
  ('50000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000022', 'partly', true),
  ('50000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000023', 'worked', false);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.check(
  (select teachers_reached = 4 and teachers_tried = 4 and teachers_worked = 3 from public.master_impact()),
  'four Sample teachers: reached 4, tried 4, worked 3 (the field teacher is not counted)');
select pg_temp.check(
  (select teachers_tried = 4 and teachers_worked = 3 from public.master_card_impact()
   where card_id = '30000000-0000-0000-0000-000000000001'),
  'the card says it worked for 3 of 4 teachers');
select pg_temp.check(
  (select teachers_tried = 0 and teachers_worked = 0 from public.master_card_impact()
   where card_id = '30000000-0000-0000-0000-000000000002'),
  'an untried card says nobody has tried it yet');
select pg_temp.check(public.mark_my_thanks_read() = 1, 'opening the room delivers the thank you');
select pg_temp.check(public.mark_my_thanks_read() = 0, 'a thank you is delivered once');
reset role;
select pg_temp.check(
  (select count(*) from public.thanks where delivered_at is not null) = 1,
  'the thank you now carries its delivery time');
select pg_temp.check(
  not exists (
    select 1 from information_schema.parameters
    where specific_schema = 'public' and parameter_mode in ('OUT', 'INOUT')
      and specific_name like any (array['master_impact%', 'master_card_impact%'])
      and parameter_name like '%teacher_id%'),
  'impact functions never return a teacher id');
set role anon;
do $$ begin
  perform public.master_impact();
  raise exception 'RLS CHECK FAILED: anon called master_impact';
exception when insufficient_privilege then raise notice 'ok  anon cannot call master_impact';
end $$;
reset role;

-- ── 0005: feedback is written, never read back by clients ───────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.feedback (profile_id, route, text_redacted, is_sample)
  values ('00000000-0000-0000-0000-00000000000a', '/t', 'The voice was too fast', true);
select pg_temp.check((select count(*) from public.feedback) = 0, 'a teacher cannot read feedback back, even her own');
do $$ begin
  insert into public.feedback (profile_id, route, is_sample)
    values ('00000000-0000-0000-0000-00000000000b', '/t', true);
  raise exception 'RLS CHECK FAILED: feedback written in another person''s name';
exception when insufficient_privilege then raise notice 'ok  feedback cannot be written as someone else';
end $$;
do $$ begin
  insert into public.feedback (profile_id, route, is_sample)
    values ('00000000-0000-0000-0000-00000000000a', '/t', false);
  raise exception 'RLS CHECK FAILED: a Sample account wrote field feedback';
exception when insufficient_privilege then raise notice 'ok  a Sample account writes Sample feedback only';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select pg_temp.check((select count(*) from public.feedback) = 0, 'a reviewer cannot read feedback either');
reset role;
set role anon;
do $$ begin
  insert into public.feedback (route, is_sample) values ('/', true);
  raise exception 'RLS CHECK FAILED: anon wrote feedback directly';
exception when insufficient_privilege then raise notice 'ok  a visitor writes feedback only through the server';
end $$;
reset role;
select pg_temp.check((select count(*) from public.feedback) = 1, 'the teacher''s feedback was stored');
-- Safety audit (24 Oct): reviewers never read answers or a teacher's distress.
insert into public.questions (id, teacher_id, text_redacted, topic, safety_flags, is_sample) values
  ('40000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-00000000000a', 'private distress', 'other', '{teacher_distress}', true);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select pg_temp.check((select count(*) from public.answers) = 0, 'reviewer cannot read teachers'' answers or their traces');
select pg_temp.check(
  (select count(*) from public.v_review_questions where text_redacted = 'private distress') = 0,
  'reviewer never sees a teacher''s distress');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.check((select count(*) from public.answers) = 1, 'teacher still reads her own answer');
reset role;

-- ── 0007: one QR, many teachers; quotable feedback ──────────────────────────
insert into public.invites (code, role, label, is_sample, max_uses, expires_at)
  values ('GROUPTEST1', 'teacher', 'Sample group', true, 2, now() + interval '1 day'),
         ('GROUPOLD01', 'teacher', 'Sample old group', true, 5, now() - interval '1 minute');
select pg_temp.check(public.join_group_invite('GROUPTEST1', 'CHILDTEST1') = 'ok', 'a scan of a group mints one person''s link');
select pg_temp.check(public.join_group_invite('GROUPTEST1', 'CHILDTEST2') = 'ok', 'a second scan takes the second place');
select pg_temp.check(public.join_group_invite('GROUPTEST1', 'CHILDTEST3') = 'full', 'a group never passes its limit');
select pg_temp.check(
  (select use_count from public.invites where code = 'GROUPTEST1') = 2
    and not exists (select 1 from public.invites where code = 'CHILDTEST3'),
  'a refused scan takes no place and mints nothing');
select pg_temp.check(
  (select count(*) from public.invites
    where parent_code = 'GROUPTEST1' and is_sample and role = 'teacher' and max_uses is null) = 2,
  'each person''s link copies the group''s Sample flag and role, and is one person');
select pg_temp.check(public.join_group_invite('GROUPOLD01', 'CHILDTEST4') = 'expired', 'an expired group takes nobody');
select pg_temp.check(public.join_group_invite('CHILDTEST1', 'CHILDTEST5') = 'unknown', 'a person''s own link is not a group');
update public.invites set revoked_at = now() where code = 'GROUPTEST1';
select pg_temp.check(public.join_group_invite('GROUPTEST1', 'CHILDTEST6') = 'closed', 'a revoked group takes nobody');
do $$ begin
  insert into public.invites (code, role, max_uses) values ('GROUPBAD01', 'reviewer', 5);
  raise exception 'RLS CHECK FAILED: a reviewer group was accepted';
exception when check_violation then raise notice 'ok  groups are for teachers only';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
do $$ begin
  perform public.join_group_invite('GROUPTEST1', 'CHILDTEST7');
  raise exception 'RLS CHECK FAILED: a signed in user called join_group_invite';
exception when insufficient_privilege then raise notice 'ok  a signed in user cannot take a place in a group';
end $$;
select pg_temp.check((select count(*) from public.invites) = 0, 'invites stay invisible to clients');
reset role;
set role anon;
do $$ begin
  perform public.join_group_invite('GROUPTEST1', 'CHILDTEST8');
  raise exception 'RLS CHECK FAILED: anon called join_group_invite';
exception when insufficient_privilege then raise notice 'ok  anon cannot take a place in a group';
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.feedback (profile_id, route, text_redacted, is_sample, quote_ok, role_word)
  values ('00000000-0000-0000-0000-00000000000a', '/t/a/x', 'Sample words', true, true, 'teacher');
do $$ begin
  insert into public.feedback (profile_id, route, is_sample, role_word)
    values ('00000000-0000-0000-0000-00000000000a', '/t', true, 'Lakshmi');
  raise exception 'RLS CHECK FAILED: a name was stored as a role word';
exception when check_violation then raise notice 'ok  feedback names a role, never a person';
end $$;
reset role;
select pg_temp.check(
  (select count(*) from public.feedback where quote_ok and role_word = 'teacher') = 1
    and (select count(*) from public.feedback where not quote_ok) = 1,
  'quoting is her own yes, and off unless she ticked it');

\echo 'All RLS checks passed.'
