# Routine-loss investigation — 2026-10-27

This records the original read-only diagnosis and the subsequently authorized
repair. Keep private account data and exported backups outside this public
repository. The owner approved the concrete recovery list before repair.

## Confirmed observations

- A device-exported backup and a SELECT-only inspection of the affected account's
  cloud plan agree: this is a stored routine-template loss, not only a Stats filter.
  Historical completed-session exercise snapshots still contain earlier routines.
- The active `workout_plans_clean` trigger was inspected. Its function only drops
  an invalid rest-day image; it does not remove routine exercises. Its definition
  matches the tracked migration. The recent rank-theme and web-push migrations do
  not update workout-plan contents.
- The affected snapshot has no per-routine edit timestamps. The current plan row
  does not provide a prior-version journal. Do not attribute the initial corrupt
  write to a particular device or user action without additional evidence.

## Reproduced code problems

1. **Destructive preset removal at startup and sync.** `loadState()` calls
   `removeStockPresets()`; `mergePlans()` calls it too. It deletes saved routines
   whose name and fingerprint match old built-in presets, records routine deletion
   markers, and clears schedule entries pointing to missing routines. This code is
   not restricted to a one-time upgrade or a newly installed account.
   The fingerprints omit sets/rest/unilateral settings, so modifying those fields
   does not protect a real customized routine. Reproducing with the historical
   built-in program deletes all original routines and produces an all-rest week.
   Renaming Full Body to Full makes that routine survive the same filter.
   The cleanup was introduced in v2.9 on October23 and retained by the modular app;
   it predates the Stats redesign. This is a confirmed dangerous mechanism, not
   proof that it initiated every aspect of the current partial-list incident.
2. **Whole-routine sync replacement propagates truncation.** The merge unit is an
   entire exercise array for each routine. A changed empty/short array can replace
   the full array and propagate to another device. A synthetic reproduction with
   the current `mergePlans()` replaces a two-exercise routine with an empty one and
   clears its scheduled day. CAS protects against simultaneous row writes, but it
   does not distinguish an intentional removal from a corrupted/truncated input.
3. **Name aliases split records.** Singular/plural variants are separate keys in
   ranking and other name-based tracking. `Preacher Curl` and `Preacher Curls`
   produce separate exercise records. The rank calculation was run against a copy
   of the exported plan; its serialized contents were unchanged afterward.
4. **Rank classification errors.** The current movement resolver classifies
   `Leg Press Calf Raise` as quads, and rear-delt names such as `Reverse Pec Deck`
   and `Reverse Chest Fly Machine` as chest. `Standing Calf Raises` can be unrated
   without a matching current routine entry. These are Stats bugs, distinct from
   the stored template loss.

## Limits and next steps

The empty/truncated cloud snapshot and the code defects are confirmed. The exact
first write that created the current bad snapshot is not established. Preset
removal alone does not explain every partial exercise list; avoid presenting that
as a fully proven incident timeline.

Before any approved repair: preserve current device/cloud snapshots, disable the
destructive cleanup, add loss detection and plan revision safeguards, and review
the preserved session snapshots against the intended routines. Exercise aliases
need explicit canonical identities with backward compatibility; do not blindly
rename historical records or merge distinct exercise variants. Obtain approval
for the concrete recovery/update plan before implementing it.


## Authorized repair follow-up

The owner subsequently approved the code/database protection fixes and restoration of the two damaged routines from saved session snapshots. Implementation is tracked in v4.2.1; the earlier read-only scope above describes the diagnosis phase. Recovery files remain private. Exact first-write attribution remains unproven.


## Completed repair and release: v4.2.1

- **Repository:** retired automatic preset removal; added owner-bound explicit removal intents, checks on incoming/outgoing sync loss, frozen in-flight baselines, bounded local safety copies, explicit exercise aliases and corrected catalogue-first muscle classification. Catalogue aliases use consistent canonical metadata. Historical logs are never renamed or deleted by alias resolution. Version, offline file list and patch notes updated.
- **Database:** additive plan-protection trigger requires exact removals approved against the current row timestamp, including from legacy clients. Keeps twenty owner-only plan revisions and an authoritative removal ledger. The access guard includes the new policy. Existing plans were not bulk rewritten. The explicitly approved account recovery updated only the damaged templates, with transaction preconditions and assertions; a fresh app export confirmed other routines, schedule, workout logs and weights unchanged.
- **Firebase / Google Cloud:** no changes, new keys, billing or paid APIs in this hotfix.
- **Validation:**112 unit,55 database and183 browser cases passed in [final checks](https://github.com/roguelineageaccmanager/gymapptest2/actions/runs/40504902252). The separate worker/subpath test passes; its duplicate in the ordinary browser project is intentionally skipped. Android project setup and signed APK asset/hash verification passed. Live anonymous plan/history access is denied.
- **Published:** [PR16](https://github.com/roguelineageaccmanager/gymapptest2/pull/16), source ddbbd31234527ca085f81e0a41b08462be3f220b, website4.2.1 / SW9856810aafa8; signed APK4.2.1 build149. The updated signed-in browser retains the recovery and shows unified exercise history.
- **Manual follow-up:** update every device before editing routines. No console setup is required. Check restored rest/left-right settings where old sessions did not preserve them; matching current configuration or defaults were used. Private backups and recovery payload remain outside the public repository.

The exact first corrupt save is still not established. These protections address the confirmed deletion/sync mechanisms without claiming unsupported incident attribution.
