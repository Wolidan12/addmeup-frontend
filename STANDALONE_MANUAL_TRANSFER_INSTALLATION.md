# Standalone manual bank transfers — live installation

## Authorization and scope

The owner explicitly instructed: remove the backup/restore prerequisite and use ordinary manual bank transfers, receipt upload and admin-approved wallet credit. This supersedes that earlier prerequisite **for this narrow installation only**. Risk was disclosed before proceeding. No backup or isolated production archive restore was performed; transaction checks are not a recovery backup.

Applied through Supabase migration tooling to existing project `lohlvenibvohoxtfucfa`:

- Migration name: `standalone_manual_bank_transfers`
- Verified registry version: `20261108195733`
- Reviewed executable source: `supabase/manual/install_manual_bank_transfers.sql`

No reset, project replacement, role grant, password change, broad 016–023 replay, launch award, DC journal reconstruction, unrelated feature rollout or payment-provider connection was performed. The registry also contains separately applied `danqel_*` migrations; their code was not modified by this installation.

## Installed flow

1. Verified, unrestricted signed-in member requests a whole-naira amount, ₦1–₦1,000,000.
2. Server creates an idempotent order at ₦1 = 1 DC, using approved Moniepoint account 6977298247 / LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST.
3. Member uploads an image into their own pending order's private `bank-receipts` path, then submits payer name/reference/evidence.
4. No credit occurs at order creation or receipt submission.
5. Verified, unrestricted super-admin/finance admin independently checks cleared receiving-bank funds and enters exact amount, NGN currency, receiving account, unique statement reference and review reason.
6. Approval locks the order, records statement facts, increases the original wallet, appends one ledger credit, records audit and notifies the member in one transaction. Repeated matching approval is a no-op. Duplicate bank references fail and roll back.
7. Rejection records reason and notification without credit. Self-review is denied.

Original integer wallet/ledger types are retained. Fractional naira deposits are rejected, never rounded into credits. Packages must also match the official 1:1 rate. Whole-naira validation is included in the updated frontend.

## Security and preservation

- Existing `require_active_account`, verified Auth and ban checks enforce active accounts; approval/report roles enforced inside SQL.
- Anonymous execution denied; member cross-order access denied; balance and ledger remain protected.
- Receipt uploads remain owner/order scoped, private, MIME/size constrained and immutable after submission. The upload-path regex and submit validation use an unambiguous literal-dot character class.
- Old `admin_review_bank_order` execution revoked to prevent bypassing exact statement checks.
- `dc_settings`: deposits enabled, extended spending disabled, authenticated read-only RLS. No public/client settings mutation.
- Refund automation is NOT installed. Report rows advertise `refunds_supported:false`; updated frontend hides unsupported refund actions. Do not use direct wallet edits as refunds.
- Read-only admin report supports username/email/reference/payer search, status/date filters, exact count, pagination and confirmed-funding totals.
- Installation takes bounded locks and fingerprints every existing Auth/profile/wallet/ledger/order/notification/audit row before and after. Any unexpected data change aborts the installation transaction. No live test payments, false receipts or artificial wallet credits were inserted.

### Live postcheck

4 Auth users, 4 profiles, 3 wallets, **90 DC aggregate**, 6 ledger entries and 0 bank orders, unchanged from preflight. Deposits enabled; new creation/approval/report functions present; old approval unavailable to authenticated callers; receipt bucket `public=false`. The only financial-table trigger found is the pre-existing earned-XP ledger trigger; no new financial trigger was introduced.

## Tests and evidence limits

- `tests/standalone-manual-deposits.test.mjs`: actual isolated SQL baseline 001–015 + 024, real receipt Storage RLS insertion/submission, 90 DC unchanged before approval, 90→1090 after approval, retry exactly-once, mismatched amount rejection, duplicate statement reference rollback, rejection without credit, self-review/member/unverified/anonymous denial, old-endpoint denial, report, Auth preservation.
- Full `npm test`, build/deployment artifact checks, secret scan and diff checks pass.
- Chromium suites: member/deposit compatibility, manual deposits and admin compatibility pass, including mobile/desktop, upload flow, approval controls, error/retry and report filtering. These use mocked Auth/transport. The manual-deposit suite's refund fixture tests the older/full contract, not newly installed refund functionality.
- Live installation and metadata/data-preservation postchecks succeeded.
- **Not verified:** actual password sign-in, actual browser Storage upload in production, actual bank transfer, statement authenticity, first real settlement or Render release completion. The owner must perform the first real end-to-end acceptance with genuine bank evidence. No credential was requested in chat.

## Frontend and future migrations

The dedicated `/deposit` page and wallet links are included in this branch; `/credits` remains compatible with the installed backend. Frontend publication/deployment status must be reported separately from the database install.

The previous all-or-nothing 016–023 reconciliation now needs revision: `dc_settings`, nullable package IDs, verification columns and some 021-signature functions already exist. **Do not run 016 or 021 or the old reconciliation script blindly.** This installation is NOT full application of either migration, and no migration-history backfill was fabricated. Other pending financial/feature migrations remain separate and retain their own safety prerequisites.
