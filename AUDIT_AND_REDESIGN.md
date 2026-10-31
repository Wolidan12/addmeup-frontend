> **Current payment policy (2026-10-31): MANUAL BANK TRANSFER ONLY.** Online Paystack processing/actions have been retired. Provider setup, secret and webhook instructions below are historical and must not be followed. Use `MANUAL_DEPOSITS_ONLY.md` and migration 021 for the current implementation and rollout. Historical payment records are preserved.

# Admin-access audit, security repairs and UI redesign

> **Current status:** See [RELEASE_011.md](RELEASE_011.md) for stage 007–011 recovery, the latest owner evidence, tests and live-verification limitations. The earlier procedure below is historical: **do not replay completed 005/006 or the role grant.**

> **Owner-assisted recovery update:** Subsequent SQL Editor screenshots confirm the intended account is email-confirmed and unbanned but has no assigned role. They also confirm `is_admin()` exists while the newer admin RPCs, `account_restrictions` and `member_overview()` are absent. The attempted grant stopped at its guard before changing the role. See `supabase/manual/README.md` and the guarded `005_006_admin_upgrade.sql`; this exact upgrade passes isolated PostgreSQL tests, but has not been run by this agent in production. The earlier “unknown” statements below describe the original audit stage. On the latest clean install npm reported **four low-severity advisories**; the earlier zero-audit result below is historical, not a current assurance.

**Latest owner-supplied evidence:** SQL Editor screenshots now show the guarded 005/006 upgrade's four function-presence checks are true and the intended existing account has `super_admin`. Do not replay those completed owner steps. The agent did not execute production SQL or independently verify real administrator dashboard access. Remaining member migrations and frontend deployment are separate outstanding steps. Earlier descriptions below of the grant/upgrade as unperformed reflect the original audit stage.

**Status: implemented in source on `arena/9a2aa14a-addmeup-frontend`; not deployed.**

No production users, roles, records, policies, payments or secrets were changed. No production database migration was executed. The existing Supabase project and React/Vite + Render architecture are preserved. No new backend or database has been introduced.

## 1. What was actually established about admin access

### Proven source-level failures corrected

- The old staff role lookup could reject without a handled error and had no deadline, leaving the access gate loading indefinitely. It now has a 12-second bound, safe failure state and retry.
- Account/session restoration and auth operations were unbounded. Session restoration now has a deadline, a retryable failure state and generation checks against stale results.
- The access gate displayed internal/setup wording before authorization. That content has been removed. Raw database/provider exception messages in customer and staff error states have been replaced with safe, static text.
- There was no dedicated staff sign-in experience. `/admin/login` uses **the existing Supabase password sign-in**, then calls the existing server-authorized role gate. Signed-in members can switch accounts there.
- Protected redirects preserve the intended local destination and reject external/protocol-relative/backslash destinations.
- Email verification now checks `auth.getUser().email_confirmed_at`; a success query parameter does not establish verification.

### What remains unknown

The exact failure of the intended **real** administrator is NOT established. I cannot determine whether its password, confirmation status, ban status, project selection, server role, installed migrations, redirect configuration or deployed release is wrong without authorized project access.

`admin_role()` in migration 006 reads `public.user_roles` for `auth.uid()`; legacy `admin` maps to `super_admin`. Creating a profile does not grant staff access. Missing profiles are not an explanation for a role lookup failure. Database `admin_can()` and RLS remain the permission authority; no frontend fallback grants access.

Supabase was disconnected; Render integration was unavailable. No real administrator login, real member-denial test or live production refresh was performed. GitHub's lack of deployment records does not establish Render's deployment status.

## 2. Secure owner diagnostic and optional role repair

These files are **manual trusted SQL Editor utilities**, not migrations, public RPCs or automatic bootstrap code:

1. `supabase/diagnostics/deployment-readiness.sql`: read-only function-presence checks for the existing migrations.
2. `supabase/diagnostics/admin-account-check.sql`: read-only lookup of one existing Auth account, confirmation/ban status, assigned/effective role and profile presence. Enter the email locally in the owner's SQL Editor.
3. `supabase/diagnostics/grant-existing-admin.sql`: sensitive, optional owner-approved grant. Use ONLY if the intended existing account lacks the intended role.

