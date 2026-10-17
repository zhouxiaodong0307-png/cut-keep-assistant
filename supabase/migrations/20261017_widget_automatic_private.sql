-- V94 | Fitness-only widget summary, scoped random read token, atomic cloud update.
-- Dedicated project: ampixosqbgqbsckmrhog. Never exposes a user's full ck* archive to a widget.
alter table public.fitness_sync_snapshots
  add column if not exists widget_summary jsonb,
  add column if not exists widget_updated_at timestamptz;
-- No direct anonymous access to the private archive. Existing RLS stays unchanged.
revoke all on public.fitness_sync_snapshots from anon,public;
revoke insert,update,delete on public.fitness_sync_snapshots from authenticated;
grant select on public.fitness_sync_snapshots to authenticated;

create table if not exists public.fitness_widget_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.fitness_widget_access enable row level security;
revoke all on public.fitness_widget_access from public,anon,authenticated;

-- Replace *new* three-argument CAS function only. Old two-argument clients
-- still work during migration; they cannot access or invalidate the widget token.
create or replace function public.fitness_sync_save(
 p_snapshot jsonb, p_expected bigint, p_widget_summary jsonb)
returns table (new_revision bigint, saved_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare uid uuid := (select auth.uid()); new_rev bigint; last_at timestamptz; item record;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or pg_column_size(p_snapshot)>10485760
 then raise exception 'INVALID_SNAPSHOT' using errcode='22023'; end if;
 if (select count(*) from jsonb_object_keys(p_snapshot))>2000 then
  raise exception 'TOO_MANY_KEYS' using errcode='22023'; end if;
 for item in select key,value from jsonb_each(p_snapshot) loop
  if item.key !~ '^ck[A-Za-z0-9_-]{0,120}$' or
   item.key in ('ckAppBuild','ckWeeklyReportLogicVersion') or
   item.key like 'ckUpgradeBackup-%' or
   jsonb_typeof(item.value)<>'string'
  then raise exception 'INVALID_RECORD' using errcode='22023'; end if;
 end loop;
 if p_widget_summary is null or jsonb_typeof(p_widget_summary)<>'object' or
  p_widget_summary->>'app'<>'cut-keep-widget' or p_widget_summary->>'version'<>'1' or
  jsonb_typeof(p_widget_summary->'weight')<>'object' or
  jsonb_typeof(p_widget_summary->'training')<>'object' or
  jsonb_typeof(p_widget_summary->'nutrition')<>'object' or
  pg_column_size(p_widget_summary)>4096
 then raise exception 'INVALID_WIDGET_SUMMARY' using errcode='22023'; end if;
 if p_expected=0 then
  insert into public.fitness_sync_snapshots(user_id,snapshot,revision,widget_summary,widget_updated_at)
  values(uid,p_snapshot,1,p_widget_summary,now())
  on conflict(user_id) do nothing
  returning revision,updated_at into new_rev,last_at;
  if new_rev is null then raise exception 'SYNC_CONFLICT' using errcode='P0001'; end if;
 elsif p_expected>0 then
  update public.fitness_sync_snapshots
  set snapshot=p_snapshot,revision=revision+1,updated_at=now(),
      widget_summary=p_widget_summary,widget_updated_at=now()
  where user_id=uid and revision=p_expected
  returning revision,updated_at into new_rev,last_at;
  if new_rev is null then raise exception 'SYNC_CONFLICT' using errcode='P0001'; end if;
 else raise exception 'INVALID_REVISION' using errcode='22023'; end if;
 return query select new_rev,last_at;
end $$;
revoke all on function public.fitness_sync_save(jsonb,bigint,jsonb) from public,anon;
grant execute on function public.fitness_sync_save(jsonb,bigint,jsonb) to authenticated;

-- When app is reopened on a new calendar day but ck* history hasn't changed,
-- refresh only the public-safe widget summary, without changing ck* revision.
create or replace function public.fitness_widget_touch(
 p_widget_summary jsonb, p_expected bigint)
returns boolean language plpgsql security definer set search_path=''
as $$
declare uid uuid := (select auth.uid()); rows_changed bigint;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_widget_summary is null or jsonb_typeof(p_widget_summary)<>'object' or
  p_widget_summary->>'app'<>'cut-keep-widget' or p_widget_summary->>'version'<>'1' or
  jsonb_typeof(p_widget_summary->'weight')<>'object' or
  jsonb_typeof(p_widget_summary->'training')<>'object' or
  jsonb_typeof(p_widget_summary->'nutrition')<>'object' or
  pg_column_size(p_widget_summary)>4096
 then raise exception 'INVALID_WIDGET_SUMMARY' using errcode='22023'; end if;
 update public.fitness_sync_snapshots
 set widget_summary=p_widget_summary,widget_updated_at=now()
 where user_id=uid and revision=p_expected;
 get diagnostics rows_changed=row_count;
 if rows_changed<>1 then raise exception 'SYNC_CONFLICT' using errcode='P0001'; end if;
 return true;
end $$;
revoke all on function public.fitness_widget_touch(jsonb,bigint) from public,anon;
grant execute on function public.fitness_widget_touch(jsonb,bigint) to authenticated;

-- Generate a 256-bit random token on the SERVER. Store only its SHA-256 hash,
-- never the clear token. Re-pairing revokes the previous widget credential.
create or replace function public.fitness_widget_pair()
returns text language plpgsql security definer set search_path=''
as $$
declare uid uuid := (select auth.uid()); secret_token text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.fitness_sync_snapshots s where s.user_id=uid)
 then raise exception 'CLOUD_NOT_PAIRED' using errcode='P0001'; end if;
 secret_token := encode(extensions.gen_random_bytes(32),'hex');
 insert into public.fitness_widget_access(user_id,token_hash,expires_at,updated_at)
 values(uid,encode(extensions.digest(secret_token,'sha256'),'hex'),now()+interval '365 days',now())
 on conflict(user_id) do update set token_hash=excluded.token_hash,
  expires_at=excluded.expires_at,updated_at=now();
 return secret_token;
end $$;
revoke all on function public.fitness_widget_pair() from public,anon;
grant execute on function public.fitness_widget_pair() to authenticated;

create or replace function public.fitness_widget_revoke()
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 delete from public.fitness_widget_access where user_id=(select auth.uid());
 return true;
end $$;
revoke all on function public.fitness_widget_revoke() from public,anon;
grant execute on function public.fitness_widget_revoke() to authenticated;

-- Read-only capability: anonymous clients must present the full random token;
-- only three display fields and timestamps are returned, never full ck* records.
create or replace function public.fitness_widget_read(p_token text)
returns table (widget_summary jsonb, widget_updated_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
  raise exception 'WIDGET_UNAUTHORIZED' using errcode='42501'; end if;
 return query
 select s.widget_summary,s.widget_updated_at
 from public.fitness_widget_access a
 join public.fitness_sync_snapshots s on s.user_id=a.user_id
 where a.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
   and a.expires_at>now()
   and s.widget_summary is not null;
 if not found then raise exception 'WIDGET_UNAUTHORIZED' using errcode='42501'; end if;
end $$;
revoke all on function public.fitness_widget_read(text) from public;
grant execute on function public.fitness_widget_read(text) to anon,authenticated;
