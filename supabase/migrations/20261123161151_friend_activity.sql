create table private.member_activity (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  workout text
);
alter table private.member_activity enable row level security;
revoke all on private.member_activity from public, anon, authenticated;

create function public.set_activity_sharing(enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if enabled then
    insert into private.member_activity(user_id) values(auth.uid()) on conflict do nothing;
  else
    delete from private.member_activity where user_id=auth.uid();
  end if;
end $$;

create function public.touch_activity(workout_name text)
returns void language sql security definer set search_path='' as $$
  update private.member_activity set seen_at=now(), workout=nullif(left(workout_name,100),'')
  where user_id=auth.uid();
$$;

create function public.friend_activity()
returns table(user_id uuid, seen_at timestamptz, workout text)
language sql stable security definer set search_path='' as $$
  select a.user_id,a.seen_at,case when a.seen_at > now()-interval '90 seconds' then a.workout end
  from private.member_activity a where a.user_id=auth.uid() or private.is_friend(a.user_id);
$$;

create function public.member_workout_history(member uuid)
returns table(workout_date text, workout_name text, lifts jsonb)
language sql stable security definer set search_path='' as $$
  select day.key,session->>'day',coalesce((
    select jsonb_agg(jsonb_build_object('name',exercise->>'name','sets',(
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('w',item->>'w','r',item->>'r','side',item->>'side')) order by n)
      from jsonb_array_elements(case when jsonb_typeof(exercise->'sets')='array' then exercise->'sets' else '[]'::jsonb end) with ordinality as sets(item,n)
    )) order by i)
    from jsonb_array_elements(case when jsonb_typeof(session->'exercises')='array' then session->'exercises' else '[]'::jsonb end) with ordinality as exercises(exercise,i)
  ),'[]'::jsonb)
  from private.member_activity a join public.workout_data d using(user_id)
  cross join lateral jsonb_each(case when jsonb_typeof(d.logs)='object' then d.logs else '{}'::jsonb end) day
  cross join lateral jsonb_array_elements(case when jsonb_typeof(day.value)='array' then day.value else '[]'::jsonb end) with ordinality as sessions(session,idx)
  where a.user_id=member and (member=auth.uid() or private.is_friend(member))
    and session->>'day' is not null
  order by day.key desc, idx desc limit 20;
$$;

revoke all on function public.set_activity_sharing(boolean),public.touch_activity(text),public.friend_activity(),public.member_workout_history(uuid) from public,anon;
grant execute on function public.set_activity_sharing(boolean),public.touch_activity(text),public.friend_activity(),public.member_workout_history(uuid) to authenticated;
