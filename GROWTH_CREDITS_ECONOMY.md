> **Current payment policy (2026-10-31): MANUAL BANK TRANSFER ONLY.** Online Paystack processing/actions have been retired. Provider setup, secret and webhook instructions below are historical and must not be followed. Use `MANUAL_DEPOSITS_ONLY.md` and migration 021 for the current implementation and rollout. Historical payment records are preserved.

# DANQEL Growth Credits economy — staged implementation

## Release status

Implemented and tested in this working branch. **Migrations 016 and 017 have NOT been applied to production; the frontend has NOT been pushed/deployed. Do not treat the production site as upgraded.** Previous account migrations 013–015 are already live and must not be replayed.

Read-only live preflight used the existing project `lohlvenibvohoxtfucfa`: two Auth accounts/two profiles, one balance of 90, six earned ledger entries totalling 90, and no packages, bank orders or provider payments. No production financial data was changed during this economy task. The 90 existing credits carry forward unchanged; no paid history is manufactured. Production has **zero deployed Edge Functions** according to the connector inventory, so provider verification must not be represented as operational.

> Follow-on launch/progression migrations 018/019 are described in `LAUNCH_MISSIONS_PROGRESSION.md`. They replace repeatable legacy tasks and automatic purchase-referral commissions with verified/reviewed missions; old earnings are retained. Coordinate all pending migrations with the frontend release.

## Rules implemented

- Official symbol **DC**. Server-side **₦1 = 1 DC**, including kobo: ₦125.25 settles as exactly 125.25 DC in PostgreSQL numeric arithmetic.
- Deposit packages 100/500/1,000/5,000/10,000 DC at exactly the same naira amounts. A database constraint rejects arbitrary package conversion rates. Staff can configure package sizes/availability, never exchange rates.
- Virtual platform credits only, not cash, bank deposits, investment returns or automatically withdrawable money. No withdrawal API, UI or admin toggle exists.
- Discovery/connections remain free. Repeated favourite/add/remove operations cause neither debits nor automatic rewards. Existing eligible check-ins, evidence-backed tasks and bounded, configurable referral/booster programmes are preserved.
- Six database-backed premium categories: Spotlight, visibility boost, featured placement, social media promotion, cosmetic premium badge, eligible creator campaign. They start **inactive/unpriced**: no invented service prices and no fabricated delivery.

## Database migrations (apply in order, once)

### 016_dc_economy.sql

Converts monetary credit amounts to numeric(20,2), preserves existing balances/ledger and adds the canonical `dc_transactions` journal. Each actual balance movement captures its database-observed previous/new balances, owner, UUID reference, amount, timestamp and transaction ID. An after-ledger trigger links the unique ledger/activity reference. A deferred constraint rejects transactions with an unpaired balance movement; orphan ledger inserts are rejected. Journal updates/deletes/truncation are blocked. Nonzero wallet deletion and null balances are blocked. Legacy snapshots are explicitly marked **reconstructed**, not misrepresented as previously recorded snapshots.

Existing functions are recompiled to avoid stale integer record-field plans in pooled sessions. Earned-only creator XP is preserved and deposits never become XP.

Bank approval retains finance/super-admin authorization, no self-approval, receiving-bank statement confirmation/reference uniqueness, evidence ownership and existing audit/referral logic. Settled credits come from the order's naira amount, not an arbitrary points snapshot. Provider settlement remains service-role-only, validates stored reference/amount/NGN/customer email/provider ID, uses unique provider transaction IDs and credits exactly once atomically with verified payment status.

### 017_dc_wallet_and_spending.sql

Adds `dc_settings`, `dc_products`, `dc_orders`, paginated/status-filtered `dc_wallet`, and audited administrator catalogue/configuration/review RPCs. Spending debits once using a stable request UUID and a locked sufficient-balance update; retries with conflicting details are rejected. Staff can record actual manual fulfilment or return unfulfilled costs **to DC only**, once. No automatic visibility/ranking/delivery integration is claimed. A purchase funds a request, not a guaranteed placement, reach result, follower count or verification badge.

Deposit attempts have request-time balance snapshots. Pending/failed/cancelled attempts are not successful ledger credits and move zero DC. New deposits and DC spending (including legacy boosters) can be paused; already-created deposits can still settle. A zero-value daily reward is treated as paused rather than creating a fictitious zero-amount financial entry.

