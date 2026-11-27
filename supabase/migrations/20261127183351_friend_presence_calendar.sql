-- Enrollment happens on the first heartbeat from an existing account.
-- Keep subsequent opt-outs as disabled rows so a heartbeat can't undo them.
alter table private.member_activity add column enabled boolean not null default true,
  add column heartbeat_seconds smallint not null default 90;

create or replace function public.set_activity_sharing(enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into private.member_activity(user_id, enabled)
    values(auth.uid(), $1)
    on conflict (user_id) do update set enabled=excluded.enabled, workout=null
    where member_activity.enabled is distinct from excluded.enabled;
end $$;

create function public.touch_activity(workout_name text, fast boolean)
returns void language sql security definer set search_path='' as $$
  insert into private.member_activity(user_id, seen_at, workout, heartbeat_seconds)
    select auth.uid(), now(), nullif(left(workout_name,100),''), case when fast then 18 else 90 end
    where auth.uid() is not null
  on conflict (user_id) do update set seen_at=excluded.seen_at, workout=excluded.workout,
    heartbeat_seconds=excluded.heartbeat_seconds
    where member_activity.enabled;
$$;
revoke all on function public.touch_activity(text,boolean) from public,anon;
grant execute on function public.touch_activity(text,boolean) to authenticated;

create or replace function public.touch_activity(workout_name text)
returns void language sql security invoker set search_path='' as $$
  select public.touch_activity(workout_name, false);
$$;

drop function public.friend_activity();
create function public.friend_activity()
returns table(user_id uuid, seen_at timestamptz, workout text, heartbeat_seconds smallint)
language sql stable security definer set search_path='' as $$
  with allowed(id) as (
    select auth.uid()
    union
    select target_id from public.friend_requests where requester_id=auth.uid() and status='accepted'
    union
    select requester_id from public.friend_requests where target_id=auth.uid() and status='accepted'
  )
  select a.user_id, a.seen_at,
         case when a.seen_at + make_interval(secs => a.heartbeat_seconds) > now() then a.workout end,
         a.heartbeat_seconds
  from allowed join private.member_activity a on a.user_id=allowed.id
  where a.enabled;
$$;
revoke all on function public.friend_activity() from public,anon;
grant execute on function public.friend_activity() to authenticated;

-- Only share dates with saved workouts and their counts. Calendar requests
-- inspect at most 31 keys in the requested user's log and return no set data.
create function public.member_calendar(member uuid, month_start date)
returns table(workout_date date, workouts integer)
language sql stable security definer set search_path='' as $$
  select day, jsonb_array_length(entries)
  from public.workout_data d
  cross join lateral (
    select month_start + offset_day as day,
           case when jsonb_typeof(d.logs->((month_start + offset_day)::text))='array'
             then d.logs->((month_start + offset_day)::text) else '[]'::jsonb end as entries
    from generate_series(0, 30) as offset_day
  ) dates
  where d.user_id=member and (auth.uid()=member or private.is_friend(member))
    and extract(day from month_start)=1
    and day < month_start + interval '1 month'
    and jsonb_array_length(entries)>0
  order by day;
$$;
revoke all on function public.member_calendar(uuid,date) from public,anon;
grant execute on function public.member_calendar(uuid,date) to authenticated;
notify pgrst,'reload schema';
