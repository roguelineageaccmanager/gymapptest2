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

### v3.5.1 publication

- Source `1882253d268609b35e05b413839e3dd043934508` published to main. Pages deployment 40214249920 succeeded; retrieved and verified live version 3.5.1 and preview code.
- APK workflow 40214258941 published **Tracker v3.5.1 (build 83)**. Downloaded the APK, matched its asset digest, and verified bundled version, preview markup and styles.
- APK SHA-256: `7b238aabdf6c264931536a8d1d122d6bd04d6e48ecc5c8bdcf34878178b8b062`.
- The older automatic v3.5.0 duplicate build 82 was canceled during its build stage to let the requested preview release proceed; the existing build 81 release stayed available.
- Previous v3.5.0 full CI run 40212873900 completed successfully, including real-account preference scenarios. Preview full run 40214249117 continues in GitHub; local lint, 90 unit tests and all 13 focused mobile scenarios passed. Website and signed APK publication are complete.

## Settings cleanup — v3.5.2 (2026-10-25)

- User requested an anchored preview, a working bottom-tab highlight color, ordered settings and removal of verbose explanatory copy.
- Replaced the sticky preview with a measured fixed-position preview while scrolling its Appearance section. A reserved slot prevents layout jumps; it follows the real header and viewport width and releases after leaving Appearance. The phone test verifies the same screen position across scrolling.
- Added a separate Bottom navigation group with Highlight and Icon and text colors. These use dedicated `navColor`/`navTextColor` settings, saved per account, restored at startup and reflected in the preview. All five actual tabs use the new colors. Defaults now use the exact accent fill and matching text ink shown in the picker, avoiding a default lime swatch paired with a faint tint.
- Appearance order: Theme; Theme color; Screen; Buttons and fields; Bottom navigation; Workout and streak; Reset. Color rows align in a grid, with one column on narrow phones.
- Removed the preview subtitle/sample explanation, picker instructions, shared-color paragraph, training weight paragraph, backup introduction, sign-in introduction, username advice, leaderboard introduction and contrast explanation. Action labels, empty states, errors, account consent and destructive-action explanations remain.
- Local lint and 90 unit tests passed. All 15 targeted mobile scenarios passed, plus three theme regressions. Rechecked the anchored preview, dedicated navigation persistence and the existing full appearance/contrast flow after the final default-color correction. A visual review confirmed grouped controls and fixed anchoring.
- Publication pending.

### v3.5.2 publication

- Source `cb71fdb41691ab67ba5f5786cc7f37430e76c325` published to main. Pages deployment 40215579459 succeeded; live version, grouped navigation settings and removal of the requested training copy verified.
- APK workflow 40215584674 published **Tracker v3.5.2 (build 84)**. Downloaded the APK and verified the bundled version, navigation controls, fixed-preview CSS and matching GitHub asset digest.
- APK SHA-256: `16042292f75d4c2c20eba057d05f402c579a2b790771e065f528b1b0ebb40854`.
- Previous v3.5.1 full CI run 40214249117 completed successfully. Current full run 40215579598 continues in GitHub. Local lint, all 90 unit tests, 15 mobile scenarios and theme/appearance regressions passed; publication is complete.

## UI polish — v3.6.0 (2026-10-25)

- User authorized the suggested UI improvements: fewer boxes, calmer default surfaces, consistent spacing/radii, clearer Today hierarchy, expandable appearance groups with preview only during customization, and consistent Friends styling.
- Removed decorative cards around page headers while preserving the pinned editor/Settings header. Increased space between headings and content; section titles use natural case. Routine library items are now separated rows instead of a card per routine; Stats totals form one divided strip.
- Today keeps the week calendar first and a neutral workout card with a smaller natural-case title and one prominent action. Exercise names are plain separated text instead of individual pills. Upcoming starts at seven compact rows, with smaller rest thumbnails, and expands in bounded batches up to 56 days.
- Friends sections use consistent 44px tabs, shared radii, neutral default surfaces and a clear selection marker. Quick-date cards are neutral; gym dates retain the chosen accent on their edge and live status treatment. Explicit saved colors continue to override defaults.
- Appearance color groups are native keyboard-accessible expandable sections, initially collapsed. Their open state survives Settings re-renders during the visit. Opening a section reveals the live anchored preview; closing the last section hides it. Existing color settings and per-account sync remain unchanged.
- Validation: local lint, cache/schema consistency, all 90 unit tests, all 17 targeted mobile scenarios and three existing theme/appearance regressions passed. Manually reviewed Today, Plan and collapsed Settings. A temporary local-only Sunday assignment used for the Today screenshot was restored; no live account data changed.
- Publication pending.

### v3.6.0 publication

- Source `2d587bdfafd19888ae6d3f5c320ea9722709b8cc` published to main. Pages deployment 40216546975 succeeded; retrieved live version and expandable appearance markup to verify deployment.
- APK workflow 40216552831 published **Tracker v3.6.0 (build 86)**. Downloaded the APK, matched its GitHub asset digest, and verified bundled version, expandable settings, seven-day upcoming default and updated stylesheet.
- APK SHA-256: `13611c9517b6d6668bc19d458818fa5a5230d59f90d617f8095c3ea57dc7a288`.
- Workflow guard commit `e404281` now skips automatic APK builds if the tested commit is no longer the default-branch tip. This prevents late checks for an older release from overwriting a newer manual APK. Manual publication remains available; no signing/security configuration changed.
- Local lint, cache/schema consistency, 90 unit tests, 17 focused mobile scenarios and three theme regressions passed. Full UI CI run 40216546927 continues in GitHub. Website and signed APK publication are complete.

## Today weekly planner redesign — v3.6.1 (2026-10-25)

- User requested a complete replacement of the Today “This week” strip after several earlier compact grid designs.
- Replaced the seven narrow columns and enclosing card with a horizontal, swipeable seven-day planner. Each day shows weekday, large date, editable workout initials, full workout name and a useful status (Today, Planned, Done or Bypass). Rest cards show Rest day once; gym dates have a people marker.
- Completed days remain white. Today has an accent edge and status; rest days are quieter transparent cards. Existing custom badge, text, border and selection colors remain active. The header shows the date range and completed count when nonzero.
- The rail opens around today once per day and retains the user's scroll position across background re-renders. Native horizontal scrolling is isolated from page-swipe navigation. Earlier/Later controls and ArrowLeft/ArrowRight/Home/End keyboard navigation provide alternatives to swiping. Controls expose disabled states at the ends without dropping keyboard focus.
- Existing day taps still start today's workout directly, open future read-only previews and open past-day details. No schedule/log/account behavior changed.
- Local lint, cache/schema checks, 90 unit tests and all 19 focused mobile scenarios passed. Re-ran the white-completed-day, full-workout-name/direct-start and arrow/keyboard/scroll-retention checks after the final styling. Visual review used a temporary local-only Sunday assignment, restored afterward; no live account data changed.
- Publication pending.

### v3.6.1 publication

- Source `78719ddc44e34de99f150ad45235b3d7565845ce` published to main. Pages deployment 40217535007 succeeded; live version and weekly navigation code retrieved and verified.
- APK workflow 40217541424 published **Tracker v3.6.1 (build 88)**. Downloaded the APK, verified its GitHub asset digest and checked the bundled version, planner controls and new day-card stylesheet.
- APK SHA-256: `b5e0920946ef58de18555b52cade04e464de2c8fb2d39097f9cca975c34d4cbe`.
- Local lint, cache/schema consistency, 90 unit tests and all 19 mobile scenarios passed. Full run 40217535101 continues in GitHub. Website and signed APK publication are complete.

## Restore the original week strip — v3.6.2 (2026-10-25)

