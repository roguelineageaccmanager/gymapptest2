-- Device tokens and delivery jobs never become readable by other app members.
create table if not exists public.chat_push_devices (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique check(length(token) between 20 and 4096 and token ~ '^[A-Za-z0-9:_-]+$'),
  install_key_hash text not null,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.chat_push_devices enable row level security;
revoke all on public.chat_push_devices from public,anon,authenticated;
grant select,delete on public.chat_push_devices to authenticated;
grant all on public.chat_push_devices to service_role;
create policy "Owners read push devices" on public.chat_push_devices for select to authenticated using(user_id=(select auth.uid()));
create policy "Owners remove push devices" on public.chat_push_devices for delete to authenticated using(user_id=(select auth.uid()));

create table if not exists public.chat_push_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  enabled_at timestamptz not null default clock_timestamp()
);
alter table public.chat_push_settings enable row level security;
revoke all on public.chat_push_settings from public,anon,authenticated;
grant select,insert,update on public.chat_push_settings to authenticated;
grant all on public.chat_push_settings to service_role;
create policy "Owners read chat push settings" on public.chat_push_settings for select to authenticated using(user_id=(select auth.uid()));
create policy "Owners insert chat push settings" on public.chat_push_settings for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Owners update chat push settings" on public.chat_push_settings for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create or replace function private.chat_push_opt_in_time() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then new.enabled_at:=clock_timestamp();
  elsif new.enabled and not old.enabled then new.enabled_at:=clock_timestamp();
  else new.enabled_at:=old.enabled_at;
  end if;
  return new;
end $$;
revoke all on function private.chat_push_opt_in_time() from public,anon,authenticated;
create trigger chat_push_opt_in_time before insert or update on public.chat_push_settings for each row execute function private.chat_push_opt_in_time();

create or replace function public.register_chat_push(device_id uuid,device_token text,device_key text)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); changed integer; begin
  if uid is null or device_id is null then raise exception 'Sign in to register notifications.' using errcode='42501'; end if;
  if device_token is null or length(device_token) not between 20 and 4096 or device_token !~ '^[A-Za-z0-9:_-]+$' then raise exception 'Invalid notification token.' using errcode='23514'; end if;
  if device_key is null or device_key !~ '^[0-9a-f]{64}(hashtextextended(uid::text,384));
  delete from public.chat_push_devices where user_id=uid and updated_at<clock_timestamp()-interval '90 days';
  if not exists(select 1 from public.chat_push_devices where id=device_id and user_id=uid)
     and (select count(*) from public.chat_push_devices where user_id=uid)>=10 then raise exception 'Too many notification devices.' using errcode='23514'; end if;
  -- Only this physical installation can reassign its token when accounts switch.
  if exists(select 1 from public.chat_push_devices where id=device_id and install_key_hash<>encode(extensions.digest(device_key,'sha256'),'hex')) then raise exception 'Installation key mismatch.' using errcode='42501'; end if;
  insert into public.chat_push_devices(id,user_id,token,install_key_hash) values(device_id,uid,device_token,encode(extensions.digest(device_key,'sha256'),'hex'))
    on conflict(id) do update set user_id=excluded.user_id,token=excluded.token,updated_at=clock_timestamp() where public.chat_push_devices.install_key_hash=excluded.install_key_hash;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Installation key mismatch.' using errcode='42501'; end if;
end $$;
revoke all on function public.register_chat_push(uuid,text,text) from public,anon;
grant execute on function public.register_chat_push(uuid,text,text) to authenticated;

