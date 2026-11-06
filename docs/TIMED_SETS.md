# Timed holds

Dead hangs, common static plank variants, L-sits, wall sits, hollow-body holds
and plate pinches default to seconds for new sets. Hanging leg raises and hang
cleans remain rep exercises. The routine editor has a Reps/Seconds selector for
other exercises and explicit overrides. Both working and warm-up rows use the
chosen unit; optional added weight stays separate.

Units use the existing exercise `target` string, for example `45 s` or `8 reps`.
Set `r` remains the numeric measurement value in the original JSON format. It
means seconds only when the **logged** target has an explicit seconds suffix.
Older clients already preserve these fields, so no optional new log field can
be silently stripped during sync. Their older table headers can still say Reps;
update each device for correct labels. An explicit target edit remains an edit.

Historical logs without a seconds marker retain their original rep unit even
when the routine now defaults to seconds. Existing legacy drafts also retain
rep interpretation. New drafts preserve per-exercise targets across reloads and
routine edits. Last-used values with ambiguous units are not reused as seconds.
No existing routine, weight, history or preference is rewritten by an upgrade.

Timed rows count as completed working sets but do not count as repetitions,
kg × reps, estimated 1RM or strength LP. Their duration records and charts are
separate from legacy rep/weight points for the same exercise. Warm-ups remain
separate. Calendar history displays seconds explicitly. The additive private
server-totals migration excludes timed rows from aggregate lifting volume even
when a legacy client uploads them. It changes no rows, table policies or grants.

The fixed main-only `Deploy timed-set totals` workflow uses the existing
protected production environment, runs synthetic SQL checks and the current
access guard, and records only this migration. It preserves the project's
pre-existing unmatched legacy migration history, following the earlier fixed
migration deployment pattern.
