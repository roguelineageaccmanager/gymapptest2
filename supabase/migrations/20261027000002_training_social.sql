-- Additive features. Existing routines and workout histories are not rewritten.
alter table public.profiles add column if not exists share_scores boolean not null default true;
create or replace function private.guard_score_sharing() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and new.user_id is distinct from auth.uid() then return new; end if;
  if not coalesce((select share_scores from public.profiles where id=new.user_id),false) then
    raise exception 'Score sharing is disabled in Settings.' using errcode='23514';
  end if;
  return new;
end $$;
create or replace function private.stop_score_sharing() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.share_scores=false and old.share_scores is distinct from new.share_scores then
    delete from public.leaderboard_stats where user_id=old.id;
  end if;
  return new;
end $$;
drop trigger if exists leaderboard_sharing_guard on public.leaderboard_stats;
create trigger leaderboard_sharing_guard before insert or update on public.leaderboard_stats for each row execute function private.guard_score_sharing();
drop trigger if exists profiles_score_sharing on public.profiles;
create trigger profiles_score_sharing before update on public.profiles for each row execute function private.stop_score_sharing();

create table if not exists public.progress_photo_reactions (
  photo_id uuid not null references public.progress_photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check(emoji in ('💪','🔥','❤️','👏','👍','💯')),
  primary key(photo_id,user_id,emoji)
);
create index if not exists progress_reactions_owner on public.progress_photo_reactions(user_id);
alter table public.progress_photo_reactions enable row level security;
revoke all on public.progress_photo_reactions from public,anon,authenticated;
grant select,insert,delete on public.progress_photo_reactions to authenticated;
create policy "Photo viewers read reactions" on public.progress_photo_reactions for select to authenticated
  using(exists(select 1 from public.progress_photos p where p.id=photo_id));
create policy "Photo viewers add own reactions" on public.progress_photo_reactions for insert to authenticated
  with check(user_id=(select auth.uid()) and exists(select 1 from public.progress_photos p where p.id=photo_id));
create policy "Users remove own photo reactions" on public.progress_photo_reactions for delete to authenticated using(user_id=(select auth.uid()));
create or replace function public.progress_photo_reactions_for(photo_ids uuid[])
returns table(photo_id uuid,emoji text,reaction_count bigint,mine boolean)
language sql stable security invoker set search_path='' as $$
  select r.photo_id,r.emoji,count(*),bool_or(r.user_id=(select auth.uid()))
  from public.progress_photo_reactions r
  where cardinality(photo_ids) between 1 and 30 and r.photo_id=any(photo_ids)
  group by r.photo_id,r.emoji order by r.photo_id,r.emoji
$$;
revoke all on function public.progress_photo_reactions_for(uuid[]) from public,anon;
grant execute on function public.progress_photo_reactions_for(uuid[]) to authenticated;

