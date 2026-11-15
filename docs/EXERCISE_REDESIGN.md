# v4.8.0 preparation: movements, Stats and visual consistency

This update is prepared for review, not published. The owner asked to start the
checks, stop without waiting for the long remote suite, and let them request a
later check. Do not merge or start a release during this preparation task.

## Plan and implemented model

1. Separate a movement's picker presentation from its saved exercise version.
   Group genuinely matching side variants, choose one arm/leg or both, and update
   the saved routine's name immediately when the version changes. Keep different
   equipment, angles, arm positions and machines distinct.
2. Remove exercise descriptions and Details controls. Preserve source metadata,
   original data notices and the user's own routine notes.
3. Use an avatar on the left, a plain name with no inner banner box, and
   rank emblem on the right with a subtle fade immediately to its left. Neutral position
   numbers replace gold/silver/bronze podium highlights; row borders and position
   circles are removed.
4. Evolve original rank emblems across divisions 4 → 1, consolidate Calculator
   into Your rank, and refine the anatomical overview.
5. Match first-use/browser cards and typography to the current themed app.

The picker now has 117 presentation families: 44 reviewed one/both-side pairs,
one equivalent-spelling family, and fixed one-side movements with neutral labels.
The catalogue keeps all 1,033 identities, shown as 985 movement results. Fixed
one-side-only movements retain their execution; no bilateral version is invented.
Original side-specific names remain searchable and saved names stay concrete.
Row, Low Row and
Pulldown remain separate; cable/plate-loaded/Smith equipment and different
triceps arm positions remain separate. Independent-arm machine versions are
only appropriate when the user's actual machine supports them; the selector
says so. No mismatched demonstration media is attached to these versions.

Version changes preserve working sets per side, separate warm-ups, targets,
rest and notes. Limits and duplicate destinations are checked before saving;
there is no silent set-count clamp. The active account, routine and original
exercise snapshot are checked after asynchronous choices. Cancellation saves
nothing; focus and the picker scroll anchor are preserved. Known catalogue
movements no longer have a generic switch that could turn a barbell bench into
a fictitious one-arm exercise. Custom exercises retain manual left/right tracking.
Legacy saved tracking is read as stored until explicitly edited.

Only the edited routine changes. Old logs, IDs, last-used values and records
remain attached to their actual version. No automatic historical migration,
merged one-/two-arm strength history, server API or database migration is involved.
New unilateral logs retain execution metadata and empty side positions. Ranking
now normalizes load conventions and recomputes derived ranks from unchanged
weights. See RANKING_REWORK.md.

## Stats and bodygraph

Iron through Diamond retain existing tier colors and LP thresholds. Their SVG
emblems gain division pips, wings and a crest as they progress from 4 to 1.
Master and above retain their distinct undivided emblems. Calculator is a
collapsible tool inside Your rank, preserving its preview-only calculation.

The bodygraph now distinguishes Traps, Mid-back and Lats, and Abs versus
Obliques. Regional breakdowns use the best qualifying active lift for that
region; they do not add terms to the existing overall-rank average. Six visible
abdominal sections share one Abs score. The latest requested style keeps deliberate gaps and avoids small filler regions.
Quads use the original six contours, extending around the knees without
intersecting them. Front calves retain their original contours. Rear calf heads now fit the shared
leg silhouette down to the ankle; hamstrings fit beneath the glutes above the
knees. Opposing spine edges have a small centre gap; lats retain their spacing. Arms use clean adjacent biceps/brachialis shapes rather than layered slivers.
Broader forearms have a short proximal Brachioradialis section, sharing the
existing Forearms score; posterior triceps remain available. Mid-back fits between the lats without overlap.
Other regions use simpler major shapes.
No per-ab-segment strength score is invented.
The adapted geometry's MIT notice and original license remain intact.

The overview keeps both front and back visible; the Explore control, expanded
explorer and explanatory paragraph were removed at the owner's request.
Rear delts are smaller and labelled explicitly. Front inner thighs are Adductors,
with adduction lifts separated from the existing Glutes breakdown without
changing overall scoring. Brachialis contours share the Biceps score and group.

Graphite replaces the old green as the default appearance, including the neutral
body color. Explicitly saved themes and custom colors remain intact; no account
appearance is overwritten or persisted by this fallback. The palette applies to
the dark default only; light mode keeps its light surfaces.

Page and section headings, name labels and tabs share Inter fonts and consistent
sizes/weights. The leaderboard board selector is compact. Intro cards, setup steps and the browser install banner use the
same saved surface/border/control colors as the app. Readable input sizing and
existing setup/install actions remain.

## Validation and publication state

Local lint and 161 unit tests passed. The ranking follow-up passed 16 distinct focused browser cases and a real service-worker offline reload. Thirty-five focused browser cases plus account/theme regressions passed. The six
affected visual/theme/profile cases were repeated after the latest styling
request. Browser checks cover movement
search/selection, immediate version names, per-arm sets and warm-ups, duplicate
and concurrent/account-change guards, save/reopen, scroll anchors, timed sets,
existing logging/history, rank normalization, division artwork, body regions,
larger explorer, calculator placement, typography, themes and narrow phones.
Real service-worker offline reload verifies version switching/save/reopen,
body exploration and unchanged saved history. Phone previews were inspected.

Full remote CI will run on the draft pull request. Its result, merge, web
publication and signed APK remain pending. The latest anatomy corrections passed
five focused browser cases and both-view visual inspection. Geometry tests check
every pair of different muscle regions for intersections in rendered coordinates,
including the posterior alignment, and preserve the original calf contours.
Browser coverage verifies both body views, distinct Brachioradialis labels,
paired-side calculator input units and the emblem-centred rank fade.
No native-device test or official release is claimed; the separate private preview is deployed. The published baseline remains v4.7.0 until a later release step.

Ranking and side-pair follow-up: see [the implemented policy and audit](RANKING_REWORK.md).
