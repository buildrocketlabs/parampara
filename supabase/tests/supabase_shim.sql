-- Minimal stand-ins for the Supabase schemas the migration expects (auth, storage, API roles).
-- For throwaway local Postgres only; never run against the hosted project.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$; do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$; do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
-- As on Supabase: RLS is on for storage.objects and the API roles hold table privileges, so only
-- policies decide. Our migrations add none, so nothing is reachable without a signed URL.
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid);
alter table storage.objects enable row level security; alter table storage.buckets enable row level security;
grant usage on schema storage to anon, authenticated; grant select, insert, update, delete on storage.objects, storage.buckets to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
-- As on Supabase: new functions in public are executable by the API roles unless a migration revokes it.
alter default privileges in schema public grant execute on functions to anon, authenticated;
