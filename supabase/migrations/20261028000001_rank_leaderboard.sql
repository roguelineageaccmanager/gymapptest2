-- Additive rank sharing; retain legacy volume storage for older app clients.
alter table public.leaderboard_stats add column rank_score integer check (rank_score between 0 and 999);
drop function if exists public.friend_summaries();
create function public.friend_summaries()
returns table (
  user_id uuid, username text, workouts_count integer, volume_kg_reps bigint,
  total_seconds bigint, current_streak integer, best_streak integer, exercise_bests jsonb,
  weight_kg numeric, weight_date date, routines integer, exercises integer, rank_score integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select auth.uid() as id
    union
    select case when f.requester_id = auth.uid() then f.target_id else f.requester_id end
    from public.friend_requests f
    where f.status = 'accepted' and (f.requester_id = auth.uid() or f.target_id = auth.uid())
  )
  select p.id, p.username,
         case when s.user_id is not null then coalesce(t.workouts, s.workouts_count) end,
         case when s.user_id is not null then coalesce(t.volume, s.volume_kg_reps) end,
         case when s.user_id is not null then coalesce(t.seconds, s.total_seconds) end,
         s.current_streak,
         s.best_streak,
         case when s.user_id is not null then coalesce(s.exercise_bests, '{}'::jsonb) else '{}'::jsonb end,
         case when p.share_weight or p.id = auth.uid() then w.weight_kg end,
         case when p.share_weight or p.id = auth.uid() then w.log_date end,
         case when s.user_id is not null or p.id = auth.uid() then
           coalesce((select count(*) from jsonb_object_keys(case when jsonb_typeof(wp.plan -> 'workouts') = 'object' then wp.plan -> 'workouts' else '{}'::jsonb end)), 0)::integer end,
         case when s.user_id is not null or p.id = auth.uid() then
           coalesce((select sum(jsonb_array_length(v)) from jsonb_each(case when jsonb_typeof(wp.plan -> 'workouts') = 'object' then wp.plan -> 'workouts' else '{}'::jsonb end) as e(k, v)
                     where jsonb_typeof(v) = 'array'), 0)::integer end,
         s.rank_score
  from people x
  join public.profiles p on p.id = x.id
  left join public.leaderboard_stats s on s.user_id = p.id
  left join public.workout_plans wp on wp.user_id = p.id
  left join public.workout_data wd on wd.user_id = p.id and s.user_id is not null
  left join lateral private.workout_totals(wd.logs) t on wd.user_id is not null
  left join lateral (
    select b.weight_kg, b.log_date from public.body_weight_logs b
    where b.user_id = p.id order by b.log_date desc limit 1
  ) w on true
  where auth.uid() is not null;
$$;
revoke all on function public.friend_summaries() from public, anon;
grant execute on function public.friend_summaries() to authenticated;

notify pgrst, 'reload schema';