The grant refuses unchanged placeholders, non-owner database execution, an incorrect UUID/email pair, unconfirmed accounts and banned accounts. It changes only that existing account's role, atomically appends an audit event and is idempotent. It does not create an account/password/function or weaken any policy. Both UUID and email must be independently verified before execution. The SQL Editor owner is identified by project access logs; the application audit actor is null because SQL Editor does not authenticate as a browser user.

**The script has NOT been executed against your Supabase project.** Its behavior was tested in isolated PostgreSQL, including negative cases. No new migrations or RLS changes are needed merely for this UI patch. Do not blindly rerun already-applied migrations; inspect the existing project's migration history first.

## 3. UI changes actually implemented

| Area | Implemented |
|---|---|
| Public landing | New split hero and platform-network illustration, benefits, real directory creators, rewards disclosure, real active promotion packages, final CTA |
| Public chrome | Responsive menu, brand system, footer, staff entry and policy links |
| Authentication | New split-screen login, registration, forgot/reset, verification/resend and dedicated staff login; busy/error states and account switching |
| Member dashboard | Redesigned shared shell and surfaces, action deck, real balance/streak/referral/views, completion/check-in actions, activity and creator discovery |
| Discovery | Restyled search/platform filters and responsive creator cards; server filtering/pagination and reporting/saving preserved; bounded directory loading |
| Creator detail | New two-column profile/trust layout, official social links, support and confirmed blocking |
| Rewards/programmes | Unified wallet, task, bank-order, referral and booster surfaces and dialogs; existing server-authorized logic retained |
| Profile/settings | Unified profile, social-link and upload forms; notification surfaces and visibility controls preserved |
| Commerce | New `/promotions`, `/subscriptions`, `/payments` views with paginated real account records, empty/error/loading states and payment-source tabs |
| Admin | Updated sidebar icons, control-room shell, metrics/charts, searchable tables, resource surfaces and confirmation/inspection dialogs; scoped actions preserved |
| Mobile | Responsive public menu, auth layout, member drawer/bottom navigation, table scrolling and stacked cards |
| Policies/help | Shared readable legal/help layout |

`src/design/system.css` supplies shared charcoal/violet/blue tokens, typography, layouts, cards, state components and responsive rules. Manrope is served from bundled local font files, not a third-party font CDN. Route splitting reduced the main JavaScript bundle below 500 kB. Existing member/admin components were retained and restyled where their architecture was already appropriate; not every route was rewritten from scratch.

No sample accounts, statistics, transactions or campaign successes were added to the application. The browser test suite intentionally uses fixtures; its screenshots are **not production/account evidence**.

### Commerce boundaries — do not mistake display for fulfillment

- Promotions show the existing active packages and a support/contact path. There is **no newly implemented automatic campaign checkout or fulfillment**.
- Subscriptions show recorded plans and dates. There is **no new self-service purchase/cancellation workflow**.
- Payments show the signed-in user's provider and bank-point-order records. A pending Paystack transaction can request the existing server-side provider verifier after confirmation; the browser never approves payment itself or charges again.
- Existing manual bank point purchases, private evidence, review and exactly-once points credit remain in migrations/Edge Functions already in the project. No new real transfer was made.
- Configurable packages/rates and confirmed Moniepoint beneficiary remain unchanged. Referral points and booster caps remain database-controlled. No withdrawal or cash-payout feature was added or newly validated.

## 4. Security work and inspection limits

