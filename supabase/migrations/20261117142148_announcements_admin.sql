-- Announcement publishing is a server-managed app role, never user metadata.
create table private.announcement_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table private.announcement_admins enable row level security;
revoke all on private.announcement_admins from public,anon,authenticated;
create function private.is_announcement_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from private.announcement_admins a where a.user_id=auth.uid()
  );
$$;
revoke all on function private.is_announcement_admin() from public,anon;
grant execute on function private.is_announcement_admin() to authenticated;
create function public.announcement_admin() returns boolean
language sql stable security invoker set search_path='' as $$
  select private.is_announcement_admin();
$$;
revoke all on function public.announcement_admin() from public,anon;
grant execute on function public.announcement_admin() to authenticated;
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid default auth.uid() references public.profiles(id) on delete set null,
  title text not null check(char_length(btrim(title)) between 1 and 120),
  body text not null check(char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_latest on public.announcements(created_at desc,id desc);
alter table public.announcements enable row level security;
revoke all on public.announcements from public,anon,authenticated;
grant select,insert,update,delete on public.announcements to authenticated;
create policy "Members read announcements" on public.announcements for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid())));
create policy "Admins publish announcements" on public.announcements for insert to authenticated with check (
  author_id=(select auth.uid()) and (select private.is_announcement_admin())
);
create policy "Admins edit their announcements" on public.announcements for update to authenticated
  using (author_id=(select auth.uid()) and (select private.is_announcement_admin()))
  with check (author_id=(select auth.uid()) and (select private.is_announcement_admin()));
create policy "Admins delete their announcements" on public.announcements for delete to authenticated
  using (author_id=(select auth.uid()) and (select private.is_announcement_admin()));
create function private.announcement_timestamps() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then new.id=old.id;new.created_at=old.created_at;new.author_id=old.author_id;
 else new.created_at=now();end if;
 new.updated_at=now();return new;
end $$;
revoke all on function private.announcement_timestamps() from public,anon,authenticated;
create trigger announcement_timestamps before insert or update on public.announcements for each row execute function private.announcement_timestamps();
notify pgrst,'reload schema';
