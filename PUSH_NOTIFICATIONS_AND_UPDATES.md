> **Latest continuation:** `PRODUCTION_BLOCKERS_REPORT.md` records the current six-phase assessment. `MIGRATION_RECONCILIATION.md` governs the 024-before-016–023 rollout. Historical observations below remain time-scoped; no additional production migration/frontend/notification deployment was performed in the continuation.

# Push notifications and production update announcements

## Status — 2026-10-31

Implemented and tested **locally**, not deployed. Production was inspected read-only: no push-subscription table and no deployed Edge Functions. Previous migrations 016–021 and new **022** remain staged. No production notification, secret, schedule, financial row or Auth user was created/changed in this task.

**No physical device/browser combination has successfully received a real push in this session.** The implementation must not be described as production-verified until the deployment and physical-device acceptance below are completed. There is no VAPID configuration or active scheduler in production yet.

## Implemented experience

- `/notifications`: private server-paginated inbox, unread/read/category filters, exact local timestamps, mark one/all read, app destinations, loading/empty/error/retry states and preferences.
- Explicit **Enable notifications on this device** is the only permission-request path. Opening a page, signing in, saving preferences and a worker update never request permission. Denied permission disables the button and explains browser settings; no repeated automatic prompts.
- Per-account master push switch, independent combined daily-reminder switch, preferred local reminder time, validated IANA time zone, paired optional quiet hours and twelve category toggles. Category preferences control push; durable in-app account/announcement records remain available.
- iPhone/iPad instructions: compatible iOS/iPadOS 16.4+ Home Screen web app, deliberate installation and permission. Ordinary iOS browser tabs are shown installation guidance instead of being repeatedly prompted. Capability detection, not a universal compatibility promise, determines availability.
- Device metadata list, revoke one device, unsubscribe this device and logout cleanup. Remote server revocation is possible without exposing endpoints/keys. Revoked endpoints are disabled; 404/410 disables expired subscriptions. Native/browser permission revocation may leave a server row until it is explicitly revoked or receives a gone response.
- App update banner preserves the existing save-work/update-now workflow and adds release notes. `/release-notes` shows the actual served package version, Git build identifier/timestamp and separately confirmed production notes. A served build can precede an administrator's announcement.

### Notification types / sources

| Type | Trusted source |
|---|---|
| Daily visit, wallet, Explore and campaign reminder | One combined opt-in daily template, not five separate nudges |
| Daily missions | Combined daily reminder; targeted mission announcements |
| Rewards/bonuses | Existing launch/mission notifications plus reviewed announcements |
| New connections | New `member_connections` insert; pair/day dedup, no DC or XP |
| Profile/reward boost changes | Reward multiplier activation/expiry and promotion window expiry |
| Promotion decisions | Actual campaign status transitions, including approval/rejection/pause/resume |
| Deposits/refunds | Existing independently verified manual-bank notifications; no Paystack integration restored |
| Important account notifications | Existing trusted account notifications and controlled staff messages |
| Features/events/campaigns | Authorized scheduled announcements |
| Production versions | Independently confirmed production release with authored release notes |
| Security | Actual email/password changes, role changes and restrictions; controlled security announcements |

Security notifications are not a comprehensive intrusion-detection system, and do not replace authentication/email recovery controls. Account/deposit/security push title/body are generic to limit lock-screen exposure; their full contents stay in the private inbox. Other opted-in categories can display content on the lock screen: device preview settings still apply.

## Backend architecture and limits

Migration `022_web_push_notifications.sql` extends the existing `notifications` table; no second backend or financial system is introduced. It adds preferences, private subscriptions, durable per-device outbox rows, append-only attempt outcomes, templates, scheduled announcements and confirmed production releases. Existing notification history is not replayed to push.