- User rejected the v3.6.1 day-card carousel. They recalled the older circles and dash markers, and explicitly asked to inspect old code and restore that version if found.
- Found the exact original `weekStripHTML` and `.wk-dot` styles in the pre-module `index.html` at commit `e863676a1fa81457d738151271b206e52b5ded6e` (parent of the app rebuild `6f2f610`). It used weekday initials, an outlined circle on planned days, a dash on rest days, an accent-filled checkmark on completed days, and an accent ring/letter for today.
- Restored that visual design in the current module structure. Removed week cards, dates, full workout names, scrolling/arrows, extra heading and week initials badges. All seven days fit in one row. Existing day taps, future-preview safeguards, account settings, saved routine badges in Plan, and the rest of the app remain intact.
- This confirmed restoration supersedes the earlier requests for white completion tiles and workout initials in the week display. Completed circles follow the chosen theme as the original did. No full-repository rollback or data change.
- Validation: local lint, 90 unit tests, direct-start/future-preview safety, routine badge persistence in Plan, and a dedicated original-week scenario passed. Checked seven visible circles, empty planned circles, rest dashes, completed checks and the current-day marker. Visual review matched the recovered original CSS/markup.
- Publication pending. Ask for a concrete reference before attempting another unsolicited redesign of this component.

### v3.6.2 publication

- Source `6ad0e2032e877760e6d9681339dcdefdfb156cc9` published to main. Pages deployment 40218693753 succeeded; live original circle markup, absence of carousel controls and version 3.6.2 verified.
- APK workflow 40218699264 published **Tracker v3.6.2 (build 90)**. Downloaded and verified the bundled original week markup/styles, app version and GitHub asset digest.
- APK SHA-256: `8408237a155862aa484aed6767846f561992fb4bdbcce768f20de783485a23ba`.
- Local lint, all 90 unit tests and the three focused original-week/badge/session safety scenarios passed. Full CI run 40218694163 continues in GitHub. Original week restoration is published on web and APK.

## Week style choice and dash highlight — v3.6.3 (2026-10-25)

- User requested a dash-shaped highlight for today's rest day instead of a circular outline, and a Settings choice between the restored circles/dashes and the earlier compact box layout.
- Circle mode keeps rest-marker borders transparent, including today and bypass days. Today's dash uses the accent color and a heavier stroke; planned days retain circles and completed days retain checked circles.
- Settings → Appearance → This week style offers Circles and dashes (default) and Boxes. Boxes restores the compact seven-column date/initial layout from `2d587bd`, not the rejected scrolling day-card carousel. Completed box days are white. Both layouts keep existing taps and future-preview safeguards.
- `weekStyle` is a validated account setting, included in the existing timestamped preference sync and backups. Choosing a style persists across refresh; Reset custom colors does not reset the style.
- Local lint, cache consistency, all 91 unit tests and four focused browser scenarios passed, covering default circles, dash border/contrast, both style choices and reload persistence, and safe future previews. Visually checked both layouts in the local app and returned the local review to circles. No live account data changed.
- Publication pending.

### v3.6.3 publication

- Source `ae6f43194583406492b0b02113da083e4c2a0d32` published to main. Pages run 40219491944 succeeded and the live version/style selector was verified.
- APK run 40219497042 completed and published Tracker v3.6.3 (build 92), confirmed through the release API. Superseded by the following release work.

## View, confirmed start and cancel workout - v3.6.4 (2026-10-26)

- User requested a Cancel workout button, a simpler Today card showing the workout name without exercise/sets/duration previews, and View workout leading to the workout screen with confirmed Start workout.
- Today's unlogged workout card now shows its name and View workout (Resume workout while running). Week-day taps and Train anyway also open without automatically starting. Future previews remain read-only with no start action.
- Start workout asks for confirmation before running its timer, including other entry points. Replacing another running workout retains the existing replacement confirmation. Repeated starts are guarded; ticking a set no longer starts the timer implicitly.
- Cancel workout is available for unfinished sessions. Its confirmation stops only that session's timer, removes only its draft and closes the screen. It preserves saved history, other drafts and any other running workout. Closing/back continues preserving an unfinished workout as before. Saved sessions show Save changes and no Cancel workout action.
- Updated existing browser scenarios to explicitly view and confirm start. Local lint, schema/cache consistency, 91 unit tests, five focused mobile scenarios and two core offline scenarios passed. A stronger cancellation check verified existing saved history and an unrelated draft survive. Publication pending.

### v3.6.4 publication

- Source `4100a85dada938585ecd1473952a099a50b16336` published to main. Pages run 40269619480 succeeded; live version 3.6.4, View workout and confirmed Start/Cancel code retrieved and verified.
- APK workflow 40269621903 published Tracker v3.6.4 (build 95). Downloaded the APK, matched GitHub's asset digest and verified bundled version, Cancel workout and View workout changes.
- APK SHA-256: `ab1de5c140cfb1ab77972ea27a460b6be9b596ff395c576547f6d318aa29c55c`.
- Phone layout visually checked after transitions settled: Start and Cancel are visible within the viewport. Local lint, schema/cache checks, 91 unit tests, five focused mobile scenarios, stronger history/unrelated-draft cancellation verification and two core offline flows passed. Full CI 40269619445 continues separately. Website and signed APK publication complete.

## Short, tappable update notice - v3.6.5 (2026-10-26)

- User requested that update notifications only say New update available and open Settings at the install/update controls when tapped, without version numbers or explanatory copy.
- Unified web, service-worker and Android update offers under that short title. The entire notification text is a button; tapping opens Settings, scrolls the update section into view and focuses its action. Tapping the notice never installs or reloads directly.
- A running workout closes to its preserved draft when opening the update section. Installation/reload still requires the existing Settings button. Exceptional reinstall/recovery instructions remain available where needed.
- Added non-Undo toast actions without Ctrl/Cmd+Z binding; background update actions still wait behind Undo/errors/dialogs. Existing Undo shortcuts remain unchanged.
- Local lint and 91 unit tests passed. Update navigation, focus/visibility, shortcut safety, busy button and Android reinstall recovery checks verified. Publication pending.

### v3.6.5 web publication

- Source `223c2d8e5615ddcad106e36acd606915a2ab96e1` published; Pages run 40271401377 succeeded. APK run 40271403966 (build 97) was building when the user requested the follow-up below. The following release includes the short update notice.

## Require Start before completion controls - v3.6.6 (2026-10-26)

- User reported that merely viewing a workout could say Workout kept, and asked to disable set completion until Start and show Cancel only after the workout starts.
- New/today workout completion checkboxes stay disabled until confirmed Start. They enable immediately when the timer starts, including resumed workouts. Saved and past workout editing remains available; future previews remain disabled.
- Cancel workout is hidden and guarded until the session is running. A fresh view and a dismissed Start confirmation do not expose it.
- Workout kept now requires a draft write during this visit, so opening an existing draft or prefilled workout without changes no longer claims it was kept. Actual draft edits and running-workout progress retain existing preservation behavior.
- Local lint and 91 unit tests passed. Focused view/start/cancel and offline tracking/regression checks run before publication. Includes all v3.6.5 update-notice changes.

### v3.6.6 publication

- Source `0a737a2047de78f9ca42622a38ea1c1b9892cff3` published. Pages run 40271658334 succeeded; live version, draft-message guard, started-only Cancel and short update notice verified.
- APK run 40271660000 published Tracker v3.6.6 (build 98). Downloaded it, matched the GitHub digest and verified both requested changes in its bundled source.
- APK SHA-256: `4c7a71a7f4e4aeee7c51f19cd55ad4946cfdc71772d2a7d55fb9fcd6c1731bfd`.
- Local lint, 91 unit tests and six focused workout regressions passed, covering pre-start gating, stale-draft view without a kept message, Start confirmation cancellation, running cancellation, future previews, core tracking, draft resume and past-session editing. Previous update-notice checks also passed. Full CI 40271658042 continues separately. Web and APK publication complete.

## Quiet workout closing - v3.6.7 (2026-10-26)

- User explicitly requested removal of the Workout kept message altogether. Removed it and its now-unused draft-change bookkeeping. Draft preservation, timers, existing cancellation and saved-history behavior stay intact.
- Calendar opening behavior inspected: onCalendarShown deliberately scrolls to the current month with a 12px offset, not to today's weekday. This may scroll the page heading offscreen. Explained this behavior; no calendar redesign requested or applied.
- Updated existing draft-resume browser checks to expect no kept message while continuing to verify saved values on reopening. No private cleanup details stored in this public project memory.
- Publication pending local checks.

