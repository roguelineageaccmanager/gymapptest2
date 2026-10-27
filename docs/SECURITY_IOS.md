# v4.2 security and iOS setup

Gym Tracker uses **Supabase email/password Auth and Postgres**, not Firebase Auth or
Firestore. Firebase supplies messaging only. Existing friend-only photos, shared
summaries and the signed-in community chat retain their intended sharing rules.
Private workout history, account settings and notification tokens remain owner-only.

## Repository changes

- Stats now shares Friends' tabs, spacing and control colors. Original Spark, Forge,
  Alloy, Vanguard, Apex, Nova, Eclipse, Ascendant and Zenith badges replace the old
  labels. A custom swatch/hex/RGB picker saves rank colors per account; stable stored
  IDs preserve existing saved themes. The scoring formula is unchanged.
- Pinned official Firebase app/messaging-only modules are bundled locally, without
  Analytics, Auth or Firestore. Apache license included. Public app configuration,
  restricted web API key and public VAPID key contain no server credentials.
- One existing worker owns offline caching and notifications under `/gymapptest2/`.
  `firebase-messaging-sw.js` is imported by `sw.js`, not registered as a conflicting
  second worker. Worker updates bypass the browser HTTP cache; each shell cache has
  a content hash, and fetches use the current cache. The manifest has relative
  identity/start/scope and standalone display. Apple icon/title metadata added;
  existing safe-area/status-bar support retained.
- Settings requests web notification permission only after a tap. Safari tabs show
  Home Screen instructions; installed iOS/iPadOS apps require 16.4+. Foreground
  messages use escaped in-app alerts; background alerts open only this app's Chat.
  Native Android registration remains separate. Account/token ownership and opt-out
  use the existing protected server registry.
- CSP remains strict, including Trusted Types. Only the two messaging-registration
  hosts were added to `connect-src`; no CDN scripts or inline-script exception.
  All HTML sinks are centralized in the escaping `html` renderer in `js/core/dom.js`.
  Chat/usernames use that renderer or textContent. Client validation supplements
  server constraints; it does not replace row-level security.
- Both community chat RPCs now return at most 50 messages with cursor pagination.
  Server checks already bind sender UID, reject direct insert/update, validate
  trimmed messages of 1–1000 characters and limit sends to 30/minute/account.
  Only owners can delete their messages. Token rows are owner-readable with
  installation-key-bound registration, and are never included in public profiles.
- Expired device registrations are removed after 90 days, queue entries after two
  days, and invalid/unregistered FCM tokens on send. Generic payload errors do not
  delete valid device registrations. A protected sender health check does not claim
  or drain chat jobs.
- Added guarded migration/deployment checks, web notification flow tests, actual
  offline-worker/subpath coverage and chat pagination integration coverage.
  Browser CI uses preinstalled Chrome when available, with Chromium installation
  as a fallback, avoiding the stalled redundant browser setup observed in this run.
- Existing main-branch protection, main-only production environment, pinned Actions,
  read-only test/deployment workflow permissions and separate APK signing job were
  retained. No repository or deployment protection was disabled.

## Applied service changes

1. Locked the unused legacy Realtime Database to deny read/write, permanently
   deleted its data after explicit user confirmation, and disabled the empty
   instance. Instance metadata remains because the console offers disable rather
   than instance deletion. Gym Tracker's Supabase database was retained.
2. Registered Gym Tracker Web in the existing Firebase project and generated a
   Google-managed VAPID pair. No private half was downloaded.
3. Created a separate **Gym Tracker Web Push** public API key, restricted to
   `https://roguelineageaccmanager.github.io/*` and **FCM Registration API** plus
   **Firebase Installations API**. Origin-wide referrer matching accommodates
   browsers trimming cross-origin referrers. Android and legacy browser keys were
   not modified. No service-account key was created/downloaded and no paid API,
   billing, trial or Blaze upgrade was enabled.
4. Read-only production audit passed the existing row-access guard. Email sign-in,
   email confirmation and refresh-token rotation are enabled; anonymous sign-in is
   disabled. Site URL and redirect allowlist both point to the GitHub Pages app.
   Raised the server password minimum from six to eight, matching existing UI.
   Password-change reauthentication remains unchanged to preserve the existing
   recovery flow; it is not represented as enabled.
