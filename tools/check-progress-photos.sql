select set_config('test.photo_owner',gen_random_uuid()::text,true);
select set_config('test.photo_friend',gen_random_uuid()::text,true);
select set_config('test.photo_stranger',gen_random_uuid()::text,true);
select set_config('test.photo_id',gen_random_uuid()::text,true);
insert into auth.users(id,raw_user_meta_data)
select current_setting(key)::uuid,jsonb_build_object('age_confirmed','true','username','pp_'||substr(replace(current_setting(key),'-',''),1,12))
from unnest(array['test.photo_owner','test.photo_friend','test.photo_stranger']) as key;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.photo_owner'),true);
insert into public.progress_photos(id,user_id,image_data,photo_date,caption) values(current_setting('test.photo_id')::uuid,auth.uid(),'data:image/jpeg;base64,YQ==',current_date,'Progress');
insert into public.friend_requests(requester_id,target_id,status) values(auth.uid(),current_setting('test.photo_friend')::uuid,'pending');
do $$ begin
  begin insert into public.progress_photos(user_id,image_data,photo_date) values(auth.uid(),'https://invalid.example/photo.jpg',current_date); raise exception 'External URL accepted'; exception when check_violation then null; end;
  begin update public.progress_photos set caption='Changed'; raise exception 'Direct update granted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.photo_friend'),true);
do $$ begin if exists(select 1 from public.progress_photos) then raise exception 'Pending request read progress'; end if; end $$;
update public.friend_requests set status='accepted' where requester_id=current_setting('test.photo_owner')::uuid and target_id=auth.uid();
do $$ declare n integer; begin
  if not exists(select 1 from public.progress_photos where id=current_setting('test.photo_id')::uuid and caption='Progress') then raise exception 'Accepted friend missing photo'; end if;
  delete from public.progress_photos where id=current_setting('test.photo_id')::uuid; get diagnostics n=row_count; if n<>0 then raise exception 'Friend removed photo'; end if;
  begin insert into public.progress_photos(user_id,image_data,photo_date) values(current_setting('test.photo_owner')::uuid,'data:image/jpeg;base64,YQ==',current_date); raise exception 'Forged ownership accepted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.photo_stranger'),true);
do $$ begin if exists(select 1 from public.progress_photos) then raise exception 'Stranger read progress'; end if; end $$;
select set_config('request.jwt.claim.sub',current_setting('test.photo_owner'),true);
insert into public.friend_blocks(blocker_id,blocked_id) values(auth.uid(),current_setting('test.photo_friend')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.photo_friend'),true);
do $$ begin if exists(select 1 from public.progress_photos) then raise exception 'Blocked friend read progress'; end if; end $$;
select set_config('request.jwt.claim.sub',current_setting('test.photo_owner'),true);
do $$ declare i integer; begin
  for i in 1..199 loop insert into public.progress_photos(user_id,image_data,photo_date) values(auth.uid(),'data:image/jpeg;base64,YQ==',current_date); end loop;
  begin insert into public.progress_photos(user_id,image_data,photo_date) values(auth.uid(),'data:image/jpeg;base64,YQ==',current_date); raise exception 'Photo quota bypassed'; exception when check_violation then null; end;
end $$;
delete from public.progress_photos where user_id=auth.uid();
reset role;
do $$ begin if has_table_privilege('anon','public.progress_photos','select') or has_table_privilege('anon','public.progress_photos','insert') then raise exception 'Anonymous photo grants'; end if; end $$;
