select set_config('test.community_a',gen_random_uuid()::text,true);
select set_config('test.community_b',gen_random_uuid()::text,true);
select set_config('test.community_message',gen_random_uuid()::text,true);
insert into auth.users(id,raw_user_meta_data)
select current_setting(key)::uuid,jsonb_build_object('age_confirmed','true','username','cm_'||substr(replace(current_setting(key),'-',''),1,12))
from unnest(array['test.community_a','test.community_b']) as key;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.community_a'),true);
insert into public.shared_themes(owner_id,recipient_id,name,appearance) values(auth.uid(),null,'Community test','{"theme":{"base":"dark","preset":"custom","color":"#aabbcc"}}');
select public.send_community_message(current_setting('test.community_message')::uuid,'Hello gym');
select public.send_community_message(current_setting('test.community_message')::uuid,'Hello gym');
do $$ begin
  if (select count(*) from public.community_messages where user_id=auth.uid())<>1 then raise exception 'Retry duplicated message'; end if;
  begin
    perform public.send_community_message(gen_random_uuid(),'');
    raise exception 'Blank message accepted';
  exception when check_violation then null; end;
  begin
    insert into public.community_messages(id,user_id,body) values(gen_random_uuid(),auth.uid(),'Forged insert');
    raise exception 'Direct insertion permitted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.shared_themes(owner_id,recipient_id,name,appearance) values(auth.uid(),null,'Invalid','{"theme":{"base":"dark","preset":"custom","color":"#aabbcc"},"url":"https://invalid.example"}');
    raise exception 'Unsafe public theme accepted';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.community_b'),true);
do $$ declare n integer; begin
  if not exists(select 1 from public.community_themes() where owner_id=current_setting('test.community_a')::uuid) then raise exception 'Nonfriend cannot read public theme'; end if;
  if not exists(select 1 from public.community_chat() where id=current_setting('test.community_message')::uuid and body='Hello gym') then raise exception 'Nonfriend cannot read chat'; end if;
  delete from public.community_messages where id=current_setting('test.community_message')::uuid; get diagnostics n=row_count;
  if n<>0 then raise exception 'Other user deleted message'; end if;
  begin
    perform public.send_community_message(current_setting('test.community_message')::uuid,'Overwrite');
    raise exception 'Other user reused message';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.community_a'),true);
do $$ declare i integer; n integer; begin
  for i in 1..29 loop perform public.send_community_message(gen_random_uuid(),'Rate test'); end loop;
  begin
    perform public.send_community_message(gen_random_uuid(),'Too many');
    raise exception 'Message rate not limited';
  exception when check_violation then null; end;
  delete from public.community_messages where id=current_setting('test.community_message')::uuid; get diagnostics n=row_count;
  if n<>1 then raise exception 'Owner cannot remove message'; end if;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.community_chat(timestamptz,uuid)','execute') or
     has_function_privilege('anon','public.community_themes()','execute') or
     has_function_privilege('anon','public.send_community_message(uuid,text)','execute') or
     has_table_privilege('anon','public.community_messages','select') then raise exception 'Anonymous community access'; end if;
end $$;