### v3.6.7 publication

- Source `4e62650f27f8c1ccba8e31caae0ff1b0d63810a0` published. Pages run 40275318359 and APK run 40275320762 (build 101) completed successfully. Superseded by the following release, which retains removal of the kept message.
- Local lint, all 91 unit tests and both past-day/current running-draft reopening checks passed before publication.

## Friends styling, concise copy and missing color coverage - v3.6.8 (2026-10-26)

- User requested less helper text (including the bypass-day explanation), Forearms classification for Meow Curls, Friends visuals consistent with the rest of the app, and color customization for the gym-date lightning badge and update notification.
- Removed the bypass explanation, repeated Friends/Gym date introductions and body-weight leaderboard instructions. Shortened empty states and the signed-out introduction. Action labels, validation, consent and reinstall/recovery instructions remain.
- Meow Curls moved from Biceps to Forearms in the built-in catalog. Exercise normalization also corrects its category in older saved/shared routines without changing name, sets, rest or weights.
- Friends uses a single tab strip with an understated selected underline, existing selected/background/text color overrides, divided friend/shared-routine lists, and unboxed find-friend/leaderboard controls. Ranking podium colors and the compact self marker remain.
- Gym-date lightning background now follows saved button color (badge/neutral fallback) with matching text contrast. The entire tappable update notice follows button background/text colors, avoiding the old grey inner button; the Settings install button already uses those controls. Undo notifications retain their existing treatment.
- Local lint, all 92 unit tests and focused update-color/leaderboard/Friends-layout checks passed. Visually reviewed mocked phone-sized Friends, Gym dates and Leaderboard screens with black button customization. No live account changes during UI review. Publication pending.

### v3.6.8 publication

- Source `9892b37a3eac102fff88a1aa82709953e379905c` published. Pages run 40275824189 succeeded; live version, short Friends text, Forearms catalog placement and themed update-notice CSS verified.
- APK run 40275826605 published Tracker v3.6.8 (build 102). Downloaded it, matched its GitHub asset digest and checked bundled version, Meow Curls correction, Friends markup and update colors.
- APK SHA-256: `8ec2e97035f0eeef7f605dd2ce4234e459984ac5e1ca4c9ad46963b91963f51c`.
- Local lint, 92 unit tests and focused theme/leaderboard/Friends regressions passed. Full CI 40275824927 continues separately. Web and signed APK publication complete.

## Direct update button and circle-calendar initials - v3.6.9 (2026-10-26)

- User requested replacing Check for updates with a visible update button and naming it Install update / Install latest update. Settings now always renders one themed update section and action. With no detected offer it says Install latest update and checks then applies an available update in one tap; with a detected offer it says Install update. No newer version reports the existing latest-version message without downloading or downgrading. Web applies/reloads its update; Android uses its existing signed-APK updater. Busy/duplicate-tap protection and reinstall recovery remain.
- Removed the separate Check for updates link. The tappable New update available notice still navigates to and focuses this same action.
- User clarified the circle calendar should keep weekday letters above the markers and show workout initials below them, with no label on rest days. Added a compact aligned initials row using the existing editable workout badges; a logged workout name takes precedence over the schedule. Circle/dash/check markers and the optional Boxes layout remain unchanged.
- Updated update tests to wait for a detected offer by its Install update label rather than visibility, since the action is now always present. Local lint, 92 unit tests and nine focused mobile/update regressions passed, including one-tap native check/install, already-latest/no-install behavior, busy handling, reinstall recovery, notice navigation/color, custom initials after rename and both week styles. Visually reviewed phone-sized circle-calendar and Settings screenshots using local fixtures.
- Publication pending.

### v3.6.9 publication

- Source `f47487a8a46f3a72424ec3cd047c165d157fc3d0` published. Pages run 40276877410 succeeded; live version, Install latest update button and circle-calendar initials verified.
- APK run 40276881091 published Tracker v3.6.9 (build 103). Downloaded it, matched GitHub's asset digest and verified bundled version, direct update handler/button and initials markup.
- APK SHA-256: `1b2c70bb93460c9438ddac83aa4480aa16e105a317bab3e4077a5bd34fce5af2`.
- Local lint, 92 unit tests, nine focused browser regressions and phone screenshot review passed. Full CI 40276877895 continues separately. Website and signed APK publication complete.

## Gym Tracker branding, customizable actions/update row and profile pictures - v3.7.0 (2026-10-26)

- User requested that action buttons use the update notice's neutral/dark customizable background instead of bright accent fills; the update container be independently customizable with the current version on the left and install action on the right; removal of the version from the Settings header; app name Gym Tracker; and account profile pictures. The user later resumed after shutting down their PC; continued existing work and rechecked interrupted validation.
- Ordinary primary/secondary/soft/ghost/icon/chip actions now share the neutral surface default and saved Button backgrounds/Button text overrides. Selected controls still honor explicit selection colors; RSVP, running-workout bar, stepper buttons and Undo actions also follow the control color. Existing separate navigation colors and semantic completion/podium indicators remain.
- Settings header now just says Settings. Update row shows v3.7.0 left and Install latest update/Install update right. New Update section color in Buttons and fields is validated, backed up and synced using existing per-account preference timestamps, with automatic contrasting version text. Reset custom colors includes it.
- Renamed document title, manifest name/short name, install-banner copy, Android display name and release title to Gym Tracker. Kept Android application ID, signing identity, download filenames and data keys stable for updates/data continuity.
- Signed-in Settings has Choose picture and Remove picture. Uploads accept JPEG/PNG/WebP under 10 MB, center-crop/re-encode to a 192px JPEG, discard metadata and cap the stored result at 100 KB. Picture rendering permits only bounded JPEG data URIs. No external image URLs. Names fall back to initials.
- Pictures appear in account Settings, Friends, leaderboards, gym-date hosts and attendee avatars. Requests capture the originating account token; stale reads/writes cannot copy a picture into a newly signed-in account. Picture cache clears across account changes. Removal is account-owned and account deletion cascades.
- New profile_pictures table has owner writes/deletes and owner/accepted-friend reads only. Pending requests, strangers and blocked users cannot read it. Stored separately from user metadata so pictures do not enlarge preference payloads or expose auth data.
- Database-only commit bbd41f6 deployed by fixed additive workflow 40278855024. It applied only the new migration and recorded its history, leaving the pre-existing unmatched legacy migration untouched. Transactional synthetic SQL checks verified owner upload/removal, friend access, stranger/pending/blocked denial and denial of cross-account mutations. Every synthetic row was rolled back; no existing data/schema contents exported. Added an equivalent integration regression for CI.
- Local lint, schema/cache consistency, 92 unit tests and eight focused browser regressions passed after restart. Covered crop/upload/remove, invalid image rejection, friend-avatar display, account switching/token binding, neutral defaults under a white accent, update-row alignment/color persistence, explicit selection colors, leaderboard, APK recovery and light-theme contrast. Reviewed phone-sized Settings, update-row and friend-photo screenshots with mock accounts; no live profile photos uploaded. Publication pending.

### v3.7.0 publication

- Source `ad15e1161e91df748a563285f2fd1dc358e00677` published. Pages run 40306916584 succeeded. Retrieved live version, profile-picture module/controls, update-row markup and Gym Tracker manifest name to verify deployment.
- Database deployment/access-check run 40278855024 completed successfully before client publication. Owner/friend/stranger/pending/blocked access checks passed with all synthetic rows rolled back.
- APK run 40306920435 published Gym Tracker v3.7.0 (build 108). Downloaded the APK, matched GitHub's digest, and verified its native Capacitor appName is Gym Tracker plus bundled profile-picture code, version and update layout.
- APK SHA-256: `e8acb50c9b7b4c18f09cab1742544a752dbe0b9c0348c1700e1a0370f283a1f9`.
- Local lint, schema/cache consistency, 92 unit tests, eight targeted browser scenarios and visual phone review passed after resuming. Full CI run 40306917363 continues separately. Website, database support and signed APK publication complete.

