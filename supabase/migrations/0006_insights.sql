-- Parampara 0006: Teacher Pulse, Lamps of Karnataka, the insights digest cache and open data
-- (docs/BUILD.md M5). Applied by the human only: ALLOW_DB_PUSH=1 pnpm db:push
-- Independent of 0005: it reads only tables and views made by 0001 to 0004, and every name it
-- creates starts with insights_ or open_.
--
-- Officers never see a row about a teacher (CLAUDE.md Law 6):
--   * every insight is a SECURITY DEFINER function that returns aggregates only: never a teacher
--     id, never one row per teacher, and no rows at all unless the caller is an officer or reviewer;
--   * a group with fewer than 5 different teachers in it is suppressed: its count comes back null
--     with suppressed = true, and the screen says "fewer than 5";
--   * field and Sample are always asked for separately (p_is_sample) and never summed (Law 7).

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- The smallest group of different teachers a number may describe.
create or replace function public.insights_min_group() returns int
language sql immutable as $$ select 5 $$;

-- A count of 1 to 4 different teachers is hidden; none at all (0) is shown as 0.
create or replace function public.insights_hidden(people bigint) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(people, 0) between 1 and public.insights_min_group() - 1
$$;

create or replace function public.insights_cell(n bigint, people bigint) returns int
language sql immutable set search_path = public as $$
  select case when public.insights_hidden(people) then null else coalesce(n, 0)::int end
$$;

-- Officers and reviewers read insights. A signed in user with no profile (an anonymous sign in)
-- has no role and reads nothing.
create or replace function public.insights_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('officer', 'reviewer'), false)
$$;

-- The week shown. Field: the last 7 days. Sample: the 7 days up to the latest Sample question, so
-- the demo never goes empty while judging runs; the screen prints the dates either way.
create or replace function public.insights_window(p_is_sample boolean)
returns table (since timestamptz, until timestamptz)
language sql stable security definer set search_path = public as $$
  with e as (
    select case
      when p_is_sample then coalesce((select max(q.created_at) from public.questions q where q.is_sample), now())
      else now()
    end as until
  )
  select e.until - interval '7 days', e.until from e
$$;

