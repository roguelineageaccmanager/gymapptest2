# Mobile UI changes — 2026-10-25

## Confirmed decisions

- The app is used by the owner and friends. Remove the Settings Privacy section; share the latest weigh-in with accepted friends by default. Full weigh-in histories remain owner-only. Keep unblocking available under account controls.
- Future workouts open the actual workout layout as a faded read-only preview, without Start, save, timers, or draft writes. Today opens directly into the workout.
- Today's date belongs under the Today heading.
- Workout badges default to the first letter and can be edited in the routine editor. These display preferences are stored with the device's other appearance settings and included in backups.

## Implementation order

1. Settings and theme: rounded native color swatches, border color, dedicated Train anyway button color, remove Privacy section and weight toggle, retain blocked-account management.
2. Today: fitted rest image, larger Rest day heading and right-aligned Train anyway; compact themed week tiles, completed days white, editable workout badges.
3. Plan: editable badge; Left/right switch on the exercise header near Delete.
4. Stats: remove floating selection box and permanent best ring; one white selection ring moves to the selected point, with a plain date/value readout.
5. Friends: full-row podium highlights, clear own-row outline, custom category sheet, no automatic keyboard when sharing routines, gym dates follow theme accent.
6. Headers and sessions: Calendar and Plan show heading, streak, Settings; Today has date underneath; direct start today, read-only future workout screen.
7. Validation and release: regenerate offline hash, lint/unit tests, focused phone-browser checks, full CI/database/browser checks, enable latest-weight sharing through the existing account sync API, publish web and signed APK, verify version/checksum, update project memory.

## Release

- Planned app version: 3.4.0.
- Implementation and signed APK publication complete (builds 74/75); full suite passed all 155 scenarios.

## Follow-up visual corrections — v3.4.1

1. Compact unified Today week strip and small neutral Train anyway button.
2. General button-text color, editable secondary text, full icon-and-label nav highlight.
3. Compact own-avatar leaderboard ring and rounded-card Friends section tabs.
4. Remove the actual SVG focus square; move selected date/value to headers and Best below graphs.
5. Add latest-body-weight leaderboard through existing friend summaries.
6. Verify focused phone flows and visual layout; run CI and publish web/APK.
- Do not remove existing workout logs, plans, account data, or friendship access boundaries.
- Database history contains a remote-only older migration. The initial new migration could not deploy and was never applied. Avoid exporting private database SQL: the final implementation enables the existing latest-weight flag for each account at app load/sync, without a schema change.
