# Danqel admin dashboard — staged delivery

## Follow-up: pictures, manual bank payments and managed profiles

The next increment is implemented in migration **009** and the frontend. See **`MANUAL_PAYMENTS_AND_PROFILES.md`** for deployment and workflows. It adds user photo uploads/display, Super Admin-configured point packages, manual Moniepoint transfers with private receipts and finance approval, and manually created managed listings. These capabilities supersede the corresponding stage-1 limitations below. The full original product remains incomplete; existing production data has not been changed.

## Member-workspace increment

Migration **010** and the frontend add the production-data-only member workspace, referral purchase-point rewards, capped daily/task point boosters, platform logos and expanded site controls. See **`MEMBER_WORKSPACE.md`** for exact scope, deployment and tests. It supersedes older demo/branding/referral/booster limitations below; the remaining original product stages are still not all complete.

## Status and scope

**Stage 1 implemented; the full requested product is not complete or production-certified.** Existing React/Vite, Supabase project, Auth and tables are retained. No Node backend and no production data resets. No migrations have been applied to the live project from this workspace.

Repository schema was inspected in migrations 001–005, the SQL-editor bundle, auth context, pages, and three existing Edge Functions. Live Supabase introspection was not available (no linked CLI/database credentials; outbound environment cannot reach Supabase). Reconcile migration history and live schema before applying anything. The old `APPLY_ALL_IN_SQL_EDITOR.sql` intentionally has not been regenerated: **do not rerun it on an existing database**.

### Working stage-1 functionality

- Standalone responsive dark `/admin` workspace; existing consumer routes remain intact.
- Supabase Auth session; demo users cannot access admin data.
- Four database-enforced roles. Existing `admin` maps to `super_admin` without rewriting role rows.
- Overview: actual profile and social-link totals, open reports, 14-day daily profile registration chart. Finance/super admins also receive verified NGN payment totals and pending payment counts. Automatic 60-second refresh while visible; manual refresh and last-refresh time. No artificial percent growth or placeholder activity feed.
- Server-side filtered/paginated tables (25/page) and record inspection: profiles, six existing social platforms, reports, point balances/streaks, ledger, task configuration, referrals, promotion packages, payments, subscriptions, notifications, roles, restrictions, reward settings, audit logs.
- CSV exports **current page only**, with spreadsheet-formula escaping. No unbounded browser downloads or fabricated report totals.
- Native accessible modal confirmation, required reason, errors, disabled pending controls, idempotent transactionally audited RPC mutations: restrict/reactivate creator accounts; resolve/dismiss reports; hide social link; super-admin point adjustment, reward value changes, task enable/disable, role assignment; targeted in-app notification to a user.
- Account restrictions block profile/social edits and reward claims, not Supabase login. They are **not a full Auth ban**, nor a comprehensive content takedown. Existing published profiles stay visible; a creator can republish a hidden social link unless restricted. Staff accounts cannot be restricted through this tool.
- Paystack pending-payment verification action for finance/super admins (requires deployed Edge Function). Only provider-confirmed, matching reference/NGN amount/customer email is reconciled. No manual “mark paid” button. Stripe records are readable but verification is not implemented.
- Hardened claim functions: authentication, restriction checks, configured daily-reward pause, duplicate daily/task prevention, profile completeness/public HTTPS social-link eligibility, corrected first-task credit. Existing arbitrary/custom/browse tasks now fail closed pending server-verifiable evidence. Existing task definitions/data are not removed.

### Role matrix (admin RPCs)

| Resource/action | Super Admin | Moderator | Finance Admin | Support Agent |
|---|---|---|---|---|
| Aggregate community overview | yes | yes | yes | yes |
| Profiles / inspection | yes | yes | no | yes |
| Social accounts / hide | yes | yes | no | no |
| Reports read | yes | yes | no | yes |
| Reports decide / restrict/reactivate | yes | yes | no | no |
| Tasks read | yes | yes | no | no |
| Payments, subscriptions, packages, points, referrals read | yes | no | yes | no |
| Verify Paystack payment | yes | no | yes | own-user verification only* |
| Send notification / read notifications | yes | no | no | yes |
| Points / reward config / role changes / task toggle | yes | no | no | no |
| Audit / restrictions table | yes | no | no | no |

*The verification Edge Function permits an authenticated payer to verify their own payment as well; administrative callers must be finance/super admin. The admin UI does not expose this action to support. Existing consumer RLS still permits users to read their own records. Own-profile inspection provides social-link user IDs, not private auth email disclosure. Owner account deletion still uses the existing `delete_my_account`; admin account deletion is not implemented.

## Changed files

