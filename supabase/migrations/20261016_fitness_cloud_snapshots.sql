-- 健身助手专用 Supabase 项目：仅在新建独立项目后执行此迁移。
-- RLS + revision compare-and-swap, automatic server-side atomic conflict detection.
create table if not exists public.fitness_sync_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint fitness_sync_snapshot_object check (jsonb_typeof(snapshot) = 'object'),
  constraint fitness_sync_snapshot_limit check (pg_column_size(snapshot) <= 10485760)
);
alter table public.fitness_sync_snapshots enable row level security;
revoke all on public.fitness_sync_snapshots from anon;
grant select on public.fitness_sync_snapshots to authenticated;
-- All writes must go through the CAS function, never direct REST UPDATE/INSERT.
revoke insert,update,delete on public.fitness_sync_snapshots from authenticated;
drop policy if exists fitness_sync_select_own on public.fitness_sync_snapshots;
create policy fitness_sync_select_own on public.fitness_sync_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);

-- The function is SECURITY DEFINER so that direct client writes remain blocked.
-- User identity is ALWAYS taken from auth.uid(), never from an API parameter.
create or replace function public.fitness_sync_save(p_snapshot jsonb, p_expected bigint)
returns table (new_revision bigint, saved_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_rev bigint;
  last_at timestamptz;
  item record;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' or pg_column_size(p_snapshot) > 10485760
    then raise exception 'INVALID_SNAPSHOT' using errcode = '22023'; end if;
  if (select count(*) from jsonb_object_keys(p_snapshot)) > 2000
    then raise exception 'TOO_MANY_KEYS' using errcode = '22023'; end if;
  for item in select key, value from jsonb_each(p_snapshot) loop
    if item.key !~ '^ck[A-Za-z0-9_-]{0,120}$' or
       item.key in ('ckAppBuild','ckWeeklyReportLogicVersion') or
       item.key like 'ckUpgradeBackup-%' or
       jsonb_typeof(item.value) <> 'string' then
      raise exception 'INVALID_RECORD' using errcode = '22023';
    end if;
  end loop;

  if p_expected = 0 then
    insert into public.fitness_sync_snapshots(user_id,snapshot,revision)
      values (uid,p_snapshot,1)
      on conflict (user_id) do nothing
      returning revision,updated_at into new_rev,last_at;
    if new_rev is null then raise exception 'SYNC_CONFLICT' using errcode = 'P0001'; end if;
  elsif p_expected > 0 then
    update public.fitness_sync_snapshots
      set snapshot=p_snapshot,revision=revision+1,updated_at=now()
      where user_id=uid and revision=p_expected
      returning revision,updated_at into new_rev,last_at;
    if new_rev is null then raise exception 'SYNC_CONFLICT' using errcode = 'P0001'; end if;
  else
    raise exception 'INVALID_REVISION' using errcode = '22023';
  end if;
  return query select new_rev,last_at;
end;
$$;
revoke all on function public.fitness_sync_save(jsonb,bigint) from public,anon;
grant execute on function public.fitness_sync_save(jsonb,bigint) to authenticated;
comment on table public.fitness_sync_snapshots is 'Private per-user fitness backup. One owner only. External identity via Supabase Auth JWT and read RLS.';
