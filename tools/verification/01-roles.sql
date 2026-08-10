-- Rôles attendus par PostgREST, tels que configurés par Supabase.
do $$ begin create role authenticator noinherit login password 'pg'; exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to authenticator;

-- auth.uid() : PostgREST expose les claims du JWT ; on reproduit le comportement Supabase.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

-- Comptes de test correspondant au harnais.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'producteur@exemple.com'),
  ('22222222-2222-2222-2222-222222222222', 'autre@exemple.com')
on conflict (id) do nothing;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
