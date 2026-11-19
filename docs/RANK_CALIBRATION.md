# LP references and selected setups

LP is calculated by this app, not supplied by FreeExerciseDB. That library
provides exercise metadata and demonstrations, not strength standards. The
previous scale used broad muscle/movement targets; many machines still need
those estimates because their displayed loads are not interchangeable.

## Reviewed lifting-data references

Checked on 2026-11-17 against Strength Level's published community results.
These are self-selected reported lifts, not a representative population sample.
We use a small number of factual intermediate bodyweight ratios to improve
**relative movement difficulty**, not copy the site's tables, media, calculator,
percentiles or database. Links below are the source notices/attribution.

The app benchmark is Gold 4 at an 80 kg barbell-bench e1RM. We do not silently assume the user's sex or age. For each reviewed
movement, normalize its published male and female intermediate ratios against
the corresponding bench ratio, then equally average the two comparisons:

`reference = round2(((male × implements / 1.25) + (female × implements / .75)) / 2)`

This averaging, rounding, Gold anchor and every LP threshold are **our game-design
choices**, not validated sex-neutral standards. They improve relative difficulty
without claiming that Gold means intermediate on Strength Level. No demographic
profile, ranking data collection or personal workout upload was added.

| Reviewed movement/source | Male ratio | Female ratio | Loads in normalized total | App reference |
|---|---:|---:|---:|---:|
| [Barbell bench](https://strengthlevel.com/strength-standards/bench-press) | 1.25 | .75 | 1 | 1.00 |
| [Dumbbell bench](https://strengthlevel.com/strength-standards/dumbbell-bench-press) | .50 | .30 | 2 | .80 |
| [Incline barbell press](https://strengthlevel.com/strength-standards/incline-bench-press) | 1.00 | .65 | 1 | .83 |
| [Incline dumbbell press](https://strengthlevel.com/strength-standards/incline-dumbbell-bench-press) | .50 | .30 | 2 | .80 |
| [Smith flat bench](https://strengthlevel.com/strength-standards/smith-machine-bench-press) | 1.25 | .70 | 1 | .97 |
| [Barbell overhead press](https://strengthlevel.com/strength-standards/shoulder-press) | .80 | .50 | 1 | .65 |
| [Dumbbell shoulder press](https://strengthlevel.com/strength-standards/dumbbell-shoulder-press) | .40 | .25 | 2 | .65 |
| [Dumbbell lateral raise](https://strengthlevel.com/strength-standards/dumbbell-lateral-raise) | .20 | .15 | 2 | .36 |
| [Cable lat pulldown](https://strengthlevel.com/strength-standards/lat-pulldown) | 1.00 | .75 | 1 | .90 |

Only exact reviewed identities and their existing reviewed side families inherit
these anchors: 13 catalogue IDs. No automatic propagation to different angles,
grips, machine levers or pulleys. Equal resulting references are allowed; we do
not invent differences just to make every setup have a different number.
Cable lateral raise was researched but not imported as an observed reference
because the source does not establish its per-stack/per-arm load convention.

Other supported exercises retain explicit estimated movement targets. Plate-loaded
Row, Low Row and Pulldown remain different exercises, with separate histories;
they are not calibrated to a particular manufacturer's lever resistance. Cuffs
change lever arms; handles, pulley ratios, machine starts and technique vary.
No universal multiplier for those differences is established here. Unsupported
holds, assistance, bands and power drills remain explicitly unrated for strength.

## Selected variation and attachments

- Equipment/angle and one-arm/one-leg choices already save concrete exercise IDs.
  Their exact model, rather than the broad picker label, determines LP.
- Attachment now partitions derived best sets, graphs and ranks. Handle, cuff,
  rope, strap and unspecified history no longer overwrite each other's best set.
  Updated profile snapshots retain these separate setups. Older clients can omit
  this metadata and may display only one same-name setup until updated.
- Only setups in the current assigned plan contribute to overall/muscle rank.
  Other setup history remains visible in Analytics. Hiding an exercise still hides
  all its attachments, and restoring it restores them together.
- Attachments do **not** manufacture an LP bonus/penalty. They share a provisional
  movement reference until there is suitable setup-specific calibration. The
  calculation identifies estimated targets rather than implying precision.
- Existing unspecified history stays unspecified. Invalid attachments sanitize to
  unspecified; no guessed migration, new exercise IDs, record rewrite or changes
  to raw logged loads/volume are made.

For a single-arm or single-leg lift, enter kilograms per side. Each left/right
pair is one working set. The weaker side's estimated max determines the pair’s
score. The app evaluates every working set and keeps the strongest score. Two
sets of 40 kg × 10 per arm therefore compare with two bilateral sets of 80 kg
× 10 on the same plate-loaded pulldown. Both give an equivalent estimated
max of 106.7 kg and Platinum 4. Dumbbell loads use the
per-implement convention shown in the calculator.

If only one side of a round is logged, the same load conversion gives a local
estimate. Stats labels it and also shows a lower confirmed score when present.
The overall rank and shared leaderboard require a complete pair. Each side stays in its recorded round. Very old compacted logs may
have lost side positions before they reached this version.

Warm-ups are separate. One rep uses the actual equivalent load. Two or more
use the Epley estimate, with the rep input capped at 12 for scoring.

Each movement has a fixed kilogram benchmark equal to its previous reference
ratio multiplied by 80 kg. Calisthenics use the same standard body load for
every lifter, scaled by the movement factor. Personal weigh-ins are tracked
separately.

The score formula is `floor(300 × e1RM / fixed reference kg)`, bounded
0–999, with existing four divisions and 100 displayed LP per division. Updated
references recalculate derived ranks from unchanged logs; some LP moves up or
down. Shared scores update after sync from an updated client. This remains a game
rating, not a population percentile, technique assessment or calibrated machine
comparison. The separate exercise-realism catalogue audit is still deferred.

## Picker muscle filters

The picker now uses the bodygraph's regional names rather than broad Arms,
Legs and Core chips: Chest, Traps, Mid-back, Lats, Shoulders, Biceps, Triceps,
Forearms, Quads, Hamstrings, Calves, Glutes, Abductors, Adductors, Abs, Obliques
and Lower back, plus All/Conditioning. Abductors now have their own regional
bodygraph rank instead of sharing the Glutes label. This is a regional display
split; the underlying hips contribution to overall rank is still counted once.
Rows still appear for Mid-back and Traps, and crunches for Abs and Obliques.
Legacy broad search terms remain usable. Saved categories/IDs stay unchanged.

## Which workout supplies current LP

For an eligible setup in the weekly split, the latest scored workout supplies
its best working round. Older sessions still supply personal records and lift
history. A newer incomplete one-sided workout can supply a local estimate.
Overall and shared ranks continue to use the most recent confirmed result for
each setup, taking the highest of those current scores in each muscle group.
Editing a saved session preserves its workout time so an earlier session on the
same day cannot become the latest merely because it was edited.
