select set_config('test.theme_owner',gen_random_uuid()::text,true);
select set_config('test.theme_friend',gen_random_uuid()::text,true);
select set_config('test.theme_stranger',gen_random_uuid()::text,true);
insert into auth.users(id,raw_user_meta_data)
select current_setting(key)::uuid,jsonb_build_object('age_confirmed','true','username','th_'||substr(replace(current_setting(key),'-',''),1,12))
from unnest(array['test.theme_owner','test.theme_friend','test.theme_stranger']) as key;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.theme_owner'),true);
insert into public.friend_requests(requester_id,target_id,status) values(auth.uid(),current_setting('test.theme_friend')::uuid,'pending');
do $$ begin
  begin
    insert into public.shared_themes(owner_id,recipient_id,name,appearance) values(auth.uid(),current_setting('test.theme_friend')::uuid,'Test','{"theme":{"base":"dark","preset":"custom","color":"#aabbcc"}}');
    raise exception 'Pending friend accepted theme';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.theme_friend'),true);
update public.friend_requests set status='accepted' where requester_id=current_setting('test.theme_owner')::uuid and target_id=auth.uid();
select set_config('request.jwt.claim.sub',current_setting('test.theme_owner'),true);
insert into public.shared_themes(owner_id,recipient_id,name,appearance) values(auth.uid(),current_setting('test.theme_friend')::uuid,'Test','{"theme":{"base":"dark","preset":"custom","color":"#aabbcc"},"buttonColor":"#000000"}');
do $$ begin
  begin
    insert into public.shared_themes(owner_id,recipient_id,name,appearance) values(auth.uid(),current_setting('test.theme_friend')::uuid,'Unsafe','{"theme":{"base":"dark","preset":"custom","color":"#aabbcc"},"url":"https://invalid.example"}');
    raise exception 'Invalid theme allowed';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.theme_stranger'),true);
do $$ declare n integer; begin
  if exists(select 1 from public.shared_themes) then raise exception 'Stranger read theme'; end if;
  delete from public.shared_themes; get diagnostics n=row_count;
  if n<>0 then raise exception 'Stranger deleted theme'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.theme_friend'),true);
do $$ begin
  if (select count(*) from public.shared_themes)<>1 then raise exception 'Recipient cannot read theme'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.theme_owner'),true);
insert into public.friend_blocks(blocker_id,blocked_id) values(auth.uid(),current_setting('test.theme_friend')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.theme_friend'),true);
do $$ begin
  if exists(select 1 from public.shared_themes) then raise exception 'Removed friend read theme'; end if;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.shared_themes','SELECT') or has_table_privilege('anon','public.workout_data','INSERT') then raise exception 'Anonymous table grant remained'; end if;
end $$;
