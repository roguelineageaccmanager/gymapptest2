-- Additive protection: no existing plans are rewritten by this migration.
alter table public.workout_plans add column if not exists plan_revision bigint not null default 1;
alter table public.workout_plans add column if not exists approved_removals jsonb not null default '{"routines":[],"exercises":{},"days":[]}';

create table if not exists public.plan_revisions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan jsonb not null,
  source_revision bigint not null,
  saved_at timestamptz not null default clock_timestamp()
);
create index if not exists plan_revisions_owner on public.plan_revisions(user_id,id desc);
alter table public.plan_revisions enable row level security;
revoke all on public.plan_revisions from public,anon,authenticated;
grant select on public.plan_revisions to authenticated;
drop policy if exists "Owners read plan revisions" on public.plan_revisions;
create policy "Owners read plan revisions" on public.plan_revisions for select to authenticated using(user_id=(select auth.uid()));

create or replace function private.plan_losses(previous jsonb, following jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare n text; items jsonb; missing jsonb; routines jsonb:='[]'; exercises jsonb:='{}'; days jsonb:='[]'; i integer;
begin
  for n,items in select * from jsonb_each(coalesce(previous->'workouts','{}')) loop
    if not coalesce(following->'workouts','{}') ? n then routines:=routines||jsonb_build_array(n);
    else
      select coalesce(jsonb_agg(distinct e->>'name'),'[]') into missing from jsonb_array_elements(items) e
      where e->>'name' is not null and not exists(select 1 from jsonb_array_elements(following->'workouts'->n) f where f->>'name'=e->>'name');
      if missing<>'[]' then exercises:=exercises||jsonb_build_object(n,missing); end if;
    end if;
  end loop;
  for i in 0..6 loop
    if coalesce(previous->'schedule'->>i::text,'')<>'' and coalesce(following->'schedule'->>i::text,'')='' then days:=days||jsonb_build_array(i::text); end if;
  end loop;
  return jsonb_build_object('routines',routines,'exercises',exercises,'days',days);
end $$;

create or replace function private.merge_plan_removals(a jsonb,b jsonb,current_plan jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:='{"routines":[],"exercises":{},"days":[]}'; k text; v jsonb; item text;
begin
  for item in select distinct value from jsonb_array_elements_text(coalesce(a->'routines','[]')||coalesce(b->'routines','[]')) loop
    if not coalesce(current_plan->'workouts','{}') ? item then result:=jsonb_set(result,'{routines}',(result->'routines')||jsonb_build_array(item)); end if;
  end loop;
  for item in select distinct value from jsonb_array_elements_text(coalesce(a->'days','[]')||coalesce(b->'days','[]')) loop
    if coalesce(current_plan->'schedule'->>item,'')='' then result:=jsonb_set(result,'{days}',(result->'days')||jsonb_build_array(item)); end if;
  end loop;
  for k in select jsonb_object_keys(coalesce(a->'exercises','{}')||coalesce(b->'exercises','{}')) loop
    select coalesce(jsonb_agg(distinct x.value),'[]') into v from jsonb_array_elements_text(coalesce(a->'exercises'->k,'[]')||coalesce(b->'exercises'->k,'[]')) x
    where not exists(select 1 from jsonb_array_elements(coalesce(current_plan->'workouts'->k,'[]')) e where e->>'name'=x.value);
    if v<>'[]' and coalesce(current_plan->'workouts','{}') ? k then result:=jsonb_set(result,array['exercises',k],v); end if;
  end loop;
  return result;
end $$;

create or replace function private.protect_plan() returns trigger
language plpgsql security definer set search_path='' as $$
declare proof jsonb; loss jsonb; n text; items jsonb;
begin
  if new.plan is null then return new; end if;
  proof:=new.plan->'_lossApproval';
  new.plan:=new.plan-'_lossApproval';
  if jsonb_typeof(new.plan->'workouts') is distinct from 'object' then raise exception 'Invalid routines' using errcode='23514'; end if;
  for n,items in select * from jsonb_each(new.plan->'workouts') loop
    if jsonb_typeof(items) is distinct from 'array' then raise exception 'Invalid exercise list' using errcode='23514'; end if;
  end loop;
  if tg_op='INSERT' then new.updated_at:=clock_timestamp(); new.plan_revision:=1; new.approved_removals:='{"routines":[],"exercises":{},"days":[]}'; return new; end if;
  loss:=private.plan_losses(old.plan,new.plan);
  if loss<>'{"routines":[],"exercises":{},"days":[]}'::jsonb then
    if coalesce(proof->>'base_updated_at','')<>old.updated_at::text and (proof->>'base_updated_at')::timestamptz is distinct from old.updated_at then
      raise exception 'Plan protected: update the app and review removals before syncing.' using errcode='23514';
    end if;
    if not coalesce(proof->'losses','{}') @> loss then
      raise exception 'Plan protected: unexpected routine or exercise removal.' using errcode='23514';
    end if;
  end if;
  new.approved_removals:=private.merge_plan_removals(old.approved_removals,loss,new.plan);
  new.plan_revision:=old.plan_revision;
  if new.plan is distinct from old.plan then
    insert into public.plan_revisions(user_id,plan,source_revision) values(old.user_id,old.plan,old.plan_revision);
    delete from public.plan_revisions where user_id=old.user_id and id not in(select id from public.plan_revisions where user_id=old.user_id order by id desc limit 20);
    new.plan_revision:=old.plan_revision+1;
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;
revoke all on function private.plan_losses(jsonb,jsonb),private.merge_plan_removals(jsonb,jsonb,jsonb),private.protect_plan() from public,anon,authenticated;
drop trigger if exists workout_plans_protect on public.workout_plans;
create trigger workout_plans_protect before insert or update on public.workout_plans for each row execute function private.protect_plan();
notify pgrst,'reload schema';
