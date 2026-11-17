# Shared friend ranks and body graphs — draft

Accepted friends can open a member profile to see both body views, regional muscle
ranks and all qualifying exercise ranks. Tap an exercise to see the qualifying
working set, weaker-side rule, load multiplier, estimated 1RM, reference target
and score formula. The profile uses the same rank and regional body-graph helpers
as the owner's Stats view, with divisions/LP and theme colors. Shared details are
cleared when sharing disappears or the account switches.

A bounded optional `leaderboard_stats.rank_details` JSON field stores a versioned
snapshot, not private workout logs. It contains qualifying active/unhidden lifts
only. Existing owner writes, accepted-friend reads, block-ending friendships and
score-consent guard/deletion triggers remain authoritative. No new RLS grants or
privileged functions are introduced. Legacy clients omit this field; legacy
servers fall back to aggregate score uploads and a clear details-unavailable view.
Snapshots carry their calculation timestamp so old details are not labelled fresh.

Shared snapshots omit historical body weight, weight ratios and bodyweight-lift
normalized loads that would reveal it. The separate existing weight-sharing
setting controls the profile's latest weigh-in. A member can inspect their own
complete calculation locally. Hidden/inactive lifts, warm-ups and unsupported
holds never acquire shared strength ranks. Overall/primary/regional ranks are
rehydrated from validated qualifying lifts rather than trusting supplied markup
or an arbitrary root score. This is a client-computed game ranking, not a verified
strength standard or a calibrated comparison of different machines.

Migration `20261117081157_friend_rank_details.sql` is applied to live project
`aiiyombsmvlbhifxgkhp` after the owner explicitly approved that production change.
The earlier automatic approval rejection is resolved. The repository filename
matches the server's actual migration version. A transaction using a temporary
copy verified acceptance of valid snapshots and rejection of missing, malformed,
over-2,000-entry and over-1MB payloads, with all fixtures rolled back. RLS remains
enabled, the same four policies remain, anonymous SELECT/INSERT remain denied,
and an authenticated role without a user JWT sees zero rows. Existing data was
not rewritten. Hosted security advisories were checked after applying the change.

Friends' details populate when an updated client publishes scores. Earlier APKs
send aggregate scores only; the official APK has not been released by this draft.
No historical ranks are fabricated from best weights without repetition data.

Lint and 174 unit tests passed. Four distinct focused browser cases passed for
single-arm cuff logging, upper-arm cuff offline persistence/clearing, exact
320-pixel Equipment/Attachment/Version/Warm-up alignment and Smith names, and
friend body graphs/calculation display, sharing revocation/account-switch clearing.
Friend API responses were mocked with synthetic fixtures; no production workout
records were used. An integration case covers friend/nonfriend/anonymous reads,
owner-only writes, bounded JSON and opt-out deletion, but it has NOT run locally:
local Supabase image unpack ran out of disk space and startup was stopped.
Full CI/native checks remain pending. Hosted schema/policies and security advisories
were inspected read-only. Only the approved additive schema field was changed; no live workout records were rewritten.