-- A teacher's district is free text (the invite's district). Spellings and old names are folded
-- into one of Karnataka's 31 districts before anything is counted, so "Gulbarga" and
-- "Kalaburagi" are one group. Anything else is 'other'; no district at all is null.
-- Keep the keys in step with lib/insights/districts.ts (a unit test compares them).
create or replace function public.insights_district(p text) returns text
language sql immutable set search_path = public as $$
  with input as (
    select nullif(trim(p), '') as raw,
           regexp_replace(lower(coalesce(p, '')), '[^a-z]', '', 'g') as folded
  )
  select case
    when input.raw is null then null
    else coalesce(
      (select a.k from (values
        ('bagalkote', 'bagalkote'), ('bagalkot', 'bagalkote'), ('ಬಾಗಲಕೋಟೆ', 'bagalkote'),
        ('ballari', 'ballari'), ('bellary', 'ballari'), ('ಬಳ್ಳಾರಿ', 'ballari'),
        ('belagavi', 'belagavi'), ('belgaum', 'belagavi'), ('belgavi', 'belagavi'), ('ಬೆಳಗಾವಿ', 'belagavi'),
        ('bengalururural', 'bengaluru_rural'), ('bangalorerural', 'bengaluru_rural'), ('ಬೆಂಗಳೂರುಗ್ರಾಮಾಂತರ', 'bengaluru_rural'),
        ('bengaluruurban', 'bengaluru_urban'), ('bangaloreurban', 'bengaluru_urban'), ('bengaluru', 'bengaluru_urban'),
        ('bangalore', 'bengaluru_urban'), ('ಬೆಂಗಳೂರುನಗರ', 'bengaluru_urban'), ('ಬೆಂಗಳೂರು', 'bengaluru_urban'),
        ('bidar', 'bidar'), ('ಬೀದರ್', 'bidar'), ('ಬೀದರ', 'bidar'),
        ('chamarajanagar', 'chamarajanagar'), ('chamarajanagara', 'chamarajanagar'), ('chamrajnagar', 'chamarajanagar'), ('ಚಾಮರಾಜನಗರ', 'chamarajanagar'),
        ('chikkaballapur', 'chikkaballapur'), ('chikkaballapura', 'chikkaballapur'), ('chikballapur', 'chikkaballapur'), ('ಚಿಕ್ಕಬಳ್ಳಾಪುರ', 'chikkaballapur'),
        ('chikkamagaluru', 'chikkamagaluru'), ('chikmagalur', 'chikkamagaluru'), ('chikkamagalur', 'chikkamagaluru'), ('ಚಿಕ್ಕಮಗಳೂರು', 'chikkamagaluru'),
        ('chitradurga', 'chitradurga'), ('ಚಿತ್ರದುರ್ಗ', 'chitradurga'),
        ('dakshinakannada', 'dakshina_kannada'), ('mangaluru', 'dakshina_kannada'), ('mangalore', 'dakshina_kannada'), ('ದಕ್ಷಿಣಕನ್ನಡ', 'dakshina_kannada'),
        ('davanagere', 'davanagere'), ('davangere', 'davanagere'), ('ದಾವಣಗೆರೆ', 'davanagere'),
        ('dharwad', 'dharwad'), ('dharwar', 'dharwad'), ('ಧಾರವಾಡ', 'dharwad'),
        ('gadag', 'gadag'), ('ಗದಗ', 'gadag'),
        ('hassan', 'hassan'), ('ಹಾಸನ', 'hassan'),
        ('haveri', 'haveri'), ('ಹಾವೇರಿ', 'haveri'),
        ('kalaburagi', 'kalaburagi'), ('gulbarga', 'kalaburagi'), ('ಕಲಬುರಗಿ', 'kalaburagi'),
        ('kodagu', 'kodagu'), ('coorg', 'kodagu'), ('ಕೊಡಗು', 'kodagu'),
        ('kolar', 'kolar'), ('ಕೋಲಾರ', 'kolar'),
        ('koppal', 'koppal'), ('koppala', 'koppal'), ('ಕೊಪ್ಪಳ', 'koppal'),
        ('mandya', 'mandya'), ('ಮಂಡ್ಯ', 'mandya'),
        ('mysuru', 'mysuru'), ('mysore', 'mysuru'), ('ಮೈಸೂರು', 'mysuru'),
        ('raichur', 'raichur'), ('ರಾಯಚೂರು', 'raichur'),
        ('ramanagara', 'ramanagara'), ('ramanagaram', 'ramanagara'), ('bengalurusouth', 'ramanagara'), ('ರಾಮನಗರ', 'ramanagara'), ('ಬೆಂಗಳೂರುದಕ್ಷಿಣ', 'ramanagara'),
        ('shivamogga', 'shivamogga'), ('shimoga', 'shivamogga'), ('ಶಿವಮೊಗ್ಗ', 'shivamogga'),
        ('tumakuru', 'tumakuru'), ('tumkur', 'tumakuru'), ('ತುಮಕೂರು', 'tumakuru'),
        ('udupi', 'udupi'), ('ಉಡುಪಿ', 'udupi'),
        ('uttarakannada', 'uttara_kannada'), ('karwar', 'uttara_kannada'), ('ಉತ್ತರಕನ್ನಡ', 'uttara_kannada'),
        ('vijayanagara', 'vijayanagara'), ('vijayanagar', 'vijayanagara'), ('hosapete', 'vijayanagara'), ('ವಿಜಯನಗರ', 'vijayanagara'),
        ('vijayapura', 'vijayapura'), ('bijapur', 'vijayapura'), ('ವಿಜಯಪುರ', 'vijayapura'),
        ('yadgir', 'yadgir'), ('yadagiri', 'yadgir'), ('ಯಾದಗಿರಿ', 'yadgir')
      ) as a(alias, k)
      where a.alias = input.folded or a.alias = regexp_replace(input.raw, '\s', '', 'g')
      limit 1),
      'other')
  end
  from input
$$;

