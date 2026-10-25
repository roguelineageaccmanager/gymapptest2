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

## PR #9 release work (2026-10-25)

- User authorized merging PR #9 and publishing all its changes as an updated Android APK.
- PR #9 raises the version to 3.3.0 and changes the mobile UI, theme controls, weight entry, Friends controls, and chart selection. It also corrects the generated schema snapshot; no live database migration is included.
- Release preparation restored the missing `renderCrew` export (required by `js/main.js`), removed a duplicate card-color handler, and corrected Friends help text after the add-friend control moved out of Settings.
- Regenerated the service worker hash. Local lint and all 85 unit tests passed.
- GitHub passed lint, all 85 unit tests, the database tests, and the Android project check. Browser run 40188523546 passed 150 of 151 scenarios; the remaining scenario pressed Right from Gym dates but expected Friends, which is on its left. Corrected that direction and removed redundant Crew keyboard handling in favor of the existing shared arrow-key handler.
- Local phone-browser validation passed startup, all five tabs, Settings and color controls, and Friends keyboard navigation (Left, Home, End and focus preservation), with no page errors. Lint and all 85 unit tests passed after the correction.
- PR #9 merged into main at `a2a96bae79741b0945dd233789ea28a0bf74e951`. GitHub Pages deployment 40189807029 succeeded; the live website was verified to serve version 3.3.0.
- Main release test run 40189807745 succeeded: lint, all 85 unit tests, database tests, all 151 phone-browser scenarios, and the Android project check. The optional Android emulator suite was not run.
- APK workflow 40191068823 successfully built, signed, verified, and published **Tracker v3.3.0 (build 70)** from merge commit `a2a96ba` on 2026-10-25. The previous release was v3.1.0 (build 67).
- Download: https://github.com/roguelineageaccmanager/gymapptest2/releases/download/latest/rat-tracker.apk
- Release page: https://github.com/roguelineageaccmanager/gymapptest2/releases/tag/latest
- Downloaded the published APK and verified its checksum against GitHub's asset digest and its bundled `assets/public/js/version.js` against version 3.3.0.
- APK SHA-256: `8d9a88a54b033d97f0449728dfe0d668c39d70322e2191898e1b83d7945e3f14`.
- PR #9 and its APK publication are complete. No additional app change is currently requested.

## Mobile UI refresh — v3.4.0 (2026-10-25)

- User authorized editing GitHub and the database and publishing the fixes. The ordered plan is in `docs/UI_CHANGE_PLAN.md`.
- Confirmed: remove Settings Privacy card; latest weight stays visible to accepted friends; future routines open faded read-only workout screens with no Start button; Today's date sits below its heading.
- Settings: round color swatches, border color and dedicated Train anyway color. Blocked-account controls remain under Blocked people.
- Today: fitted rest image, larger Rest day text, right-aligned themed button, completed-only white week tiles, editable routine badges. Badges are device appearance preferences (1–3 characters), included in backups and preserved on routine rename.
- Plan: Left/right switch moved beside the exercise name near Delete. Calendar/Plan headers show title, streak and Settings. Calendar's Jump to today remains below its header.
- Stats: removed floating selection box and permanent best ring; one white selection ring follows the clicked point, with plain date/value text.
- Friends: full-row gold/silver/bronze highlights, separate own-row outline, custom leaderboard picker, theme-colored gym dates, no automatically opened keyboard in routine sharing/copying dialogs.
- Today starts new workouts immediately. Future previews disable every editing control and do not write logs/drafts or replace a running timer.
- The initial migration for weight sharing could not deploy: the live database records older migration `20261025061802`, missing from GitHub. No new migration was applied. Automatic approval review blocked exporting the missing private SQL to a GitHub artifact, so the diagnostic workflow was discarded without being pushed or run.
- Final approach: account sync turns on the existing `share_weight` flag through the owner's existing authenticated API when each user loads v3.4.0. It retries on later syncs if needed. No database schema/history change is required; accepted-friend checks and owner-only histories stay in force. The unapplied migration was removed and the schema snapshot regenerated.
- Local lint and all 85 unit tests passed. Local phone-browser checks passed the six existing offline flows and four focused scenarios covering safe future previews, badge persistence/rename, movable chart selection, and podium/category selection. Updated existing tests to match direct-start and removed weight-toggle behavior.
- Publication and full CI/database validation are pending.
