# Security

Report vulnerabilities through this repository's **Security → Report a vulnerability** page.
Do not post access tokens, database rows, signing files or account details in public issues.

Production deploys use the protected `production` environment. Workflow permissions default
to read-only, external Actions are pinned to commit hashes, and Android signing runs separately
from the build. Browser code contains only the public Supabase key; database row policies
enforce account ownership and accepted-friend access.

The main branch blocks force pushes/deletion and requires pull requests plus tests for
non-admin changes. The repository owner retains direct-publish bypass. Secret scanning,
push protection, dependency alerts/security updates and pinned Action references are enabled.
Production environment secrets remain restricted to main.

Shared themes are validated color-only payloads. New explicit shares are visible to
all signed-in users, including the publishing username. Existing private gifts stay
limited to their sender and chosen recipient. Gym chat deliberately shares message
text, usernames and timestamps with signed-in users (existing block boundaries are
respected). Only message owners can delete their messages; direct message insertion
and editing are denied. A token-bound RPC enforces 1,000 characters and 30 new sends
per minute, with idempotent retry IDs. Neither community feature grants access to
private plans, weight history, email addresses, tokens or other health records.

Legacy private theme gifts remain visible only to the sender and chosen
accepted recipient. Next-workout sharing returns a name/date summary only; full plans and
history stay private. Anonymous table privileges are revoked. The current access allowlist
is checked by `supabase/verify-access.sql`; unexpected policies, APIs and readable views fail it.

Keep the Android application ID and signing key unchanged when updating the app.
Profile banners follow the picture access rules: owner writes and owner/accepted-friend
reads only, with anonymous access revoked and account deletion cascading. Images are
bounded, re-encoded JPEG data only; external URLs and SVG are rejected. Profile views
reuse the existing friend-summary access rules and never expose private workout logs
or weight history. Requests capture the originating account token and stale responses
cannot enter another account's profile view or banner cache.

Never commit replacement credentials or private signing material.
