-- Parampara 0007: one QR, many teachers (group invites), and quotable feedback.
-- Applied by the human only: ALLOW_DB_PUSH=1 pnpm db:push. Additive only: nothing is dropped or
-- rewritten, and the app works before it is applied (groups then say "not ready", D80).
--
-- D80 A group invite holds max_uses and expires_at. Each new scan of /join/<group> mints that
--     person's own invite (parent_code = the group), which owns its own hidden user exactly as in
--     D37, and takes one place, in one transaction: join_group_invite below. A group never has a
--     hidden user of its own.
-- D81 Revoking a group stops new scans; the people who joined through it keep their own links
--     until each is revoked one by one (which bans that person's hidden user, D45).
-- D82 Feedback carries a role word and the person's own yes to being quoted (default no).

-- ── Group invites ───────────────────────────────────────────────────────────
alter table public.invites
  add column if not exists max_uses int,
  add column if not exists expires_at timestamptz,
  add column if not exists parent_code text references public.invites (code) on delete set null;

do $$ begin
  alter table public.invites add constraint invites_group_shape check (
    max_uses is null
    or (max_uses between 1 and 200 and parent_code is null and used_by is null and role = 'teacher')
  );
exception when duplicate_object then null; end $$;

create index if not exists invites_parent_idx on public.invites (parent_code)
  where parent_code is not null;

-- One scan, one place, one new person's link. The group row is locked for the length of the
-- transaction, so scans arriving together queue here and the count never passes max_uses.
-- Returns 'ok', or why not: 'unknown' (not a group), 'closed' (revoked), 'expired', 'full'.
-- The new link copies the group's role, district, label, Sample flag and owner (D38: a Sample
-- group only ever brings in Sample teachers).
create or replace function public.join_group_invite(p_group text, p_child text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  g public.invites%rowtype;
begin
  select * into g from public.invites where code = p_group for update;
  if not found or g.max_uses is null or g.parent_code is not null then return 'unknown'; end if;
  if g.revoked_at is not null then return 'closed'; end if;
  if g.expires_at is not null and g.expires_at <= now() then return 'expired'; end if;
  if g.use_count >= g.max_uses then return 'full'; end if;

  update public.invites
    set use_count = use_count + 1, last_used_at = now()
    where code = p_group;
  insert into public.invites (code, role, district, label, is_sample, created_by, parent_code)
    values (p_child, g.role, g.district, g.label, g.is_sample, g.created_by, p_group);
  return 'ok';
end $$;
-- Server only (service role), like claim_job: no client may take a place or mint a link (D59).
revoke all on function public.join_group_invite(text, text) from public, anon, authenticated;

-- ── Feedback that may be quoted ─────────────────────────────────────────────
-- quote_ok: she ticked "you may quote my words" (default off). role_word: who said it, as a role
-- only, from the fixed list in lib/field/changes.ts; never a name (Law 6). The founder's
-- scripts/add-change.mjs reads a row only when quote_ok is true and is_sample is false.
alter table public.feedback
  add column if not exists quote_ok boolean not null default false,
  add column if not exists role_word text;

do $$ begin
  alter table public.feedback add constraint feedback_role_word_check check (
    role_word is null
    or role_word in ('teacher', 'master', 'headmaster', 'reviewer', 'officer', 'mentor')
  );
exception when duplicate_object then null; end $$;
