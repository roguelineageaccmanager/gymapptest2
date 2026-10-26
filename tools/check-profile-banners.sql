select set_config('test.banner_owner',gen_random_uuid()::text,true);
select set_config('test.banner_friend',gen_random_uuid()::text,true);
select set_config('test.banner_stranger',gen_random_uuid()::text,true);
insert into auth.users(id,raw_user_meta_data)
select current_setting(key)::uuid,jsonb_build_object('age_confirmed','true','username','bn_'||substr(replace(current_setting(key),'-',''),1,12))
from unnest(array['test.banner_owner','test.banner_friend','test.banner_stranger']) as key;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.banner_owner'),true);
insert into public.profile_banners(user_id,color,image_data) values(auth.uid(),'#112233','data:image/jpeg;base64,YQ==');
insert into public.friend_requests(requester_id,target_id,status) values(auth.uid(),current_setting('test.banner_friend')::uuid,'pending');
do $$ begin
  begin
    update public.profile_banners set image_data='https://invalid.example';
    raise exception 'External banner allowed';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.banner_friend'),true);
do $$ begin
  if exists(select 1 from public.profile_banners where user_id=current_setting('test.banner_owner')::uuid) then raise exception 'Pending friend read banner'; end if;
end $$;
update public.friend_requests set status='accepted' where requester_id=current_setting('test.banner_owner')::uuid and target_id=auth.uid();
do $$ declare n integer; begin
  if not exists(select 1 from public.profile_banners where user_id=current_setting('test.banner_owner')::uuid and color='#112233') then raise exception 'Friend cannot read banner'; end if;
  update public.profile_banners set color='#ffffff' where user_id=current_setting('test.banner_owner')::uuid; get diagnostics n=row_count;
  if n<>0 then raise exception 'Friend changed banner'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.banner_stranger'),true);
do $$ begin
  if exists(select 1 from public.profile_banners where user_id=current_setting('test.banner_owner')::uuid) then raise exception 'Stranger read banner'; end if;
  begin
    insert into public.profile_banners(user_id,color) values(current_setting('test.banner_owner')::uuid,'#ffffff');
    raise exception 'Forged owner allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.banner_owner'),true);
update public.profile_banners set color='#445566',image_data=null where user_id=auth.uid();
insert into public.friend_blocks(blocker_id,blocked_id) values(auth.uid(),current_setting('test.banner_friend')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.banner_friend'),true);
do $$ begin
  if exists(select 1 from public.profile_banners where user_id=current_setting('test.banner_owner')::uuid) then raise exception 'Blocked friend read banner'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.banner_owner'),true);
delete from public.profile_banners where user_id=auth.uid();
reset role;
do $$ begin
  if has_table_privilege('anon','public.profile_banners','select') then raise exception 'Anonymous banner grant'; end if;
end $$;
