> **Latest continuation:** `PRODUCTION_BLOCKERS_REPORT.md` records the current six-phase assessment. `MIGRATION_RECONCILIATION.md` governs the 024-before-016–023 rollout. Historical observations below remain time-scoped; no additional production migration/frontend/notification deployment was performed in the continuation.

# Danqel Social Boost — production readiness

**Assessment: 31 October 2026. Public-launch decision: NO-GO until the blockers below are cleared.**

This report separates deployed changes, live read-only observations, isolated database tests, browser fixtures and real local service-worker tests. It is not a certificate of end-to-end production operation. Existing users and financial data were preserved.

## 1. Production observations and changes

| Item | Verified result |
|---|---|
| Existing domain | `https://danqel-social-boost.onrender.com` responds; its published version marker still reports commit `d7bdd4607c9a3771dfba4e4210bc2c820304bce2`, built `2026-10-28T12:12:29.375Z` |
| Published PWA manifest | Still the old SVG-only manifest. The newer PNG/maskable manifest is built locally, not deployed |
| Supabase | Existing project `lohlvenibvohoxtfucfa`, ACTIVE_HEALTHY; retained, not replaced |
| User/data preservation | Post-hardening: 2 Auth users, 2 profiles, 6 ledger entries, total balance 90 DC — unchanged from the recorded baseline |
| Production migration applied now | `024_launch_least_privilege.sql`, registered as `20261031131450_launch_least_privilege` |
| Production feature migrations | **016–023 remain unapplied.** DC journal, launch awards, missions and push tables are absent; the extended workspace is not operational live |
| Edge deployments completed now | `payment-webhook`, version 1 ACTIVE; `verify-payment`, version 1 ACTIVE. Both are retired-payment fail-closed guards, not payment processors |
| Live Edge check | Public GET to both functions returned the online-payments-disabled JSON message. Source returns HTTP 410 except OPTIONS 204; live POST/status-header testing was not performed |
| Notification/release functions | `notification-worker` and `publish-app-release` are not deployed |
| Administrator records | Both intended accounts are email-confirmed and unrestricted; historical `admin` maps correctly to `super_admin` |
| Auth settings | Correct production site URL; email signup enabled; confirmation required; anonymous signup disabled; refresh rotation enabled. Allowlist still includes a localhost development redirect; review/remove when development use ends |
| Email readiness | No custom SMTP configured; Auth reports an email-send limit of 2/hour. Public verification/recovery throughput is not ready without configured and tested delivery |
| Push secrets | No user-managed Edge secrets configured at audit time; no VAPID/scheduler configuration was activated |
| Frontend deployment | **No new Render deployment performed.** Render management is not exposed by the available connector. Blueprint settings were inspected; actual dashboard settings/custom domains remain unverified |

### Applied security hardening

Migration 024 is deliberately independent of missing 016–023, idempotent, and tested against both the old 015 catalog and complete 023 catalog. It removes schema CREATE and table TRUNCATE/TRIGGER/REFERENCES from API/browser roles; removes direct browser DML from trusted-function-managed resources; and explicitly retains only `notifications.is_read` UPDATE for read-state changes. Normal own-profile edits remain supported. It changes no balances, financial records, Auth identities or role assignments.

Live post-checks: **31/31 public tables have RLS enabled; zero dangerous browser grants remain; direct authenticated credit UPDATE and provider-payment INSERT are false; read-state UPDATE is true; notification-body UPDATE is false.**

Do not interpret these checks as proof that every legacy RPC satisfies the new business rules. The pending 016–023 cutover is still required to retire legacy reward paths, enforce the new journal/verified missions and complete manual-only payment rules.

## 2. Implemented frontend readiness work

