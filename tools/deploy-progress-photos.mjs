// Apply only this public additive migration. Never export private database data.
import { readFileSync } from 'node:fs';
const ref = process.env.SUPABASE_PROJECT_REF, token = process.env.SUPABASE_ACCESS_TOKEN;
if (!/^[a-z]+$/.test(ref || '') || !token) throw new Error('Banner deployment settings are missing.');
const migration = readFileSync('supabase/migrations/20261026000007_progress_photos.sql', 'utf8');
const checks = readFileSync('tools/check-progress-photos.sql', 'utf8');
const guard = readFileSync('supabase/verify-access.sql', 'utf8');
const query = `begin; ${migration}\nsavepoint banners_checks; ${checks}\nrollback to savepoint banners_checks; ${guard}
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261026000007','progress_photos',array[$banners_migration$${migration}$banners_migration$]) on conflict (version) do nothing;
commit;`;
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, read_only: false }), signal: AbortSignal.timeout(120000),
});
if (!response.ok) throw new Error(`Banner migration or access checks failed (HTTP ${response.status}).`);
console.log('Banner chat/theme sharing and access checks passed. Every synthetic test row was rolled back.');
