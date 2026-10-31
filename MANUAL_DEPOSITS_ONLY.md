> **Current continuation:** `PRODUCTION_BLOCKERS_REPORT.md`, `MIGRATION_RECONCILIATION.md` supersede older rollout statements below. Moniepoint manual transfers are the only supported funding method; Paystack TEST and live integrations are removed.

> **Latest launch assessment:** `PRODUCTION_READINESS.md` records the live 024 hardening, two deployed retired-payment guards, exact tests and remaining NO-GO blockers. Earlier inspection/deployment statements below are historical; 016–023 and the new Render frontend remain undeployed.

# Manual deposits only — current payment policy

**2026-10-31. Local implementation tested; NOT deployed.** This supersedes all older Paystack deployment instructions. Production online checkout remains disabled. Paystack TEST and live integration are removed. Do not configure provider keys or checkout/webhooks. Use Moniepoint manual transfers only.

## Live inspection (read-only)

The existing Supabase project `lohlvenibvohoxtfucfa` was inspected. It has the existing bank-order tables, zero bank orders, zero provider payment records and no deployed Edge Functions. The DC journal table is absent: earlier staged migrations 016–020 have not been deployed. No production financial rows, roles, Auth users or credentials were modified in this task.

## What changed

- Removed the shared Paystack API adapter and all frontend/admin provider-verification actions. Both legacy payment Edge entrypoints are fail-closed HTTP 410 tombstones: no secret reads, network calls, database access or crediting. OPTIONS only supports browser compatibility.
- Migration **021_manual_deposits_only.sql** revokes provider settlement/failure RPC execution from API roles, including service_role, and blocks new online payment records. Existing provider records and financial history remain read-only archives; nothing is deleted or retrospectively credited. Owner-controlled SQL is still trusted administrative access, not a public payment API.
- `/credits` supports entering a naira amount (₦0.01–₦1,000,000, maximum two decimals), exact pre-transfer DC preview and preset packages. ₦1 = 1 DC, including fractional naira/DC. The examples ₦100/500/1,000/2,000/5,000/10,000 map exactly to the same number of DC. Custom requests require a verified account. UUID retries return the same snapshotted order; five unfinished requests per account are allowed.
- Platform deposit fee is **₦0**. User bank fees may be charged separately. Transfer the exact order amount; credited DC is never silently reduced by fees.
- Reuses `bank_point_orders`, private `bank-receipts`, existing Auth/RLS, wallet, notifications, append-only points/DC journals and audit logs. Recipient details are snapshotted per order. Official configured bank: **MONIEPOINT — 6977298247 — LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST**. No separate backend or provider key is needed.
- Receipt evidence and claimed references create **submitted**, never approved, status. Finance must independently inspect the receiving bank statement/account. There is no automated bank-account connection or screenshot authenticity verifier.
- Verified, active Super Admin/finance staff enter the actual received amount, NGN currency, recipient account and unique cleared bank-statement reference. The server rejects discrepancies against the order snapshot and prevents self-review, raw user financial writes, legacy approval bypass, duplicate incoming references and duplicate credit. Credits, original-order status, notification and immutable balance/ledger snapshots commit atomically. Existing pending evidence remains submittable when new deposits are paused.
- `/payments` defaults to manual transfers. Historic online records, if any, remain readable without a verify/checkout action. Wallet history includes posted full-deposit reversal entries and refunded filtering.

## Admin review, refunds and reports

Admin → **Bank transfers** provides server-side username/email/order/claimed-reference/statement-reference/refund-reference search, status and inclusive UTC date filters, 25-row pages, record inspection, private receipt access and CSV export of **the current page only**. CSV escapes spreadsheet formulas. Amounts show kobo precision.

Matching-record totals show gross confirmed funding, recorded full refunds and net confirmed funding. These are customer credit funding, **not business profit**. Pending/rejected/cancelled transfers do not count as received funding. Original statement facts, reviewer/reason, bank-recipient snapshots and refund references are retained.

**Record confirmed external refund** does not transfer money and does not enable cash withdrawals. Authorized independent finance staff may record only a separately confirmed full external bank refund, with exact original amount, unique outgoing reference and reason. The corresponding purchased DC is reversed once, without overwriting the original deposit. A repeated identical confirmation cannot debit twice. A contradictory reference is rejected.

