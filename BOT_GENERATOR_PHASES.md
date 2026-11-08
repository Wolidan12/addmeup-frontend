# DANQEL BOT GENERATOR — admin-module implementation

## Placement and scope

The owner chose an admin-dashboard feature, not a replacement application. Entry: `/admin?view=bot_generator`, linked only for the existing `super_admin` role. The existing login, members, payments, Render deployment and Supabase project are retained. No Express server or separate public signup is introduced. The module follows the repository's existing React/JavaScript/Vite stack; it does not claim the requested TypeScript/Express application has been built.

Backend authorization additionally requires an explicit singleton `botgen_owners` record, a verified, unbanned account, no account restriction, and super-admin permission. A super-admin alone is not sufficient to read or mutate module data. Do not auto-enroll the first visitor or grant ownership via client code.

Fake views, artificial engagement, fake accounts, WhatsApp Web automation, unsolicited bulk messaging and guaranteed reach are excluded. Template 04 is **Actual Status Views Recorder**. A future measurements implementation must retain source/provenance and distinguish manual observations from independently verified figures.

## Implemented increment

- Admin navigation, green-on-charcoal module styling, accessible controls, responsive layout, and template details/search/category filtering.
- Thirty distinct **configuration specifications**, each with stable ID, description, features, fields, permissions, documentation and a reserved handler identifier. These are not thirty executable handlers. Their explicit status is `CONFIGURATION_ONLY`.
- Separate server-protected configuration persistence, edit, idempotent retry, deletion and append-only configuration audit.
- Server-sourced configuration count and template catalogue when authorized/installed. Unavailable data shows a dash, never a fabricated zero. Missing or failed owner verification locks the entire module: no catalogue, records or controls are rendered.
- Paginated saved configurations and the latest 25 audit entries. Audit events are not execution history.
- Metadata export only: configuration text, tokens and other credentials are deliberately excluded. This is not a portable executable bot export or production database backup.
- Dedicated `/admin/bots/login` entry, `/admin/bots` alias, owner-specific anonymous redirects, safe fixed post-login destination, sign-out and expired-session denial. No module registration or automatic grants.
- Client-side input constraints plus independent SQL validation of allowed field keys, required string values and lengths.
- Fail-closed missing-backend/access states, role-restricted navigation, request-generation protection and configuration preserved across successful background refreshes.

### Files

- `src/admin/botgen/BotGenerator.jsx`: module UI and protected RPC/table operations.
- `src/admin/botgen/botgen.css`: module-scoped design and responsive styles.
- `src/admin/botgen/templates.json`: thirty non-secret configuration specifications.
- `src/pages/Admin.jsx`: dedicated super-admin view; deliberately bypasses generic `admin_list`.
- `supabase/manual/botgen_foundation.sql`: gated, additive SQL foundation and matching catalogue seed.
- `tests/botgen-foundation.test.mjs`: real isolated PostgreSQL-compatible SQL tests.
- `tests/botgen-browser.smoke.mjs`: Chromium browser tests with mocked Auth/transport.
- `package.json`: foundation regression included in `npm test`.

## Database rollout — NOT performed

The SQL is intentionally under `supabase/manual/`, not the automatic numbered migration directory. Production recovery is still unverified and the unrelated 016–023 reconciliation remains pending with 024 already applied. Do not blindly apply either set to remove upgrade notices.

The foundation uses `botgen_*` names only: owners, templates, bots and audit. It reuses existing Auth and role/restriction checks instead of colliding with `referrals`, `audit_logs`, or adding a new registration system. No wallet/ledger or Auth data is modified by the foundation SQL.

Only after actual backup/isolated restore evidence, dependency review and staged rehearsal: install the reviewed foundation as a separately recorded additive migration. It supports the baseline 001–015 + 024 in isolated tests. A trusted SQL administrator must then select the intended existing verified super-admin UUID and provision it into `botgen_owners`. No hardcoded production owner UUID or automatic grant is included. The singleton constraint prevents accidental multiple owner enrollments. Enrollment and any later transfer must be reviewed and independently audited; no client grant path exists.

## Validation and evidence boundaries

