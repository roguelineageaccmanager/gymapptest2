// Only the fixed additive chat notification migration and notification-only secrets.
import { readFileSync } from 'node:fs';
const ref = process.env.SUPABASE_PROJECT_REF, access = process.env.SUPABASE_ACCESS_TOKEN;
const firebase = process.env.FIREBASE_SERVICE_ACCOUNT, webhook = process.env.CHAT_PUSH_WEBHOOK_KEY;
if (!/^[a-z]+$/.test(ref || '') || !access || !/^[a-f0-9]{64}$/.test(webhook || '')) throw new Error('Notification deployment settings missing');
const service = JSON.parse(firebase || '{}');
if (service.project_id !== 'test-2612b' || service.client_email !== 'gym-tracker-chat-push@test-2612b.iam.gserviceaccount.com') throw new Error('Unexpected notification sender');
async function management(path, body, multipart = false) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + access, ...(multipart ? {} : { 'Content-Type': 'application/json' }) },
    body: multipart ? body : JSON.stringify(body), signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Notification deployment failed at ${path.split('?')[0]} (HTTP ${response.status})`);
  return response;
}
// Secrets go directly to the server vault; never printed or placed in function source.
await management('secrets', [{ name: 'FIREBASE_SERVICE_ACCOUNT', value: firebase }, { name: 'CHAT_PUSH_WEBHOOK_KEY', value: webhook }]);
const form = new FormData();
form.append('metadata', JSON.stringify({ name: 'chat-push', entrypoint_path: 'index.js', verify_jwt: false }));
for (const name of ['index.js', 'fcm.mjs']) form.append('file', new Blob([readFileSync('supabase/functions/chat-push/' + name)], { type: 'application/javascript' }), name);
await management('functions/deploy?slug=chat-push', form, true);
const migration = readFileSync('supabase/migrations/20261026000008_chat_push.sql', 'utf8');
const installed = await (await management('database/query', { query: "select exists(select 1 from supabase_migrations.schema_migrations where version='20261026000008') as installed", read_only: true })).json();
const checks = readFileSync('tools/check-chat-push.sql', 'utf8');
const guard = readFileSync('supabase/verify-access.sql', 'utf8');
const endpoint = `https://${ref}.supabase.co/functions/v1/chat-push`;
const sqlString = value => "'" + value.replaceAll("'", "''") + "'";
const query = `begin;
${installed[0]?.installed === true ? '' : migration}
savepoint push_checks;
${checks}
rollback to savepoint push_checks;
${guard}
select vault.create_secret(${sqlString(endpoint)},'gym_chat_push_url') where not exists(select 1 from vault.secrets where name='gym_chat_push_url');
select vault.update_secret(id,${sqlString(endpoint)}) from vault.secrets where name='gym_chat_push_url';
select vault.create_secret(${sqlString(webhook)},'gym_chat_push_key') where not exists(select 1 from vault.secrets where name='gym_chat_push_key');
select vault.update_secret(id,${sqlString(webhook)}) from vault.secrets where name='gym_chat_push_key';
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('gym-chat-push-retry','* * * * *','select private.maintain_chat_push()');
insert into supabase_migrations.schema_migrations(version,name,statements) values('20261026000008','chat_push',array[$push_migration$${migration}$push_migration$]) on conflict(version) do nothing;
commit;`;
await management('database/query', { query, read_only: false });
const unauthorized = await fetch(endpoint, { method: 'POST', body: '{}' });
if (unauthorized.status !== 401) throw new Error('Notification sender did not reject unauthenticated access');
const health = await fetch(endpoint, { method: 'POST', headers: { 'x-gym-push-key': webhook, 'Content-Type': 'application/json' }, body: '{}' });
if (!health.ok) throw new Error('Notification sender health check failed (HTTP ' + health.status + ')');
console.log('Chat notification sender deployed. Anonymous access rejected; authenticated sender health passed. Synthetic access checks rolled back.');