- Manifest: Danqel name/short name, stable ID `/`, scope `/`, language, start URL `/`, standalone mode, consistent theme/background, PNG 192/512 icons and separate maskable 512 icon. Apple touch icon and viewport safe-area metadata are present.
- Added `/install`, linked from the footer. Deliberate Chromium install action when eligible; clear Android, iPhone/iPad and desktop instructions otherwise. No automatic install or notification prompt; no claim that a shortcut proves PWA support.
- Real generated service worker: navigation NetworkFirst, offline fallback, API/release requests NetworkOnly, push-handler import, obsolete-cache cleanup and controlled update prompt.
- Fixed a real update bug: `AppUpdate` mounted outside BrowserRouter but used `Link`. It now uses a regular release-notes anchor, so an available update does not crash due to missing router context.
- Added a root error boundary with safe recovery text; no raw exception, SQL response, token or stack rendered to visitors. Saved transactions remain server-side; recovery does not clear Auth storage.
- Lazy-loaded the member shell/provider/layout and dashboard, keeping member-only code out of initial public-page imports.
- Removed unnecessary `admin_overview`/metrics queries from every admin resource search/filter request; reused overview metrics rather than immediately fetching the same snapshot twice.
- Render blueprint retains Static Site + SPA rewrites + Node 22, adds immutable caching for hashed assets, explicit worker revalidation and Permissions-Policy disabling unused camera/microphone/geolocation. These are source settings, not verified live response headers.
- Build metadata identifies dirty/unverifiable source. The release publisher rejects `sourceDirty: true`; the strict public readiness check requires a clean-source marker. Uncommitted local builds are not release identity proof.
- Added `npm run verify:production -- https://YOUR_ORIGIN`: read-only checks for matching release/HTML, manifest, real PNG dimensions, real JS/worker assets (rejects SPA HTML rewrites), offline page and bounded same-origin public JavaScript scans. `EXPECTED_COMMIT` pins the intended commit; `READINESS_OUTPUT` writes a redacted JSON report. Exit code is nonzero on failure. This static check does not certify Auth, finance, devices or the database.

## 3. Database/table and Storage audit

Catalog inventory covered **66 tables** across public, storage and auth. Application policies and API grants were inspected; the large policy response was split to recover the omitted policies. Counts alone are not an authorization test.

### Public tables — all 31 have RLS

| Policy group | Tables / intended access |
|---|---|
| Own private reads; server-managed writes | `account_consents`, `account_restrictions`, `bank_point_orders`, `points_balance`, `points_ledger`, `referral_purchase_rewards`, `subscriptions`, `user_boosts` |
| Public/configured read; trusted admin writes | `bank_transfer_details` (authenticated), `boost_plans` (active), `managed_profiles` (published), `point_packages` (active), `promotions` (active/admin), `site_settings`, `social_platforms` |
| Owner-scoped user interaction | `blocks`, `favourites`, `profiles`, `social_links`, `reports`, `notifications` |
| Relationship/private staff access | `referrals` (participants), `purchases` (owner/admin), `user_roles` (own/admin), `audit_logs` (Super Admin) |
| Legacy payment archive | `payment_transactions`: own SELECT retained; direct API writes now revoked; provider tombstones cannot credit |
| Deny direct API access / trusted RPC | `managed_profile_batches`, `profile_views`, `reward_config`, `task_claims` |
| Legacy reward definitions | `reward_tasks`: read policy retained; new verified/capped mission cutover still pending |

Public profiles/social links intentionally expose only published profile data; private account email is not added to the public profile table. Financial corrections must use audited RPCs, not browser writes.

### Storage — 8 tables

`buckets`, `buckets_analytics`, `buckets_vectors`, `migrations`, `objects`, `s3_multipart_uploads`, `s3_multipart_uploads_parts`, `vector_indexes`: all have RLS. Supabase-managed tables were not altered. Nine object policies scope avatar writes to owner prefixes, managed avatar writes to Super Admin prefixes, and receipt uploads/reads to the order owner or finance staff.

Live buckets: `avatars` and `managed-avatars` public; `bank-receipts` private. Each limits files to 5 MiB and JPEG/PNG/WebP. Receipts are evidence only, never payment authorization. MIME/ownership controls are not a malware-scanning service. Public avatar visibility and metadata/EXIF handling require appropriate privacy expectations.

### Auth — 27 managed tables

Inventoried Auth users/identities/sessions/tokens, MFA/recovery, SAML/SSO, OAuth, SCIM, WebAuthn, flow state, instances, audit entries and schema history. Some Supabase-managed Auth tables do not use RLS, but **none grant table privileges to PUBLIC/anon/authenticated**. Do not blindly rewrite managed Auth policies. No passwords, refresh tokens or private user secrets were queried.

## 4. Tests run in this readiness pass

