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

Shared themes are validated color-only payloads and visible only to the sender and chosen
accepted recipient. Next-workout sharing returns a name/date summary only; full plans and
history stay private. Anonymous table privileges are revoked. The current access allowlist
is checked by `supabase/verify-access.sql`; unexpected policies, APIs and readable views fail it.

Keep the Android application ID and signing key unchanged when updating the app.
Never commit replacement credentials or private signing material.
