> **Current payment policy (2026-10-31): MANUAL BANK TRANSFER ONLY.** Online Paystack processing/actions have been retired. Provider setup, secret and webhook instructions below are historical and must not be followed. Use `MANUAL_DEPOSITS_ONLY.md` and migration 021 for the current implementation and rollout. Historical payment records are preserved.

# Danqel Social Boost — master project audit

Audit date: 31 October 2026. Branch: `arena/24d9981d-addmeup-frontend`, starting at `d7bdd4607c9a3771dfba4e4210bc2c820304bce2`. This report was prepared before editing application code for this request. Results below distinguish source inspection, direct read-only production metadata, local tests and unperformed workflows. This is a broad implementation review, not a formal security certification.

## Architecture and repository inventory

Existing React 18 / Vite 7 frontend, React Router, Supabase JS, CSS/Tailwind, vite-plugin-pwa/Workbox. Render static-site configuration builds `npm ci && npm run build`, publishes `dist`, rewrites SPA routes to `/index.html`, sets document/release cache headers and emits a commit/build marker. No new Node backend, Netlify, Railway or Supabase project is needed or introduced.

- `src/pages`: public, auth, creator/member, economy and admin route components.
- `src/components`: shared navigation, cards, uploads, notifications, purchase UI and PWA update prompt.
- `src/context`, `src/member`: real Auth/Site/Member contexts and the authenticated workspace shell.
- `src/admin`: authorized resource configuration and existing action/create/programme/bulk dialogs, receipt evidence and admin CSS.
- `src/design`, `src/index.css`, `src/member/member.css`: layered design styles. There are several brand-mark implementations and overlapping legacy style selectors; consolidate branding without rewriting working route logic.
- `supabase/migrations`: canonical 001–011 schema/security/feature stages at audit start.
- `supabase/functions`: shared Paystack reconciler, verify-payment, payment-webhook and retired admin-action endpoint.
- `supabase/manual`, `supabase/diagnostics`: guarded owner upgrades, role diagnostics and recovery instructions. The full bootstrap SQL is **not** a production upgrade; do not replay it or completed 005/006/role grants.
- `scripts`, `tests`: environment guard, redacting scan, recovery generator, isolated PostgreSQL tests, fixture browser smoke and production artifact tests.
- `public`: platform icons, offline page and old placeholder PWA marks. Supplied logo is not yet integrated at the initial audit.

## Complete route inventory

| Routes | Current implementation / access |
| --- | --- |
| `/` | Public landing, configured content and database-backed directory preview |
| `/discover` | Public directory; authenticated save/report; server pagination/filtering |
| `/profile/:username`, `/listing/:username` | Real user / managed profile details; listing is not a login account |
| `/login`, `/register` | Existing Supabase Auth forms; no fake credentials or demo login |
| `/admin/login` | Existing Supabase sign-in plus separately database-authorized staff gate |
| `/verify`, `/forgot-password`, `/reset-password` | Confirmation, reset request and password reset |
| `/dashboard` | Guarded member overview, real profile/balance/activity |
| `/settings` | Guarded profile, photo/social links and notification inbox |
| `/rewards` | Guarded wallet, supported daily tasks and manual points purchases |
| `/referrals`, `/boosts` | Guarded referral records/linking and capped point boosters |
| `/promotions`, `/subscriptions`, `/payments` | Guarded commerce views; promotions enquiry, recorded subscriptions, provider/bank payment history |
| `/admin` | Guarded staff application, section chosen via `?view=`; trusted role/RPC scope authorization |
| `/privacy`, `/terms`, `/cookies`, `/support`, `/delete-account` | Policy/help/deletion information |
| unmatched path | Not-found view |

Commerce routes deliberately share `Commerce.jsx`; auth forms share `AuthPages.jsx`; user/managed detail share `ProfileDetail.jsx`. These are purposeful shared implementations, not disconnected duplicate applications. The older admin-action Edge Function is retired (410); trusted audited SQL RPCs are the current admin mutation path.

## Direct production inspection

The existing Supabase project is ACTIVE_HEALTHY. No rows, roles, accounts, prices or site settings were changed during inspection.

### Tables and policies

All 29 public application tables have RLS enabled:
`account_restrictions`, `audit_logs`, `bank_point_orders`, `bank_transfer_details`, `blocks`, `boost_plans`, `favourites`, `managed_profile_batches`, `managed_profiles`, `notifications`, `payment_transactions`, `point_packages`, `points_balance`, `points_ledger`, `profile_views`, `profiles`, `promotions`, `purchases`, `referral_purchase_rewards`, `referrals`, `reports`, `reward_config`, `reward_tasks`, `site_settings`, `social_links`, `subscriptions`, `task_claims`, `user_boosts`, `user_roles`.

Inspected live public/storage policy expressions and function security settings/execute grants. Policies enforce ownership for private financial/account resources, public visibility for directory data, staff-only audit reading and controlled storage ownership. Private parent profiles are checked by social-link read policy. Batch records have no browser policies. Avatars and managed portraits are public images; bank receipts are private. All three buckets enforce 5 MB and JPEG/PNG/WebP limits.

