-- Small, re-encoded profile pictures; never externally hosted URLs.
create table if not exists public.profile_pictures (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  image_data text not null check (length(image_data) <= 100000 and image_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$'),
  updated_at timestamptz not null default now()
);
alter table public.profile_pictures enable row level security;
revoke all on public.profile_pictures from anon, authenticated;
grant select, insert, update, delete on public.profile_pictures to authenticated;
drop policy if exists "Owners and friends read profile pictures" on public.profile_pictures;
create policy "Owners and friends read profile pictures" on public.profile_pictures
  for select to authenticated using (user_id = (select auth.uid()) or private.is_friend(user_id));
drop policy if exists "Owners insert profile pictures" on public.profile_pictures;
create policy "Owners insert profile pictures" on public.profile_pictures
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Owners update profile pictures" on public.profile_pictures;
create policy "Owners update profile pictures" on public.profile_pictures
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Owners remove profile pictures" on public.profile_pictures;
create policy "Owners remove profile pictures" on public.profile_pictures
  for delete to authenticated using (user_id = (select auth.uid()));
notify pgrst, 'reload schema';