## Complete themes, sharing hub, keyboard fixes and security - v3.8.0 (2026-10-26)

- User requested organized/full themes, saved custom presets and sharing with friends; removal of blocking UI; flatter Friends section selectors; repository/database hardening; an improved exercise-leaderboard list and keyboard avoidance; friends' next workouts inside Gym dates; and moving shared routines into Gym dates with an all/individual sharing picker. All follow-ups are incorporated into this release.
- Appearance has a Theme section with five coordinated palettes: Icy Blue, Baby Blue, Midnight, Forest and Graphite. Accent colors live in a folded Accent color control within Theme, alongside mode and existing custom color groups. Theme tiles preview the three main colors and indicate the active palette. Applying a palette clears stale appearance overrides while preserving workouts/training settings.
- Up to 20 named custom theme presets save in per-account preferences/backups. Theme payloads whitelist only theme/color fields; untrusted keys cannot change training settings or execute URLs/markup. Save/restore/reload, palette contrast and bounds validated. Presets can be sent to one chosen accepted friend; received presets appear under Friends → Shared themes and can be applied/saved or removed.
- New shared_themes table restricts insertion to the sender and an accepted recipient, reading to sender/chosen accepted recipient, and removal to either participant. No UPDATE grant. Database payload checks reject unknown keys, URLs, malformed colors and oversized objects. Deployed in 10b9b60 via run 40311257300 with rolled-back owner/recipient/stranger/pending/blocked and malformed-payload checks.
- Removed Block/Unblock management and choices from Settings/Friends; normal removal/declining remains. Backend blocking and authorization policies remain for old clients and existing privacy boundaries. Removed obsolete block-management UI tests; database security tests remain.
- Friends/Gym dates/Leaderboard selectors are flat text tabs with a thin square-ended selected line; no filled/rounded white selection box. Existing selected color controls the line.
- Gym dates now includes a Next workouts section returning only each accepted friend's next routine name/date (up to the next week, skipping completed/bypass dates). Full plans/history stay owner-only. Date queries are bounded around the caller's current local day. Deployed in 1eb401d via run 40312365052; synthetic checks proved stranger denial, minimal friend summary, private plan denial, completed-day skipping and bounded dates.
- Shared routines moved to Gym dates, including existing copy/remove controls. Share routines opens checkboxes initialized from existing shares, with All routines and individual choices. Save adds missing selected snapshots and stops sharing unchecked current routines; already-deleted local routines' old snapshots are preserved unless explicitly removed. New batch requests capture the original account token and stop on account switches. Plan's older share action remains available.
- Exercise leaderboard setup shows a count and cleaner compact rows/removal icons. Replaced the native datalist popup with up to five in-app exercise suggestions; selecting one adds it and blurs the field. Manual entry remains available.
- Central visualViewport handling sizes dialogs/workout overlays to the visible screen, scrolls focused fields into view, hides obstructing bottom controls/pinned previews during keyboard use and preserves visible form actions. Android activity explicitly uses adjustResize. Tested a 393×400 keyboard-sized viewport, dialog save, normal tracking/draft reopening and light-theme contrast. Physical keyboard behavior can still vary by OS/WebView; no actual user data changed in visual tests.
- GitHub: main now has PR/check requirements for non-admins and force-push/deletion protections; owner/admin direct-publish bypass is retained and documented. Enabled SHA-pinned Actions enforcement, dependency alerts, automated security updates and private vulnerability reporting. Existing secret scanning/push protection were already enabled; workflow token defaults were already read-only with no PR-approval power. Confirmed production environment allows only main. Added weekly Dependabot checks and SECURITY.md. npm bulk advisory audit checked 163 dependency names and returned no advisories.
- Database: revoked anonymous privileges on known user-data tables and future public tables, retained/enabled RLS, and preserved authenticated owner/friend rules. A prior CI failure revealed the security guard's allowlist had not been extended for profile pictures. Added current supabase/verify-access.sql (historical migration unchanged), allowing only approved new policy names and the exact next-workout RPC signature. Existing rejection checks for unexpected policies/functions/views/realtime tables remain. Commit c4ea123 and verification run 40314334579 passed against the live database without exporting data or changing unmatched legacy migration history.
- Local lint, schema/cache checks, 95 unit tests, five combined theme/share/keyboard/next-workout regressions, three appearance/APK-recovery/contrast regressions, two core offline tracking regressions and phone visual review passed. Added DB integration tests for recipient-only theme gifts and minimal next-workout sharing for CI. Publication pending.

### v3.8.0 publication

- Source `6fce65a5a107b449f2adefeb293c63287cf8a726` published. Pages run 40316526965 succeeded; retrieved live version, routine-sharing controls and Icy Blue palette to verify deployment.
- Signed APK run 40316547308 published Gym Tracker v3.8.0 (build 112). Downloaded it, matched GitHub's asset digest and verified bundled version, palettes, theme sharing, keyboard handler, routine-sharing picker and native Gym Tracker name.
- APK SHA-256: `4630358f7d5ed378c6b7d37dacf80110c1ce1479fe522fdac7dfd83fc5638d19`.
- Database deployments/checks 40311257300, 40312365052 and 40314334579 succeeded before publication. Local lint, 95 unit tests, focused browser/offline checks and phone visual review passed. Full CI run 40316526382 remains in progress; automatic duplicate APK run 40316646371 was skipped after the manual build published successfully.
- Website, database support and signed APK publication complete. No real workout data was removed or altered by release verification.
## Ongoing Android workout notification and optional rest timers - v3.8.1 (2026-10-26)

- User requested a Spotify-like ongoing workout notification and a rest-timer toggle so friends can choose independently. Settings → Training now has Rest timers, on by default; the validated boolean saves/merges with each account's existing preferences/backups. Theme presets cannot change it.
- Disabled timers hide the rest bar and suppress rest-ready beep/vibration without disabling workout time/set logging. Switching off clears the pending rest, including with the workout screen closed; turning back on waits for the next completed set.
- New optional WorkoutStatus Capacitor bridge and private Android foreground service show the running routine, selected exercise, set progress and native elapsed/rest chronometer. Notification tap reopens the active workout; previews/old log edits never replace a running session's status. Finish/Cancel removes it. Rest state survives closing/reopening the workout. Snapshot delivery is serialized and stale permission-dialog updates cannot resurrect cancelled workouts. Browsers/older APKs retain existing in-app behavior.
- Android POST_NOTIFICATIONS permission is requested after confirming Start. Service declares specialUse for the explicit user-started workout stopwatch; no sensors, location, network, exact alarms or wake locks. Silent low-importance private notification, bounded native text/counts/rest times, non-exported service, no automatic resurrection after process termination, 12-hour expiry. Android controls visibility/dismissal and deep sleep scheduling; this does not promise exact background rest alerts. References checked: developer.android.com/develop/background-work/services/fgs/service-types and developer.android.com/develop/ui/compose/notifications/notification-permission.
- Local lint, 96 unit tests and phone-sized mock-native regression passed (preview/start permission, rest countdown, close/tap/reopen, disabled timers/reload, set progress, cancellation and separate account choices). Added a real Android regression and optional notifications-only CI selection. Native compile/emulator and publication pending.

## Community chat, shared theme gallery and global update banner - v3.9.0 (2026-10-26)

