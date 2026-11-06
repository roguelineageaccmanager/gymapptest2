do $$
declare t record;
begin
  select * into t from private.workout_totals('{"2026-01-01":[{"day":"Test","duration":120,"exercises":[{"name":"Bench","target":"8 reps","sets":[{"w":"50","r":"6","done":true}]},{"name":"Dead Hang","target":"30 s","sets":[{"w":"20","r":"30","done":true}]},{"name":"Custom hold","target":"10–20 SECONDS","sets":[{"w":"100","r":"20","done":true}]}]}]}'::jsonb);
  if t.workouts<>1 or t.seconds<>120 or t.volume<>300 then raise exception 'Timed volume exclusion failed'; end if;
  select * into t from private.workout_totals('{"2026-01-01":[{"day":"Legacy","exercises":[{"name":"Dead Hang","target":"8–12","sets":[{"w":"20","r":"3","done":true}]}]}]}'::jsonb);
  if t.volume<>60 then raise exception 'Legacy rep units changed'; end if;
end $$;
