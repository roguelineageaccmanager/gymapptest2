-- Run inside a savepoint; the deploy tool rolls every test row back.
select set_config('test.picture_owner', gen_random_uuid()::text, true);
select set_config('test.picture_friend', gen_random_uuid()::text, true);
select set_config('test.picture_stranger', gen_random_uuid()::text, true);
insert into auth.users(id,raw_user_meta_data)
select current_setting(key)::uuid, jsonb_build_object('age_confirmed','true','username','pic_' || substr(replace(current_setting(key),'-',''),1,12))
from unnest(array['test.picture_owner','test.picture_friend','test.picture_stranger']) as key;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.picture_owner'), true);
insert into public.profile_pictures(user_id,image_data) values (auth.uid(),'data:image/jpeg;base64,AAAA');
insert into public.friend_requests(requester_id,target_id,status) values (auth.uid(),current_setting('test.picture_friend')::uuid,'pending');
select set_config('request.jwt.claim.sub', current_setting('test.picture_stranger'), true);
do $$ declare n integer; begin
  if exists(select 1 from public.profile_pictures) then raise exception 'Stranger read another picture'; end if;
  update public.profile_pictures set image_data='data:image/jpeg;base64,BBBB';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Stranger changed another picture'; end if;
  begin
    insert into public.profile_pictures(user_id,image_data) values (current_setting('test.picture_owner')::uuid,'data:image/jpeg;base64,BBBB');
    raise exception 'Stranger inserted another picture';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.picture_friend'), true);
do $$ begin
  if exists(select 1 from public.profile_pictures) then raise exception 'Pending request read a picture'; end if;
end $$;
update public.friend_requests set status='accepted' where requester_id=current_setting('test.picture_owner')::uuid and target_id=auth.uid();
do $$ declare n integer; begin
  if (select count(*) from public.profile_pictures) <> 1 then raise exception 'Accepted friend cannot read picture'; end if;
  delete from public.profile_pictures;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Friend deleted another picture'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.picture_owner'), true);
insert into public.friend_blocks(blocker_id,blocked_id) values(auth.uid(),current_setting('test.picture_friend')::uuid);
select set_config('request.jwt.claim.sub', current_setting('test.picture_friend'), true);
do $$ begin
  if exists(select 1 from public.profile_pictures) then raise exception 'Blocked friend read a picture'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.picture_owner'), true);
delete from public.profile_pictures where user_id=auth.uid();
do $$ begin
  if exists(select 1 from public.profile_pictures) then raise exception 'Owner could not remove picture'; end if;
end $$;
reset role;