- Notification insertion creates outbox rows only for active opted-in devices/categories. Preferences, restriction status and bidirectional connection blocks are checked again when claiming a job.
- Subscription endpoints and encryption keys cannot be selected by browser clients, including the owner. Owners get only safe device metadata. Native PushSubscription data is submitted over authenticated Supabase RPC; HTTP endpoint/key formats are validated. Known HTTPS FCM/Mozilla/Apple/WNS hosts are allowlisted in SQL and again in the worker to prevent arbitrary URL/SSRF requests. Other providers require a reviewed allowlist change rather than accepting arbitrary hosts.
- Maximum ten active devices per member, serialized under an owner lock. A native endpoint cannot silently transfer to another account. Shared devices must unsubscribe the previous account; logout attempts native unsubscribe before clearing Auth.
- `notification-worker` is a Supabase Edge Function, authenticated by a separate >=32-character `PUSH_CRON_SECRET`. It does not accept ordinary member tokens as scheduling authorization. Service-role-only RPCs tick schedules, lease deliveries and record outcomes; browser clients cannot manufacture successful sends or releases.
- `supabase/manual/022_push_schedule.sql` installs one named minute-level pg_cron/pg_net job using **Vault references**, not literal credentials in cron SQL. Overlapping ticks are serialized. Tick batches at most 200 due daily preferences, five announcement batches of 200 recipients each and bounded expiry notices. A large audience drains over multiple minutes; monitor backlog age and raise capacity deliberately.
- The scheduler uses PostgreSQL IANA time zones and local calendar days, with explicit spring-forward/fall-back tests. One daily event per user/local day; no multi-day catch-up storm. Schedule backlogs over six hours old are skipped; next due time advances from current time. Daily push jobs expire after six hours; other push jobs after 24 hours. The in-app record remains available.
- Every category respects configured quiet hours, including overnight windows; no implicit emergency bypass. Equal quiet start/end means no quiet window. Pair both fields or clear both. Deferred jobs can expire rather than delivering stale messages.
- At most five distinct reserved/accepted push messages per member/local day, shared across devices. Retries do not create new messages; expired/failed provider requests are not proof of display. Queue quota is rechecked under serialized claims. In-app records are not discarded by push limits.
- A claim leases at most 20 jobs for five minutes. Four bounded-concurrency senders have 10-second network timeouts. Up to four attempts; exponential retry delay, bounded Retry-After for 429/5xx/network failures. Permanent errors stop; 404/410 deactivates the endpoint. Stale lease acknowledgements are rejected. Expired leases record an outcome and can be reclaimed.
- Attempts are append-only and contain outcome/HTTP code/time, never endpoint secrets or raw provider error bodies. **Accepted** means accepted by the push service, not displayed, delivered to a physical device, opened or read.
- Web Push is at-least-once at the transport boundary: a worker can crash after provider acceptance but before the database acknowledgement. The service worker uses stable notification tags and seven-day IndexedDB deduplication to suppress repeats where storage is available. Exactly-once physical display is not promised. In-flight/accepted pushes cannot be recalled by cancellation, preference changes or logout; native unsubscribe and generic private-category previews reduce exposure.
- Without VAPID configuration, the authenticated scheduler can still publish in-app notifications; it does not claim push jobs. Inbox fallback does not depend on granting browser permission.

## Admin controls

Admin → **Push & notifications**, verified Super Admin only for broadcast operations:

- Author announcements; target all users, verified users, members with active campaigns, or up to 100 explicitly selected member UUIDs.
- Choose category/app destination, send at the next tick or schedule using the administrator browser's local time (stored as an absolute timestamp).
- Require content/scope/timing review, authorization checkbox and audit reason. Stable request UUIDs and recipient event keys prevent duplicate publication on retries.
- Create/edit templates and load templates into announcements. Saving a template does not send anything. The combined `daily_reminder` category cannot be repurposed to bypass daily preferences.
- Cancel remaining fan-out and pending push. Already-created inbox records and in-flight/accepted pushes cannot be recalled.
- View active registrations, global pending/leased/accepted/failed/skipped/expired counts, latest 20 append-only outcomes and announcement inbox recipient counts. These are real database values, not reach estimates.

Existing support staff may inspect/send their separately authorized account messages; they cannot use the new root-only broadcast/release functions. No new privileged role or public role-assignment path is added.

## Production releases — never announce a build that is merely compiled

`vite.config.js` emits package version, commit and build time in `version.json`, plus a matching `danqel-build` meta tag in the HTML. Existing Workbox precaching, NetworkFirst navigation, API NetworkOnly rules and update prompt are preserved. `push-handler.js` is imported by the generated worker; notification clicks are constrained to approved same-origin app destinations.

The authorized administrator authors notes and submits the expected **deployed** SHA and package version through `publish-app-release`. The Edge Function:

1. Authenticates the real bearer session and verifies active, verified Super Admin access.
2. Requires explicit authorization and an audit reason.
3. Fetches only the fixed `PRODUCTION_ORIGIN`, never a user-supplied URL, with timeout/no-store/no-redirect rules.
4. Requires healthy HTML, matching HTML build meta, matching JSON commit **and version**, and a valid nonfuture build timestamp.
5. Calls the service-only publication RPC. Commit serialization and unique release/announcement constraints permit one announcement per production commit. Notes remain public and immutable through the client APIs.

An unavailable origin, mismatched/preview commit, wrong version, failed response or missing healthy build marker cannot create a release announcement. A later rollback is a new operational decision: already accepted announcements cannot be recalled. Publication is a deliberate **post-deploy confirmation**, not an automatic build hook. Do not announce from the Render build command: production may not yet serve that build. No release notes are invented from an unpublished build.

## Setup — existing Supabase + Render only

