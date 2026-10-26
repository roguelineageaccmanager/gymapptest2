create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_data text not null check(length(image_data)<=240000 and image_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$'),
  photo_date date not null,
  caption text not null default '' check(length(caption)<=160),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists progress_photos_feed on public.progress_photos(created_at desc,id desc);
create index if not exists progress_photos_owner on public.progress_photos(user_id);
alter table public.progress_photos enable row level security;
revoke all on public.progress_photos from public,anon,authenticated;
grant select,insert,delete on public.progress_photos to authenticated;
create policy "Owners and friends read progress photos" on public.progress_photos for select to authenticated
  using(user_id=(select auth.uid()) or private.is_friend(user_id));
create policy "Owners post progress photos" on public.progress_photos for insert to authenticated
  with check(user_id=(select auth.uid()));
create policy "Owners remove progress photos" on public.progress_photos for delete to authenticated
  using(user_id=(select auth.uid()));

create or replace function private.limit_progress_photos() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,383));
  if not exists(select 1 from public.progress_photos where id=new.id)
     and (select count(*) from public.progress_photos where user_id=new.user_id)>=200 then
    raise exception 'You can keep up to 200 progress pictures. Remove an older picture first.' using errcode='23514';
  end if;
  new.created_at:=clock_timestamp();
  return new;
end $$;
revoke all on function private.limit_progress_photos() from public,anon,authenticated;
create trigger limit_progress_photos before insert on public.progress_photos for each row execute function private.limit_progress_photos();
notify pgrst,'reload schema';
