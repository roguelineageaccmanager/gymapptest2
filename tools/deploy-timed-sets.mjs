// Apply only this checked additive migration, preserving unmatched legacy history.
// Same protected main-only production path as the existing fixed migrations.
import {readFileSync} from 'node:fs';
const ref=process.env.SUPABASE_PROJECT_REF,token=process.env.SUPABASE_ACCESS_TOKEN;
if(ref!=='aiiyombsmvlbhifxgkhp'||!token)throw new Error('Deployment settings missing');
async function query(sql,readOnly=true){
  const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(120000),
  });
  if(!response.ok)throw new Error('Timed-set migration request failed: HTTP '+response.status);
  return response.json();
}
const version='20261106195354';
const migration=readFileSync(`supabase/migrations/${version}_timed_sets_volume.sql`,'utf8');
const installed=await query(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as installed`);
const checks=readFileSync('tools/check-timed-sets.sql','utf8'),guard=readFileSync('supabase/verify-access.sql','utf8');
await query(`begin; ${installed[0]?.installed?'':migration}
savepoint timed_checks; ${checks} rollback to savepoint timed_checks; ${guard}
insert into supabase_migrations.schema_migrations(version,name,statements)
values('${version}','timed_sets_volume',array[$timed_migration$${migration}$timed_migration$])
on conflict(version) do nothing; commit;`,false);
console.log('Timed-set totals migration recorded; synthetic checks and access guard passed. No workout data rewritten.');
