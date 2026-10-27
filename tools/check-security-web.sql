-- Run inside a savepoint and roll back; inspect only function definitions/permissions.
do $$ begin
 if pg_get_functiondef('public.community_chat(timestamptz,uuid)'::regprocedure) !~* 'limit 50' or
    pg_get_functiondef('public.community_chat_v4(timestamptz,uuid)'::regprocedure) !~* 'limit 50' then
   raise exception 'Chat reads are not bounded to fifty';
 end if;
 if has_function_privilege('anon','public.community_chat(timestamptz,uuid)','execute') or
    has_function_privilege('anon','public.community_chat_v4(timestamptz,uuid)','execute') or
    has_function_privilege('authenticated','private.maintain_chat_push()','execute') or
    has_table_privilege('anon','public.chat_push_devices','select') then
   raise exception 'Chat/token permissions too broad';
 end if;
 if pg_get_functiondef('private.maintain_chat_push()'::regprocedure) !~* '90 days' then
   raise exception 'Expired token cleanup missing';
 end if;
end $$;
