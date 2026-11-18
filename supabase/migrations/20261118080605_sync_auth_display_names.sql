-- Mirror the app's display name for Supabase Studio's Authentication Users list.
-- This field is presentation metadata and does not grant permissions.
create function private.sync_auth_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
  set raw_user_meta_data = case
    when new.display_name is null then coalesce(raw_user_meta_data, '{}'::jsonb) - 'display_name'
    else coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', new.display_name)
  end
  where id = new.id
    and raw_user_meta_data ->> 'display_name' is distinct from new.display_name;
  return new;
end;
$$;

revoke all on function private.sync_auth_display_name() from public, anon, authenticated;

create trigger sync_auth_display_name
after update of display_name on public.profiles
for each row
when (old.display_name is distinct from new.display_name)
execute function private.sync_auth_display_name();

-- Backfill saved app names while preserving every other metadata field.
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', p.display_name)
from public.profiles p
where p.id = u.id and p.display_name is not null
  and u.raw_user_meta_data ->> 'display_name' is distinct from p.display_name;
