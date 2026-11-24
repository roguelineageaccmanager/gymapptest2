-- Existing absent rows may represent an explicit opt-out. Initialize only new profiles.
create function private.default_activity_sharing() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into private.member_activity(user_id) values(new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function private.default_activity_sharing() from public,anon,authenticated;
create trigger default_activity_sharing after insert on public.profiles
for each row execute function private.default_activity_sharing();
