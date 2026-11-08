# Dedicated Moniepoint deposit page

## Implemented

- Protected member route `/deposit`, existing member shell/mobile navigation.
- Wallet and legacy-wallet entry links; `/credits` retained for compatibility.
- Confirmed Moniepoint destination read from the existing protected `bank_transfer_details` table:
  - MONIEPOINT
  - 6977298247
  - LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST
- Reference-only bank card, clipboard copy with honest browser failure feedback and beneficiary retry.
- No hardcoded bank fallback on failed/denied reads. Mismatched bank/account/beneficiary values are suppressed for owner review.
- Order processing on this page is not mounted until the beneficiary read succeeds and matches the approved destination.
- Existing deposit/order/history UI reused, without enabling legacy financial writes. Missing deposit settings still disable new orders and warn not to transfer.
- No new payment/approval RPC, balance mutation, migration or provider integration was introduced.

## Files

`src/pages/Deposit.jsx`, `src/pages/deposit.css`, `src/member/depositBank.js`, `src/App.jsx`, `src/member/MemberLayout.jsx`, `src/member/LegacyMemberWallet.jsx`, `src/pages/GrowthWallet.jsx`, `tests/deposit-page.test.mjs`, `tests/member-compatibility-browser.smoke.mjs`, `package.json`.

## Validation

`npm test`, `npm run test:deployment`, `npm run test:secrets`, `git diff --check`: PASS.

Local Chromium member compatibility suite: PASS including the new deposit route at 320/390/844/768/1440px, actual browser clipboard copy in the local secure-context fixture, mismatched details hidden, beneficiary retry, disabled unavailable payment entry and preserved prior wallet/member regressions. Auth and transport are mocked; not production login/settlement or a physical-phone clipboard test.

## Installation status

The owner explicitly waived the earlier backup/restore prerequisite for this narrow manual-transfer installation. The live `standalone_manual_bank_transfers` migration (version `20261108195733`) installed deposit settings, whole-naira order creation, private receipt submission, admin reporting and statement-matched approval. Existing Auth/profile/wallet/ledger/order/notification/audit records were protected with before/after row fingerprints inside the installation transaction and preserved unchanged. This is not a backup or proof of recoverability.

The dedicated frontend route is part of this release; actual Render release completion must be verified separately. Existing deployed `/credits` uses the same newly installed backend contract.

Only whole naira amounts from ₦1 to ₦1,000,000 are supported, at ₦1 = 1 DC. The existing integer wallet schema is preserved. Receipts alone never authorize credit. Approval requires an authorized admin to independently check the receiving-bank statement and enter the exact amount/currency/account and a unique reference. Repeated approval cannot credit twice. No self-approval, automatic refunds, Paystack, unrelated reward credits or migration replay is enabled.

See `STANDALONE_MANUAL_TRANSFER_INSTALLATION.md` for evidence, limitations and future migration collisions. Full real-browser Auth/receipt upload/actual bank settlement acceptance remains unverified; no real bank transfer was performed here.