5. Deployed additive migration `20261027000000` and the existing notification sender
   update. The existing protected messaging-only sender credential was reused
   inside the server, never downloaded or copied into this release. Anonymous
   sender access returned 401; authenticated health and access guards passed.
   Read-only audit run: 40463857643. Checked deployment: 40464137142.

## Firestore rules and App Check

The Firebase console shows **Create database**: Firestore is not provisioned. There
are no Gym Tracker documents or Firestore rules to deploy. `firestore.rules` is an
explicit deny-all reference for accidental future use:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

It grants nobody access; Supabase policies/RPC checks protect the actual app data.
Do not create an unused Firestore database to publish these rules. Firebase Auth
authorized domains do not control Supabase Auth. If Firebase Auth is intentionally
introduced later, add `roguelineageaccmanager.github.io` (hostname only); review
existing domains before removal rather than deleting another app's domains.

App Check does not directly enforce Supabase requests, and FCM is not listed among
its supported Firebase services. No unused reCAPTCHA/paid service was introduced
and no unsupported protection is claimed. A future custom-backend App Check
integration would need explicit server verification and separate design.
References: [Firebase API keys](https://firebase.google.com/docs/projects/api-keys),
[FCM web setup](https://firebase.google.com/docs/cloud-messaging/web/get-started),
[foreground/background handling](https://firebase.google.com/docs/cloud-messaging/web/receive-messages),
[App Check supported services](https://firebase.google.com/docs/app-check).

## Audit findings and limitations

Reachable Git history was scanned for PEM private-key material, GitHub tokens,
Supabase secret/service-role tokens and Google access tokens: no matching privileged
credentials found in 2552 unique objects / 1494 text blobs at the initial scan.
The historical debug signing keystore was already retired; the release key is held
in protected signing secrets. Public Firebase/Android identifiers are client config,
not admin credentials. Dependency audit after reducing the SDK reported zero known
vulnerabilities. These checks do not prove no credential has ever leaked elsewhere.
The final working-tree scan covered 232 text files with no matching privileged
credentials. A live synthetic installation check accepted the allowed GitHub Pages
referrer (200), rejected another site (403), and removed the test installation (200)
without printing or retaining its tokens.

The unrelated old database had public access before removal. Its former contents
must be considered potentially exposed; rotate any still-active credentials that
were stored there. No claim is made that someone accessed them. No contents are
included in this report. Existing sender certificate renewal remains due before
2027-10-26; no key rotation was performed in this update.

Real iPhone/iPad background delivery requires a physical installed app; simulated
browser permission and routing tests cannot establish device delivery. Android's
earlier released closed-process push test is documented in PROJECT_MEMORY; current
release validation is recorded there separately.

## Ordered console/device checklist

1. **Database rules:** complete for the unused RTDB (deny-all, empty, disabled).
   Leave Firestore unprovisioned. No rule-publishing step remains for Gym Tracker.
2. **Auth:** Supabase site/redirect URL and email/anonymous settings were verified;
   eight-character password minimum is applied. No Firebase Auth domain change is
   required. Do not enable anonymous access.
3. **API key:** restrictions are saved on Gym Tracker Web Push. To inspect them:
   Google Cloud → APIs & Services → Credentials → Gym Tracker Web Push. Leave its
   website restriction and two APIs intact; do not use a referrer key for Android.
4. **VAPID:** generated and public key installed in code. Firebase → Project settings
   → Cloud Messaging → Web Push certificates shows the pair. Do not regenerate it
   casually, because existing subscriptions would need re-enabling.
5. **App Check:** no applicable console enforcement step for the present messaging-
   only Firebase/Supabase architecture. Do not enable billing to add one.
6. **iPhone/iPad:** open the website in Safari → Share → Add to Home Screen. Launch
   the icon, sign in, open Settings → Enable notifications and tap Allow. Have a
   friend send a test chat message while the app is closed, then tap its alert and
   confirm Chat opens. Check Focus/notification settings if no alert appears.
