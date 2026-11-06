-- Timed sets retain numeric values in r and an explicit seconds unit in the
-- existing target field. They contribute no kg × reps, including for old clients.
-- No stored workout, plan or preference is rewritten.
create or replace function private.workout_totals(logs jsonb)
returns table (workouts integer, seconds bigint, volume bigint)
language sql
immutable
set search_path = ''
as $$
  with sessions as (
    select s.value as s
    from jsonb_each(case when jsonb_typeof(logs) = 'object' then logs else '{}'::jsonb end) d
    cross join lateral jsonb_array_elements(case when jsonb_typeof(d.value) = 'array' then d.value else '[]'::jsonb end) s
    where jsonb_typeof(s.value) = 'object'
  ), sets as (
    select x.value as x
    from sessions
    cross join lateral jsonb_array_elements(case when jsonb_typeof(sessions.s -> 'exercises') = 'array' then sessions.s -> 'exercises' else '[]'::jsonb end) e
    cross join lateral jsonb_array_elements(case when jsonb_typeof(e.value -> 'sets') = 'array' then e.value -> 'sets' else '[]'::jsonb end) x
    where jsonb_typeof(x.value) = 'object'
      and not (coalesce(e.value->>'target','') ~* '(^|[0-9[:space:]])(s|sec|secs|seconds?)$')
  )
  select
    (select count(*) from sessions)::integer,
    (select coalesce(sum(case when (s ->> 'duration') ~ '^\d{1,7}(\.\d+)?$' then (s ->> 'duration')::numeric else 0 end), 0) from sessions)::bigint,
    (select coalesce(sum(
      (case when (x ->> 'w') ~ '^\d{1,4}(\.\d+)?$' then (x ->> 'w')::numeric else 0 end) *
      (case when (x ->> 'r') ~ '^\d{1,4}(\.\d+)?$' then (x ->> 'r')::numeric else 0 end)), 0) from sets)::bigint;
$$;
revoke all on function private.workout_totals(jsonb) from public, anon, authenticated;