**Important privilege finding:** browser roles have SQL TRUNCATE privileges on 27 tables, despite RLS. This is a confirmed over-grant, not evidence that a public REST truncate endpoint or exploit has been demonstrated. Revoke it and correct PostgreSQL default table grants. Do not test by truncating a production table. Role-table DML ACL grants also exist, but there is no browser write policy; RLS remains the role-write boundary. Additive defense-in-depth revocation of direct role writes can be reviewed separately.

### Auth and admin

The intended existing owner remains `super_admin`. There are two Auth accounts and zero ordinary non-staff accounts in the live database at inspection. No account is created, deleted or promoted for this audit. Auth/session restoration uses bounded requests and generation checks; authorization is enforced by SQL `admin_role`, `admin_can`, trusted RPCs and RLS, not by hiding buttons.

Browser roles cannot execute provider settlement or the private boost/referral award helpers, and cannot read the private bulk batch table. RLS being enabled is not by itself proof that all grants/policies/workflows are secure. Legacy invoker admin helpers remain exposed by EXECUTE; their existence alone does not grant row access. Real ordinary-user denial remains untested because no ordinary account exists. Real password sign-in, refresh, reset email delivery, live redirect allowlists, SMTP and MFA settings were not verified. Sensitive auth configuration/secret values were not retrieved merely to inventory them.

### Migrations and Edge Functions

Stage-011 functions/tables are present, but the management API returns **no migration-history entries**. Prior SQL Editor/connector application is documented separately; an empty history does not mean the database is empty. Reconcile history carefully rather than replaying 001–011.

The live Edge Function list is **empty**. Repository verify-payment and payment-webhook code validates provider responses, references/amounts/currency/email, webhook HMAC and database settlement with a server-only key. It is **not deployed/operational**. Provider settlement marks the transaction verified; automatic subscription/campaign fulfilment is not implemented by that function. No provider secrets were requested or displayed.

## Environment/deployment inventory — names only

- Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; only public URL/anon/publishable key is allowed by the build guard.
- Edge/runtime: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, `ALLOWED_ORIGINS`; server-only. Do not put these private values in VITE variables or chat.
- Build/release: `RENDER_GIT_COMMIT`, `GITHUB_SHA`, `NODE_VERSION`.
- `.env.example` has public placeholders; no local VITE environment values are set in this session. Render YAML contains only public frontend configuration. Live Render environment and provider-secret inventories were not independently accessed.
- PWA has update consent, same-origin network-first navigation/offline fallback and network-only release/Supabase traffic. Old marks are SVG placeholders; replace with real PNG application icons, maskable icon and Apple touch icon from the supplied artwork.

## Problems and staged implementation plan

| Priority | Finding | Stage / acceptance gate |
| --- | --- | --- |
| High | Browser TRUNCATE over-grants bypass RLS if reached through a SQL execution path | 1: minimal additive revoke/default-privilege migration; hosted-default isolated tests, zero application-row changes; metadata-only production postflight |
| Requested | Supplied logo missing from public/auth/member/admin/offline/PWA branding | 2: shared brand component, faithful crops/optimized assets, PNG/maskable/touch/favicon variants; source/build/image and browser checks |
| Medium | Fresh npm audit: 10 affected packages (8 moderate, 2 low), largely transitive build tooling | 3: attempt compatible remediation only; retest, do not force an unreviewed PWA downgrade; report remaining advisories |
| Medium | Single managed editor differs from bulk: no official-host normalization, publishes new drafts by default, rewrites link visibility to public | 3: reuse shared validation/normalization and preserve existing link visibility; test local before deployment |
| Medium | Member context referral storage can throw in privacy-restricted browsers; async refresh/referral rejection handling is incomplete | Follow-up reliability stage with account-switch race/storage/rejection tests; do not claim all mutations are timeout/idempotency-safe |
| Blocking provider workflow | No deployed Edge Functions; verification controls cannot complete provider calls | Owner/provider stage: server secret/origin setup and reviewed deployment, signed webhook tests; no invented credentials |
| Product incomplete | Promotions enquiry and subscription records, not automated checkout/fulfilment/cancellation | Owner-defined product stage: agree plans/prices, verified order/fulfilment state machine and audit tests before enabling purchase promises |
| Configuration | No active point packages or boosters; no support email | Owner must configure legitimate rates/plans/contact in existing admin; never invent them |
| Operational | Empty recorded migration history; abandoned portrait/receipt cleanup absent | Reviewed migration baseline/history reconciliation and storage retention/cleanup policy; no destructive reset |
| UX/privacy | Blocking persists in directory but profile detail does not re-check an existing block on reload; notifications still permit broad own-row updates; styles retain legacy overrides | Separate scoped hardening/UX tests; preserve public/profile privacy boundaries and avoid speculative production rewrites |
| Acceptance | No real account sign-in, ordinary-user denial, mobile installed-PWA update or live money flow performed this audit | Owner-assisted real workflows after reviewed deployment; mocks/builds are not real acceptance tests |