Any historical purchase-referral bonus associated with that deposit is reversed atomically too; its original award record is preserved. Historical referral totals are explicitly labelled gross, while wallet journals show reversals. The earlier 019 policy disabling new automatic purchase-referral bonuses is preserved. Refunds do not alter independently earned creator XP or launch awards.

If the buyer or a historical bonus recipient lacks sufficient unspent DC, reversal fails atomically and staff must escalate for audited reconciliation. No negative wallet, silent partial debit, automatic withdrawal or false refund-completed record is created. Staff should assess recoverability before arranging an external refund. This release does **not** implement partial refunds, automatic bank payouts, provider disputes/chargebacks or a dispute-case management system. Discrepancies/disputes require support/finance investigation and documented authorized reconciliation; they are never automatically treated as successful payments.

## Tests actually performed

- `npm test`: full regression suite, including provider-retirement and manual-deposit tests on isolated full 001–021 databases.
- `npm run test:manual-deposits:concurrency`: real embedded PostgreSQL authenticated sessions; 20 simultaneous approvals, 20 simultaneous refund reversals, and competing approve/reject decisions. Single credit/reversal and serialized conflict handling asserted.
- `tests/manual-deposits.test.mjs`: ₦100, ₦1,000 and ₦5,000 exact credit; pending receipt gives no credit; rejected transfer; wrong amount/currency/recipient; duplicate statement/reference/verification; refunded wallet history and totals; insufficient-unspent-DC rollback; historical referral-bonus reversal; private owner access; unprivileged/legacy/provider RPC denial; online insertion disabled; staff search/date filters.
- `tests/dc-provider.test.mjs`: retired endpoints return 410; OPTIONS 204; no provider network, secret or database call. These are retirement tests, not successful Paystack tests.
- `tests/manual-deposits-browser.smoke.mjs`: intercepted-network fixtures for amount/DC preview, official beneficiary, private receipt submission/pending copy, absence of online verification, finance statement approval, full external-refund confirmation, server search/date filters, CSV download, safe errors/retry and 15 phone/tablet/desktop portrait/landscape layouts (320–1440px), with no document overflow or uncaught JS errors.
- Build/deployment-artifact checks, secret scan and `git diff --check`.

No real money was moved. **Real bank receipt/statement settlement, real administrator/member Auth sign-in/refresh, live notification delivery and deployed frontend acceptance were NOT tested.** Browser fixtures and local SQL are not proof of those flows.

Optional tools (no lockfile changes): install `embedded-postgres@18.6.0-beta.19 playwright @sparticuz/chromium` together with `npm install --no-save --package-lock=false`. Run a test-only Vite server on port 5174 with `VITE_SUPABASE_URL=https://test.supabase.co` and `VITE_SUPABASE_ANON_KEY=test-key`; execute `LD_LIBRARY_PATH=/home/user/.cache/browser-libs/lib node tests/manual-deposits-browser.smoke.mjs`. This library path is sandbox-specific. Never deploy fixture settings.

## Coordinated deployment / manual acceptance

1. Review backups and migration history in the **existing** project. Apply only missing migrations in order through **021**; currently 016–021 remain staged. Earlier economy/launch migrations have separate eligibility/award implications: do not reset/replay existing migrations or manually rewrite balances.
2. Confirm the official recipient in Admin bank configuration. Preserve existing order snapshots if bank details later change. Review package values, fixed-rate constraint and deposits-enabled setting.
3. Deploy the matching frontend on Render with public Supabase settings only. No Paystack/private payment key belongs in Vite/Render/browser configuration. If an older online handler exists in another environment, remove it or replace both entrypoints with these 410 tombstones and remove its provider webhook subscription. Do not enable historical payment instructions.
4. No payment Edge Function is required for manual transfers. Existing unrelated secrets must not be deleted blindly. If obsolete provider secrets were configured elsewhere, remove them only after confirming they are no longer used; never expose them in chat or builds.
5. With consenting test accounts, perform a small real bank transfer and independent finance review. Confirm exact DC/ledger snapshots, private receipt access, owner refresh/notification, ordinary-user denial, duplicate-reference denial and historical archive behaviour. Check rejected/mismatched transfers remain uncredited.
6. Verify an authorized full external-refund recording/reversal and its journal/audit trail using an appropriate controlled test process, then reconcile actual receiving-bank totals against the filtered financial report. Preserve evidence of the real acceptance checks separately. Do not describe manual approval as automated bank verification.