-- ── Teacher Pulse ────────────────────────────────────────────────────────────
-- This week's funnel (asked → answered → tried → worked) for the questions asked this week, and
-- what answering them cost. Cost per teacher = answer cost / different teachers who asked; it is
-- hidden with the teacher count when fewer than 5 asked.
create or replace function public.insights_summary(p_is_sample boolean)
returns table (
  is_sample boolean,
  since timestamptz,
  until timestamptz,
  asked int, asked_suppressed boolean,
  answered int, answered_suppressed boolean,
  tried int, tried_suppressed boolean,
  worked int, worked_suppressed boolean,
  teachers int, teachers_suppressed boolean,
  answer_cost_usd numeric,
  cost_per_answer_usd numeric,
  cost_per_teacher_usd numeric
)
language sql stable security definer set search_path = public as $$
  with w as (select * from public.insights_window(p_is_sample)),
  q as (
    select q.id, q.teacher_id
    from public.questions q, w
    where q.is_sample = p_is_sample and q.created_at > w.since and q.created_at <= w.until
  ),
  a as (
    select a.id, a.status, a.cost_usd, q.teacher_id
    from public.answers a join q on q.id = a.question_id
  ),
  t as (
    select t.outcome, t.teacher_id
    from public.tried t join a on a.id = t.answer_id
  ),
  agg as (
    select
      (select count(*) from q) as asked_n,
      (select count(distinct teacher_id) from q) as asked_p,
      (select count(*) from a where status = 'answered') as answered_n,
      (select count(distinct teacher_id) from a where status = 'answered') as answered_p,
      (select count(*) from t) as tried_n,
      (select count(distinct teacher_id) from t) as tried_p,
      (select count(*) from t where outcome = 'worked') as worked_n,
      (select count(distinct teacher_id) from t where outcome = 'worked') as worked_p,
      (select coalesce(sum(cost_usd), 0) from a) as cost
  )
  select
    p_is_sample, w.since, w.until,
    public.insights_cell(agg.asked_n, agg.asked_p), public.insights_hidden(agg.asked_p),
    public.insights_cell(agg.answered_n, agg.answered_p), public.insights_hidden(agg.answered_p),
    public.insights_cell(agg.tried_n, agg.tried_p), public.insights_hidden(agg.tried_p),
    public.insights_cell(agg.worked_n, agg.worked_p), public.insights_hidden(agg.worked_p),
    public.insights_cell(agg.asked_p, agg.asked_p), public.insights_hidden(agg.asked_p),
    case when public.insights_hidden(agg.asked_p) then null else round(agg.cost, 4) end,
    case when agg.answered_n > 0 and not public.insights_hidden(agg.answered_p)
      then round(agg.cost / agg.answered_n, 4) end,
    case when agg.asked_p > 0 and not public.insights_hidden(agg.asked_p)
      then round(agg.cost / agg.asked_p, 4) end
  from agg, w
  where public.insights_allowed()
$$;

-- This week's questions by FLN topic, with the questions on that topic still waiting for a
-- master's answer (open human_queue, reason no_card, of any age).
create or replace function public.insights_topics(p_is_sample boolean)
returns table (
  topic text, asked int, asked_suppressed boolean, asked_shielded boolean,
  waiting int, waiting_suppressed boolean
)
language sql stable security definer set search_path = public as $$
  with w as (select * from public.insights_window(p_is_sample)),
  wk as (
    select coalesce(q.topic, 'other') as topic, count(*) as n, count(distinct q.teacher_id) as p
    from public.questions q, w
    where q.is_sample = p_is_sample and q.created_at > w.since and q.created_at <= w.until
    group by 1
  ),
  waiting as (
    select coalesce(q.topic, 'other') as topic, count(distinct q.id) as n, count(distinct q.teacher_id) as p
    from public.human_queue h join public.questions q on q.id = h.question_id
    where h.reason = 'no_card' and h.status <> 'resolved' and q.is_sample = p_is_sample
    group by 1
  ),
  joined as (
    select coalesce(wk.topic, waiting.topic) as topic,
      coalesce(wk.n, 0) as asked_n, coalesce(wk.p, 0) as asked_p,
      coalesce(waiting.n, 0) as waiting_n, coalesce(waiting.p, 0) as waiting_p
    from wk full join waiting on waiting.topic = wk.topic
  ),
  -- Complementary suppression: the week's total is shown, so with exactly one small topic the
  -- total minus the shown topics would give its count. Then the smallest shown topic is kept
  -- private too (asked_shielded), and only the sum of the two can be worked out.
  marked as (
    select joined.*,
      public.insights_hidden(asked_p) as small,
      count(*) filter (where public.insights_hidden(asked_p)) over () as small_groups,
      row_number() over (
        order by (public.insights_hidden(asked_p) or asked_n = 0), asked_n, joined.topic
      ) as smallest
    from joined
  ),
  final as (
    select marked.*, (not small and asked_n > 0 and small_groups = 1 and smallest = 1) as shield
    from marked
  )
  select final.topic,
    case when small or shield then null else asked_n::int end, small or shield, shield,
    public.insights_cell(waiting_n, waiting_p), public.insights_hidden(waiting_p)
  from final
  where public.insights_allowed()
  -- Shown groups first, largest first; hidden groups after, by name, so order never hints a size.
  order by (small or shield), case when small or shield then 0 else asked_n end desc, final.topic
