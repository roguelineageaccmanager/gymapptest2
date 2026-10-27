// Fixed, bounded security checks. Never log config secrets, credentials or user rows.
import { readFileSync } from 'node:fs';
const ref = process.env.SUPABASE_PROJECT_REF, token = process.env.SUPABASE_ACCESS_TOKEN;
if (!/^[a-z]+$/.test(ref || '') || !token) throw new Error('Audit settings missing');
async function management(path, method = 'GET', body) {
  const multipart = body instanceof FormData;
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`, { method,
    headers: { Authorization: 'Bearer ' + token, ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Security operation failed: ${path.split('?')[0]} HTTP ${response.status}`);
  return response;
}
const auth = await (await management('config/auth')).json();
const publicFields = ['site_url','uri_allow_list','disable_signup','external_email_enabled','external_anonymous_users_enabled','mailer_autoconfirm','password_min_length','refresh_token_rotation_enabled','security_update_password_require_reauthentication'];
console.log('Auth configuration (safe allowlist only):', JSON.stringify(Object.fromEntries(publicFields.filter(key => Object.hasOwn(auth,key)).map(key => [key,auth[key]]))));
const guard = readFileSync('supabase/verify-access.sql','utf8');
await management('database/query','POST',{ query: `begin read only; ${guard}\nrollback;`, read_only: false });
console.log('Existing row-level access guard passed. No user records queried.');
if (process.env.APPLY_SECURITY_UPDATE !== 'true') process.exit(0);
const patch = {};
if (auth.external_anonymous_users_enabled === true) patch.external_anonymous_users_enabled = false;
if (Number(auth.password_min_length) < 8) patch.password_min_length = 8;
if (auth.refresh_token_rotation_enabled === false) patch.refresh_token_rotation_enabled = true;
if (Object.keys(patch).length) { await management('config/auth','PATCH',patch); console.log('Auth hardening applied:', JSON.stringify(patch)); }
else console.log('Anonymous sign-in, password minimum and refresh-token rotation need no change.');
const migration = readFileSync('supabase/migrations/20261027000000_security_web_push.sql','utf8');
const checks = readFileSync('tools/check-security-web.sql','utf8');
await management('database/query','POST',{ query: `begin; ${migration}\nsavepoint security_checks; ${checks}\nrollback to savepoint security_checks; ${guard}
insert into supabase_migrations.schema_migrations(version,name,statements) values('20261027000000','security_web_push',array[$security_web$${migration}$security_web$]) on conflict(version) do nothing; commit;`, read_only: false });
const form = new FormData(); form.append('metadata',JSON.stringify({ name:'chat-push',entrypoint_path:'index.js',verify_jwt:false }));
for (const name of ['index.js','fcm.mjs']) form.append('file',new Blob([readFileSync('supabase/functions/chat-push/'+name)],{type:'application/javascript'}),name);
await management('functions/deploy?slug=chat-push','POST',form);
const endpoint = `https://${ref}.supabase.co/functions/v1/chat-push?health=1`;
if ((await fetch(endpoint,{method:'POST',body:'{}'})).status !== 401) throw new Error('Anonymous sender request was not rejected');
const response = await fetch(endpoint,{method:'POST',headers:{'x-gym-push-key':process.env.CHAT_PUSH_WEBHOOK_KEY,'Content-Type':'application/json'},body:'{}'});
if (!response.ok || (await response.json()).ready !== true) throw new Error('Sender health check failed');
console.log('Bounded chat reads, expired-device cleanup, web push sender and synthetic access checks passed. Existing Firebase sender secret preserved; no new service-account keys.');
