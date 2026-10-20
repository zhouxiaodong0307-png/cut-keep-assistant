-- V95: distinguish "cloud archive synced" from "iOS Scriptable actually read the feed".
-- No existing token/snapshot changed or revoked.
alter table public.fitness_widget_access
 add column if not exists last_read_at timestamptz;

create or replace function public.fitness_widget_read(p_token text)
returns table (widget_summary jsonb, widget_updated_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare payload jsonb; updated timestamptz; access_user uuid;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
  raise exception 'WIDGET_UNAUTHORIZED' using errcode='42501';
 end if;
 select a.user_id,s.widget_summary,s.widget_updated_at
 into access_user,payload,updated
 from public.fitness_widget_access a
 join public.fitness_sync_snapshots s on s.user_id=a.user_id
 where a.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
   and a.expires_at>now() and s.widget_summary is not null;
 if access_user is null then raise exception 'WIDGET_UNAUTHORIZED' using errcode='42501'; end if;
 update public.fitness_widget_access
 set last_read_at=now()
 where user_id=access_user;
 return query select payload,updated;
end $$;
revoke all on function public.fitness_widget_read(text) from public;
grant execute on function public.fitness_widget_read(text) to anon,authenticated;

create or replace function public.fitness_widget_status()
returns table (paired boolean, last_widget_read_at timestamptz,
 widget_summary_date text, widget_updated_at timestamptz)
language sql security definer set search_path=''
as $$
 select a.user_id is not null,
  a.last_read_at,
  s.widget_summary->>'date',
  s.widget_updated_at
 from public.fitness_sync_snapshots s
 left join public.fitness_widget_access a
  on a.user_id=s.user_id and a.expires_at>now()
 where s.user_id=(select auth.uid())
$$;
revoke all on function public.fitness_widget_status() from public,anon;
grant execute on function public.fitness_widget_status() to authenticated;