$$;

-- This week's questions by the asking teacher's district.
create or replace function public.insights_districts(p_is_sample boolean)
returns table (district text, asked int, suppressed boolean)
language sql stable security definer set search_path = public as $$
  with w as (select * from public.insights_window(p_is_sample)),
  q as (
    select public.insights_district(p.district) as d, q.teacher_id
    from public.questions q
    join public.profiles p on p.id = q.teacher_id
    cross join w
    where q.is_sample = p_is_sample and q.created_at > w.since and q.created_at <= w.until
  ),
  per as (select d, count(distinct teacher_id) as p from q group by d),
  -- A district is named only with 5 or more different teachers in it. Smaller districts, unknown
  -- names and no district are counted together as 'elsewhere' and never named: a named district
  -- of one or two teachers would point at them (Law 6).
  placed as (
    select case when per.p >= public.insights_min_group() and q.d is not null and q.d <> 'other'
        then q.d else 'elsewhere' end as district, q.teacher_id
    from q join per on per.d is not distinct from q.d
  ),
  g as (select district, count(*) as n, count(distinct teacher_id) as p from placed group by district)
  select g.district, public.insights_cell(g.n, g.p), public.insights_hidden(g.p)
  from g
  where public.insights_allowed()
  order by (g.district = 'elsewhere'), g.n desc, g.district
$$;

-- Practices that worked most, so far: approved cards with how many teachers tried them and how
-- many said it worked, credited as each master chose (v_master_credit).
create or replace function public.insights_practices(p_is_sample boolean, p_limit int default 5)
returns table (
  card_id uuid, title_kn text, title_en text, topic text,
  master_name text, master_years int, master_district text, card_is_sample boolean,
  tried int, worked int, suppressed boolean
)
language sql stable security definer set search_path = public as $$
  with uses as (
    select c.id as card_id, t.teacher_id, t.outcome
    from public.tried t
    join public.answers a on a.id = t.answer_id
    join public.cards c on c.id = any (a.card_ids)
    where t.is_sample = p_is_sample and c.status = 'approved'
  ),
  agg as (
    select card_id, count(*) as n, count(*) filter (where outcome = 'worked') as w,
      count(distinct teacher_id) as p
    from uses group by card_id
  )
  select c.id, c.title_kn, c.title_en, c.topic,
    mc.display_name, case when mc.display_name is null then null else mc.years end, mc.district, c.is_sample,
    public.insights_cell(agg.n, agg.p), public.insights_cell(agg.w, agg.p), public.insights_hidden(agg.p)
  from agg
  join public.cards c on c.id = agg.card_id
  join public.v_master_credit mc on mc.master_id = c.master_id
  where public.insights_allowed()
  order by public.insights_hidden(agg.p),
    case when public.insights_hidden(agg.p) then 0 else agg.w end desc,
    c.title_en
  limit greatest(1, least(coalesce(p_limit, 5), 20))
$$;

-- ── Lamps of Karnataka ───────────────────────────────────────────────────────
-- Each lamp is a time a teacher said a master's idea worked, counted by the teacher's district.
create or replace function public.insights_lamps(p_is_sample boolean)
returns table (district text, helped int, suppressed boolean)
language sql stable security definer set search_path = public as $$
  with t as (
    select public.insights_district(p.district) as d, t.id, t.teacher_id
    from public.tried t
    join public.profiles p on p.id = t.teacher_id
    where t.outcome = 'worked' and t.is_sample = p_is_sample
  ),
  per as (select d, count(distinct teacher_id) as p from t group by d),
  -- As for questions: only a district with 5 or more different teachers gets its own lamp; the
  -- rest light one shared lamp, 'elsewhere', that names no place.
  placed as (
    select case when per.p >= public.insights_min_group() and t.d is not null and t.d <> 'other'
        then t.d else 'elsewhere' end as district, t.id, t.teacher_id
    from t join per on per.d is not distinct from t.d
  ),
  g as (select district, count(*) as n, count(distinct teacher_id) as p from placed group by district)
  select g.district, public.insights_cell(g.n, g.p), public.insights_hidden(g.p)
  from g
  where public.insights_allowed()
  order by (g.district = 'elsewhere'), g.district