- User's follow-up supersedes the new Gym dates sharing-hub layout: Friends now opens on Leaderboard after a full restart, with tabs ordered Leaderboard, Friends, Gym dates. Shared routines (all/individual sharing controls), themes and next-workout summaries now live in Friends. Gym dates is a large shared chat room for signed-in accounts. Existing date records/APIs remain intact for older clients and calendar continuity; no real workout data is deleted.
- New explicit theme shares publish to everyone signed in. Existing selected-recipient theme gifts remain private. Gallery RPC exposes only the shared appearance/name and publishing username, with existing gift access rules. Only owners can remove public shares. Public themes are limited to 20 per owner and still use the strict color-only payload validator. New UI confirms the audience at publication.
- Chat loads 100 messages at a time, offers earlier history, polls every five seconds while visible and preserves scroll when reading. Text is safely rendered, failed sends retain drafts and retry IDs prevent duplicates. Requests capture the original account token; account changes clear draft/message UI and stale responses cannot enter the new account. Send stays visible in keyboard-sized viewports, Enter sends and Shift+Enter adds a line. Owners can delete their messages.
- Database chat reads expose only messages, usernames and times to signed-in accounts, respecting existing block boundaries. Direct insert/update is denied; send RPC binds ownership to auth.uid(), limits messages to 1,000 characters and 30 per minute under a serialized private rate counter. Anonymous access and deleting another user's message are denied. Private plans/history/pictures keep existing access rules; the gallery/chat grant no broader health-data access.
- Fixed additive migration 20261026000003 deployed in source fc4a9b9 via workflow 40326883746. Rolled-back synthetic checks passed for public-to-members themes, invalid payloads, chat visibility, idempotent retry, own/other deletion, direct insert denial, message limits and anonymous grants. Current API/policy security guard passed; unmatched legacy migration history untouched. Added matching integration coverage for CI, and replaced obsolete booking/reply UI tests while retaining backend access tests and workout regression coverage.
- New update banner sits before every page header, stays visible while scrolling and opens/focuses Settings install controls. Text remains New update available; saved update/button colors apply. Existing update install/reinstall behavior is preserved.
- Prior notification/rest-timer work is included. Native source compiled and signed successfully in APK run 40326890873 (v3.8.1); focused emulator verification is still to run for the combined release. Local lint, 96 unit tests, five combined chat/theme/sharing/notification regressions, two update-banner regressions and two offline workflow/backup checks passed. Reviewed the phone chat screenshot using mock accounts. Final native verification/publication pending.

- Follow-up verification: tested 201-message chat history pagination with no missing messages, scroll position preserved on new messages, and deletion refresh. Full CI's database integration/security checks passed in run 40329286760. The first focused emulator attempt 40329299461 failed before launching the test because the emulator Action executes each multiline script line independently; moved scope selection into tools/android-ci.sh. Native APK compilation/signing succeeded; no app runtime error was reported by that harness failure. Aligned the banner's text fallback with the customizable button ink and updated its previous toast-based regression. Final combined source/release checks continue.

- Native emulator check 40330263342 reached the real workout and started its service, then exposed Android's deferred foreground-notification visibility (no notification before the eight-second assertion). Set FOREGROUND_SERVICE_IMMEDIATE on Android 12+ so the user-started workout notification appears immediately, per the official Notification.Builder documentation. Added the normal Today-ready wait to native test startup. Rebuilding/rechecking this native-only fix; web assets unchanged.

### v3.9.0 publication

- Final app source `5563501fa6662cf6016b6b0d03931be677f90211` published. Pages run 40331329476 succeeded. Live version, ranking-first tab initialization, chat module, everyone-theme sharing, global update banner and final button-ink CSS verified.
- Signed APK run 40331333731 published Gym Tracker v3.9.0 (build 119). Downloaded it, matched GitHub's asset digest and verified packaged chat/theme/banner/rest-toggle modules plus compiled WorkoutStatusService/setForegroundServiceBehavior code. Signing identity/application ID unchanged.
- APK SHA-256: `46851e7a59bda1458928280104275da8291d66a66554679f75f3a6fd1109c56b`.
- Real Android emulator notification regression passed in run 40331340986, job 121601247240: service absent for previews, active workout notification appears, survives Home/backgrounding, reopens the active workout with completed sets preserved, and stops on cancel. Immediate-display fix verified on API 35.
- Local lint, 96 unit tests, all 32 mobile regressions across the suite and corrected obsolete booking-icon assertion, two update-banner checks, two offline tracking/backup workflows, 201-message chat pagination/scroll/deletion check and phone screenshot review passed. Database migration/access verification 40326883746 passed with synthetic data rolled back; full CI integration/security step also passed. Broader CI browser suites continue separately; native verification and website/APK publication are complete.
- No real workout/history data or existing gym-date records were deleted. New chat/theme publication requests were tested with mocks or rolled-back synthetic rows only.

## Profile views, personal banners and chat keyboard repair - v3.10.0 (2026-10-26)

- User requested customizable banners on leaderboard/profile views and opening a person's complete stats by tapping them in Friends or Leaderboard. Follow-up reported the real phone keyboard covering chat; incorporated that fix into this release.
- Leaderboard rows and accepted-friend avatar/name areas are accessible profile buttons. Profile sheet has a wide banner, avatar/username, workout count, total training time and lifted volume, current/best streak, latest shared weight/date, routine/exercise counts and shared exercise bests. Friends use a fresh, captured-token friend_summaries request, preserving existing publication/weight-sharing rules; nulls stay unshared, private logs/history are not exposed. Own profile uses local totals and exercise bests, including unsynced stats. Account changes close sheets; friend removal invalidates content, and closed/stale requests cannot repopulate them. Close returns focus to the original row.
- Settings account card has banner preview, image picker, color choice, Reset and View profile. Color choice switches to a plain color; images are center-cropped/re-encoded to 768×256 JPEGs, capped at 180,000 data-URI characters, stripping metadata. Only JPEG/PNG/WebP files under 10 MB are decoded. Banners appear subtly behind leaderboard entries while preserving podium colors and compact own-row styling. Colors are applied through the CSS object model; no arbitrary URLs/CSS. Original app/signing identity unchanged.
- New profile_banners table restricts writes to the owner and reads to owner/accepted friends, cascades on account deletion and rejects URL/oversized/non-JPEG payloads. Migration 20261026000004 deployed from 7d60818 in run 40333097406; rolled-back synthetic owner/friend/pending/stranger/blocked and invalid/forged-write checks plus current security allowlist passed. No real user data or legacy migration history exported/changed. Added CI integration coverage.
- Chat had a 240px minimum below the page header, which could exceed the area left above the IME. It now fills the visible screen only while composing with the keyboard open, keeping both textarea and Send visible. Baseline viewport height is retained across resize/focus changes, and tapping Send retains text-field focus. Normal layout returns when the keyboard closes. Existing dialogs/session field scrolling remains in place.
- Native KeyboardLayout helper observes layout/insets without replacing Capacitor's inset listener. If IME overlaps an unresized WebView, it explicitly fits the view to the visible keyboard top; already-resized views are left alone and the original layout height restores on hide. No keyboard permission, sensors, network access or extra dependency. Android keyboard references checked in developer.android.com/develop/ui/views/layout/sw-keyboard.
- Local lint, 96 unit tests, focused image/color/profile/ownership/keyboard/leaderboard regressions passed. Reviewed phone screenshots for profile and leaderboard; no real banners uploaded. Added a real Android IME test (actual keyboard visibility, composer/send bounds, successful send, normal layout restoration). Native compile/IME test and publication pending.

### v3.10.0 follow-up layout and customization requirements

