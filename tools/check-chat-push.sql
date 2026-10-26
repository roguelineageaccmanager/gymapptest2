select set_config('test.push_owner',gen_random_uuid()::text,true);
select set_config('test.push_other',gen_random_uuid()::text,true);
select set_config('test.push_device',gen_random_uuid()::text,true);
insert into auth.users(id,raw_user_meta_data)
select current_setting(key)::uuid,jsonb_build_object('age_confirmed','true','username','push_'||substr(replace(current_setting(key),'-',''),1,12))
from unnest(array['test.push_owner','test.push_other']) as key;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.push_owner'),true);
select public.register_chat_push(current_setting('test.push_device')::uuid,'synthetic-fcm-deployment-check',repeat('a',64));
insert into public.chat_push_settings(user_id,enabled,enabled_at) values(auth.uid(),true,'2000-01-01');
do $$ begin
  if not exists(select 1 from public.chat_push_devices where id=current_setting('test.push_device')::uuid) then raise exception 'Owner missing own token'; end if;
  if exists(select 1 from public.chat_push_settings where enabled_at<'2026-01-01') then raise exception 'Client forged opt-in time'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.push_other'),true);
do $$ begin
  if exists(select 1 from public.chat_push_devices where id=current_setting('test.push_device')::uuid) then raise exception 'Other member read token'; end if;
  begin perform public.register_chat_push(current_setting('test.push_device')::uuid,'synthetic-fcm-deployment-check',repeat('b',64)); raise exception 'Other install took token'; exception when insufficient_privilege then null; end;
  begin perform public.claim_chat_pushes(1); raise exception 'Member claimed notification jobs'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.chat_push_queue; raise exception 'Member read queue'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.push_owner'),true);
delete from public.chat_push_devices where id=current_setting('test.push_device')::uuid;
reset role;
do $$ begin
 if has_function_privilege('anon','public.register_chat_push(uuid,text,text)','execute') or has_table_privilege('anon','public.chat_push_devices','select') or has_function_privilege('authenticated','private.kick_chat_push()','execute') then raise exception 'Notification permissions too broad'; end if;
end $$;
