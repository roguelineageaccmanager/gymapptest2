-- Optional chat names. Handles remain unique; routines and workout data are untouched.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add constraint profile_display_name_valid check (
 display_name is null or (char_length(display_name) between 1 and 40 and display_name=btrim(display_name)
 and display_name !~ '[[:cntrl:]]' and display_name !~ U&'[\202a-\202e\2066-\2069]'));

create or replace function public.change_display_name(name text,expected_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from expected_user then
  raise exception 'The account changed. Try again.' using errcode='42501';
 end if;
 update public.profiles set display_name=nullif(btrim(name),'') where id=auth.uid();
end $$;
revoke all on function public.change_display_name(text,uuid) from public,anon;
grant execute on function public.change_display_name(text,uuid) to authenticated;

-- Replace atomically so older clients keep their existing fields and limits.
drop function public.community_chat_v4(timestamptz,uuid);
create function public.community_chat_v4(before_time timestamptz default null,before_id uuid default null)
returns table(id uuid,user_id uuid,username text,body text,created_at timestamptz,reply_to uuid,reply_username text,reply_body text,display_name text,reply_display_name text)
language sql stable security definer set search_path='' as $$
 select m.id,m.user_id,p.username::text,m.body,m.created_at,r.id,rp.username::text,left(r.body,160),p.display_name,rp.display_name
 from public.community_messages m join public.profiles p on p.id=m.user_id
 left join public.community_messages r on r.id=m.reply_to and not private.blocked_between(auth.uid(),r.user_id)
 left join public.profiles rp on rp.id=r.user_id
 where auth.uid() is not null and not private.blocked_between(auth.uid(),m.user_id)
 and (before_time is null or (m.created_at,m.id)<(before_time,coalesce(before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 order by m.created_at desc,m.id desc limit 50;
$$;
revoke all on function public.community_chat_v4(timestamptz,uuid) from public,anon;
grant execute on function public.community_chat_v4(timestamptz,uuid) to authenticated;
notify pgrst,'reload schema';
