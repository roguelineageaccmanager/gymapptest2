-- v4 clients use explicit replies; old clients keep their existing RPCs.
alter table public.community_messages add column if not exists reply_to uuid
  references public.community_messages(id) on delete set null;

create or replace function public.send_chat_reply(message_id uuid,message_body text,reply_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; begin
  -- Serialize retries with the legacy send function, so a retry cannot change a reply.
  if auth.uid() is null then raise exception 'Sign in to chat.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,381));
  if exists(select 1 from public.community_messages where id=message_id and user_id=auth.uid()) then return message_id; end if;
  if reply_id is not null and not exists(select 1 from public.community_messages m where m.id=reply_id and not private.blocked_between(auth.uid(),m.user_id)) then
    raise exception 'This message is no longer available.' using errcode='23514';
  end if;
  result:=public.send_community_message(message_id,message_body);
  update public.community_messages set reply_to=reply_id where id=result and user_id=auth.uid();
  return result;
end $$;
revoke all on function public.send_chat_reply(uuid,text,uuid) from public,anon;
grant execute on function public.send_chat_reply(uuid,text,uuid) to authenticated;

create or replace function public.community_chat_v4(before_time timestamptz default null,before_id uuid default null)
returns table(id uuid,user_id uuid,username text,body text,created_at timestamptz,reply_to uuid,reply_username text,reply_body text)
language sql stable security definer set search_path='' as $$
  select m.id,m.user_id,p.username::text,m.body,m.created_at,r.id,rp.username::text,left(r.body,160)
  from public.community_messages m join public.profiles p on p.id=m.user_id
  left join public.community_messages r on r.id=m.reply_to and not private.blocked_between(auth.uid(),r.user_id)
  left join public.profiles rp on rp.id=r.user_id
  where auth.uid() is not null and not private.blocked_between(auth.uid(),m.user_id)
    and (before_time is null or (m.created_at,m.id)<(before_time,coalesce(before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by m.created_at desc,m.id desc limit 100;
$$;
revoke all on function public.community_chat_v4(timestamptz,uuid) from public,anon;
grant execute on function public.community_chat_v4(timestamptz,uuid) to authenticated;

-- Chat participants expose only identity/appearance to other signed-in members.
-- Direct photo/banner access and private/friend-only workout stats stay unchanged.
create or replace function public.community_members(member_ids uuid[])
returns table(user_id uuid,username text,image_data text,color text,banner_image text,avatar_color text)
language sql stable security definer set search_path='' as $$
  select p.id,p.username::text,i.image_data,coalesce(b.color,'#343456'),b.image_data,b.avatar_color
  from public.profiles p left join public.profile_pictures i on i.user_id=p.id
  left join public.profile_banners b on b.user_id=p.id
  where auth.uid() is not null and cardinality(member_ids)<=100 and p.id=any(member_ids)
    and not private.blocked_between(auth.uid(),p.id)
    and (p.id=auth.uid() or exists(select 1 from public.community_messages m where m.user_id=p.id));
$$;
revoke all on function public.community_members(uuid[]) from public,anon;
grant execute on function public.community_members(uuid[]) to authenticated;
notify pgrst,'reload schema';