- `src/pages/Admin.jsx`: replaces reports-only page with dashboard, resource tables, polling, inspection, exports and permission states.
- `src/admin/resources.js`: resource metadata, UI action availability, CSV escaping (UI is not the security boundary).
- `src/admin/ActionDialog.jsx`, `src/admin/admin.css`: confirmed actions and responsive design.
- `src/components/NotificationInbox.jsx`, `src/pages/Settings.jsx`: paginated recipient inbox with mark-as-read and explicit refresh.
- `src/App.jsx`: hides public navbar/footer only on `/admin`.
- `supabase/migrations/006_admin_operations.sql`: role scopes, restriction table, read/overview/mutation RPCs, hardened legacy policies, audited operations, indexes.
- `007_reward_claim_hardening.sql`: replaces claim implementations without clearing data.
- `008_payment_verification.sql`: service-role-only atomic payment reconciliation.
- `supabase/functions/_shared/paystack.ts`: shared verification and origin allowlist.
- `verify-payment/index.ts`, `payment-webhook/index.ts`: authentication/ownership, provider checks, status persistence errors, signed webhook validation.
- `admin-action/index.ts`: retires previous no-op action acknowledgment with HTTP 410. Redeploy to retire the old deployed implementation.
- `tests/admin-database.test.mjs`, `tests/admin-resources.test.mjs`, `package*.json`: reproducible local PostgreSQL and resource tests; PGlite is development-only.

## Database and security design

- New `account_restrictions` table with own-row read RLS and no client writes.
- `admin_role` / `admin_can` resolve database roles, never JWT user metadata. RPCs use explicit resource/action allowlists and fixed search paths. Read queries bind search/filter/offset; identifiers come only from the allowlist. All pages are bounded.
- No service-role/provider secret in browser. All sensitive mutations use SECURITY DEFINER functions with database role checks. PUBLIC/anon execution is revoked on new admin APIs. Payment settlement is service-role only.
- Existing broad payment/subscription staff-read policies replaced with own-user reads; scoped administrative reads occur through RPC. Direct moderation/promotions writes removed. Notification authorship is server-side; recipients can update only `is_read`.
- New point changes and their audit record are atomic. Negative balances fail at DB constraint. Random request IDs/advisory lock prevent duplicate adjustment on transport retries. Balance row locks and unique ledger keys protect reward claims.
- `audit_logs` client insert/update/delete/truncate revoked. Normal authenticated staff only read through authorized APIs. Trusted service-role/database owner remains privileged by design. Audit IDs/targets survive deletion of user records, but existing historical ledger FKs still cascade: resolve a retention policy before administrative deletion.
- Legacy moderation/sponsor RPCs explicitly fail closed, directing clients to supported workflows. No unrelated grants on `auth.users`.
- Provider verification requires a successful fresh Paystack API check, exact reference, positive stored amount, NGN currency and matching payer email. Settlement locks the payment and records success once; previously refunded/failed rows cannot be resurrected. Verification attempts are audit logged. CORS only allows `ALLOWED_ORIGINS`; webhooks rely on provider HMAC and re-verification, not CORS/JWT.
- Not a complete anti-fraud system: payment order creation still needs trusted package pricing/customer binding before campaign/subscription fulfilment. Do not automatically grant entitlement from an arbitrary client-created pending payment. No refund/dispute writes or unsupported provider approval paths are exposed.

## Deployment — existing Supabase + Render

1. Back up production and test on a staging Supabase project first. Compare actual columns, policies, functions, role constraint name, and migration history with 001–005. Resolve drift manually; do not apply the old initial migrations to already-existing tables.
2. Apply **006**, **007**, **008** in order via Supabase migrations/SQL editor. Each is transactional. These are one-time migrations, not rerunnable bootstrap scripts. No drop table/truncate/data-reset operations are used; policy/function replacements affect behavior immediately.
3. Bootstrap staff only in a trusted SQL editor, with a verified account UUID:
   ```sql
   insert into public.user_roles(user_id,role)
   values ('<verified-auth-user-uuid>', 'super_admin')
   on conflict(user_id) do update set role=excluded.role;
   ```
   Do not use user-editable metadata to grant roles. Existing `admin` roles continue working. Review/remove stale privileged accounts before launch. UI prevents self-role changes; trusted SQL ownership is the recovery path.
4. Set Supabase Edge secrets: `PAYSTACK_SECRET_KEY`, `ALLOWED_ORIGINS` (comma-separated exact Render/custom origins, no trailing slash). Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on Edge. Never add these privileged secrets to Render VITE variables.
5. Deploy `verify-payment` (JWT protected), `payment-webhook` with `--no-verify-jwt` (HMAC is mandatory), and retired `admin-action`. For projects using new publishable-key/JWT gateway configurations, follow current Supabase guidance and verify a real bearer-session request; the function itself always authenticates `verify-payment` callers. Do not disable function-level authentication checks.
   ```sh
   supabase functions deploy verify-payment
   supabase functions deploy payment-webhook --no-verify-jwt
   supabase functions deploy admin-action
   ```