- User requested two account appearance actions only: Edit picture and Edit banner, each in a separate GUI with image/color choices; account-management controls grouped below; rest-picture editing moved from Settings into a built-in Rest day card in Plan; and every new GUI honoring saved colors. Implemented these changes and recorded the ongoing color-token requirement in AGENTS.md.
- Account header username opens the own profile, while the main action row contains exactly Edit picture/Edit banner. Separate editors support choosing/removing images and colors. Account settings groups username, sync, password, sign-out and account deletion. The existing irreversible delete confirmation remains. Banner images remain supported. Picture color is an account-owned avatar_color in profile_banners, preserving banner appearance separately; choosing picture color uses initials instead of a photo.
- Additive avatar-color migration 20261026000005 deployed from a5d733b in run 40338134858; inherited owner/friend policies and strict hex-color checks passed with synthetic rows rolled back. No private migration history or real user data exported/changed.
- Plan's built-in Rest day tile edits only the picture, with Choose picture/Reset. It is not added to workouts, sessions, routine counts or the weekly schedule. The previous Settings picker was removed; existing rest-picture plan sync remains. Image preparation is account-bound and locally re-encoded.
- Profile stat boxes now use saved button/card background, text and border tokens, with inherited label/date colors. New account controls, editors and rest-day controls use the same saved tokens. Personal image/banner/avatar colors remain separate chosen profile content.
- Protected picture/banner caches against old reads overwriting a new save. Profile membership refresh queues a follow-up when one is already running, and dismissed profile sheets ignore late results. Browser regressions cover account-bound uploads, both profile entry points, custom stat-card colors, separate editors, image/initial color choice, picture removal/invalid image rejection, Plan rest-picture editing and Today display. Local lint and 96 unit tests passed; reviewed phone profile/leaderboard layouts.
- The first actual Android keyboard test (40336281608) stopped in Playwright's ADB keyboard-state query with FAIL before the viewport assertions. Replaced that query with bounded adb CLI inspection/retry; the actual keyboard and composer/send assertions remain. Final Android verification and revised APK publication pending.

### v3.10.0 publication

- Final app source `017fa814fed92261088b93fd02f3298187db2826` published. Pages run 40339810192 succeeded; live revised Settings includes Edit picture/Edit banner and Account settings. Profile/leaderboard and separate banner/rest-day editor phone layouts were visually reviewed using mock accounts, including images/colors and customizable stat cards.
- Signed APK run 40339811532 published Gym Tracker v3.10.0 (build 129). Downloaded it, matched GitHub's digest and verified packaged version, profiles, separate editors, Plan rest-day editor, avatar-color support, customizable profile cards and keyboard repair. Signing identity/application ID unchanged.
- APK SHA-256: `38ff3b4c14f8a0184299bb0fe657af9db7974817e5f38ab64ab50f91b5af78e5`.
- Real Android keyboard test passed in run 40339815797, job 121631134818 (API 35): actual IME shown, WebView/visible area resized, both message input and Send within visible bounds, message successfully delivered, and normal layout restored on Back/keyboard close. KeyboardLayout fallback and chat composing mode verified against the real IME, not a simulated viewport.
- Database access-check deployments 40333097406 and 40338134858 succeeded with synthetic test data rolled back. Local lint, 96 unit tests, profile/banner/account-bound upload and chat regressions, existing picture upload/removal/rejection, customization/podium/dialog checks and Plan rest-picture/Today-display regression passed. The broader mobile run had 33 passing cases and a busy-input test race; corrected that test to wait for the UI save to finish, then the focused profile/editor checks passed. Broader CI browser suites continue separately; required feature checks and website/APK publication are complete.
- No real workout data, profile photos, banners or messages were altered by verification. All visual data was mocked; Android test accounts/messages were confined to its temporary local test database and removed afterward. Future new GUI must honor saved appearance tokens, as recorded in AGENTS.md.

## v4.0 account, chat and rest alerts (2026-10-26)

- User authorized the v4.0 release, requested a single Account settings button, removing Settings sync, Chat rename/first tab, chat pictures/profile links, hold-to-copy/delete/reply, cleaner chat, native ongoing/rest-ready notifications with next split, Plan sound controls and customizable notifications/popups. Authorized useful related polish, without deleting workout data.
- Account settings now opens a separate account-management sheet. Existing username/password/sign-out/delete flows retain their confirmations. Removed Settings Sync now; leaderboard sync remains. Appearance editors remain the two direct account actions.
- Chat is first and initially selected, then Leaderboard and Friends. Messages use compact avatars/name profile links, date separators, smaller timestamps and customizable bubbles. Removed inline deletion X; 500ms hold, right-click or keyboard Enter/ContextMenu opens Reply/Copy text/own Delete. Delete confirms audience; replies persist server-side and remove quoted content after source deletion. Failed sends preserve draft/reply with idempotent retry. Blocked source quotes are hidden. Chat participant identity/photo/banner is visible to signed-in members through a bounded dedicated RPC; direct image RLS and private/friend-only training stats remain unchanged. Nonfriend chat profiles show identity and unshared stats. Account switches clear state/close actions, stale image reads cannot replace new own saves.
- Migration 20261026000006_chat_replies deployed from bfa7287, dedicated run 40358907865 succeeded. Rolled-back synthetic checks verified reply/retry/delete behavior, invalid/blocked reply denial, member image access, anonymous denial, unchanged direct-photo/private-stat boundaries and current security guard. No private history or real user data exported/altered.
- Plan Rest alert sheet offers Beep/Chime/Bell/Silent, Preview sound and independent Vibrate. Strict validated preferences sync per account and backups; themes cannot alter training choices. Original generated sine-tone WAVs match browser previews. Native ongoing notification includes next exercise/workout, with separate Rest ready notification and selected sound/vibration channel at deadline. No extra runtime permissions beyond existing notifications; normal VIBRATE added. Timer-off/cancel/finish clears pending alerts; duplicate web/native sound suppressed after successful bridge handshake. Android channel/user sound settings and device sleep scheduling still apply; no exact-alarm/wake-lock behavior added.
- Standard, accent and error toasts now use saved button background/text and border colors; semantic side stripe distinguishes error/accent. New sheets/chat controls use existing saved color tokens. Initial local lint, 97 unit tests and focused account/profile/chat/reply/keyboard/rest-status checks passed. Wider browser/native verification and signed APK publication pending.

- Follow-up local verification: 33/35 broader mobile cases initially passed; one assertion still expected the old ranking-first tab and one exposed a stale Plan sound subtitle after closing its editor. Updated tab expectations and refresh the Plan after editing sound; both focused checks now pass, including saved choice/reload/account separation. CI database integration tests passed for the new reply/member APIs. Native compile/signing passed; actual background rest-alert test continues.

- User added Settings patch notes during final validation. Added a customizable Patch notes button below update/install, opening concise v4.0 notes and collapsible v3.10 notes. Dedicated browser check passed for content, previous-release expansion, custom black/pink colors and focus return.
- Final mobile suite passed all 35 cases after sound-label/tab fixes; additional patch-notes check passed. Local lint and 97 unit tests passed. Six core offline tracking/backup/upgrade checks and eight offline focus/Undo checks passed; four database-dependent focus cases could not start locally because npx/Supabase is unavailable on this machine, so real DB tests run in CI instead. CI database suite passed. Updated legacy account/sync test helpers to wait on account sync state instead of the deliberately removed Settings status/button.
- Actual Android rest-ready regression passed in workflow 40360472842, job 121704231189 on API35: ongoing notification starts only with workout, survives Home, shows next workout/exercise, fires Rest ready with selected Chime/no-vibration channel at the test deadline, reopens preserved progress and stops on cancel. Native source unchanged by the later sound-label/patch-notes UI additions. Final keyboard check and final APK publication continue.

### v4.0.0 publication

- Final app source `f49ee9d0da3a7f1370ad1aae82099d23fdad4ba6` published. Pages run 40362216455 succeeded. Retrieved live Patch notes module and service worker BUILD `8c87b538380e` to verify the final deployment.
- Signed APK workflow 40362221269 completed successfully, publishing Gym Tracker v4.0.0 (build 137). Downloaded it, matched GitHub asset digest and verified version, patch notes, reply/profile chat, consolidated Account settings, final Plan sound-label fix and all three native sound assets. Release resource paths are shortened by Android packaging; verified resource names remain in resources.arsc and each WAV matches the original asset SHA-256. Signing identity/application ID unchanged.
- APK SHA-256: `5350897a6e388d82c52b387febd23975906a0264cd4295fc820c2ffd24b0ff27`.
- Native rest-ready job 121704231189 passed on API35 (13.3s total, actual background/ready notification assertions included). Native keyboard job 121706992469 passed (19.7s total): real IME, visible input/Send, successful send and normal viewport restoration. Their parent workflows 40360472842/40361251522 were later deliberately cancelled only to stop obsolete general browser jobs; both Android jobs had already completed successfully and logs were retained. Superseded push test runs 40360465845/40361238171 also cancelled. Final-source CI remains active.
- Local lint, 97 unit tests, all 35 mobile regression cases plus the new Patch notes case passed. Rechecked account-menu Change password and Sign out actions open the existing confirmation flows without changing account data. Six offline workout/backup/upgrade cases and eight offline focus/Undo cases passed; four DB-dependent focus cases require CI because this local environment has no npx/Supabase. Final-source CI 40362219944 completed lint/unit/database integration/security checks successfully; broader browser tests continue independently.
- Visually reviewed phone-sized chat, rest-alert selector and patch-notes sheet. All visual/message/photo data was mocked; native tests used temporary local test accounts. No real workout, message, account or profile data was modified during release verification.
- Website, additive database support and final signed APK publication complete. Patch notes are available below the Settings update row. New UI continues honoring per-account saved colors.