1. Review backups/migration history and apply **only missing migrations in order through 022**. Earlier 016–021 remain staged and have separate economy/launch implications; do not reset/replay existing production tables.
2. Generate a VAPID pair on a trusted workstation into a private file **outside the repository** with owner-only permissions. For example, after `umask 077`, use `npx --yes web-push@3.6.7 generate-vapid-keys --json > /secure/path/vapid.json`. Do not paste keys into chat/logs/Git.
3. Prepare `/secure/path/push.env` (owner-only) with `VAPID_PUBLIC_KEY`, **`VAPID_PRIVATE_KEY`**, a real contact `VAPID_SUBJECT` (`mailto:` or HTTPS), `PUSH_CRON_SECRET` (cryptographically random, >=32 characters), and `PRODUCTION_ORIGIN=https://danqel-social-boost.onrender.com`. Store them via `supabase secrets set --env-file /secure/path/push.env` for the existing linked project. Supabase supplies the Edge service-role environment. **No private VAPID/service-role/cron key in Vite, Render frontend variables, public config or browser bundles.** Remove private temporary files securely according to workstation policy.
4. Set **only the public VAPID key** in `public.push_config` (`id=true`) using trusted SQL. Never store the private key in that table. Rotating the pair requires updating the Edge secret/public configuration together and re-enabling affected devices; the client detects a changed native application-server key where supported.
5. Deploy `notification-worker --no-verify-jwt`: its handler requires the private cron bearer secret on every POST. Deploy `publish-app-release` with the appropriate authenticated gateway configuration; the handler independently authenticates the bearer session even if gateway changes are needed for the project's key type. Do not weaken handler authorization.
6. In Supabase Vault, create `danqel_push_worker_url` containing this project's deployed `/functions/v1/notification-worker` URL, and `danqel_push_cron_secret` containing the same private cron token as Edge. Apply `supabase/manual/022_push_schedule.sql` in the trusted dashboard. Only this named schedule is replaced. Never put secret literals into cron SQL, Git or chat.
7. Deploy the matching React/Vite build on Render over HTTPS. Verify `version.json`, matching HTML build meta, `/sw.js`, `/push-handler.js`, manifest/PNG icons and service-worker activation. Preserve current SPA rewrites and no-store version response. Confirm the successful production build before using the release announcement form. Bump `package.json` version deliberately for a new version label.
8. Monitor `cron.job_run_details`, trusted `net._http_response`, admin outbox statistics and append-only `push_attempts`. A cron HTTP enqueue or Edge 200 does not prove physical display. Alert on repeated failures, no scheduler activity and growing/expiring backlog. Secret rotation, queue retention and audit retention are owner operational policies, not silently enabled browser tasks.
9. Disable the named cron schedule and/or revoke subscriptions to pause future dispatch if necessary. Do not delete journal/notification/audit history or re-enable Paystack. This implementation leaves the manual-only payment policy intact.

## Verification performed

- `npm test`: full regression suite, including full 001–022 notification workflows and mocked runtime tests.
- `npm run test:push:concurrency`: real embedded PostgreSQL authenticated/service-role sessions; ten competing workers claim one queued delivery once, ten concurrent acknowledgements record one result, stale leases recover without allowing stale acknowledgements. These are real database concurrency tests, not real Web Push transport.
- SQL tests: preferences/time zones/DST/quiet hours/category validation, endpoint SSRF restrictions, private subscription columns, unauthorized sends/results/release denial, retries/max attempts/410 deactivation, read-all/private inbox, reminder/daily dedup, per-message cap, free-connection pair/day dedup and block suppression, credential-change security message, selected broadcast/idempotency and release records.
- `tests/push-runtime.test.mjs`: mocked Edge auth/queue/provider outcomes, URL restrictions, safe service-worker notification/click handling and failed/mismatched production release gating. Edge code is transformed and exercised with mocks; **a real Deno/Supabase Edge runtime was not executed**.
- `tests/push-browser.smoke.mjs`: headless Chromium with intercepted Supabase and mocked PushManager/Notification APIs; permission only after explicit click, enable/unsubscribe, time/quiet/category saves, inbox filters/read-all, template/announcement confirmation, rejected release and published notes. Fifteen portrait/landscape phone/tablet/desktop layouts (320–1440px) assert no document overflow/uncaught JS errors. iOS user-agent installation guidance and denied-permission fallback are also **simulated**, not physical device tests.
- Build/deployment artifact checks confirm worker import, push/click handlers, current version metadata and preserved caching/update prompt. Secret scan and `git diff --check` pass. No VAPID private credential was generated or exposed in this session.

## Real-device acceptance matrix — outstanding, not passed

| Device/browser target | Physical push result this session |
|---|---|
| Android Chrome / other supported Android browsers | **Not tested** |
| Installed iPhone/iPad Home Screen web app (supported iOS/iPadOS) | **Not tested** |
| Windows Chrome / Edge / Firefox where supported | **Not tested** |
| Supported macOS Safari / Chrome / Firefox | **Not tested** |

For each consenting pilot device after deployment, record exact OS/browser versions, installed/noninstalled state, permission result, subscription registration, provider acceptance, actual visible notification with app closed, click destination, revoke/unsubscribe, denied-permission fallback, quiet-hour deferral and a real timezone reminder. Test unavailable/expired endpoints, repeated schedule ticks, no repeated display, actual manual-deposit/promotion/reward events, and an unpublished release that produces no announcement. Then test a genuinely published release with accurate notes, its push, safe click and update prompt/service-worker activation. Record actual timestamps and device evidence without copying subscription secrets.

Also outstanding: hosted Auth sign-in/refresh, real VAPID encryption/transport and provider acceptance, Vault/cron reliability, Edge runtime compatibility and live Render release checks. **Implementation and local tests are not evidence that notifications are guaranteed on any device.**
