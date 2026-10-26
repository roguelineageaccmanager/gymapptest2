// Apply only this public additive migration. Never export private database data.
import { readFileSync } from 'node:fs';
const ref = process.env.SUPABASE_PROJECT_REF, token = process.env.SUPABASE_ACCESS_TOKEN;
if (!/^[a-z]+$/.test(ref || '') || !token) throw new Error('Community deployment settings are missing.');
const migration = readFileSync('supabase/migrations/20261026000003_community.sql', 'utf8');
const checks = readFileSync('tools/check-community.sql', 'utf8');
const guard = readFileSync('supabase/verify-access.sql', 'utf8');
const query = `begin; ${migration}\nsavepoint community_checks; ${checks}\nrollback to savepoint community_checks; ${guard}
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261026000003','community',array[$community_migration$${migration}$community_migration$]) on conflict (version) do nothing;
commit;`;
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, read_only: false }), signal: AbortSignal.timeout(120000),
});
if (!response.ok) throw new Error(`Community migration or access checks failed (HTTP ${response.status}).`);
console.log('Community chat/theme sharing and access checks passed. Every synthetic test row was rolled back.');
