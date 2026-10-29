select set_config('test.identity_a',gen_random_uuid()::text,true);
select set_config('test.identity_b',gen_random_uuid()::text,true);
insert into auth.users(id,raw_user_meta_data)
select current_setting(key)::uuid,jsonb_build_object('age_confirmed','true','username','id_'||substr(replace(current_setting(key),'-',''),1,12))
from unnest(array['test.identity_a','test.identity_b']) as key;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.identity_a'),true);
select public.change_display_name('Leonard Gym',auth.uid());
select public.send_chat_reply(gen_random_uuid(),'Synthetic identity message',null);
do $$ begin
 if not exists(select 1 from public.community_chat_v4() where user_id=auth.uid() and display_name='Leonard Gym') then raise exception 'Display name missing'; end if;
 begin perform public.change_display_name('Wrong owner',current_setting('test.identity_b')::uuid); raise exception 'Wrong owner accepted'; exception when insufficient_privilege then null; end;
 begin perform public.change_display_name(repeat('a',41),auth.uid()); raise exception 'Long name accepted'; exception when check_violation then null; end;
 begin perform public.change_display_name(E'Bad\nName',auth.uid()); raise exception 'Control character accepted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.identity_b'),true);
select public.change_display_name('Leonard Gym',auth.uid());
do $$ begin
 if (select count(*) from public.profiles where id=auth.uid() and display_name='Leonard Gym')<>1 then raise exception 'Duplicate display name rejected'; end if;
end $$;
select public.change_display_name('',auth.uid());
do $$ begin
 if not exists(select 1 from public.profiles where id=auth.uid() and display_name is null) then raise exception 'Name reset failed'; end if;
end $$;
reset role;
