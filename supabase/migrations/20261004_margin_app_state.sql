-- Margin keeps its JSON store behind the Express API for this small hosted demo.
-- The Data API role can reach the state row only when the Vercel backend supplies
-- a private bridge token. The token itself is never stored in Postgres.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
grant usage on schema private to anon, authenticator;

create table if not exists private.margin_store_api_keys (
  key_hash bytea primary key,
  label text not null,
  created_at timestamptz not null default now()
);

revoke all on schema private from public, anon, authenticated;
revoke all on private.margin_store_api_keys from public, anon, authenticated;
grant select on private.margin_store_api_keys to postgres;
alter table private.margin_store_api_keys enable row level security;

-- SHA-256 of the randomly generated Vercel-only bridge key.
insert into private.margin_store_api_keys (key_hash, label)
values (decode('74bdc1203f23e04dde05b69361feb50b0ead1cf5e2e6ff74042f2a4526b9e08c', 'hex'), 'vercel-margin-backend')
on conflict (key_hash) do nothing;

create table if not exists public.margin_app_state (
  id text primary key check (id = 'main'),
  state jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

alter table public.margin_app_state enable row level security;
revoke all on public.margin_app_state from public, authenticated;
grant select, insert, update on public.margin_app_state to anon;

drop policy if exists "Vercel backend reads Margin state" on public.margin_app_state;
drop policy if exists "Vercel backend inserts Margin state" on public.margin_app_state;
drop policy if exists "Vercel backend updates Margin state" on public.margin_app_state;

create policy "Vercel backend reads Margin state"
  on public.margin_app_state for select to anon using (true);
create policy "Vercel backend inserts Margin state"
  on public.margin_app_state for insert to anon with check (true);
create policy "Vercel backend updates Margin state"
  on public.margin_app_state for update to anon using (true) with check (true);

create or replace function private.check_margin_store_api_key()
returns void
language plpgsql
security definer
set search_path = pg_catalog, private, extensions
as $$
declare
  request_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('request.jwt.claims', true)::json->>'role'
  );
  supplied_key text := current_setting('request.headers', true)::json->>'x-margin-store-api-key';
begin
  if request_role is distinct from 'anon' then
    return;
  end if;

  if supplied_key is null or not exists (
    select 1
    from private.margin_store_api_keys
    where key_hash = extensions.digest(supplied_key, 'sha256')
  ) then
    raise sqlstate 'PGRST'
      using message = '{"code":"margin_storage_unauthorized","message":"Unauthorized Margin storage request"}',
            detail = '{"status":403,"headers":{}}';
  end if;
end;
$$;

revoke all on function private.check_margin_store_api_key() from public, anon, authenticated;
grant execute on function private.check_margin_store_api_key() to authenticator, anon;

alter role authenticator set pgrst.db_pre_request = 'private.check_margin_store_api_key';
notify pgrst, 'reload config';
