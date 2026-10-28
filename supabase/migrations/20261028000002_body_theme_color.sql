-- Add an optional hex body color to shared presets; keep existing payloads and access rules.
create or replace function private.valid_theme_payload(p jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; rk text; rv jsonb; begin
  if p is null or jsonb_typeof(p)<>'object' or jsonb_typeof(p->'theme')<>'object' or octet_length(p::text)>4096 then return false; end if;
  if p - array['theme','updateColor','backgroundColor','surfaceColor','textColor','borderColor','buttonTextColor','buttonColor','selectedColor','selectedTextColor','inputColor','badgeColor','streakColor','navColor','navTextColor','bodyColor','rankColors','statsFinish'] <> '{}'::jsonb then return false; end if;
  if (p->'theme') - array['base','preset','color'] <> '{}'::jsonb then return false; end if;
  if coalesce(p->'theme'->>'base','') not in ('dark','light','system') or coalesce(p->'theme'->>'color','') !~ '^#[0-9A-Fa-f]{6}$' or coalesce(p->'theme'->>'preset','') !~ '^[a-z-]{1,20}$' then return false; end if;
  for k,v in select * from jsonb_each(p) loop
    if k='rankColors' then
      if jsonb_typeof(v)<>'object' or v - array['wood','bronze','silver','gold','platinum','diamond','champion','titan','olympian'] <> '{}'::jsonb then return false; end if;
      for rk,rv in select * from jsonb_each(v) loop
        if jsonb_typeof(rv)<>'string' or (rv #>> '{}') !~ '^#[0-9A-Fa-f]{6}$' then return false; end if;
      end loop;
    elsif k='statsFinish' then
      if jsonb_typeof(v)<>'string' or (v #>> '{}') not in ('metallic','flat') then return false; end if;
    elsif k<>'theme' and (jsonb_typeof(v)<>'string' or (v #>> '{}') !~ '^#[0-9A-Fa-f]{6}$') then return false;
    end if;
  end loop;
  return true;
end $$;
revoke all on function private.valid_theme_payload(jsonb) from public,anon;
grant execute on function private.valid_theme_payload(jsonb) to authenticated;
