# Movement, equipment and attachment picker

The 4.8.1 draft now presents 655 movement results instead of 975 equipment/side
results. All 1,033 distinct existing exercise IDs remain; no routine or history
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
