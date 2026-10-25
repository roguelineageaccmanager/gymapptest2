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
- Added exercise-specific labels to the moved Left/right switches; the existing Undo/focus regression test passed locally after that correction.
- Full run 40195870543 passed 154/155 browser scenarios, lint, unit tests, database tests, and Android project setup. The sole failure was light-theme live-status contrast. Reusing the theme's readable accent text and soft background fixed it; that exact contrast test then passed locally.
- Published **Tracker v3.4.0 (build 74)** from commit `c22b76f` through APK workflow 40197430836. Build, signing, signature verification, and publication succeeded. Downloaded the APK and verified its GitHub checksum, bundled version, future-workout preview code, and custom leaderboard screen. The live website also serves v3.4.0.
- APK SHA-256: `a864e2eb347378b3e5415648f31b9fb3155b6d179fcb9e0e05961c0ce1e73fd8`.
- Latest-weight sharing turns on for each account when that person opens/syncs the updated app. No private SQL was exported and no schema migration was applied.
- Full validation rerun 40197429795 passed all 155 browser scenarios as well as lint, unit/database tests and Android project setup. Its automatic release also published build 75 from the same `c22b76f` code. Optional Android emulator tests were not run.

## v3.4.1 visual corrections (2026-10-25)

- User disliked the tall separate Today tiles and oversized Train anyway button. Replaced the week with a compact unified strip, retaining completed-only white days and editable badges. Train anyway is a compact neutral button again.
- Clarified intent: text colors should be editable, including gray buttons. Removed the dedicated Train anyway background picker; added a general Button text color. Custom Main text also colors muted/dim labels.
- Bottom navigation highlight now includes icon and label. Friends section tabs use compact rounded cards instead of the pill/underline style. Own leaderboard highlight is a thin small avatar ring instead of an outline around the full row.
- Reproduced the Stats square in the live app: it was the browser's SVG focus outline, not the previously removed tooltip. Explicitly suppress that outline, use the round selected marker for focus, update selected value/date in each card header, and move lift Best values below the graph.
- Added Body weight leaderboard using existing accepted-friend summaries, latest weigh-in, heaviest first. No database migration required.
- Local lint and all 85 unit tests passed; focused phone-browser tests passed chart/header/focus behavior, podium/body-weight category selection, and compact button size/custom text persistence. Publication pending.

## Shared appearance controls — v3.4.2 (2026-10-25)

- User requested customizable backgrounds for settings/edit/share buttons, Friends/leaderboard controls, selected controls, weight input, sets/reps/notes fields, and workout-letter badges. Added shared Button backgrounds, Selected controls, Selected text, Input fields and set controls, and Workout letter badges pickers. Existing Button text and Main text remain available.
- Colors apply through validated shared CSS variables and persist with the other device appearance settings. Reset custom colors clears all new overrides. Selected and badge colors receive automatic contrasting text unless explicitly overridden.
- Removed the Workout / exercises / sets summary above the routine editor title; keep its title and action buttons.
- Fixed the startup green flash: the pre-paint theme script restores saved text/control colors and the loading label uses Main text instead of the default accent.
- Local lint and all 85 unit tests passed. All seven focused phone-browser scenarios passed, including all requested control groups and pre-initialization loading-text color. Also fixed a CI test selector to exclude a previously closed leaderboard sheet during its closing animation; the previous run had 155/156 scenarios passing, with only that ambiguous selector failing.
- No database migration or permissions change is needed. Publication and full verification pending.

### v3.4.2 publication

- Published source `abd9fa5a6c3fd331a7d31713a2105646f1dc8ce9` to main. GitHub Pages deployment 40210980575 succeeded; live version and early saved-color restoration were retrieved and verified.
- APK workflow 40210985724 built, signed and published **Tracker v3.4.2 (build 79)**. Downloaded the release APK, matched its SHA-256 to GitHub's asset digest, and checked the bundled app version, theme boot script and customization settings.
- Verified APK SHA-256: `a7cd96aaf3bac07be06cd7ad504f824a5bbd826d72002130059d3ef2d856021b`.
- Local lint, schema snapshot consistency, all 85 unit tests and all seven focused phone-browser scenarios passed. A visual review confirmed the new appearance controls and round swatches. The broader database-dependent browser suite runs in CI; it cannot run under the offline local review configuration.

