create or replace function public.member_workout_split(member uuid)
returns table(workout_name text, weekdays int[], exercises jsonb)
language sql stable security definer set search_path='' as $$
 select routine.key, array(
   select i from generate_series(0,6) i where
   case when jsonb_typeof(p.plan->'schedule')='array' then p.plan->'schedule'->>i
   else p.plan->'schedule'->>(i::text) end = routine.key order by i
 ), coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'name', coalesce(ex->>'name',case when jsonb_typeof(ex)='string' then ex#>>'{}' end),
   'sets', ex->>'sets', 'target', ex->>'target', 'unilateral', ex->'unilateral',
   'cat', ex->'cat', 'sides', ex->'sides', 'rest', ex->'rest', 'attachment', ex->'attachment',
   'grip', ex->'grip', 'warmupSets', ex->'warmupSets')) order by ord)
   from jsonb_array_elements(case when jsonb_typeof(routine.value)='array' then routine.value else '[]'::jsonb end)
   with ordinality items(ex,ord)), '[]'::jsonb)
 from public.workout_plans p
 cross join lateral jsonb_each(case when jsonb_typeof(p.plan->'workouts')='object' then p.plan->'workouts' else '{}'::jsonb end) routine
 where p.user_id=member and (auth.uid()=member or private.is_friend(member))
 order by 2,1;
$$;
