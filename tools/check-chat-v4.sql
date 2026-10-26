select set_config('test.chat_a',gen_random_uuid()::text,true);
select set_config('test.chat_b',gen_random_uuid()::text,true);
select set_config('test.chat_c',gen_random_uuid()::text,true);
select set_config('test.chat_original',gen_random_uuid()::text,true);
select set_config('test.chat_reply',gen_random_uuid()::text,true);
insert into auth.users(id,raw_user_meta_data)
select current_setting(key)::uuid,jsonb_build_object('age_confirmed','true','username','c4_'||substr(replace(current_setting(key),'-',''),1,12))
from unnest(array['test.chat_a','test.chat_b','test.chat_c']) as key;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.chat_a'),true);
insert into public.profile_pictures(user_id,image_data) values(auth.uid(),'data:image/jpeg;base64,YQ==');
insert into public.profile_banners(user_id,color,avatar_color) values(auth.uid(),'#112233','#445566');
select public.send_chat_reply(current_setting('test.chat_original')::uuid,'Original',null);
select set_config('request.jwt.claim.sub',current_setting('test.chat_b'),true);
select public.send_chat_reply(current_setting('test.chat_reply')::uuid,'Reply',current_setting('test.chat_original')::uuid);
select public.send_chat_reply(current_setting('test.chat_reply')::uuid,'Changed',null);
do $$ declare n integer; begin
  if not exists(select 1 from public.community_chat_v4() where id=current_setting('test.chat_reply')::uuid and body='Reply' and reply_body='Original') then raise exception 'Reply/retry failed'; end if;
  if not exists(select 1 from public.community_members(array[current_setting('test.chat_a')::uuid]) where image_data='data:image/jpeg;base64,YQ==' and color='#112233') then raise exception 'Chat appearance missing'; end if;
  if exists(select 1 from public.profile_pictures where user_id=current_setting('test.chat_a')::uuid) then raise exception 'Direct private picture RLS changed'; end if;
  if exists(select 1 from public.community_members(array[current_setting('test.chat_c')::uuid])) then raise exception 'Nonparticipant exposed'; end if;
  if exists(select 1 from public.friend_summaries() where user_id=current_setting('test.chat_a')::uuid) then raise exception 'Chat exposed private stats'; end if;
  delete from public.community_messages where id=current_setting('test.chat_original')::uuid; get diagnostics n=row_count;
  if n<>0 then raise exception 'Other member deleted original'; end if;
  begin perform public.send_chat_reply(gen_random_uuid(),'Invalid reply',gen_random_uuid()); raise exception 'Invalid reply accepted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.chat_a'),true);
insert into public.friend_blocks(blocker_id,blocked_id) values(auth.uid(),current_setting('test.chat_b')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.chat_b'),true);
do $$ begin
  if exists(select 1 from public.community_members(array[current_setting('test.chat_a')::uuid])) then raise exception 'Blocked identity exposed'; end if;
  if exists(select 1 from public.community_chat_v4() where reply_body='Original') then raise exception 'Blocked quote exposed'; end if;
  begin perform public.send_chat_reply(gen_random_uuid(),'Blocked reply',current_setting('test.chat_original')::uuid); raise exception 'Blocked reply accepted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.chat_a'),true);
delete from public.community_messages where id=current_setting('test.chat_original')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.chat_b'),true);
do $$ begin
  if exists(select 1 from public.community_chat_v4() where id=current_setting('test.chat_reply')::uuid and reply_to is not null) then raise exception 'Deleted quote retained'; end if;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.community_chat_v4(timestamptz,uuid)','execute') or
     has_function_privilege('anon','public.community_members(uuid[])','execute') or
     has_function_privilege('anon','public.send_chat_reply(uuid,text,uuid)','execute') then raise exception 'Anonymous v4 access'; end if;
end $$;