## Account appearance and calendar — v3.5.0 (2026-10-25)

- User confirmed v3.4.2 works and requested these next changes without waiting for lengthy unrelated checks: remaining background gaps, streaks on Stats/Friends, smaller chart ring, a better Today week calendar, and settings saved per account.
- Navigation selection now paints on the button itself (the old negative-layer background sat behind the navigation bar). Shared button backgrounds also apply to streaks and routine badges, unless their specific colors override them. Added a separate Streak background setting; selected controls/navigation share their selected color.
- Added compact streak pills beside Settings on Stats and Friends. Reduced chart ring radius from 7 to 4 and stroke from 3 to 1.6; invisible touch targets remain large.
- Redesigned Today week as a rounded card with a date range, three-letter weekday labels, spaced columns, small workout badges and a clear current-day outline. Only completed days have a white fill; existing direct-start/future-preview behavior is unchanged.
- Settings now save in the existing authenticated account metadata field `tracker_preferences`. Preferences have a separate local cache per account and per-setting edit times, including reset tombstones. Old device choices seed an account only during first adoption and do not overwrite newer saved choices. Switching or merging workouts never copies appearance settings into a different account; sign-out returns to default guest appearance. Rest pictures retain their existing plan sync.
- Preference requests use the session token captured at the start, so an in-flight request remains bound to its original account. Incoming responses cannot apply to another account. Settings restored from a backup are recorded as current edits. No database migration or access-policy change.
- Local lint, schema consistency, all 90 unit tests and all 11 focused phone-browser scenarios passed. Added two real-account CI scenarios covering two-device preferences, offline updates, reset propagation and account switching. Visual review saved locally; publication pending.

### v3.5.0 publication

- Published source `19cd142a903e3ade264bfaf5739954fce0ec6c1a`. Pages deployment 40212873389 succeeded; retrieved the live v3.5.0 version and account-preference module.
- APK workflow 40212881903 built, signed and published **Tracker v3.5.0 (build 81)**. Downloaded it and verified its GitHub asset digest, bundled version, account preference module/service and redesigned Today calendar.
- APK SHA-256: `18e93ac268eea4985e2d2208294b4002b82ce929173f7c7d8051e26f6cabac2e`.
- Local verification: lint, schema consistency, 90 unit tests, 11 targeted mobile scenarios and two existing light-theme/loading regressions passed. Full CI run 40212873900 is still running; the two real-account scenarios are included there. User explicitly asked not to wait through the lengthy full run after the prior version worked, so publication was verified without holding the turn for that run.
- Previous v3.4.2 full run 40210981493 finished successfully and automatically published identical source as build 80 after manual build 79.
- Website: https://roguelineageaccmanager.github.io/gymapptest2/
- APK: https://github.com/roguelineageaccmanager/gymapptest2/releases/download/latest/rat-tracker.apk

## Live appearance preview — v3.5.1 (2026-10-25)

- User selected recommendation 1 only: simplify customization with a live visual preview. No progression suggestions or calendar features added in this change.
- Appearance now includes a compact preview of a workout badge/title, streak, edit button, input field, and selected navigation tab. It stays beneath the Settings header while scrolling the appearance section; short screens use a normal non-sticky layout.
- Samples share the real component color rules but use separate display-only classes, so navigation routing, keyboard focus and actual workout actions cannot affect them.
- Native color-picker input events update the preview immediately, including automatic contrast and shared badge/streak fallbacks. Only the existing change handlers save to the account; leaving/canceling a picker clears unfinished preview overrides. Theme presets, reset and confirmed changes render using the actual saved theme.
- Validation: lint and 90 unit tests passed. The 11 existing mobile checks and both new preview scenarios passed; a new test's attribute-presence assertion was replaced with checks of empty inline styles and restored visible color. Covered each custom color, transient versus committed edits, reset/reload, read-only samples and phone overflow. Visual review saved locally.
- Publication pending. Previous full v3.5.0 CI run was still running when checked; no claim of completion.