| Test | Result / exact boundary |
|---|---|
| Full `npm test` | PASS, including new least-privilege and retired-payment runtime tests; isolated DB/runtime tests, not production Auth |
| `npm run test:deployment` | PASS manifest/icons, release marker, update-router regression, error boundary, Render source rules and negative readiness cases |
| `npm run test:secrets` | PASS supported-pattern source/build/local Git scan, 365 text sources/blobs at final scan before this report; not an exhaustive guarantee |
| Real PostgreSQL launch races | PASS 60 simultaneous eligibility updates, 20 same-account retries, rollback and hard 50-person / 250,000 DC cap |
| Real PostgreSQL deposit races | PASS ₦100/₦1,000/₦5,000 exact DC, 20 approvals, 20 refunds, conflicting review serialization, private RLS and duplicate/reversal prevention |
| Real PostgreSQL promotion races | PASS competing purchases/retries/refunds, no overspending, free connections and independent paid review |
| Real PostgreSQL admin/coupon races | PASS one-slot coupon cap and concurrent cross-demotions retaining one Super Admin |
| Real PostgreSQL notification races | PASS exclusive leasing and once-only acknowledgements; not real Web Push transport |
| Launch/mission browser fixtures | PASS claims/evidence/configuration/review/safe errors and 25 responsive layouts; mocked Auth/network |
| Manual-deposit browser fixtures | PASS exact amount, official bank, private receipt/pending-only status, statement approval/refund/filter/export and 15 layouts; no bank settlement |
| Discovery/boost browser fixtures | PASS paid vs organic, free connect/save/block/report, purchase/review and 25 layouts; mocked Auth/network |
| Administrator browser fixtures | PASS all 20 sections, member inspection, chart counts, audited support/coupon forms, ordinary-role UI denial and 20 layouts |
| New installation/update/recovery browser test | PASS five viewport layouts, keyboard activation, synthetic install lifecycle, update prompt and safe rendering of a deliberately thrown error |
| Real local built service worker | PASS registration/control, precached offline fallback on a never-visited URL, online recovery and no Supabase API cache |
| Slow-network production-build simulation | Registration form rendered in **1,864 ms** in local headless Chromium with 400 ms latency / 1.6 Mbps download. Fixtures used for backend requests; not real mobile hardware, Core Web Vitals or production performance certification |
| Local strict release gate | All static asset checks passed (36 JS assets, 732,504 bytes scanned), but **release gate correctly rejects the uncommitted local source**. Not a clean production build approval |

Published old production bundles were **not exhaustively downloaded and pattern-scanned** in this pass. Local source/build/Git scans and the local static-asset simulation are not evidence of an exhaustive live asset audit.

### Actual administrator access

For both intended administrator IDs, separate live database statements set a transaction-local `authenticated` role and trusted subject, then verified `super_admin`, allowed overview, and zero other-member rows via direct wallet table SELECT. A no-subject authenticated-role test returned no admin permission and zero wallet rows. These are **SQL authorization simulations**, not password login. Role changes in the same SELECT must not be used as RLS proof because query planning/initplans may precede them.

**Actual password sign-in, session refresh, live dashboard actions and an ordinary real Auth-account browser test remain unperformed.** No new production test accounts were created.

### Physical device/browser matrix

| Requested environment | Physical/installed test result |
|---|---|
| Android Chrome | NOT TESTED |
| iPhone Safari | NOT TESTED |
| Installed iOS/iPadOS PWA | NOT TESTED |
| Windows Chrome | NOT TESTED |
| Windows Edge | NOT TESTED |
| macOS Safari | NOT TESTED |
| macOS Chrome | NOT TESTED |

Linux headless Chromium viewport tests are not substitutes for these environments. No physical device has successfully received real push in this session. iOS/iPadOS web push requires a supported Home Screen PWA (16.4+) and deliberate permission. Keyboard-labelled controls and responsive layouts were checked; a complete screen-reader/WCAG contrast audit is still outstanding.

## 5. Complete user journey: what is and is not proven

| Journey | Evidence | Production acceptance |
|---|---|---|
| Register → email verification | Registration metadata/consent/role-spoof rejection isolated tests; real email confirmation required by Auth config | NOT TESTED end-to-end; SMTP blocker |
| Complete profile | Owner-column/RLS/validation tests and browser fixtures | NOT TESTED with new live user |
| First 50 receive exactly 5,000 DC | Isolated real-PostgreSQL cap/race/journal tests | Backend not deployed |
| Deposit ₦1,000 → exactly 1,000 DC | Isolated bank-order/independent-review/ledger tests; screenshot never sufficient | No real transfer/statement verification |
| Missions earn DC, XP remains non-spendable | Isolated mission/review/caps/XP tests | Backend not deployed |
| Free discovery/connections | Isolated RLS + browser fixtures | Full new relationship backend not deployed |
| Spend DC on promotions | Isolated atomic purchase/review/refund tests | Backend not deployed |
| Transaction history | Isolated journal/snapshot/ownership tests | DC journal absent live |
| Notifications | Inbox/preferences/worker fixtures and local real service-worker tests | Worker/secrets/schedule/device acceptance missing |
| Administrator management | Live SQL role mappings + isolated permissions/browser fixtures | Actual login/actions/refresh unperformed; backend missing |
| Ordinary account denied staff operations | Isolated verified ordinary Auth fixtures + browser denial | Actual ordinary production-account browser test unperformed |

