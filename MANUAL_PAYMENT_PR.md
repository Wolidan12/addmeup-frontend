# Manual Moniepoint-only payment revision

Owner decision (31 October 2026): remove Paystack integration, including TEST mode; use manual Moniepoint transfers only.

## Changes

- Removed the undeployed sandbox migration, three test-payment Edge functions, shared Paystack adapter, sandbox-only tests/scripts and provider setup runbook.
- Browser and Edge source guard prevents restoring Paystack API/checkout/secret/sandbox integrations.
- Kept legacy HTTP 410 payment endpoints, disabled online settlement and historical migration/payment records. These are protective tombstones/history, not a working integration.
- Preserved Moniepoint **6977298247**, **LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST**, fixed **₦1 = 1 DC**, private receipt submission and independent finance statement verification before atomic audited credit. Receipts/client claims do not prove payment.
- Updated current rollout documents to remove Paystack setup and acceptance requirements.

## Verification

- `npm test`: PASS, including manual-deposit authorization, exact amount/recipient/currency checks, idempotency/refunds, source retirement guard and migration reconciliation fixture.
- `npm run test:deployment`: PASS (fresh build and local artifact checks).
- `npm run test:secrets`: PASS, no supported private-credential patterns.
- `git diff --check`: PASS.

This branch also includes the accumulated frontend/admin/manual-payment/PWA implementation and migration preparation from earlier work, not just this removal. The PR intentionally carries that existing work forward.

## Deployment warning

Creating the PR does not deploy anything or resolve the production NO-GO. Do not merge into an auto-deploying production branch before the existing backup/recovery, coordinated backend reconciliation, SMTP/Auth and live acceptance gates are cleared. Migrations 016–023 remain unapplied in production; 024 was already applied. Use `MIGRATION_RECONCILIATION.md`, never replay the whole migration directory blindly. No production financial data was changed for this revision.
