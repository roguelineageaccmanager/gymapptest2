# Stats redesign notes — v4.1

## Reference study

User requested a close Liftoff-style Stats/ranks rebuild, using both the supplied
bodygraph screenshots and the app's published screens.

Reviewed first-party references:
- https://liftoffrank.com/ — hero rank screen, metallic rank banner, horizontal
  section tabs, nine tiers, per-lift records and colored per-muscle bodygraph.
- https://liftoffrank.com/images/hero/phone1.webp — large badge, rank/points,
  progress chart and compact dark surfaces.
- https://liftoffrank.com/en/faq — bodyweight and estimated 1RM underlie ranks;
  calculator previews are separate from saved training history.
- User's supplied legacy screens: paired front/back figures, uppercase tier names,
  colored metallic accordion rows and individual muscle breakdowns.

## Implemented structure

Stats opens on Bodygraph, with Your rank, Analytics, Progress and Calculator alongside it. Overall
rank has its own Your rank view with strength history and the nine-tier ladder. Tapping a region opens/focuses the corresponding muscle
card; cards show that muscle's completed exercises. Exercise sheets show rank,
next-tier progress, best estimated 1RM, heaviest weight, completed sets and dated
history. Existing weigh-ins/entry deletion/Undo/chart-point selection remain under
Analytics. Progress photo audience and account boundaries are unchanged.

No invented global/regional standings, fake leagues, fake XP or fake users. Existing
Friends leaderboards remain their existing metrics. Liftoff's private scoring table
is not represented as known, reproduced or connected to this app.

## Gym Tracker scale v1

Ranks are derived, never written over source logs. Completed, valid sets of 1–12 reps
can earn ranks. Single reps use actual load; other sets use Epley
`load * (1 + reps / 30)`. Historical weigh-ins must be on or before the session;
future weigh-ins and future sessions never affect an earlier rank.

Reference loads in `js/domain/ranks.js` are explicit **game-design targets**, not
population percentiles or clinical/competition standards. The movement reference
earns Vanguard at 300 RP; score is `e1RM / bodyweight / reference * 300`, capped at899.
Nine100-point tiers: Spark, Forge, Alloy, Vanguard, Apex, Nova, Eclipse, Ascendant,
Zenith. Bodyweight exercises include bodyweight (push-ups use65%); dumbbell
references use one dumbbell. Assisted/timed/unsupported movements remain unrated.
Machine loads vary and should be compared on the same equipment.

A muscle uses its best ranked exercise; overall score averages the muscles with
ranks. Coverage is shown. Removing source training data immediately recomputes ranks.
Missing historical weight does not fabricate a historical bodyweight. Calculator
results are previews and never create logs, weights or rank records.

## Appearance and implementation

Original shield badges, metallic gradients, optional flat finish and existing saved
UI tokens. Every rank color is editable. `rankColors` and `statsFinish` sync per
account and travel with saved/shared theme presets. Added Crimson coordinated theme.
No style attributes are interpolated into HTML: validated colors/progress are painted
through CSSOM to retain the existing strict Content Security Policy.

Body polygons adapted from GV79's MIT-licensed react-body-highlighter, pinned to
commit `d03fcd8740033721a51f5a2682de02ec31df92ba`. License shipped in
`vendor/body-highlighter-LICENSE.txt`. Original rounded neutral silhouette, path
corner smoothing, rank coloring and interactions added here. No Liftoff logos,
mascot, rank images or app screenshots are shipped as app assets.

