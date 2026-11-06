# Editor usability review — 6 November 2026

Priorities reflect observed behaviour and saved-data risk. This is a focused
review of exercise selection and routine editing, not a claim that the entire
app has been audited. All five changes below are implemented for v4.5.2;
release checks and publication are tracked separately.

| Priority | Finding | Evidence | Work |
| --- | --- | --- | --- |
| 1 | Adding an exercise moves the picker away from the tapped result. | Reproduced on a 393 × 851 touch viewport: the tapped result moved 331 px. Routine cards grow above the picker while the update restores an obsolete absolute scroll position. | Fixed: anchor the visible control, with the picker as a fallback when a temporary result disappears. Reproduction now moves 0 px. Browser regressions cover repeated/empty/custom additions, nested results and background changes. |
| 2 | “Keep it” can lose a rest choice or the unit of a target being edited when another device deletes the routine. | A focused rest button recovered as None instead of 2:15 in a failing browser regression. Recovery treated a choice button as a text input. Typed target recovery also copied its display value without its seconds/reps suffix. | Fixed: recover only actual input values and preserve explicit target units. Existing saved history is unchanged. |
| 3 | Exercise reordering has no tap/keyboard alternative to dragging. | The row had an aria-hidden grip without an alternative, despite an old code comment saying otherwise. This is confirmed UI friction, not a claim that dragging itself was broken. | Added Order with Move up/Move down, boundary handling, focus/position return and a guard against overwriting a newer order. The grip and exercise identities remain. |
| 4 | Adding exercises to a long routine requires reaching the bottom of every existing card. | The Add exercises section follows the entire routine. Confirmed layout friction; priority 1 fixes the additional movement after each choice. | Added an Add exercises shortcut above the cards. It focuses the existing search and preserves edits; no second picker or routine copy. |
| 5 | Switching measurement replaces a custom target with defaults. | The unit-change handler initializes 30 seconds or 8–12 reps. Re-selecting the same unit preserves its target, but switching units previously had no recovery action. | Added Undo for the previous target/unit, guarded against later edits and account changes. No automatic conversion between reps and seconds. |

Picker layout changes also wait for their history layer to finish closing. A
reorder regression exposed native history scroll restoration overwriting the
app's correction after the action. Waiting for the actual popstate and following
frame fixes that race without disabling ordinary browser scroll restoration.

No production accounts or saved workouts are used for these checks. Each fixed
item needs a browser regression, relevant keyboard/focus checks and offline
verification before publication. Release status is recorded in PROJECT_MEMORY.md
and the associated pull request.
