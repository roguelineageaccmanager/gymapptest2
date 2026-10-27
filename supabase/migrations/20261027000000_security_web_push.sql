-- Bounded community reads, owned tokens and expired-device cleanup. No private data export.
create or replace function public.community_chat(before_time timestamptz default null,before_id uuid default null)
returns table(id uuid,user_id uuid,username text,body text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select m.id,m.user_id,p.username::text,m.body,m.created_at from public.community_messages m join public.profiles p on p.id=m.user_id
 where auth.uid() is not null and not private.blocked_between(auth.uid(),m.user_id)
 and (before_time is null or (m.created_at,m.id)<(before_time,coalesce(before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 order by m.created_at desc,m.id desc limit 50;
$$;
revoke all on function public.community_chat(timestamptz,uuid) from public,anon;
grant execute on function public.community_chat(timestamptz,uuid) to authenticated;
create or replace function public.community_chat_v4(before_time timestamptz default null,before_id uuid default null)
returns table(id uuid,user_id uuid,username text,body text,created_at timestamptz,reply_to uuid,reply_username text,reply_body text)
language sql stable security definer set search_path='' as $$
 select m.id,m.user_id,p.username::text,m.body,m.created_at,r.id,rp.username::text,left(r.body,160)
 from public.community_messages m join public.profiles p on p.id=m.user_id
 left join public.community_messages r on r.id=m.reply_to and not private.blocked_between(auth.uid(),r.user_id)
 left join public.profiles rp on rp.id=r.user_id
 where auth.uid() is not null and not private.blocked_between(auth.uid(),m.user_id)
 and (before_time is null or (m.created_at,m.id)<(before_time,coalesce(before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 order by m.created_at desc,m.id desc limit 50;
$$;
revoke all on function public.community_chat_v4(timestamptz,uuid) from public,anon;
grant execute on function public.community_chat_v4(timestamptz,uuid) to authenticated;
create or replace function private.maintain_chat_push() returns void
language plpgsql security definer set search_path='' as $$
begin
 delete from public.chat_push_queue where created_at<clock_timestamp()-interval '2 days';
 delete from public.chat_push_devices where updated_at<clock_timestamp()-interval '90 days';
 perform private.kick_chat_push();
end $$;
revoke all on function private.maintain_chat_push() from public,anon,authenticated;
notify pgrst,'reload schema';