- Added an error allowlist, static fallbacks and request-deadline helper. A deadline stops waiting; it does **not** cancel the underlying server request. Payment/reward idempotency remains server-enforced.
- Added a build-time frontend environment guard: only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are accepted. The key must be public/publishable or a legacy JWT with role `anon`; private/service-role keys are rejected without logging their value. A build with neither setting remains possible for source checks, but account services show unavailable until both settings are provided.
- Tightened dev/preview allowed hosts to localhost and Arena's `.e2b.app` preview domain instead of accepting arbitrary hosts.
- Added env/log/test-output ignore rules. Existing frontend code uses only the public Supabase URL/key. Service-role and payment secrets remain Edge Function environment settings, never browser inputs.
- Removed arbitrary provider exception detail from the payment verification server log statement. Existing hosted logs could not be inspected or erased.
- Added `scripts/scan-secrets.py` to inspect working source, current build artifacts, local env/log files, frontend environment settings and available local Git blobs without printing matching values.
- The scan found **no supported private-credential patterns** in the inspected material. Public anon/publishable keys and project URLs are expected, not private credential exposure. This is pattern-based detection, not proof that every secret type is absent, and does not cover inaccessible remote branches, Render environment/log history, Supabase logs or third-party systems. No revocation/rotation was performed because no actual private exposure was identified and provider access was unavailable.
- Upgraded React Router, Vite, its React plugin and PWA tooling. Final npm audit: **0 vulnerabilities**. Render Node is pinned to `22.22.3` for the upgraded toolchain.

## 5. Verification

### Passed locally

- Clean `npm ci` passed; the subsequent production build used the existing **public** Supabase settings from `render.yaml`. This validates compilation/configuration shape, not live connectivity. The install emitted a transitive `glob` deprecation warning; npm audit still reported zero known vulnerabilities.
- `npm test`: frontend-env guard; error suppression/deadlines; social/image/input validation; safe login destinations; admin resource permissions and CSV safety; all existing isolated PostgreSQL migration/permission/reward/payment/manual-bank/referral/booster tests; targeted owner-grant negative/idempotency/audit tests.
- `npm run test:deployment`: production build and release-marker/PWA/navigation artifact checks.
- `npm run test:secrets`: pattern scan with redacted results.
- `npm audit --audit-level=moderate`: zero reported vulnerabilities.
- `git diff --check`.
- `tests/member-browser.smoke.mjs`: desktop 1440px/mobile 390px; home, dashboard, discovery filters, referrals, booster confirmation, settings, wallet, commerce, admin configuration dialogs; mocked staff password sign-in → dashboard → refresh; ordinary-role denial; role lookup failure/retry/timeout; sanitized invalid-credential error; server-validated email verification and query-parameter anti-spoofing. No uncaught page exceptions in the final passing run.

The browser runner requires optional `playwright` and `@sparticuz/chromium` installed with `--no-save --package-lock=false`. Use a **test-only** Vite server with `VITE_SUPABASE_URL=https://test.supabase.co` and a non-secret test key. In this sandbox Chromium also requires libraries extracted from its bundled `al2023.tar.br`; run with `LD_LIBRARY_PATH=/home/user/.cache/browser-libs/lib`. These optional tools/libraries are not application production dependencies.

Browser checks caught and led to correction of a lazy-import initialization regression; build checks also caught and led to correction of an unavailable font CSS entry. Neither failed state remains in the final tested source.

### Not performed — owner access required

- Real intended-admin password sign-in, real dashboard query/RLS result and refresh/session persistence.
- Real ordinary-user `/admin` denial and direct RPC denial in the deployed project.
- Real email delivery/reset/verification redirects, upload/storage access and two-account isolation checks.
- Real reward/check-in/task/referral/booster operations against production records.
- Real bank transfer, receipt upload, bank-statement reconciliation or Paystack verification/settlement.
- Render deployment, live release/cache inspection, production console/network checks, or old-worker → new-worker lifecycle testing.

## 6. Owner release and live-test checklist

