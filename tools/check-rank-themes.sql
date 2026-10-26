do $$ declare base jsonb:='{"theme":{"base":"dark","preset":"custom","color":"#ff3344"},"buttonColor":"#112233"}'; begin
 if not private.valid_theme_payload(base) then raise exception 'Existing theme rejected'; end if;
 if not private.valid_theme_payload(base||'{"rankColors":{"wood":"#abcdef","gold":"#ff3344"},"statsFinish":"metallic"}') then raise exception 'Rank colors rejected'; end if;
 if not private.valid_theme_payload(base||'{"rankColors":{},"statsFinish":"flat"}') then raise exception 'Flat finish rejected'; end if;
 if private.valid_theme_payload(base||'{"rankColors":{"gold":"red; background:url(x)"}}') then raise exception 'Injected color accepted'; end if;
 if private.valid_theme_payload(base||'{"rankColors":{"fake":"#abcdef"}}') then raise exception 'Unknown tier accepted'; end if;
 if private.valid_theme_payload(base||'{"rankColors":["#abcdef"]}') then raise exception 'Array accepted'; end if;
 if private.valid_theme_payload(base||'{"rankColors":{"gold":42}}') then raise exception 'Non-color accepted'; end if;
 if private.valid_theme_payload(base||'{"statsFinish":"url(x)"}') then raise exception 'Unknown finish accepted'; end if;
 if private.valid_theme_payload(base||'{"chatNotifications":true}') then raise exception 'Training preference accepted in theme'; end if;
 if private.valid_theme_payload(base||jsonb_build_object('textColor',repeat('x',5000))) then raise exception 'Unbounded theme accepted'; end if;
end $$;