## v4.0.1 work in progress (2026-10-26)

- User asked for a before-work audit: found Plan still displayed exercise/set counts despite the earlier title-only request. Removed those from library/week/chooser rows. User requested friend rows replacing remove-X with next workout and day, and a cleaner Plan sound picker; implemented inline friend summary, moved Remove friend into the profile actions, removed duplicate Next workouts list, and added full-width sound choice cards with per-sound previews and saved selection/vibration colors.
- Follow-ups: move shared routines to Plan and shared themes to Settings; added shared sharing module with account-change guards, existing all/individual routine sharing/copy/removal, public/private theme gallery and saved presets. Stats now has Stats/Progress tabs. Progress photos are visible to owner/accepted friends by default, as explicitly chosen by user; no stranger/public feed. Supports gallery choice, date/caption, original-ratio JPEG resizing/re-encoding (960px max, 240k data URI max, metadata removed), idempotent retries, 30-item pages, zoom and owner delete. Photos remain memory-only on the client, not added to local backups. New native user-invoked system-camera plugin uses narrow cache FileProvider grant and deletes temporary files; no new camera/gallery permission or gallery writes.
- Fixed additive progress migration 20261026000007 deployed from 72db186 in workflow 40368051116, success. Rolled-back checks verified owner/friend/pending/stranger/blocked boundaries, forgery/external URLs/direct update denial, owner delete and 200-photo quota. Existing private migration history untouched. Added matching integration coverage.
- Local lint and 98 unit tests passed. Focused browser checks passed friend row layout, shared theme relocation, account/profile entry points, routine all/individual sharing relocation, sound selector save/reload and progress upload/error/retry/escaping/zoom/owner-delete/custom-color behavior. Further full UI/native camera verification pending.
- User wants Snapchat-style chat pushes while app is closed, with enable/disable. No Firebase configuration existed. User created/logged into Firebase and said setup was done. Inspected new project test-2612b and registered Android package com.roguelineage.rattracker as Gym Tracker. Firebase registration succeeded. The CUA browser's config download stalled/timed out (including recovery), and Downloads contains no google-services file. Requested user attach google-services.json from the Firebase setup page. Need real push credentials/config and secure notification-only server sender before claiming closed-app chat alerts work. No private keys obtained or stored; no push messages sent.
- Working on branch codex/v4-0-1 for review/testing while Firebase setup is incomplete; main has only the additive photo migration so far. Do not publish v4.0.1 with a false closed-app notification claim. Native camera/complete release verification and publication remain outstanding.

### v4.0.1 validation and Firebase setup progress

- Real native camera regression succeeded in workflow 40369272617, Android job 121735304225 (24.0s total). Captured a real emulator-camera image, resized/re-encoded it, posted through the authenticated Progress screen and cleaned up synthetic user/data. Lint/unit/database CI steps passed; full browser CI exposed two older issues. Updated Show more test for seven initial days, fixed an actual Undo toast/rest/footer overlap by measuring current controls, and preserved the actual open Accent details state across immediate keyboard theme changes. Both focused browser regressions now pass.
- All 37 focused mobile tests passed before push changes. Fixed Stats/Progress selected ARIA text serialization after visual review; added selected-color regression. Picture feed screenshot was initially captured during editor closing animation; tests now wait for the editor to be removed before taking that image. Sound cards visually reviewed; complete screenshots still to refresh after settled animation.
- Added prepared optional chat notification UI/native registration flow and opt-in setting, account-bound registry calls, install-key protection, server-only queue/recipient resolution, Firebase RS256 messaging-only sender, targeted chat-notification cleanup preserving workout alerts, Android token deletion completion bridge, private lock-screen previews, owner/sender/block exclusions and opt-in timestamps preventing replay of pre-opt-in messages. Push migration 20261026000008 and sender are NOT deployed yet. Tests: 101 unit cases passed; mocked native enable/disable/tap-to-Chat case passed. More push tests/security checks and actual delivery verification remain.
- Registered Firebase Android app in user's test-2612b project (package com.roguelineage.rattracker, display Gym Tracker). In-app download events repeatedly timed out; browser recovered after reset/inventory. User manually accepted Google Cloud first-use terms when prompted. Read the existing Firebase-created Android client key and public app/project identifiers from the official consoles, verified its 25-API restriction list (Firebase-related, including Installations and FCM Registration; no Generative Language API), and reconstructed minimal tools/android/google-services.json. This is public client configuration per Firebase's API-key documentation; no privileged key is in the repository/notes.
- No user file attachment is needed now (told user). Closed-app chat alerts still require a restricted Firebase sender identity/private key stored in server secrets, live sender deployment, and final delivery test. No service-account key has been created/downloaded, no privileged Google access expanded, and no actual push or user chat message has been sent. Browser confirmation policy requires action-time approval before creating security-sensitive persistent credentials; do all code/build preparation before asking for that final setup approval. Do not claim notification delivery is working before testing it.
- Official push plugin @capacitor/push-notifications 7.0.7 pinned in Android package/lock; default Firebase Messaging 24.1.0 explicitly included for the small token-deletion bridge. Added a debug-only dependency-checksum review workflow; signed release builds remain strict and never accept write-verification mode. Need run that workflow, inspect new dependency checksums, commit reviewed metadata and rerun native checks.

### Follow-up requests to keep for after v4.0.1

- User explicitly said finish the existing work first and save these additions for later: customizable gradients; exercise and muscle ranks inspired by the supplied Liftoff body-graph/rank screenshots; a red GUI/theme preset; a shinier granite-like GUI finish. Do not mix these into the unfinished v4.0.1 release or discard them. Reference images supplied in chat on 2026-10-26: codex-clipboard-3d8b1e43-d870-442a-b45a-57027ef92b5f.png, codex-clipboard-450ba821-0ee4-4b5c-9388-798f899fc8a3.png, codex-clipboard-8057913a-9c91-4d21-b93c-4bff2171c562.png. Clarify fair ranking rules before implementing ranks; screenshots are visual references, not established scoring rules.
- User specifically approved creating the Google notification sender, Firebase messaging permission and storing its private key in protected server settings. Created service account gym-tracker-chat-push in test-2612b; role selection is in progress, no private key created yet. The last external shell check was not executed because automatic approval review hit a usage limit; this was a review availability failure, not a determination the action was unsafe. Do not bypass that check.
- Push migration corruption found before live deployment and corrected in 92ed654. Isolated Android push dependency review run 40375159956 succeeded; its metadata still needs retrieval/review. Corrected feature test run 40375455502 was running at last check; superseded 40375314651 cancelled. No v4.0.1 publication or live notification deployment yet.

- Setup continued after the approval-review availability issue cleared. User approval remains valid. Sender service account has only Firebase Cloud Messaging API admin; activated a locally generated public RSA certificate (expires 2027-10-26). Private material stays outside the repository and is stored encrypted in GitHub deployment secrets. Firebase validation-only call authenticated and rejected a deliberately invalid synthetic token as expected; no real notification sent yet. All 71 new Gradle artifacts matched independent official Google Maven/Maven Central downloads and all 563 original checksum entries stayed unchanged. Corrected feature CI 40375455502 passed.

### v4.0.1 final notification deployment

