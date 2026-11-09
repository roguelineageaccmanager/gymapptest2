# v4.7.0 — leaderboard and numbered workout editor

The owner requested publishing the saved update on 2026-11-09, lifting the earlier
hold. Preparing release from `codex/big-update`, based on published v4.6.0.
Required full checks and signed-release verification must pass before completion.

## Implemented

- Leaderboard members show the existing strength-rank emblem and tier/division
  on the right. Each row's border follows that member's shared strength rank,
  regardless of the chosen leaderboard category or podium position. Null/missing
  rank stays Unranked with a neutral theme border; a valid zero score is Iron 4.
  Current LP and division formatting reuse the existing rank model.
- Podium numbers still indicate position in the selected category. Member banners,
  profile access, score-sharing rules, category sorting and the “you” label remain.
  Removed the redundant outer list border and allow usernames to wrap on narrow
  phones. Surfaces and text honor saved appearance colors.
- Workout editor cards show 1, 2, 3… in their drag handles. Adding, removing,
  dragging and background routine changes update the numbers. The separate Order
  button and its picker are removed. Drag a numbered handle to reorder, or focus
  it and press Alt + Up/Down. Keyboard movement retains focus and scroll position.
  Drag completion is guarded against a routine/account switch.

No saved exercise order is changed unless the user reorders it. Workout history,
warm-ups, timed targets, identities, ranks, sync formats and permissions remain
unchanged. Version files are aligned at 4.7.0 and the offline cache fingerprint is
regenerated. Previous release notes, including v4.6.0, remain available.

## Validation

Lint and all 145 existing unit tests passed. Eighteen focused browser tests passed
for numbered editing, keyboard and drag reorder, cancellation/concurrent changes,
saved data/reopening, profile banners/profile access, rank badges/borders across
categories, null versus zero ranks, custom appearance and a 320px viewport.
The final leaderboard spacing/name adjustment was checked again with the affected
leaderboard and profile cases. Real service-worker offline reload verifies
numbered reorder/save/reopen, preserved seconds and unchanged saved history.
Phone previews were inspected at 393px and 320px.

The saved draft passed the checks above before publication was requested.
Full release CI and signed-publication verification are pending for v4.7.0.
No native-device result is claimed. Final run/source/APK verification is recorded
in the release pull request and docs/PROJECT_MEMORY.md once complete.
