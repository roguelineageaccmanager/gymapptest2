# Numbered divisions and LP

Each eligible exercise keeps its own best qualifying set, rank and LP. These
are calculated from the user's working sets and historical body weight. They
are not rank values imported from FreeExerciseDB or population percentiles.
The existing app reference scale uses muscle targets with adjustments for some
movements/equipment; it is not a separately validated standard for every machine.

Iron, Bronze, Silver, Gold, Platinum, Emerald and Diamond have divisions
**4 → 3 → 2 → 1**. Each division has 100 LP. Master, Grandmaster and Challenger
remain undivided. Their LP continues from 0 at Master, 100 at Grandmaster and
200 at Challenger, following the app's existing fixed tier thresholds.

Stored/shared strength scores stay on the original 0–999 scale. Below Master,
each 25-score segment is one division, so one score point displays as four LP.
The next division starts at 0 LP; the stored score and tier thresholds are not
rescaled. Overall/muscle aggregation and leaderboard sorting still use the
underlying score rather than division LP, which resets at promotion.

| Strength score | Display |
|---|---|
| 400 | Platinum 4 · 0 LP |
| 424 | Platinum 4 · 96 LP |
| 425 | Platinum 3 · 0 LP |
| 450 | Platinum 2 · 0 LP |
| 475 | Platinum 1 · 0 LP |
| 500 | Emerald 4 · 0 LP |
| 699 | Diamond 1 · 96 LP |
| 700 | Master · 0 LP |
| 800 | Grandmaster · 100 LP |
| 900 | Challenger · 200 LP |

Ranked sets still require 1–12 reps and a valid body weight logged on or before
the workout. Warm-ups, hidden exercises and exercises outside the assigned
split remain excluded from ranks. The calculator only previews results.

The expanded catalogue's stretching, cardio and plyometric metadata now excludes
those movements from load-based ranking. Unsupported body-only drills, timed
holds/carries, assisted lifts and movements without a tracked muscle scale keep
their history without an invented strength rank. Supported push-ups, pull-ups,
chin-ups and dips retain the existing bodyweight calculation. Loaded Olympic
hang cleans are supported; a hanging hold is still excluded.

All 26 specifically requested loaded exercise variants are eligible for their
own rank once qualifying sets are recorded. Their identities, separate records,
routines and logged data are preserved. No migration or server-score format
change is needed. Updated clients render the division and LP from the existing
shared score; older clients continue rendering the previous tier/score format.
