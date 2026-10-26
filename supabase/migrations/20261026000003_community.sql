-- Explicit public-to-members theme publishing; existing private gifts stay private.
alter table public.shared_themes alter column recipient_id drop not null;
drop policy if exists "Owners and recipients read themes" on public.shared_themes;
create policy "Owners and recipients read themes" on public.shared_themes for select to authenticated
  using (recipient_id is null or owner_id=(select auth.uid()) or (recipient_id=(select auth.uid()) and private.is_friend(owner_id)));
drop policy if exists "Owners share with accepted friends" on public.shared_themes;
create policy "Owners share with accepted friends" on public.shared_themes for insert to authenticated
  with check (owner_id=(select auth.uid()) and (recipient_id is null or private.is_friend(recipient_id)));

create or replace function private.limit_public_themes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.recipient_id is null then
    perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 380));
    if (select count(*) from public.shared_themes where owner_id=new.owner_id and recipient_id is null)>=20 then
      raise exception 'You can publish up to 20 themes.' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.limit_public_themes() from public,anon,authenticated;
drop trigger if exists limit_public_themes on public.shared_themes;
create trigger limit_public_themes before insert on public.shared_themes for each row execute function private.limit_public_themes();

create or replace function public.community_themes()
returns table(id uuid,owner_id uuid,recipient_id uuid,name text,appearance jsonb,username text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select t.id,t.owner_id,t.recipient_id,t.name,t.appearance,p.username::text,t.created_at
  from public.shared_themes t join public.profiles p on p.id=t.owner_id
  where auth.uid() is not null and (t.recipient_id is null or t.owner_id=auth.uid() or (t.recipient_id=auth.uid() and private.is_friend(t.owner_id)))
  order by t.created_at desc,t.id desc limit 200;
$$;
revoke all on function public.community_themes() from public,anon;
grant execute on function public.community_themes() to authenticated;

create table if not exists public.community_messages (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists community_messages_chronological on public.community_messages(created_at desc,id desc);
alter table public.community_messages enable row level security;
revoke all on public.community_messages from public,anon,authenticated;
grant select,delete on public.community_messages to authenticated;
drop policy if exists "Users read own chat rows" on public.community_messages;
drop policy if exists "Users remove own messages" on public.community_messages;
create policy "Users read own chat rows" on public.community_messages for select to authenticated using(user_id=(select auth.uid()));
create policy "Users remove own messages" on public.community_messages for delete to authenticated using(user_id=(select auth.uid()));

create table if not exists private.chat_rate (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  window_start timestamptz not null,
  count integer not null
);
revoke all on private.chat_rate from public,anon,authenticated;

create or replace function public.send_community_message(message_id uuid,message_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); n integer; existing_owner uuid; begin
  if uid is null then raise exception 'Sign in to chat.' using errcode='42501'; end if;
  if message_id is null or message_body is null or length(btrim(message_body)) not between 1 and 1000 then
    raise exception 'Write a message of up to 1000 characters.' using errcode='23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,381));
  select user_id into existing_owner from public.community_messages where id=message_id;
  if existing_owner=uid then return message_id; end if;
  if existing_owner is not null then raise exception 'Message ID already used.' using errcode='42501'; end if;
  insert into private.chat_rate(user_id,window_start,count) values(uid,clock_timestamp(),1)
    on conflict(user_id) do update set
      count=case when private.chat_rate.window_start<clock_timestamp()-interval '1 minute' then 1 else private.chat_rate.count+1 end,
      window_start=case when private.chat_rate.window_start<clock_timestamp()-interval '1 minute' then clock_timestamp() else private.chat_rate.window_start end
    returning count into n;
  if n>30 then raise exception 'Wait a moment before sending more messages.' using errcode='23514'; end if;
  insert into public.community_messages(id,user_id,body) values(message_id,uid,btrim(message_body));
  return message_id;
end $$;
revoke all on function public.send_community_message(uuid,text) from public,anon;
grant execute on function public.send_community_message(uuid,text) to authenticated;

create or replace function public.community_chat(before_time timestamptz default null,before_id uuid default null)
returns table(id uuid,user_id uuid,username text,body text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select m.id,m.user_id,p.username::text,m.body,m.created_at
  from public.community_messages m join public.profiles p on p.id=m.user_id
  where auth.uid() is not null and not private.blocked_between(auth.uid(),m.user_id)
    and (before_time is null or (m.created_at,m.id)<(before_time,coalesce(before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by m.created_at desc,m.id desc limit 100;
$$;
revoke all on function public.community_chat(timestamptz,uuid) from public,anon;
grant execute on function public.community_chat(timestamptz,uuid) to authenticated;
notify pgrst,'reload schema';