## Baseline and execution record

- Before application edits: `npm ci` succeeded; `npm test` passed all existing suites, including isolated SQL recovery/bulk authorization/atomicity/privacy tests.
- Initial `npm audit`: 8 moderate, 2 low, zero high/critical. These supersede the earlier four-low historical report.
- Initial system-wide Pillow installation was rejected by Python's externally-managed-environment protection. Resolved by using an isolated virtual environment; no system override used.
- Implementation results, later tests and any outstanding failures will be appended below. No blanket “production complete” claim is made.

## Implemented stages and verification results

### Stage 1 — completed, including production hardening

Added `012_browser_truncate_hardening.sql` and isolated `truncate-privileges.test.mjs`. The test reproduces Supabase-style global and schema default grants, verifies browser denial on current/future tables, preserves service-role privileges, compares all pre-existing application rows (apart from the intentional append-only audit entry), and tests a denied truncate **only in the disposable local database**. Reapplication preserves application records.

Applied the narrow owner migration via Supabase's migration tool. Direct production postflight: **0 current public browser TRUNCATE grants**, **0 postgres global/public browser default TRUNCATE grants**, two existing Auth accounts, unchanged `super_admin`, one protected hardening audit entry. No table was actually truncated; no production account, price, payment, reward or profile row was changed. Vendor storage tables have no current browser TRUNCATE grants. There remain two postgres schema-specific *storage* default grants; the public-application migration deliberately does not alter Supabase's vendor schema/defaults. Those defaults require separate vendor/owner review if postgres will create storage-schema tables.

### Stage 2 — completed in source, not deployed

Integrated the supplied artwork without AI regeneration. Shared `BrandLogo.jsx` replaces repeated letter placeholders in public navbar/footer, auth masthead, member sidebar, admin sidebar and admin access states. Added original-artwork WebP crops and full artwork, PNG favicon, Apple touch icon, 192/512 PWA icons, separate safe-zone maskable icon and branded offline page. Updated HTML metadata, manifest configuration and Workbox inclusion. No sign-in, account or database replacement is involved. Existing installed PWAs may need an update/reinstall to refresh OS-cached icons after frontend deployment.

Asset/source tests and production-manifest/offline-precache tests passed. Browser fixtures confirm images load with natural dimensions and accessible brand labels in public/auth/member/admin shells. Desktop/mobile smoke passed. Visually inspected the generated staff/admin screenshots; these contain **fixture data**, not production account evidence.

### Stage 3 — scoped editor repair completed; dependency blocker remains

Single managed-profile creation/editing now reuses bulk draft validation and official-link normalization. New single listings default to private; existing private social-link visibility is preserved instead of silently changed to public. Facebook aliases become canonical URLs. Tests exercise private defaults, rejection before RPC, normalized submission and privacy-preserving edits. Existing SQL permission checks remain authoritative.

A normal, non-force `npm audit fix` completed without resolving the advisory chain. **10 advisories remain (8 moderate, 2 low)** in Workbox/PWA build dependencies. No forced downgrade was applied. A reviewed dependency/tooling upgrade with PWA regression tests remains necessary; do not describe this as a clean audit.

### Failed checks and resolution

- Initial branding test caught an overlooked legacy `d.` mark in the admin loading/denial state. Replaced it with the shared logo; rerun passed.
- The baseline dependency audit and post-remediation audit remain non-zero; this is an open finding, not a passed security gate.
- System Python package installation was blocked; used a virtual environment instead. No override of system package protection.

### Remaining owner/product requirements

Deploy the reviewed frontend branch through the existing Render static site; do not rerun completed production upgrades or role grants. Verify the release marker and newly served logo assets, then test real admin sign-in/refresh, a separately authorized ordinary account's denial, and installed-PWA icon/offline/update behavior. No production fake/demo accounts or listings were added.

Configure monitored support email and genuine point/booster offerings through existing authorized admin controls. Deploy/configure the reviewed provider Edge Functions using server-side secrets and allowed origins, then test real signed callbacks/reconciliation before treating provider payments as operational. Define promotion/subscription products and audited fulfilment rules before implementing/enabling automatic purchasing. Provider deployment, real money flows, Auth email/redirect delivery and full business-workflow acceptance remain unperformed. The reliability/UX/storage/history backlog above is not claimed complete.

Final local release gates: `npm test`, `npm run test:deployment`, `git diff --check` and value-redacting `npm run test:secrets` over source/Git/build/available logs all passed. The extended Playwright desktop/mobile smoke passed with isolated network fixtures (including logo image/accessibility checks, single-editor validation/private defaults and bulk consent/retry). Secret-pattern scanning found no supported private-credential patterns; this does not certify provider-side secret inventories or establish that rotation is unnecessary in every external system. No real browser password sign-in or live purchase was performed.
