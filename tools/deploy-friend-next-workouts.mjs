// Fixed additive migration + rolled-back synthetic RLS checks. No data export.
import { readFileSync } from 'node:fs';
const ref = process.env.SUPABASE_PROJECT_REF, token = process.env.SUPABASE_ACCESS_TOKEN;
if (!/^[a-z]+$/.test(ref || '') || !token) throw new Error('Friend next workout deployment settings are missing.');
const migration = readFileSync('supabase/migrations/20261026000002_friend_next_workouts.sql', 'utf8');
const checks = readFileSync('tools/check-friend-next-workouts.sql', 'utf8');
const query = `begin; ${migration}\nsavepoint next_checks; ${checks}\nrollback to savepoint next_checks;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261026000002','friend_next_workouts',array[$picture_migration$${migration}$picture_migration$]) on conflict (version) do nothing;
commit;`;
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, read_only: false }), signal: AbortSignal.timeout(120000),
});
if (!response.ok) {
  // The query contains public setup SQL only; do not print the API response.
  throw new Error(`Friend next workout migration or access checks failed (HTTP ${response.status}).`);
}
console.log('Friend next workout schema and owner/friend/stranger access checks passed. All synthetic test data rolled back.');
