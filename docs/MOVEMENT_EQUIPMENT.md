# Movement, equipment and attachment picker

The 4.8.1 draft now presents 655 movement results instead of 975 equipment/side
results. All 1,033 original exercise IDs remain (1,043 including the new reviewed variants); no routine or history
migration runs. Explicitly reviewed movement groups contain concrete selectable
setups. Specialist entries that have not been reviewed remain separate rather
than guessing that similar names mean the same exercise.

Choose a movement, then equipment, a concrete version and supported arm/leg mode.
Exact searches that already specify an existing setup go straight to that setup's
side choice. Equipment can also be changed in the routine editor. Incline/decline,
arm-at-side/overhead, assistance, plate-loaded/cable, and Row/Low Row/High Row remain
separate versions with their original rank models and last-used values. The rank
calculator uses the same grouping and explicit input units.

An Attachment control offers compatible cuffs, handles, ropes and bars. Wrist
cuffs are offered for cable raises/rear-delt flyes and single-arm pushdowns; ankle
cuffs for cable hip movements. Fixed rope/bar identities do not offer contradictory
attachments. This optional setup metadata is not another catalogue identity or a
new strength multiplier. It appears beside the exercise name in the editor,
session and calendar history. Two working sets per side, warm-ups, notes, rest and
targets survive equipment changes. Incompatible attachments are cleared explicitly
when equipment/side changes; previous logged attachments never change with a plan.

Allowed attachment values survive sanitizer, plan/log merge, backups/sharing and
session drafts. Explicit `none` clears the selection; missing fields from older
clients preserve known metadata during merging. An older app alone cannot display
new metadata and may omit it when editing; do not claim all historical clients
understand it. Raw set weights/reps, existing IDs, ranking models and warm-up
handling are unchanged by movement grouping.

## Larger library research (2026-11-17)

The likely requested source is [ExerciseDB API](https://github.com/ExerciseDB/exercisedb-api),
whose repository advertises 11,000+ exercises. Its repository contains a README
and code licence, not an openly downloadable 11,000-record dataset. Its linked
[published API content terms](https://exercisedb.notion.site/ExerciseDB-API-Terms-of-Use-226983b728ca8090bf7be79564e4b356)
reserve rights in the API content and prohibit permanent storage and bulk
collection, including offline application data. The repository's AGPL licence
must not be treated as a licence to redistribute all hosted API content.

No ExerciseDB data/media was downloaded, scraped, purchased or imported, and no
new API dependency was added. Importing that catalogue requires legitimately
available data with terms allowing this app's public repository, packaged APK and
offline catalogue. Existing FreeExerciseDB provenance/licence notices remain.
This change cleans the current catalogue rather than claiming 10,000 new entries.

## Validation

Lint and all 170 unit tests passed. Thirty distinct affected browser cases passed
(27 in the affected suite, two touch/scroll cases after fixing their setup helper,
and one additional service-worker cuff persistence/clearing case). Coverage
includes every ID's group, equipment filters, version distinctions, duplicate
prevention, cancellation/account/concurrent-edit guards, per-side sets/warm-ups,
logged cuffs, equipment changes, raw-history preservation, theme/phone layouts,
rank calculator and genuine offline reloads. Native emulator/full CI were not run
locally. The same runtime source is deployed to the existing owner-private preview;
no official GitHub Pages/APK release or database schema/access change occurred.

## Attachment and layout follow-up

Seven additional attachment choices: forearm/upper-arm cuffs, short/long ropes,
wide lat bar and close/wide neutral handles. Cuff hints distinguish one cuff on the
working arm from one per working arm; side tracking remains an exercise option.
Upper-arm cuffs are not offered for pushdowns. Existing stored attachment keys
remain valid. Equipment and Attachment now share a two-column setup row; Version
and the equally sized Warm-up toggle sit underneath. A lone Equipment field spans
the row. Smith-filtered searches show the concrete Smith Machine exercise name;
Smith machine remains equipment, never an attachment. Leaderboard rows now fade inward from the personal banner on the left and rank
colour on the right, retaining plain names and no row outlines.


## Further setup and confirmation review

Ten curated single-leg machine versions are added: leg-press calf raise, calf
press machine, standing/seated calf raises, plus plate-loaded leg press, leg
extension, seated/lying leg curls and standing/seated calf raises. All have their
own identities, per-leg defaults and matching equipment. They use placeholders
instead of incorrectly borrowed bilateral demonstration media. The picker still
has 655 movement groups; there are now 1,043 identities, 63 reviewed side pairs,
127 presentation families and 693 ranked/350 explicitly unrated models. Existing
routines are never rewritten. Independent-arm/leg machine requirements are shown
with the correct limb.

Wrist cuffs now also appear on compatible generic cable curls, triceps movements,
rows and pulldowns. Cable straps are separate from lifting straps used as grip
aids on rows, deadlifts, shrugs and pull-ups/pulldowns. Fixed rope/bar names do not
offer contradictory cable attachments, and barbell/plate-loaded pulling setups
offer lifting straps rather than cable cuffs. Existing metadata keys remain valid.

When there is no side choice, Warm-up shares the Equipment row and any Attachment
field follows underneath. With a side choice, Version/Warm-up remain together.
The exercise X opens a confirmation; cancelling preserves the entry, confirming
retains Undo. Account, routine and concurrent-edit guards prevent stale deletions,
and Undo is bound to the account that removed the exercise. Confirmation dialogs
use a compact icon/message layout and clear adjacent actions; update notices and
status messages use the same spacing, rounded controls and saved appearance tokens.