1. Connect the **existing Supabase project** in Arena if you want its schema/account state inspected here. Never share a password, service-role key, bank secret or payment-provider key in chat.
2. Run the read-only diagnostics above in its trusted SQL Editor. Establish the intended Auth account's status/role. Use the optional role grant only after deliberate owner approval and independent account verification.
3. Review this branch's source changes, then merge the reviewed patch into the existing deployment branch. These changes are not on deployed main just because a previous PR was merged.
4. In the existing Render static site, use Node `22.22.3`, `npm ci && npm run build`, publish `dist`, and an SPA **rewrite** of `/*` → `/index.html`. Keep only the two public frontend Supabase settings. No Railway/Netlify/backend replacement is needed. Dashboard-created Render services may require settings/header updates manually; editing `render.yaml` alone does not prove they were applied.
5. In Supabase Auth, confirm Site URL and allowed redirect URLs include the production origin and `/verify` and `/reset-password`. Do not disable confirmation or weaken RLS to work around login failures.
6. Deploy the reviewed commit; compare `/version.json?check=<unique>` with Render's actual successful release commit in a fresh private window. Confirm the new public/staff/member layouts. Consult `DEPLOYMENT_RECOVERY.md` for old-PWA cache recovery.
7. Owner signs in at **https://danqel-social-boost.onrender.com/admin/login** using the intended existing account: verify data loads, refresh, verify access again, sign out.
8. Sign in as a real ordinary account: open `/admin`, verify denial; directly attempt unauthorized `admin_list`/mutation calls and verify PostgreSQL rejects them. Test separate-account data isolation and private receipt access.
9. Exercise email/reset, profile/social/photo, eligible rewards/tasks/programmes, and payment workflows using authorized test records/provider mode before asserting end-to-end completion. Confirm real provider/bank funds before approval; never treat a receipt screenshot as proof of payment.

**Local preview:** the running Vite preview serves this redesigned production build, using the existing public Supabase configuration. It is not a separate test database: signed-in actions can affect that existing project. No automated live-account mutations were performed.

**Production target:** https://danqel-social-boost.onrender.com — the new release at this URL has NOT been verified or deployed by this session.

## 7. Changed files

The source file list below includes the earlier uncommitted deployment-recovery patch as well as this redesign/security work. Generated build output, browser binaries and screenshots are excluded from Git.
- `.gitignore`
- `RENDER_DEPLOY.md`
- `package-lock.json`
- `package.json`
- `render.yaml`
- `src/App.jsx`
- `src/admin/ActionDialog.jsx`
- `src/admin/CreateDialog.jsx`
- `src/admin/ProgrammeDialog.jsx`
- `src/admin/ReceiptEvidence.jsx`
- `src/admin/admin.css`
- `src/components/BuyPoints.jsx`
- `src/components/NotificationInbox.jsx`
- `src/components/ProfilePhoto.jsx`
- `src/components/chrome.jsx`
- `src/components/ui.jsx`
- `src/context/AuthContext.jsx`
- `src/index.css`
- `src/main.jsx`
- `src/member/MemberContext.jsx`
- `src/member/MemberLayout.jsx`
- `src/member/member.css`
- `src/pages/Admin.jsx`
- `src/pages/AuthPages.jsx`
- `src/pages/Boosters.jsx`
- `src/pages/Discover.jsx`
- `src/pages/Home.jsx`
- `src/pages/Legal.jsx`
- `src/pages/MemberDashboard.jsx`
- `src/pages/ProfileDetail.jsx`
- `src/pages/Referrals.jsx`
- `src/pages/Rewards.jsx`
- `src/pages/Settings.jsx`
- `supabase/functions/verify-payment/index.ts`
- `tests/member-browser.smoke.mjs`
- `vite.config.js`
- `AUDIT_AND_REDESIGN.md`
- `DEPLOYMENT_RECOVERY.md`
- `scripts/frontend-env.mjs`
- `scripts/scan-secrets.py`
- `src/admin/AdminNavIcon.jsx`
- `src/components/AppUpdate.jsx`
- `src/design/system.css`
- `src/lib/errors.js`
- `src/lib/navigation.js`
- `src/pages/Commerce.jsx`
- `supabase/diagnostics/admin-account-check.sql`
- `supabase/diagnostics/dashboard_readiness.sql`
- `supabase/diagnostics/grant-existing-admin.sql`
- `tests/admin-bootstrap.test.mjs`
- `tests/deployment-artifacts.test.mjs`
- `tests/errors.test.mjs`
- `tests/frontend-env.test.mjs`
- `tests/navigation.test.mjs`
