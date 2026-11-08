# Admin manual reseller workflow

## Implemented scope

A super-admin-only admin section at `/admin?view=reseller`, labelled **Manual Reseller**. It preserves the existing application/Auth and does not replace the Bot Generator. The canonical legacy navigation and generic `admin_list` resources are unchanged; this module has its own protected RPCs and RLS reads.

This is a manual service-operations workflow, not an automated SMM-provider connection. It cannot buy or deliver fake followers, artificial views, bot accounts or guaranteed engagement.

### Catalogue

Four reviewed legitimate services:

1. Original content creation.
2. Campaign planning.
3. Paid-ad creative assistance (not ad spend or automatic platform submission).
4. Audience consent-process review (not unsolicited outreach).

No provider catalogue is imported. Catalogue maintenance is a trusted database operation, not a public client-write path. Provider credentials are never read or used by this module.

### Orders and fulfillment

- Create a unique UUID request with service, title, brief and explicit legitimate-scope/consent attestation.
- Every admin order has a database-enforced **0 DC** charge. The RPCs never call wallet, payment, refund or ledger functions.
- Idempotent creation: identical retries on the same request UUID produce one order/event; reusing a UUID with changed details fails.
- Status flow: `SUBMITTED → IN_PROGRESS → COMPLETED`, or cancellation from either nonterminal state.
- A meaningful review note is required on every transition. Completion additionally requires an HTTPS delivery-evidence link.
- Completed and cancelled states are terminal. There is no fabricated automatic success, restart, refund, or provider verification.
- Row locking and expected revision checks reject stale/concurrent updates; failed retries cannot append duplicate transition events.
- Completion is explicitly **admin-reported**, not independently provider-verified. The backend validates evidence URL syntax; it does not fetch or assess the evidence.
- Order inspection includes the brief, current revision and latest 100 append-only audit events. No order or audit deletion control is exposed.
- Server-side status/title filtering, exact matching count and 25-row pagination.
- Current-page metadata CSV excludes titles, briefs, completion notes, evidence links and credentials. It includes only order ID, catalogue service ID, status, zero charge and timestamps. It is not a complete data backup.

## Authorization

`reseller_is_admin()` requires the existing server-verified super-admin role, a confirmed email, no current Auth ban and no account restriction. Ordinary members, moderators, finance admins and anonymous callers cannot operate the module. This is a super-admin workflow, not the separate singleton Bot Generator owner grant.

Every mutation independently checks authorization. RLS restricts reads. Clients have no INSERT/UPDATE/DELETE/TRUNCATE permissions on services, orders or audit events. Security-definer RPCs have explicit execution grants and fixed search paths. Ownership or privilege cannot be granted through this UI.

The frontend fails closed if authorization, schema or reads are unavailable. It clears records/inspection and exposes no purchase, provider or create controls. No sample orders/statistics are presented.

## Files

- `src/admin/reseller/ResellerWorkspace.jsx`: service cards, zero-charge order form, filtering, pagination, inspection/audit, manual status transitions and safe export.
- `src/pages/Admin.jsx`: super-admin navigation and dedicated module rendering; no generic list fallback.
- `supabase/manual/reseller_workflow.sql`: additive tables, fixed catalogue, authorization, RLS, protected functions and indexes.
- `tests/reseller-workflow.test.mjs`: isolated real SQL workflow/security/data-preservation regressions.
- `tests/reseller-browser.smoke.mjs`: Chromium tests with mocked Auth and database transport.
- `tests/botgen-foundation.test.mjs`: existing shared admin-route assertion updated to cover both dedicated super-admin modules.
- `package.json`: SQL regression included in the full test suite.

The module reuses the local green-on-charcoal Bot Generator stylesheet. It introduces no dependency on its database tables or owner enrollment.

## Database rollout: staged, NOT applied

Tables: `reseller_services`, `reseller_orders`, `reseller_events`. Relationships connect services, requests and existing Auth users. Existing balances, ledger, Auth users, profiles and other feature tables are not replaced or reset.

The SQL is deliberately stored under `supabase/manual/`, outside the automatic migration sequence. It has been rehearsed against isolated baseline 001–015 + 024. Before production, obtain actual backup and matching isolated restore evidence, inspect/reconcile the current schema and apply this reviewed script as a separately recorded additive migration. Do not run it blindly or treat mocked persistence as production installation.

No production migration, provider request, enrollment, key access or Render deployment was performed for this feature. Until rollout, the live module will show a locked/backend-pending state rather than claim to work.

## Validation

- `npm test`: PASS, including the new SQL regression and existing application suites.
- `npm run test:deployment`: PASS, production build and artifact/readiness checks only.
- `npm run test:secrets`: PASS.
- `git diff --check`: PASS.
- Isolated SQL: verified/ordinary/moderator/finance/anonymous/restricted access, RLS, zero charge, scope attestation, unsupported service rejection, persistent requests, idempotence, versioned transitions, evidence syntax/notes, terminal states, direct-write/TRUNCATE/audit mutation denial, unchanged fixture Auth/profile/balance/ledger snapshots.
- Chromium mocked transport: five layouts (320, 390, 844, 768, 1440px), create/reload, manual progress/completion, evidence/audit inspection, terminal controls, metadata export, filters/search, missing-backend lock and moderator denial.

These are not real production password/session tests, actual provider fulfillment or evidence-quality verification.

## Intentionally unfinished / excluded

- No automatic provider connection, balance lookup, catalogue synchronization or provider job tracking.
- No customer checkout, paid orders, subscriptions, refunds, ad-spend settlement or DC deductions.
- No provider-verified delivery guarantee or fake engagement services.
- No real live authenticated acceptance or deployment confirmation.
- No service catalogue editor or broad arbitrary-service import; catalogue remains reviewed and constrained.

Stored provider secrets, if present in Supabase, remain untouched. A previously exposed credential should stay revoked; nothing in this module validates or rehabilitates that credential.
