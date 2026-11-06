# Exercise library expansion

The picker now has **393 unique exercises, 97 new** compared with the 296
previous identities. A reviewed 107-record FreeExerciseDB subset supplies
90 new movements plus metadata for existing/curated entries. Seven additional
missing variants have curated names/instructions. Manufacturer names are omitted.

Existing names and identity aliases are unchanged. Search aliases are catalogue
metadata only. No routine, history, best, rank, sync or warm-up data is migrated.
JM Press remains an optional library entry. Newly selected movements retain the
existing two working sets (two per side for unilateral movements).

| Requested exercise | Picker entry | Status |
|---|---|---|
| Single-arm cable lateral raise | Single-Arm Cable Lateral Raises | Reused |
| Single-arm cable rear delt fly | Single-Arm Cable Rear Delt Fly | Reused; curated instructions |
| Smith shoulder press | Smith Machine Shoulder Press | Reused |
| Smith incline bench press | Smith Machine Incline Bench Press | Reused |
| Chest press machine | Chest Press Machine | Reused |
| Plate-loaded Row | Plate-Loaded Row | Reused; curated instructions |
| Plate-loaded Low Row | Plate-Loaded Low Row | New curated variant |
| Plate-loaded Pulldown | Plate-Loaded Pulldown | New curated variant |
| Seated lumbar/lower-back machine | Seated Lumbar Extension Machine | New curated variant |
| 45° back extension | 45-Degree Back Extension | Reused; curated instructions |
| Preacher curl | Preacher Curl | Reused |
| Supinating dumbbell curl | Supinating Dumbbell Curl | New curated variant |
| Reverse cable biceps curl | Reverse Cable Bicep Curls | Reused; preserved Forearms identity |
| Arm-at-side single-arm cable triceps extension | Single-Arm Tricep Pushdowns | Reused; curated instructions/aliases |
| Rope overhead cable triceps extension | Rope Overhead Cable Triceps Extension | New curated variant; matched source media |
| Cable wrist flexion | Cable Wrist Flexion | New curated variant; matched source media |
| Cable wrist extension | Cable Wrist Extension | New curated variant |
| JM press | JM Press | Reused |
| Leg press | Leg Press | Reused |
| Seated leg curl | Seated Leg Curl | Reused |
| Leg extension | Leg Extension | Reused |
| Hip abduction machine | Hip Abduction | Reused existing identity alias |
| Hip adduction machine | Hip Adduction | Reused existing identity alias |
| Standing calf raise | Standing Calf Raise | Reused |
| Leg-press calf raise | Leg Press Calf Raise | Reused |
| Abdominal crunch machine | Abdominal Crunch Machine | Reused |

Primary muscle chips retain the existing group semantics. Name/alias searches
also find mapped primary and secondary muscles. Equipment filters distinguish
plate-loaded machines, cable stacks, Smith machines and other equipment.

Instructions and metadata ship in the offline shell, including Android assets.
Photos load lazily only in details, using pinned source URLs with anonymous CORS
and no referrer. The web worker caches up to 80 viewed photos separately; an
unavailable/uncached image shows a placeholder offline. There is no bulk photo
download. Variants without a verified matching demonstration use a placeholder.
Android photo persistence depends on WebView cache/service-worker support.

The upstream repository declares data and imagery public domain under Unlicense.
Its full license, revision and original dataset credits are shipped in
`vendor/free-exercise-db-LICENSE.txt` and `vendor/free-exercise-db-NOTICE.txt`.
No paid service, new account, database migration or runtime catalogue API is used.
