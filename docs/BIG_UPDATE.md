# Bigger update — unpublished draft

The owner explicitly requested holding publication while this update grows.
Work continues on `codex/big-update`. Do not merge to main, deploy the website,
publish an APK or bump a release version until the owner requests publication.
The published baseline remains v4.6.0. This file tracks the accumulated draft.

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
unchanged. Version files stay at 4.6.0; only the draft's offline cache fingerprint
is regenerated as source assets change. Prior patch notes are untouched.

## Validation

Lint and all 145 existing unit tests passed. Eighteen focused browser tests passed
for numbered editing, keyboard and drag reorder, cancellation/concurrent changes,
saved data/reopening, profile banners/profile access, rank badges/borders across
categories, null versus zero ranks, custom appearance and a 320px viewport.
The final leaderboard spacing/name adjustment was checked again with the affected
leaderboard and profile cases. Real service-worker offline reload verifies
numbered reorder/save/reopen, preserved seconds and unchanged saved history.
Phone previews were inspected at 393px and 320px.

Full release CI and native-device testing have not run for this draft. No remote
branch push, pull request, deployment or release is part of this work. Further
changes can be accumulated here before the owner requests the bigger release.
