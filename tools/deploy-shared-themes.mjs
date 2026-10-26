// Fixed additive migration + rolled-back synthetic RLS checks. No data export.
import { readFileSync } from 'node:fs';
const ref = process.env.SUPABASE_PROJECT_REF, token = process.env.SUPABASE_ACCESS_TOKEN;
if (!/^[a-z]+$/.test(ref || '') || !token) throw new Error('Shared theme deployment settings are missing.');
const migration = readFileSync('supabase/migrations/20261026000001_shared_themes_security.sql', 'utf8');
const checks = readFileSync('tools/check-shared-themes.sql', 'utf8');
const query = `begin; ${migration}\nsavepoint theme_checks; ${checks}\nrollback to savepoint theme_checks;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261026000001','shared_themes_security',array[$picture_migration$${migration}$picture_migration$]) on conflict (version) do nothing;
commit;`;
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, read_only: false }), signal: AbortSignal.timeout(120000),
});
if (!response.ok) {
  // The query contains public setup SQL only; do not print the API response.
  throw new Error(`Shared theme migration or access checks failed (HTTP ${response.status}).`);
}
console.log('Shared theme schema and owner/friend/stranger access checks passed. All synthetic test data rolled back.');
