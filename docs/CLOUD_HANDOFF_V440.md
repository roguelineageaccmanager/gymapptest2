# Gym Tracker v4.4.0 cloud continuation

The owner explicitly requested moving this work to cloud execution so it can continue with their Windows PC shut down. Continue the implementation and release from this branch. Do not rely on local computer files, browser sign-ins or credential stores. Do not expose/copy any secret, private backup, account email or fitness data into this public repository.

## Repository and baseline

- Repository: https://github.com/roguelineageaccmanager/gymapptest2
- Branch: codex/v4-4-profile-progress-polish (unfinished implementation).
- Production remains v4.3.1 build151, runtime merge e9062e17ed57c63f517a274a89e5c5b40201a4bf. Last main documentation commit9f18ad1.
- Read AGENTS.md, README.md, docs/PROJECT_MEMORY.md. This project is separate from unrelated German work. Do not edit synced project sources/ files.
- Static JS/CSS app, GitHub Pages /gymapptest2/ subpath, Android signed APK release via existing GitHub Actions. Supabase is the app backend; Firebase is only notifications. There is no build step for the web app.

## Authorized requirements

The user asked to finish and publish website/APK as v4.4.0. They amended the proposed plan to request full keyboard emojis instead of24 fixed reactions, progress-photo comments and the exercise-editor cleanup. They now explicitly request cloud continuation while the PC is off.

1. Weekly Plan: compact schedule, clearer day/workout alignment, routine initials, current-day highlight, clear Rest days; maintain existing schedule editing.
2. Bodygraph: cleaner Liftoff-inspired paired front/back figure and five distinct fingers per hand. Current geometry is licensed MIT muscle polygons plus an original silhouette. Do not claim access to Liftoff private source/assets or its scoring. Existing fixed Iron-to-Challenger palette and rank formula stay.
3. Progress reactions: all standard keyboard emojis, searchable/category picker and keyboard input (skin tones, flags, ZWJ families). Unicode17 catalog3953 fully-qualified/component entries and Unicode License v3 are vendored. Canonicalize omitted FE0F input to the catalog entry. Keep existing reactions and photo privacy.
4. Photo comments: only users who can view a photo may read/post comments. Only authors delete their own comments. Bounded cursor pagination30, proper text escaping, captured initiating auth session, account-switch cleanup, persistent failed draft/retry ID, themed keyboard-safe sheet. Server validates author/visibility/length and limits rate; photo/account deletion cascades. No raw fitness history sharing.
5. Leaderboard: fix .row.me width expansion and special32px avatar; equal widths, heights,40px avatars and banners for all rows, with a subtle own-row marker. Preserve top-three styling and clickable profiles.
6. Exercise editor: cleaner header/delete affordance, aligned sets/reps/rest controls and switches, notes and separate warm-up counts. Keep all values, left/right semantics, per-account settings and routine data intact.
7. All non-rank GUI backgrounds/text/borders respect user theme variables. Keep Body weight and exercise records in Analytics; removed Training analytics stays removed. Keep compact grouped chat from4.3.1.

## Work already written (NOT validated fully or released)

- Version files4.4.0; current cache hash generated with tools/sw-hash.mjs.
- New vendor/emoji-data.js (Unicode17), vendor/Unicode-LICENSE.txt, js/domain/emoji.js, js/ui/emoji-picker.js and js/ui/progress-comments.js.
- js/cloud/client.js + js/cloud/progress.js provide captured-session comment/reaction access. js/ui/progress.js renders dynamic reaction results and opens full picker/comments.
- New additive migration supabase/migrations/20261028000000_progress_comments.sql: private emoji catalog FK replaces six-value reaction constraint; public progress_comments RLS, private comment rate history, trigger author/viewer validation, bounded progress_photo_comments RPC. Existing routines/logs are not rewritten. Full access guard allowlist and schema snapshot updated.
- Generic supabase-deploy workflow deliberately excludes this migration, as it excludes earlier migrations: live project has unmatched legacy migration history. Do not blindly run supabase db push/repair or recreate/drop the database. Use an authorized checked one-migration deployment; if no authorized cloud database access is available, prepare exact SQL and report the access step required instead of claiming deployment.
- UI changes in plan.js, strength.js and app.css; new five-finger silhouette outline needs close visual review, not just a DOM label assertion.
- Existing invalid-emoji integration expectation adjusted from23514 to23503 (new catalog FK). Latest patch-note test updated. New features still need meaningful unit/integration/browser tests.
- Local ESLint and all114 existing unit tests passed on this initial draft. Database and browser checks have NOT run for4.4.0. Schema snapshot generated from28 migrations. Do not infer readiness from these early checks.

## Remaining work / review priorities

- Review and fix in-progress implementation before release; add emoji tests (ZWJ, skin tone, flags, keycaps, malformed/multiple/markup) and meaningful comment access/ownership/rate/pagination/account-switch/error/retry tests.
- Review the comments sheet loading/concurrency/paging behavior. A replace load invalidates old result tokens; load-more button must not remain disabled after loading. Ensure errors are visible, drafts survive errors, and fields/actions remain above the keyboard.
- Improve full emoji UI and paging/category/search as needed. Verify comment and reaction RPC header/result behavior, server FK permissions, existing-heart compatibility, nonfriend denial, author spoof rejection, own-only deletion, no editing grants, and no public access to private catalogs/rate tables.
- Visually inspect week, editor, front/back five-finger hands, leaderboard row/avatar equality, emoji picker and comment composer at320/393 phone widths and light/dark/custom themes. Do not use production accounts/messages/photos/workouts for tests.
- Run npm ci, npm run lint, npm test. Regenerate schema/cache when source changes. DB/browser tests need isolated local Supabase (CI has setup). Use existing required test/android-project PR checks; do not change branch protection or bypass runtime checks. No need to repeat unchanged tests unnecessarily.
- Commit all fixes to this branch and update/create its PR. Use connected authorized GitHub access; never obtain/export credentials from the owner's PC. If cloud has no GitHub write connection, finish work in the cloud workspace and retain a patch, clearly requesting only the necessary connection approval.
- Apply checked additive migration before publishing the client, only with authorized database tools. No Firebase/Google Cloud changes, billing upgrades, paid APIs or service-account JSON keys.
- Merge normally after required checks, publish Pages and signed APK with existing build-apk.yml. Verify published version/source and APK digest. Do not claim a release before it exists. Record final results in docs/PROJECT_MEMORY.md without any private user details.
- Earlier plan loss was fixed in4.2.1 (retired removeStockPresets, explicit loss-intent sync guard and owner-only revision backups). Never remove/replace routines as part of this UI work. No production data wipe is authorized for this update.

## Operation boundaries

The cloud task should actually use its cloud container, not the connected Windows executor. The PC's browser sign-ins do not transfer. If essential access requires the owner, ask one concise question in the cloud task and continue independent implementation/testing; do not invent access or claim background progress once blocked. No new paid infrastructure is authorized. Reply with concrete completion status and any genuinely remaining console action.
