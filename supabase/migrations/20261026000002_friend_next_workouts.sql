-- Return one small next-workout summary per accepted friend, never full plans.
create or replace function public.friend_next_workouts(from_day date default current_date)
returns table(user_id uuid,username text,workout_name text,workout_date date)
language sql stable security definer set search_path='' as $$
  select p.id,p.username,next.workout,next.day
  from public.profiles p
  join public.workout_plans wp on wp.user_id=p.id
  left join public.workout_data wd on wd.user_id=p.id
  cross join lateral (
    select candidate.day,candidate.workout from (
      select from_day + i as day,
        case when jsonb_typeof(wp.plan->'schedule')='array'
          then wp.plan->'schedule'->>(extract(isodow from from_day+i)::integer-1)
          else wp.plan->'schedule'->>((extract(isodow from from_day+i)::integer-1)::text) end as workout
      from generate_series(0,7) as i
    ) candidate
    where candidate.workout is not null and jsonb_typeof(wp.plan->'workouts'->candidate.workout)='array'
      and jsonb_array_length(case when jsonb_typeof(wp.plan->'workouts'->candidate.workout)='array' then wp.plan->'workouts'->candidate.workout else '[]'::jsonb end)>0
      and not coalesce(wd.bypass_days->(candidate.day::text)='true'::jsonb,false)
      and not exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(wd.logs->candidate.day::text)='array' then wd.logs->candidate.day::text else '[]'::jsonb end) logged
        where logged->>'day'=candidate.workout
      )
    order by candidate.day limit 1
  ) next
  where auth.uid() is not null and p.id<>auth.uid() and private.is_friend(p.id)
    and from_day between current_date-1 and current_date+1;
$$;
revoke all on function public.friend_next_workouts(date) from public,anon;
grant execute on function public.friend_next_workouts(date) to authenticated;
notify pgrst,'reload schema';