create table if not exists public.chat_push_queue (
  message_id uuid primary key references public.community_messages(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  attempts integer not null default 0
);
alter table public.chat_push_queue enable row level security;
revoke all on public.chat_push_queue from public,anon,authenticated;
grant all on public.chat_push_queue to service_role;

create or replace function public.claim_chat_pushes(batch_size integer default 20)
returns table(message_id uuid,sender_id uuid,username text,body text,devices jsonb)
language sql security definer set search_path='' as $$
  with candidates as (
    select q.message_id from public.chat_push_queue q
    where q.delivered_at is null and q.attempts<5 and q.created_at>clock_timestamp()-interval '1 day'
      and (q.claimed_at is null or q.claimed_at<clock_timestamp()-interval '2 minutes')
    order by q.created_at limit greatest(1,least(coalesce(batch_size,20),20)) for update skip locked
  ), claimed as (
    update public.chat_push_queue q set claimed_at=clock_timestamp(),attempts=attempts+1
    from candidates c where q.message_id=c.message_id returning q.message_id
  )
  select m.id,m.user_id,p.username::text,left(m.body,160),coalesce((
    select jsonb_agg(jsonb_build_object('id',d.id,'token',d.token))
    from public.chat_push_devices d join public.chat_push_settings s on s.user_id=d.user_id and s.enabled and m.created_at>=s.enabled_at
    where d.user_id<>m.user_id and not private.blocked_between(d.user_id,m.user_id)
      and d.updated_at>clock_timestamp()-interval '90 days'
  ),'[]'::jsonb)
  from claimed c join public.community_messages m on m.id=c.message_id join public.profiles p on p.id=m.user_id;
$$;
revoke all on function public.claim_chat_pushes(integer) from public,anon,authenticated;
grant execute on function public.claim_chat_pushes(integer) to service_role;

create extension if not exists pg_net with schema extensions;
create or replace function private.kick_chat_push() returns void
language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text; begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='gym_chat_push_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name='gym_chat_push_key' limit 1;
  if endpoint is null or secret is null then return; end if;
  perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-gym-push-key',secret),body:='{}'::jsonb,timeout_milliseconds:=5000);
exception when others then
  -- A notification failure must never prevent sending a chat message.
  return;
end $$;
revoke all on function private.kick_chat_push() from public,anon,authenticated;
-- The sender is connected separately after its Firebase credentials are configured.
-- No old messages are queued or notified during installation.
create or replace function private.queue_chat_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.chat_push_queue(message_id) values(new.id) on conflict do nothing;
  perform private.kick_chat_push();
  return new;
end $$;
revoke all on function private.queue_chat_push() from public,anon,authenticated;
create trigger queue_chat_push after insert on public.community_messages for each row execute function private.queue_chat_push();
notify pgrst,'reload schema';
 then raise exception 'Invalid installation key.' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,384));
  delete from public.chat_push_devices where user_id=uid and updated_at<clock_timestamp()-interval '90 days';
  if not exists(select 1 from public.chat_push_devices where id=device_id and user_id=uid)
     and (select count(*) from public.chat_push_devices where user_id=uid)>=10 then raise exception 'Too many notification devices.' using errcode='23514'; end if;
  -- An unguessable install ID follows the physical installation when accounts switch.
  insert into public.chat_push_devices(id,user_id,token) values(device_id,uid,device_token)
    on conflict(id) do update set user_id=excluded.user_id,token=excluded.token,updated_at=clock_timestamp();
end $$;
revoke all on function public.register_chat_push(uuid,text,text) from public,anon;
grant execute on function public.register_chat_push(uuid,text,text) to authenticated;

create table if not exists public.chat_push_queue (
  message_id uuid primary key references public.community_messages(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  attempts integer not null default 0
);
alter table public.chat_push_queue enable row level security;
revoke all on public.chat_push_queue from public,anon,authenticated;
grant all on public.chat_push_queue to service_role;

create or replace function public.claim_chat_pushes(batch_size integer default 20)
returns table(message_id uuid,sender_id uuid,username text,body text,devices jsonb)
language sql security definer set search_path='' as $$
  with candidates as (
    select q.message_id from public.chat_push_queue q
    where q.delivered_at is null and q.attempts<5 and q.created_at>clock_timestamp()-interval '1 day'
      and (q.claimed_at is null or q.claimed_at<clock_timestamp()-interval '2 minutes')
    order by q.created_at limit greatest(1,least(coalesce(batch_size,20),20)) for update skip locked
  ), claimed as (
    update public.chat_push_queue q set claimed_at=clock_timestamp(),attempts=attempts+1
    from candidates c where q.message_id=c.message_id returning q.message_id
  )
  select m.id,m.user_id,p.username::text,left(m.body,160),coalesce((
    select jsonb_agg(jsonb_build_object('id',d.id,'token',d.token))
    from public.chat_push_devices d join public.chat_push_settings s on s.user_id=d.user_id and s.enabled
    where d.user_id<>m.user_id and not private.blocked_between(d.user_id,m.user_id)
      and d.updated_at>clock_timestamp()-interval '90 days'
  ),'[]'::jsonb)
  from claimed c join public.community_messages m on m.id=c.message_id join public.profiles p on p.id=m.user_id;
$$;
revoke all on function public.claim_chat_pushes(integer) from public,anon,authenticated;
grant execute on function public.claim_chat_pushes(integer) to service_role;

-- The sender is connected separately after its Firebase credentials are configured.
-- No old messages are queued or notified during installation.
create or replace function private.queue_chat_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.chat_push_queue(message_id) values(new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function private.queue_chat_push() from public,anon,authenticated;
create trigger queue_chat_push after insert on public.community_messages for each row execute function private.queue_chat_push();
notify pgrst,'reload schema';
