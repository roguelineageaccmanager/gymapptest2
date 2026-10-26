select set_config('test.next_owner',gen_random_uuid()::text,true);
select set_config('test.next_friend',gen_random_uuid()::text,true);
select set_config('test.next_stranger',gen_random_uuid()::text,true);
insert into auth.users(id,raw_user_meta_data)
select current_setting(key)::uuid,jsonb_build_object('age_confirmed','true','username','nx_'||substr(replace(current_setting(key),'-',''),1,12))
from unnest(array['test.next_owner','test.next_friend','test.next_stranger']) as key;
insert into public.workout_plans(user_id,plan) values(current_setting('test.next_friend')::uuid,jsonb_build_object('workouts',jsonb_build_object('Test next',jsonb_build_array(jsonb_build_object('name','Private exercise'))),'schedule',jsonb_build_object((extract(isodow from current_date)::integer-1)::text,'Test next')));
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.next_owner'),true);
do $$ begin if exists(select 1 from public.friend_next_workouts()) then raise exception 'Stranger read next workout'; end if; end $$;
insert into public.friend_requests(requester_id,target_id,status) values(auth.uid(),current_setting('test.next_friend')::uuid,'pending');
select set_config('request.jwt.claim.sub',current_setting('test.next_friend'),true);
update public.friend_requests set status='accepted' where requester_id=current_setting('test.next_owner')::uuid and target_id=auth.uid();
select set_config('request.jwt.claim.sub',current_setting('test.next_owner'),true);
do $$ begin
  if (select count(*) from public.friend_next_workouts() where workout_name='Test next' and workout_date=current_date)<>1 then raise exception 'Accepted friend next workout missing'; end if;
  if exists(select 1 from public.workout_plans) then raise exception 'Full friend plan leaked'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.next_friend'),true);
insert into public.workout_data(user_id,logs) values(auth.uid(),jsonb_build_object(current_date::text,jsonb_build_array(jsonb_build_object('day','Test next'))));
select set_config('request.jwt.claim.sub',current_setting('test.next_owner'),true);
do $$ begin
  if exists(select 1 from public.friend_next_workouts() where workout_date=current_date) then raise exception 'Completed workout was still next'; end if;
  if exists(select 1 from public.friend_next_workouts(current_date+30)) then raise exception 'Unbounded date query allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.next_stranger'),true);
do $$ begin if exists(select 1 from public.friend_next_workouts()) then raise exception 'Unrelated account read next workout'; end if; end $$;
reset role;