- Foundation SQL test passes: thirty matching DB specifications, explicit owner grant, RLS, ordinary/moderator/other-super-admin/anonymous/restricted denial, no self-enrollment, persistent validated saves, repeated-save deduplication, retained audit on deletion, direct-write denial, unchanged fixture Auth/profiles/balances/ledger.
- Chromium smoke passes at 320, 390, 844, 768 and 1440px: no page overflow, template search, save/reload/edit, metadata export with no configuration, deletion, unauthorized denial and missing-backend disabled controls. It uses mocked Supabase sessions/transport, not actual password login or production persistence.
- Full regression suite includes these SQL tests. Build/deployment-artifact checks and secret scans pass for this increment.
- No production migration, owner enrollment, messaging operation, worker execution or deployment has been performed for this increment.

## Phase tracking / unfinished work

| Requested phase | Honest status |
| --- | --- |
| 1. Foundation/design | Admin-module foundation implemented; not a separate 16-page app. |
| 2. Authentication/database | Existing Auth reused; isolated SQL owner controls tested. Live rollout and real-session acceptance pending. |
| 3. Dashboard | Actual saved-configuration figures only. Execution, audience and WhatsApp statistics not implemented. |
| 4. Thirty templates | Distinct specifications implemented; distinct execution handlers pending. |
| 5. Generator/configuration | Save/edit/delete configuration implemented and locally tested. Production persistence requires gated rollout. |
| 6. Execution engine | Not implemented: durable queue, workers, leases, retry/backoff, dedup, shutdown and scheduler. |
| 7. Controls/execution history | Configuration controls/audit only. No activation/pause/stop/restart or execution history. |
| 8. Downloads | Metadata export only; private artifact generation/storage and safe executable exports pending. |
| 9. WhatsApp integration | Not implemented. Requires official Cloud API credentials stored server-side, raw-body signature checks, event dedup, service-window/template/consent/suppression checks and rate limits. Fake views will not be implemented. |
| 10. Analytics/reporting | Real execution/measurement/audience datasets and reports pending. |
| 11. Security testing | Foundation SQL and mocked UI denial tests implemented. Real owner/member Auth and integration/security acceptance pending. |
| 12. Deployment | Not performed. Recovery, staged migrations, live acceptance and authorized release remain gated. |

Do not enable activation merely by adding a button or changing `CONFIGURED` to `ACTIVE`. The current table and protected save function intentionally cannot create an ACTIVE state or an execution-success record. Future execution needs its own reviewed migration and actual handler/worker implementation before lifecycle controls are exposed.


## Login-first gate — latest increment

The owner explicitly required login and routing to work before further implementation. This increment strengthens that foundation and **does not advance execution or exports**.

Created:
- `src/admin/botgen/OwnerLogin.jsx`: Matrix-styled private owner login through existing Supabase Auth, no signup, post-login backend owner verification, safe failures/retry/account sign-out.
- `src/admin/botgen/ownerAccess.js`: shared strict boolean owner decision and canonical bot-route recognition. Malformed, denied or missing backend responses never grant access.
- `tests/botgen-owner-access.test.mjs`: owner-check and route selection unit tests.
- `tests/botgen-login-browser.smoke.mjs`: real Chromium with mocked Auth/SQL transport for anonymous deep links, five layouts, invalid credentials, ordinary/moderator/other-super-admin denial, missing/denied backend lock, authorized sign-in/reload, logout and expired refresh denial.

Changed: `src/App.jsx`, `BotGenerator.jsx`, `botgen.css`, the existing bot-module browser smoke, `package.json`, and this report. Existing platform registration remains untouched; the private module has no registration or grant path. Existing member/staff routing must continue to pass the regression suite.

Database migrations in this increment: **none**. The previously staged `supabase/manual/botgen_foundation.sql` remains unapplied; owner enrollment has not been performed. No existing account password was requested, reset or impersonated.

**Gate status:** local unit/SQL and mocked-browser foundation checks pass. Real owner/password/session acceptance against an installed, protected owner backend is **NOT verified**, and production recovery is still unverified. Do not represent the local tests as real live authentication evidence. Further queue/worker/activation/restart/package-source stages remain stopped at this gate.


### Latest validation results

- `npm test`: PASS (including bot foundation SQL, owner-access tests and prior application regressions).
- `npm run test:deployment`: PASS (production build and artifact/readiness checks, not a live deployment).
- `npm run test:secrets`: PASS.
- `git diff --check`: PASS.
- `tests/botgen-login-browser.smoke.mjs`: PASS in local Chromium with mocked Auth/SQL HTTP endpoints.
- `tests/botgen-browser.smoke.mjs`: PASS in local Chromium with mocked transport.

Not run: live Supabase owner password/session acceptance, production owner enrollment, live migrations, worker execution, WhatsApp settlement/delivery, or Render release. No success is claimed for any of these.
