alter table public.profile_banners add column if not exists avatar_color text;
alter table public.profile_banners drop constraint if exists profile_avatar_color_valid;
alter table public.profile_banners add constraint profile_avatar_color_valid check(avatar_color is null or avatar_color ~ '^#[0-9A-Fa-f]{6}$');
notify pgrst,'reload schema';