-- Older apps omit optional warm-up fields. Missing preserves them; an explicit
-- zero count / empty array is the newer app's instruction to clear them.
create or replace function private.warmup_exercise(known jsonb,item jsonb,field_name text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare value jsonb; entry jsonb;
begin
  if item ? field_name then
    value:=item->field_name;
    if field_name='warmupSets' then
      if jsonb_typeof(value) is distinct from 'number' or value::text !~ '^([0-9]|1[0-2])$' then
        raise exception 'Warm-up count must be between zero and twelve.' using errcode='23514';
      end if;
    else
      if jsonb_typeof(value) is distinct from 'array' then raise exception 'Invalid warm-up sets.' using errcode='23514'; end if;
      if jsonb_array_length(value)>12 then raise exception 'Too many warm-up sets.' using errcode='23514'; end if;
      for entry in select * from jsonb_array_elements(value) loop
        if jsonb_typeof(entry) is distinct from 'object' or
           jsonb_typeof(entry->'w') is distinct from 'string' or jsonb_typeof(entry->'r') is distinct from 'string' or
           jsonb_typeof(entry->'done') is distinct from 'boolean' or
           length(entry->>'w')>12 or length(entry->>'r')>12 or entry-array['w','r','done']<>'{}'::jsonb then
          raise exception 'Invalid warm-up set.' using errcode='23514';
        end if;
      end loop;
    end if;
  elsif known ? field_name then item:=jsonb_set(item,array[field_name],known->field_name);
  end if;
  return item;
end $$;

create or replace function private.preserve_warmup_exercises(previous jsonb,following jsonb,field_name text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare known_index jsonb; result jsonb; field_path jsonpath;
begin
  if jsonb_typeof(following) is distinct from 'array' then return following; end if;
  if jsonb_typeof(previous) is distinct from 'array' then previous:='[]'; end if;
  field_path:=case when field_name='warmupSets' then '$[*].warmupSets'::jsonpath else '$[*].warmups'::jsonpath end;
  if not jsonb_path_exists(following,field_path) and not jsonb_path_exists(previous,field_path) then return following; end if;
  select coalesce(jsonb_object_agg(e.name,e.item),'{}') into known_index from
    (select distinct on (v->>'name') v->>'name' as name,v as item from jsonb_array_elements(previous) with ordinality a(v,n)
      where v ? field_name and jsonb_typeof(v->'name')='string' order by v->>'name',n) e;
  select coalesce(jsonb_agg(private.warmup_exercise(known_index->(e.v->>'name'),e.v,field_name) order by e.n),'[]') into result
    from jsonb_array_elements(following) with ordinality e(v,n);
  return result;
end $$;

create or replace function private.preserve_plan_warmups() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous jsonb; workouts jsonb;
begin
  if new.plan is null or jsonb_typeof(new.plan->'workouts') is distinct from 'object' then return new; end if;
  if octet_length(new.plan::text)>1048576 then raise exception 'Plan is too large.' using errcode='23514'; end if;
  previous:=case when tg_op='UPDATE' then old.plan->'workouts' else '{}' end;
  select coalesce(jsonb_object_agg(e.key,private.preserve_warmup_exercises(previous->e.key,e.value,'warmupSets')),'{}') into workouts from jsonb_each(new.plan->'workouts') e;
  new.plan:=jsonb_set(new.plan,'{workouts}',workouts);
  return new;
end $$;

create or replace function private.warmup_session(known jsonb,item jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(item->'exercises')='array' then
    item:=jsonb_set(item,'{exercises}',private.preserve_warmup_exercises(known->'exercises',item->'exercises','warmups'));
  end if;
  return item;
end $$;

create or replace function private.preserve_warmup_day(previous jsonb,following jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare old_index jsonb; result jsonb;
begin
  if jsonb_typeof(following) is distinct from 'array' then return following; end if;
  if jsonb_typeof(previous) is distinct from 'array' then previous:='[]'; end if;
  if not jsonb_path_exists(following,'$[*].exercises[*].warmups') and not jsonb_path_exists(previous,'$[*].exercises[*].warmups') then return following; end if;
  select coalesce(jsonb_object_agg(case when nullif(s->>'id','') is not null then jsonb_build_array(s->>'id')::text else jsonb_build_array(s->>'day',s->>'time')::text end,s),'{}') into old_index from jsonb_array_elements(previous) s;
  select coalesce(jsonb_agg(private.warmup_session(old_index->(case when nullif(e.v->>'id','') is not null then jsonb_build_array(e.v->>'id')::text else jsonb_build_array(e.v->>'day',e.v->>'time')::text end),e.v) order by e.n),'[]') into result from jsonb_array_elements(following) with ordinality e(v,n);
  return result;
end $$;

create or replace function private.preserve_logged_warmups() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous jsonb;
begin
  if jsonb_typeof(new.logs) is distinct from 'object' then return new; end if;
  if octet_length(new.logs::text)>8388608 then raise exception 'Workout history is too large.' using errcode='23514'; end if;
  previous:=case when tg_op='UPDATE' then old.logs else '{}' end;
  -- Aggregate once rather than copying the whole history for every date.
  select coalesce(jsonb_object_agg(d.key,private.preserve_warmup_day(previous->d.key,d.value)),'{}') into new.logs from jsonb_each(new.logs) d;
  return new;
end $$;
drop trigger if exists workout_plans_preserve_warmups on public.workout_plans;
create trigger workout_plans_preserve_warmups before insert or update on public.workout_plans for each row execute function private.preserve_plan_warmups();
drop trigger if exists workout_data_preserve_warmups on public.workout_data;
create trigger workout_data_preserve_warmups before insert or update on public.workout_data for each row execute function private.preserve_logged_warmups();
revoke all on function private.guard_score_sharing(),private.stop_score_sharing(),private.warmup_exercise(jsonb,jsonb,text),private.warmup_session(jsonb,jsonb),private.preserve_warmup_exercises(jsonb,jsonb,text),private.preserve_plan_warmups(),private.preserve_warmup_day(jsonb,jsonb),private.preserve_logged_warmups() from public,anon,authenticated;
notify pgrst,'reload schema';