$$;

-- Whose practice helped in each district: the master's name as they chose to be shown (null for a
-- master who chose to stay anonymous), never who was helped.
create or replace function public.insights_lamp_masters(p_is_sample boolean)
returns table (district text, master_name text, master_years int, helped int, suppressed boolean, shielded boolean)
language sql stable security definer set search_path = public as $$
  with t as (
    select public.insights_district(p.district) as d, t.id, t.answer_id, t.teacher_id
    from public.tried t
    join public.profiles p on p.id = t.teacher_id
    where t.outcome = 'worked' and t.is_sample = p_is_sample
  ),
  per as (select d, count(distinct teacher_id) as p from t group by d),
  u as (
    select case when per.p >= public.insights_min_group() and t.d is not null and t.d <> 'other'
        then t.d else 'elsewhere' end as district, c.master_id, t.id as tried_id, t.teacher_id
    from t
    join per on per.d is not distinct from t.d
    join public.answers a on a.id = t.answer_id
    join public.cards c on c.id = any (a.card_ids)
    where c.status = 'approved'
  ),
  g as (
    select u.district, u.master_id, count(distinct u.tried_id) as n, count(distinct u.teacher_id) as p
    from u group by u.district, u.master_id
  ),
  -- Complementary suppression within each district: its lamp count is shown, so one small master
  -- row is never the district's count minus the other masters.
  marked as (
    select g.*, public.insights_hidden(g.p) as small,
      count(*) filter (where public.insights_hidden(g.p)) over (partition by g.district) as small_groups,
      row_number() over (
        partition by g.district order by public.insights_hidden(g.p), g.n, g.master_id
      ) as smallest
    from g
  ),
  final as (
    select marked.*, (not small and n > 0 and small_groups = 1 and smallest = 1) as shield from marked
  )
  select final.district, mc.display_name,
    -- An anonymous master's years could point at them; only a named master's years are shown.
    case when mc.display_name is null then null else mc.years end,
    case when small or shield then null else n::int end, small or shield, shield
  from final
  join public.v_master_credit mc on mc.master_id = final.master_id
  where public.insights_allowed()
  order by (final.district = 'elsewhere'), final.district, mc.display_name nulls last
$$;

-- What every AI call cost in the last 7 days (Law 10). ai_calls has no sample flag, so this is the
-- whole system and is shown as such, never as field or Sample.
create or replace function public.insights_platform_cost()
returns table (since timestamptz, until timestamptz, ai_cost_usd numeric, ai_calls int)
language sql stable security definer set search_path = public as $$
  select x.since, x.until, x.cost, x.calls
  from (
    select now() - interval '7 days' as since, now() as until,
      round(coalesce(sum(c.cost_usd), 0), 4) as cost, count(*)::int as calls
    from public.ai_calls c
    where c.created_at > now() - interval '7 days'
  ) x
  where public.insights_allowed()
$$;

-- ── The insights digest cache (insights_digest@v1) ──────────────────────────
-- One row per week and data kind. The page shows the last good digest; the server asks the model
-- again at most once a day (claim_insights_digest), after the page has been sent.
create table if not exists public.insights_digests (
  week_start date not null,
  is_sample boolean not null,
  attempted_on date not null,
  status text not null default 'running' check (status in ('running', 'ok', 'failed')),
  digest jsonb,
  digest_at timestamptz,
  input_hash text,
  prompt_version text,
  updated_at timestamptz not null default now(),
  primary key (week_start, is_sample)
);
alter table public.insights_digests enable row level security;
drop policy if exists insights_digests_read on public.insights_digests;
create policy insights_digests_read on public.insights_digests for select to authenticated
  using (public.insights_allowed());
revoke insert, update, delete on public.insights_digests from anon, authenticated;

-- True when this call won today's single attempt for the week and kind (India time).
create or replace function public.claim_insights_digest(p_week date, p_is_sample boolean)
returns boolean
language sql security definer set search_path = public as $$
  with up as (
    insert into public.insights_digests (week_start, is_sample, attempted_on, status)
    values (p_week, p_is_sample, (now() at time zone 'Asia/Kolkata')::date, 'running')
    on conflict (week_start, is_sample) do update
      set attempted_on = excluded.attempted_on, status = 'running', updated_at = now()
      where public.insights_digests.attempted_on < excluded.attempted_on
    returning 1
  )
  select exists (select 1 from up)
$$;

