create table if not exists public.profile_banners (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  color text not null default '#343456' check(color ~ '^#[0-9A-Fa-f]{6}$'),
  image_data text check(image_data is null or (length(image_data)<=180000 and image_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$')),
  updated_at timestamptz not null default now()
);
alter table public.profile_banners enable row level security;
revoke all on public.profile_banners from public,anon,authenticated;
grant select,insert,update,delete on public.profile_banners to authenticated;
drop policy if exists "Owners and friends read profile banners" on public.profile_banners;
create policy "Owners and friends read profile banners" on public.profile_banners for select to authenticated
  using(user_id=(select auth.uid()) or private.is_friend(user_id));
drop policy if exists "Owners insert profile banners" on public.profile_banners;
create policy "Owners insert profile banners" on public.profile_banners for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "Owners update profile banners" on public.profile_banners;
create policy "Owners update profile banners" on public.profile_banners for update to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists "Owners remove profile banners" on public.profile_banners;
create policy "Owners remove profile banners" on public.profile_banners for delete to authenticated using(user_id=(select auth.uid()));
notify pgrst,'reload schema';
