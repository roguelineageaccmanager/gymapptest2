// One fixed additive identity migration and an update to the existing sender.
// Existing protected credentials stay on the server; no secret is created/exported.
import { readFileSync } from 'node:fs';
const ref=process.env.SUPABASE_PROJECT_REF,token=process.env.SUPABASE_ACCESS_TOKEN;
if(ref!=='aiiyombsmvlbhifxgkhp'||!token)throw new Error('Deployment settings missing');
async function management(path,body) {
 const multipart=body instanceof FormData;
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`,{method:'POST',headers:{Authorization:'Bearer '+token,...(multipart?{}:{'Content-Type':'application/json'})},body:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw new Error('Chat identity deployment failed: '+path.split('?')[0]+' HTTP '+response.status);
 return response;
}
const version='20261029000000',migration=readFileSync('supabase/migrations/'+version+'_chat_identity.sql','utf8');
const installed=await(await management('database/query',{query:`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as installed`,read_only:true})).json();
const checks=readFileSync('tools/check-chat-identity.sql','utf8'),guard=readFileSync('supabase/verify-access.sql','utf8');
await management('database/query',{query:`begin; ${installed[0]?.installed?'':migration}
savepoint identity_checks; ${checks} rollback to savepoint identity_checks; ${guard}
insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','chat_identity',array[$identity_migration$${migration}$identity_migration$]) on conflict(version) do nothing; commit;`,read_only:false});
const form=new FormData();form.append('metadata',JSON.stringify({name:'chat-push',entrypoint_path:'index.js',verify_jwt:false}));
for(const name of ['index.js','fcm.mjs','avatar.mjs'])form.append('file',new Blob([readFileSync('supabase/functions/chat-push/'+name)],{type:'application/javascript'}),name);
await management('functions/deploy?slug=chat-push',form);
const endpoint=`https://${ref}.supabase.co/functions/v1/chat-push`;
if((await fetch(endpoint,{method:'POST',body:'{}'})).status!==401)throw new Error('Anonymous sender access was not rejected');
if((await fetch(endpoint+'?avatar=00000000-0000-4000-8000-000000000001')).status!==403)throw new Error('Unsigned picture access was not rejected');
console.log('Chat display names and expiring notification pictures deployed. Synthetic checks rolled back; access guard passed.');