-- ── Open data (CC BY 4.0) ────────────────────────────────────────────────────
-- Approved cards of consented masters, credited as each master chose (an anonymous master's years
-- are hidden too). Only the words of the
-- practice: no transcript, no segment text, no evidence ids, no reviewer, no flags.
-- docs/open/parampara-card.schema.json documents the shape /api/open/cards builds from this.
create or replace function public.open_cards(p_card uuid default null)
returns table (
  id uuid, title_kn text, title_en text, problem_kn text, problem_en text,
  steps jsonb, materials jsonb, why_kn text, why_en text,
  grade_band text, subject text, topic text, is_sample boolean,
  approved_at timestamptz, updated_at timestamptz,
  master_name text, master_district text, master_years int
)
language sql stable security definer set search_path = public as $$
  select c.id, c.title_kn, c.title_en, c.problem_kn, c.problem_en,
    (select coalesce(jsonb_agg(jsonb_build_object(
        'kn', coalesce(s ->> 'kn', ''), 'en', coalesce(s ->> 'en', '')) order by o), '[]'::jsonb)
     from jsonb_array_elements(c.steps) with ordinality as e(s, o)),
    (select coalesce(jsonb_agg(case when jsonb_typeof(m) = 'object'
        then jsonb_build_object('kn', coalesce(m ->> 'kn', ''), 'en', coalesce(m ->> 'en', ''))
        else jsonb_build_object('kn', m #>> '{}', 'en', m #>> '{}') end order by o), '[]'::jsonb)
     from jsonb_array_elements(c.materials) with ordinality as e(m, o)),
    c.why_kn, c.why_en, c.grade_band, c.subject, c.topic, c.is_sample,
    coalesce(c.reviewed_at, c.updated_at), c.updated_at,
    mc.display_name, mc.district, case when mc.display_name is null then null else mc.years end
  from public.cards c
  join public.v_master_credit mc on mc.master_id = c.master_id
  where c.status = 'approved' and (p_card is null or c.id = p_card)
  order by c.is_sample, coalesce(c.reviewed_at, c.updated_at) desc, c.id
$$;

-- ── Who may call what ────────────────────────────────────────────────────────
-- Supabase grants EXECUTE on new public functions to anon and authenticated by default, so every
-- function says exactly who may call it.
revoke all on function public.insights_min_group() from public, anon, authenticated;
revoke all on function public.insights_hidden(bigint) from public, anon, authenticated;
revoke all on function public.insights_cell(bigint, bigint) from public, anon, authenticated;
revoke all on function public.insights_allowed() from public, anon;
revoke all on function public.insights_window(boolean) from public, anon, authenticated;
revoke all on function public.insights_district(text) from public, anon, authenticated;
revoke all on function public.insights_summary(boolean) from public, anon;
revoke all on function public.insights_topics(boolean) from public, anon;
revoke all on function public.insights_districts(boolean) from public, anon;
revoke all on function public.insights_practices(boolean, int) from public, anon;
revoke all on function public.insights_lamps(boolean) from public, anon;
revoke all on function public.insights_lamp_masters(boolean) from public, anon;
revoke all on function public.insights_platform_cost() from public, anon;
revoke all on function public.claim_insights_digest(date, boolean) from public, anon, authenticated;
revoke all on function public.open_cards(uuid) from public, anon, authenticated;

-- The digest table's read policy asks insights_allowed() as the caller, so it is callable; it
-- only ever says whether you yourself may read insights.
grant execute on function public.insights_allowed() to authenticated;
-- Officers and reviewers (the functions themselves return nothing to anyone else).
grant execute on function public.insights_summary(boolean), public.insights_topics(boolean),
  public.insights_districts(boolean), public.insights_practices(boolean, int),
  public.insights_lamps(boolean), public.insights_lamp_masters(boolean),
  public.insights_platform_cost()
  to authenticated;
-- The server only.
grant execute on function public.claim_insights_digest(date, boolean) to service_role;
grant execute on function public.insights_district(text) to service_role;
-- The server only: /api/open/cards is the public door, because it also drops any card the safety
-- patterns flag (a direct RPC would skip that backstop).
grant execute on function public.open_cards(uuid) to service_role;

-- The 0001 aggregate views were never suppressed (a topic of one teacher showed as 1). Nothing in
-- the app reads them; the insights_* functions above replace them for officers and reviewers.
revoke select on public.v_weekly_funnel, public.v_topic_gaps from authenticated, anon;
