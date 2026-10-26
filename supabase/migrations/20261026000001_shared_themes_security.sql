-- Explicitly close anonymous table grants; authenticated row policies remain.
do $$ declare name text; begin
  foreach name in array array['profiles','friend_requests','friend_blocks','shared_workouts','leaderboard_stats','workout_plans','body_weight_logs','workout_data','gym_dates','gym_date_invites','gym_date_rsvps','profile_pictures'] loop
    if to_regclass('public.' || name) is not null then
      execute format('revoke all on public.%I from anon',name);
      execute format('alter table public.%I enable row level security',name);
    end if;
  end loop;
end $$;
alter default privileges in schema public revoke all on tables from anon;

create or replace function private.valid_theme_payload(p jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; begin
  if jsonb_typeof(p) <> 'object' or jsonb_typeof(p->'theme') <> 'object' or octet_length(p::text)>4096 then return false; end if;
  if p - array['theme','updateColor','backgroundColor','surfaceColor','textColor','borderColor','buttonTextColor','buttonColor','selectedColor','selectedTextColor','inputColor','badgeColor','streakColor','navColor','navTextColor'] <> '{}'::jsonb then return false; end if;
  if (p->'theme') - array['base','preset','color'] <> '{}'::jsonb then return false; end if;
  if coalesce(p->'theme'->>'base','') not in ('dark','light','system') or coalesce(p->'theme'->>'color','') !~ '^#[0-9A-Fa-f]{6}$' or coalesce(p->'theme'->>'preset','') !~ '^[a-z-]{1,20}$' then return false; end if;
  for k,v in select * from jsonb_each(p) loop
    if k <> 'theme' and (jsonb_typeof(v)<>'string' or (v #>> '{}') !~ '^#[0-9A-Fa-f]{6}$') then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function private.valid_theme_payload(jsonb) from public,anon;
grant execute on function private.valid_theme_payload(jsonb) to authenticated;

create table if not exists public.shared_themes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  appearance jsonb not null check (private.valid_theme_payload(appearance)),
  created_at timestamptz not null default now(),
  check (owner_id<>recipient_id)
);
create index if not exists shared_themes_owner on public.shared_themes(owner_id);
create index if not exists shared_themes_recipient on public.shared_themes(recipient_id);
alter table public.shared_themes enable row level security;
revoke all on public.shared_themes from anon,authenticated;
grant select,insert,delete on public.shared_themes to authenticated;
drop policy if exists "Owners and recipients read themes" on public.shared_themes;
create policy "Owners and recipients read themes" on public.shared_themes for select to authenticated
  using (owner_id=(select auth.uid()) or (recipient_id=(select auth.uid()) and private.is_friend(owner_id)));
drop policy if exists "Owners share with accepted friends" on public.shared_themes;
create policy "Owners share with accepted friends" on public.shared_themes for insert to authenticated
  with check (owner_id=(select auth.uid()) and private.is_friend(recipient_id));
drop policy if exists "Owners and recipients remove themes" on public.shared_themes;
create policy "Owners and recipients remove themes" on public.shared_themes for delete to authenticated
  using (owner_id=(select auth.uid()) or recipient_id=(select auth.uid()));
notify pgrst,'reload schema';
