-- Owned edits and bounded reactions for the existing signed-in community chat.
create table public.community_reactions (
 message_id uuid not null references public.community_messages(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 emoji text not null references private.progress_emoji(emoji),
 created_at timestamptz not null default now(), primary key(message_id,user_id,emoji)
);
alter table public.community_reactions enable row level security;
revoke all on public.community_reactions from public,anon,authenticated;
create table private.community_action_rate(user_id uuid not null references public.profiles(id) on delete cascade,posted_at timestamptz not null default now());
create index community_action_rate_user on private.community_action_rate(user_id,posted_at desc);
revoke all on private.community_action_rate from public,anon,authenticated;
create function private.guard_community_action() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to chat.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,17));
 delete from private.community_action_rate where user_id=auth.uid() and posted_at<now()-interval '2 minutes';
 if (select count(*) from private.community_action_rate where user_id=auth.uid() and posted_at>now()-interval '1 minute')>=60 then raise exception 'Wait a moment before changing more messages.' using errcode='54000'; end if;
 insert into private.community_action_rate(user_id) values(auth.uid());
end $$;
revoke all on function private.guard_community_action() from public,anon,authenticated;
create function public.edit_community_message(message_id uuid,message_body text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.community_messages m where m.id=message_id and m.user_id=auth.uid()) then raise exception 'This message is no longer available.' using errcode='42501'; end if;
 if message_body is null or char_length(btrim(message_body)) not between 1 and 1000 then raise exception 'Write a message of up to 1000 characters.' using errcode='22023'; end if;
 perform private.guard_community_action();
 update public.community_messages set body=btrim(message_body) where id=message_id and user_id=auth.uid();
 return true;
end $$;
create function public.set_community_reaction(message_id uuid,reaction text,enabled boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.community_messages m where m.id=message_id and not private.blocked_between(auth.uid(),m.user_id)) then raise exception 'This message is no longer available.' using errcode='42501'; end if;
 if not exists(select 1 from private.progress_emoji e where e.emoji=reaction) then raise exception 'Choose an emoji.' using errcode='22023'; end if;
 perform private.guard_community_action();
 perform pg_advisory_xact_lock(hashtextextended(message_id::text,18));
 if enabled then
  if exists(select 1 from public.community_reactions r where r.message_id=set_community_reaction.message_id and r.user_id=auth.uid() and r.emoji=reaction) then return true; end if;
  if (select count(*) from public.community_reactions r where r.message_id=set_community_reaction.message_id and r.user_id=auth.uid())>=10 then raise exception 'Use up to 10 reactions per message.' using errcode='54000'; end if;
  if not exists(select 1 from public.community_reactions r where r.message_id=set_community_reaction.message_id and r.emoji=reaction) and (select count(distinct r.emoji) from public.community_reactions r where r.message_id=set_community_reaction.message_id)>=24 then raise exception 'This message already has 24 reaction types.' using errcode='54000'; end if;
  insert into public.community_reactions values(message_id,auth.uid(),reaction,now()) on conflict do nothing;
 else
  delete from public.community_reactions r where r.message_id=set_community_reaction.message_id and r.user_id=auth.uid() and r.emoji=reaction;
 end if;
 return true;
end $$;
create function public.community_reactions_for(message_ids uuid[]) returns table(message_id uuid,emoji text,count bigint,mine boolean) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to chat.' using errcode='42501'; end if;
 if coalesce(cardinality(message_ids),0)>50 then raise exception 'Read up to 50 messages at once.' using errcode='22023'; end if;
 return query select r.message_id,r.emoji,count(*),bool_or(r.user_id=auth.uid()) from public.community_reactions r join public.community_messages m on m.id=r.message_id
 where r.message_id=any(message_ids) and not private.blocked_between(auth.uid(),m.user_id) and not private.blocked_between(auth.uid(),r.user_id)
 group by r.message_id,r.emoji order by r.message_id,r.emoji limit 1200;
end $$;
revoke all on function public.edit_community_message(uuid,text),public.set_community_reaction(uuid,text,boolean),public.community_reactions_for(uuid[]) from public,anon;
grant execute on function public.edit_community_message(uuid,text),public.set_community_reaction(uuid,text,boolean),public.community_reactions_for(uuid[]) to authenticated;
notify pgrst,'reload schema';