## 6. Required deployment configuration

### Render Static Site

- Existing application only; no replacement backend, Railway or Netlify.
- Build: `npm ci && npm run build`; publish directory: `dist`; Node `22.22.3`; SPA rewrite `/* → /index.html`.
- Frontend variables **only** `VITE_SUPABASE_URL` and public `VITE_SUPABASE_ANON_KEY` (anon/publishable key). Never service-role, bank/provider, VAPID-private or cron credentials.
- Blueprint tracks `main`, while this work remains on `arena/24d9981d-addmeup-frontend`. Use the authorized review/merge/deployment process; no branch switch or push to main was performed. Work is uncommitted and not published.
- Rebuild from the intended clean commit; verify actual HTML/version/assets, deep-link refresh, response headers and service-worker update behavior on the published domain. Run the strict checker with `EXPECTED_COMMIT`. It is not sufficient to inspect local `dist`.
- No custom domain was supplied or verified. Current verified public URL is the onrender.com domain above.

### Supabase Auth

Retain the current project/users. Configure custom SMTP and sender/domain authentication securely in Supabase; verify signup confirmation, resend, recovery and production redirects on real mailboxes. Review signup-abuse/CAPTCHA requirements, email limits, password strength and actual delivery. Do not put SMTP passwords in chat or Vite.

### Database migration gate

The missing **016 DC economy; 017 wallet/spending; 018 launch reward; 019 missions/progression; 020 discovery/promotions; 021 manual-only deposits; 022 push/inbox; 023 workspace** must be rolled out in order after recoverable-backup/data-impact checks. Owner authorization is already recorded, but the rollout is still unexecuted. Preserve the 90 DC baseline and existing ledger records; review genuine automatic launch awards separately from preservation checks. Never `db reset` or replay 001–015 blindly. Migration history is partial; check catalog and registered names. 024 is already applied and is idempotent; reconciliation must not mistake this for 016–023 being installed.

### Payments — manual only

**No Paystack checkout, provider secret or payment webhook configuration is required or authorized for this release.** Keep the two retired endpoint guards disabled for crediting. Use Moniepoint **6977298247**, **LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST**, fixed **₦1 = 1 DC**, and independent receiving-bank statement verification before approval. Complete migration 021 and the real bank/deposit acceptance; a screenshot or frontend success cannot authorize credits. Historic provider records remain preserved.

### Notifications

Deploy `notification-worker` and `publish-app-release` only with the tested schema and secure configuration. Supabase provides runtime `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; keep private values exclusively server-side.

Set private Edge configuration securely: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, legitimate contact `VAPID_SUBJECT`, random `PUSH_CRON_SECRET`, and `PRODUCTION_ORIGIN=https://danqel-social-boost.onrender.com`. Only the public VAPID key goes into `public.push_config`. Configure Vault `danqel_push_worker_url` / `danqel_push_cron_secret`, then the bounded scheduler in `supabase/manual/022_push_schedule.sql`. Never paste keys into chat or source.

Keep deliberate opt-in, refusal persistence, quiet hours/category/reminder/unsubscribe controls and inbox fallback. Test expiry, retries, physical display and click routing. Publishing a schema or accepting a push at a provider does not prove device delivery. Never announce failed/unpublished/dirty releases. Full setup remains in `PUSH_NOTIFICATIONS_AND_UPDATES.md`.

## 7. Remaining launch blockers

1. Missing coordinated 016–023 production backend rollout and post-migration financial checks.
2. Clean, reviewed frontend commit and actual Render deployment/asset/service-worker verification.
3. Custom SMTP and real signup → verify → login → refresh/recovery acceptance.
4. Real administrator and ordinary-account browser authorization tests.
5. Real manual deposit statement approval/refund acceptance at fixed ₦1 = 1 DC.
6. Notification Edge/secrets/Vault/scheduler configuration and supported physical-device tests.
7. Full real-device/browser, screen-reader/contrast and production slow-network acceptance.
8. Operational backup/recovery, monitoring, incident response, abuse controls, support ownership and retention procedures still require owner verification.

**Do not announce a reliable public launch or mark the 13-step live journey successful until these gates are actually cleared.**