Browser financial writes are revoked. The only direct browser provider write is a column-limited INSERT of an own pending reference/provider/amount, protected by existing RLS; callers cannot set status, purpose, provider ID or balance snapshots. All settlement stays trusted. Canonical journal and premium orders are protected by RLS; ordinary users cannot inspect others' records or invoke administrative operations.

## Frontend

- `/wallet`: server balance, deposit/buy/earn/spend/free-discovery actions; successful/pending/failed counts; transaction/deposit histories, server pagination/status filters, references, before/after balances and snapshot provenance. Loading, empty, safe-error/retry states.
- `/credits`: exact-rate packages, existing confirmed Moniepoint destination, private receipts and review statuses. New purchases disabled while deposits are paused; existing evidence submission remains available.
- `/spend-credits`: real catalogue, authorization/price disclosure and accessible confirmation dialog, stable request ID, staff-reviewed fulfilment history and DC refund notes.
- Member dashboard/navigation/rewards/referrals/boosters now use DC rather than pts.
- Admin **DC catalogue & packages**: availability controls, feature pricing/activation with reasons and explicit confirmation. Separate **DC transaction journal** and **Premium requests** resources have server filtering/pagination and finance permissions. Only super admins may confirm fulfilment/refund; both require a reason/confirmation and server authorization.

## Checks actually performed

- Full `npm test` regression suite passed after migration/fixture adaptations. Existing financial fixture expectations were updated for the official rate and provider credits; account XP fixtures now create matching balance/ledger pairs instead of impossible orphan entries.
- `npm run test:dc`: PostgreSQL/PGlite migration preservation, fixed conversion, fractional provider settlement, amount/email/currency mismatch denial, provider-ID/retry duplicate prevention, real bank-order/evidence/review SQL workflow, immutable snapshots, browser ACL/RLS/cross-user denial, free repeated connections, configured spending, insufficient funds, fulfilment/refund idempotency, pauses and audit records. Mocked provider adapter checks success/failure/pending/mismatch/unavailability/reconciliation errors.
- `tests/dc-browser.smoke.mjs`: explicit network fixtures for wallet filters/pagination/error recovery, credit packages, confirmed spend, catalogue admin/refund, ordinary-user admin denial and 30 responsive combinations (320px, 390px, landscape, tablet, desktop). Screenshots reviewed. These are NOT live Auth/payment tests.
- Account and existing member browser smoke suites passed against the isolated fixture server.
- Production build/deployment-artifact checks passed; secret scanner passed over 297 source/artifact/log blobs; `git diff --check` passed.

## Coordinated production rollout still required

1. Review/back up the existing project's financial tables. Recheck the live preflight; if new legacy paid/pending records now exist, reconcile/classify them before migration. Historical provider records are labelled `legacy_unspecified`, not blindly back-credited.
2. Apply **only** 016 and then 017 using the existing Supabase migration workflow/SQL editor. Never replay 001–015, reset the project or replace accounts/roles. Both files are transactional. Verify the old ledger/roles/accounts, 90-credit carry-forward, six reconstructed journal rows, fixed-rate packages and inactive catalogue. Keep normal operational backups and use a reviewed forward fix rather than dropping financial history on rollback.
3. Deploy this branch's frontend to the existing Render service with its existing public Supabase URL and anon/publishable key; no service-role, bank-provider or other private key belongs in Vite/browser variables. Verify the actual deployed wallet/admin UI and authenticated refresh.
4. For Paystack, deploy repository `verify-payment` and `payment-webhook` Edge Functions including `_shared/paystack.ts`. Configure the private provider key and origin allowlist server-side. Verification requires the member JWT; webhook gateway JWT verification must be disabled so Paystack can call it, while the handler still requires a valid HMAC and independently re-verifies the payment with Paystack. Configure the signed webhook URL at the provider. No provider checkout initializer was added; do not advertise an automated Paystack checkout as ready.
5. Perform a controlled real bank transfer and finance review; check exact credit, duplicate statement denial and ledger snapshots. Perform provider sandbox success/failure/signed-webhook/retry tests after setup. **No real bank transfer, Paystack charge/webhook or live administrator/member sign-in acceptance was performed in this task.**
6. Configure premium service prices and actual delivery capacity before activation. Requests are manual fulfilment, not automatic ranking/visibility/badge changes; mark completed only with genuine delivery evidence or refund unfulfilled requests in DC.
7. Preserve the separate outstanding account email/SMTP/live verification requirements documented in `USER_ACCOUNT_SYSTEM.md`.