6. Configure Paystack webhook URL in the provider dashboard; test signed delivery, bad signature, replay, mismatched amount/email/currency, unknown reference, upstream timeout and database failure. Payments where provider payer email differs from account email intentionally fail pending review; establish a trusted customer mapping before changing that policy.
7. Render stays a static site: `npm ci && npm run build`, publish `dist`, SPA rewrite `/*` → `/index.html` (already in `render.yaml`). Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`/publishable key in the frontend. Set Auth Site URL + redirect allowlist to deployed origins. Build with Node 20+.
8. Inspect the current PWA update behavior and deploy cache invalidation. Supabase requests are NetworkOnly; do not introduce API data caching. Admin data is held in component state only. Sign out when leaving shared devices.
9. Test all roles against actual RLS using authenticated sessions before production. Monitor Edge logs, provider reconciliation and audit records. Use staging migrations for rollback analysis; do not blindly drop new objects after staff start writing data.

## Tests performed and limitations

`npm test` applies all eight migrations to an isolated PGlite PostgreSQL engine (mocked Supabase auth/storage schemas; pgcrypto extension creation omitted because UUID generation is built in). Exercises anonymous/ordinary/staff authorization, all resource RPCs, point idempotency and balance bounds, audit immutability, restrictions, duplicate check-ins/tasks, eligibility, notification spoofing, role self-edit denial, provider mismatch checks and idempotent payment success. CSV escaping and UI permission/action metadata have unit tests. `npm run build` validates the Vite production bundle.

This is not hosted Supabase integration or concurrency/load testing. Auth gateway, Realtime (not used), Edge/Deno runtime, real Paystack/Stripe calls, Render deployment, browser layout/keyboard/screen-reader flows, actual production schema compatibility and email delivery have **not** been verified. No production database writes were performed. Run the staging acceptance checklist below before launch.

`npm audit` currently reports existing dependency advisories (Vite/toolchain high + moderate, React Router moderate). Major toolchain upgrades are intentionally deferred to avoid breaking the existing PWA/Tailwind app. Resolve and retest before production certification; do not run `npm audit fix --force` blindly.

## Remaining stages — not implemented

| Stage | Work remaining |
|---|---|
| 2: task & moderation workflows | Task/challenge CRUD, deadlines, eligibility rules, global/per-user completion limits, evidence upload/review and unique evidence claims; complaints evidence/internal-note threads, warnings, appeals and decision history. Existing report decisions retain reason in audit only. |
| 3: monetization | Package CRUD/pricing versioning, trusted order creation, boost campaign entities/queues, schedules, approvals, atomic entitlement fulfilment, analytics, expiry jobs, refunds/disputes and Stripe verification. Existing promotion table has packages only, no campaign data. |
| 4: communication & support | Announcements, segmented audiences, bulk notifications, email-provider integration, support tickets, coupons, referral fraud/reversal workflows. Existing referral table is read-only here. |
| 5: governance & analytics | Branding/platform/policy settings, enforced maintenance mode, configurable additional social platforms, dedicated security/fraud events, retention, authorized Auth ban and destructive account deletion with step-up auth/dual control, full-dataset export jobs and revenue reconciliation reports. |
| 6: launch hardening | MFA/step-up sessions, rate limits, independent security review, dependency upgrades, performance indexes based on actual query plans, staging browser/integration/load tests, operational alerts and recovery runbooks. |

## Staging acceptance checklist

- Log in as each role; attempt unauthorized RPCs directly (not just hidden navigation).
- Compare overview totals/chart and CSV page to SQL; create records in another session and confirm refresh.
- Search, filter, page, inspect, cancel and confirm every enabled action; retry same point request; verify single ledger/audit entry.
- Restrict an ordinary creator; confirm profile/social mutations and all reward functions deny; reactivate and retest.
- Exercise daily pause, duplicate check-ins, task evidence eligibility and two simultaneous claims from different sessions.
- Verify targeted notification delivery to the settings notification inbox and read-only field enforcement.
- Test role changes against existing sessions, dialog keyboard/focus behavior, mobile menu and narrow table scrolling.
- Confirm all payment negative cases and successful retry from both webhook and admin; validate no double settlement and no unintended fulfilment.
- Validate production RLS/policies match migration intent and confirm no service-role/provider secrets in compiled `dist`.
