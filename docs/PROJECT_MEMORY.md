# Gym app project memory

Last updated: 2026-10-25 (Europe/Vienna).

## Scope and working agreement

- Repository: https://github.com/roguelineageaccmanager/gymapptest2
- This gym app is a separate project from unrelated German work. Keep its context independent.
- The user wants the app files to be readable and editable, and durable working context kept with this repository.
- Store confirmed requirements, decisions, progress, and remaining work here so future sessions can continue by reading this file. This is a maintained project record, not a copy of account-wide memory or a complete chat transcript.

## Baseline inspected

- Starting commit: `4be0ecd` (Improve mobile stats, friends, and leaderboards).
- App version: 3.1.0, confirmed in `js/version.js` and `Version`.
- Offline-first workout tracker with a web app and Android packaging; accounts, sync, friends, leaderboards, and gym dates.
- Page shell: `index.html`; styling: `css/app.css`; entry point: `js/main.js`.
- Code is organized under `js/core/`, `js/domain/`, `js/ui/`, and `js/cloud/`.
- Supabase database migrations live in `supabase/migrations/`; deployment and Android workflows live in `.github/workflows/`.
- Existing references: `README.md` for current setup and development; `docs/HANDOVER.md` for the earlier handover; `docs/REVIEW.md` for historical findings. Live deployment, migration, and signing status have not been independently verified in this session.

## Validation and development

- The app has no build step. npm supplies development and test tools.
- Standard checks: `npm run lint` and `npm test` after `npm ci`.
- Database and browser tests require a local Supabase instance. See README for prerequisites; do not point these tests at production.
- Run `npm run sw-hash` after changing assets loaded by the app. Database changes require `npm run schema`. Version changes must follow the README's consistency rules.

## Work completed on 2026-10-25

- Downloaded the repository into the local project workspace and inspected its structure and existing documentation.
- Added repository instructions in `AGENTS.md` and this durable project record.
- No app behavior changed. Application tests were not run for these documentation-only additions.

## Next work

- No specific app change has been requested yet.
- Update this record as requirements and implementation decisions are confirmed.
