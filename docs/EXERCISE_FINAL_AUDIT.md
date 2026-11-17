# Exercise catalogue audit — 4.8.1 draft

All 1,033 original catalogue identities remain. The picker presents 975 movement
results across 117 presentation families, including 53 reviewed one/both-side
pairs. No routines or logs are migrated, renamed, combined or automatically added.
No new exercise identities or media are introduced; existing provenance/licence
notices remain unchanged. Descriptions remain hidden as requested.

## Verified corrections

- Group nine more matching movement pairs: chest-supported row, glute bridge,
  push-up, hammer curl, incline dumbbell curl, cable wood chop, farmer carry,
  dumbbell curl and open-palm kettlebell clean. The alternate "Dumbbell Bicep
  Curl" spelling is a presentation alias; its historic identity is retained.
- Count one shared dumbbell once for pullovers, seated triceps press, the
  catalogue's one-dumbbell close-grip press and plie squat. Ordinary paired
  dumbbell movements remain per dumbbell. Goblet/overhead shared loads stay total.
- Correct kettlebell labels and reviewed per-bell inputs for Arnold/seated/floor
  presses and front squats with two bells. Preserve existing tracking defaults;
  a unit correction does not convert old single rows into required L/R pairs.
- Use the same primary rank muscle for both versions of reviewed movements.
  Kettlebell cleans use hamstrings; face-pull versions consistently use shoulders.
- Rank loaded walking lunges, including barbell walking lunges, instead of treating
  their names as distance-only walking. Zero external load remains unrated.
- Exclude seven missed band movements (including reverse-band assisted lifts):
  bar kilograms alone do not describe added or assisting band resistance.

The reproducible `node tools/rank-audit.mjs` report now has 683 ranked and 350
explicitly unrated identities. See `RANK_MODELS.csv` for every model and reason.
Scores will reflect corrected models when recalculated; raw sets remain unchanged.

All 26 requested exercise/search phrases return results, including the distinct
plate-loaded Row/Low Row/Pulldown, arm-at-side versus overhead cable extensions,
lumbar/45-degree extensions, wrist movements and JM press. Equipment filters and
aliases retain the original catalogue; JM press is never automatically inserted.

## Limits

These are consistent game targets, not validated machine-specific strength
standards. Different machines, cable ratios and ranges of motion cannot be
calibrated from catalogue metadata. Some sparse legacy records, notably
Single-Leg Dumbbell RDL, do not establish whether a user holds one or two bells;
this audit preserves that convention rather than guessing or rewriting history.
Earlier clients can still submit scores from their older model.

## Validation

Lint and 165 unit tests pass, including every reviewed side pair's resistance and
primary muscle, shared loads, kettlebell units, band exclusions and catalogue
identity coverage. Four focused browser cases cover existing specialised search,
selection, saving, reopening, warm-ups and version switching. An additional
service-worker test covers all nine new side choices and offline save/reopen with
byte-identical routine storage and unchanged history. Full CI/native checks have
not been run locally. This follow-up is prepared for review, not published.
