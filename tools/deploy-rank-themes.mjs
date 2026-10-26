import { readFileSync } from 'node:fs';
const ref = process.env.SUPABASE_PROJECT_REF, token = process.env.SUPABASE_ACCESS_TOKEN;
if (!/^[a-z]+$/.test(ref || '') || !token) throw new Error('Deployment settings missing');
const migration = readFileSync('supabase/migrations/20261026000009_rank_theme_colors.sql', 'utf8');
const checks = readFileSync('tools/check-rank-themes.sql', 'utf8');
const guard = readFileSync('supabase/verify-access.sql', 'utf8');
const query = `begin; ${migration}\n${checks}\n${guard}
insert into supabase_migrations.schema_migrations(version,name,statements) values('20261026000009','rank_theme_colors',array[$rank_theme$${migration}$rank_theme$]) on conflict(version) do nothing; commit;`;
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, read_only: false }), signal: AbortSignal.timeout(120000) });
if (!response.ok) throw new Error('Rank theme validator deployment failed (HTTP ' + response.status + ')');
console.log('Existing and ranked themes accepted; invalid colors/tiers/finish/training settings rejected. Existing access guard passed. No user data changed.');