- Protected main-only production environment rejected the feature-branch deployment as designed; no protections changed. Copied only the isolated notification backend/deployment files to main in 00a8071, leaving shipped app v4.0.0. Dedicated main deployment 40405090541 / job 121860677779 succeeded: fixed additive migration8, rolled-back synthetic owner/other/token/opt-in/claim checks, existing access guard, notification-only Edge sender, private vault webhook values, retry/cleanup cron. Anonymous sender request returned401 and authorized health passed. User specifically approved the credential setup before creation; no billing/trial started.
- Sender private key is in encrypted GitHub deployment secrets and Supabase server secrets, never app/source/notes. Temporary local private key and webhook key copies removed after successful protected storage. Locally generated public certificate expires2027-10-26; update this restricted sender before expiry. Public certificate remains outside repo. No broad Firebase admin key created.
- New sender is protected by a random256-bit webhook key and reads only server-queued message IDs/recipients; caller cannot nominate tokens/messages. Recipient resolution respects opt-in timestamp, account ownership, sender exclusion and blocks. Tokens are private with installation-key protection; no old messages replayed. Queue entries expire; retry five attempts; idle cron does not call sender without pending work. Final real Firebase native-delivery test running in 40404744260 / Android job121859490219. Test user and messages are confined to local emulator DB; only a synthetic notification body/token goes through real FCM.
- Latest code passed lint/unit/database CI and Android project setup. Earlier complete corrected feature CI40375455502 passed; actual camera passed earlier. Rechecked three final phone views (friends inline workout/day, settled sound picker, Progress custom colors) locally:3/3 passed and visually reviewed. Additional design references saved outside public repo in ../design-references/{ranks-body-graph,ranks-muscle-list,rank-tiers}.png for the deferred next update.

### v4.0.1 release gate passed

- Real Firebase-to-Android test passed in workflow40405746862, job121862919837: actual FCM registration, app PID killed without force-stop, real synthetic push received while process closed, actual notification tap reopened Chat, and opt-out removed device registration/disabled server setting. Individual chat test26.4s. Existing ongoing workout/background/rest-ready/cancel native regression also passed12.0s;2 passed41.6s total. No real user account/message/workout data changed. Earlier first push run failed only because Android `am kill` kept the attached debug process alive; updated the test to kill its own debuggable PID without force-stopping and it passed.
- Final101 unit tests and lint passed. Full earlier corrected feature CI40375455502 passed; later broader browser runs continue independently. Native camera previously passed real capture/upload. All required feature, security and native delivery gates passed; proceeding with website and signed v4.0.1 APK publication. Deferred gradients/ranks/red/shiny design work stays queued for after this release.

### v4.0.1 published

- Final app source29884d5fdc368aa463187166168adab15715b140 published to main. Website Pages40406810624 succeeded; live Version4.0.1 and final service-worker BUILDc072bb1decc9 verified directly from GitHub Pages.
- Signed APK workflow40406813707 succeeded (build/sign/publish), releasing Gym Tracker v4.0.1 build144. Downloaded public rat-tracker.apk and matched GitHub asset SHA2563b9528a60d5edddec49bbc62dac6843dee229493a3d065b50ccdb2ccd07feacb. Compared packaged version, chat notifications, Progress UI/domain, sharing, sound picker, patch notes, friend rows and Stats modules byte-for-byte against final source; native PushNotifications plugin registration and exact Firebase Android appID verified. Local copy ../Gym-Tracker-v4.0.1-679576370.apk.
- Closed-app chat alerts are opt-in under Settings → Notifications → Chat messages in the updated Android app. Real Firebase closed-process delivery/tap/openChat/opt-out and ongoing workout/rest regressions passed; owner/friend-only progress DB deployed and real camera capture passed. Final101 units, lint and three visual checks passed; earlier corrected complete feature CI40375455502 passed. Later broader CI browser repetitions were still running at publication and are not claimed complete.
- Website, database notification sender and signed APK publication complete. No real user workout/photo/message/account data changed for verification. Deferred next-update requests remain gradients, exercise/muscle ranks inspired by saved visual references, red theme preset and shinier granite-style surfaces, all customizable. These have been saved, not implemented in4.0.1.

## v4.1 Stats / ranks rebuild (2026-10-26)

- User activated the deferred rank/design work and requested a complete Stats revamp closely following Liftoff, asking to study/reference its appearance. Studied official liftoffrank.com rank screen/FAQ plus supplied bodygraph screenshots; implementation/research notes in docs/STATS_REDESIGN.md.
- Bodygraph opens first with overall strength tier, front/back interactive muscles and expandable metallic muscle/exercise cards. Analytics retains bodyweight logging/history/Undo/small chart-ring selection, adds volume/sets/rank time series with30d/90d/all periods and searchable exercise records. Per-lift details show completed sets, e1RM history and rank progress. Progress photos remain their own tab with unchanged friend-only boundaries. Calculator uses a searchable custom exercise sheet and never writes history.
- Own transparent Gym Tracker v1 rank scale, not claimed to be Liftoff's private formula or global percentile. Completed1–12-rep sets, historical bodyweight as-of session (never future weight), movement-specific game targets, bodyweight/dumbbell conventions, assisted/timed unsupported left unrated. Recomputes from source logs on deletion. Reference/calibration details in ranks.js and notes. No fake global rankings/leagues/XP.
- Original rank badges; licensed offline anatomical polygons pinned to GV79 MIT source commit, license shipped; added original neutral silhouette and rounded anatomy paths. Custom rank palette and metallic/flat finish sync per account and shared/saved presets; Crimson theme added. All controls honor existing custom colors. Fixed initial style rendering to use CSSOM/data attributes under existing strict CSP; no security protections weakened. The bounded shared-theme validator is extended in migration9 for rankColors/statsFinish, with no new data access or sharing exposure.
- Work in codex/v4-1-stats; version4.1.0 prepared.106 units and lint passed initially; three new mobile checks passed before the final silhouette/custom-picker refinement. Final visual review, regressions and website/signed APK publication remain pending. Test requests are mocked/offline and use no production accounts/data.

- Final layout refinement: separate Your rank view (metallic badge, score/progress, rank-history chart and tier ladder); Bodygraph stays default and shows muscle cards higher on screen.106 final units/lint passed;47 mobile/offline regressions passed, then3 targeted final-layout tests and4 affected theme/chart/customization/Progress cases passed. Fixed an older SVG keyboard click issue and chart selection in exercise sheets; prevented floating-point roundoff losing1RP. Visual phone reviews passed. Shared preset validator required a matching bounded extension: migration9 with old-theme compatibility and invalid key/color/type/finish/oversize/training-field checks; no row/data permission changes.

### v4.1 release validation

- Final Stats layout: Your rank (overall badge/progress, ranked coverage, strength history, nine-tier ladder); default Bodygraph (front/back map, legend, custom palette/finish, expandable muscle/exercise cards); Analytics; friend-only Progress; searchable Calculator. Final visual phone previews saved outside repo as ../v410-bodygraph.png and ../v410-your-rank.png, using synthetic sample workouts only.
-106 unit tests/lint passed;47 mobile/offline regressions passed; final3 Stats checks plus4 affected theme/chart/color/photo regressions passed. Subsequent screenshot run rechecked Bodygraph/Your rank/muscle/exercise/keyboard/history/Analytics and passed. Final7 repository/version/offline-cache/schema consistency checks passed. CI Android project setup passed (job121878814504); broader CI continues separately.
- Migration20261026000009_rank_theme_colors deployed from cbf5300 in protected main workflow40411282780, job121882313237, success. Only extends the existing shared-theme validator to bounded, known nine-tier hex colors and metallic/flat finish. Old themes accepted; unknown keys/colors/types/finishes, training settings and oversized payloads rejected. Existing access guard passed; no user rows/data/access boundaries altered. No legacy migration export/repair.
- Ready for website and signed APK publication as4.1.0. Own game-design rank references are documented, with no claim to Liftoff's proprietary formula or global percentile. Historical weights, completed-set-only ranks, no calculator writes, per-account palette and original source data preserved.
