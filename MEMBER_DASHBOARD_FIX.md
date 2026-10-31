# Member dashboard / wallet follow-up

## Live diagnosis

The production member overview function exists, but the extended wallet, missions and connection RPCs are absent. A diagnostic transaction called `member_overview` for both existing accounts and rolled back ALL effects, including the old routine's normal wallet initialization/upsert. Both calls succeeded: one existing wallet returned 90 DC; the account without a wallet returned a temporary initialized 0 DC within the test transaction. That temporary wallet was NOT retained. This is a SQL diagnostic, not an actual password/browser login. No financial/schema migration was performed.

This distinguishes a core overview query from missing functions on pages linked from the dashboard; it does not claim the user's exact live browser error was reproduced without their session/network trace.

## Changes

- Validate member overview owner, balance and activity shape before rendering. Invalid/missing balances are not converted to zero. Wallet owner mismatch is rejected.
- Clear failed/stale overview data, suppress cross-account data during identity changes, show an actionable error and allow Retry. Recent activity no longer remains stuck on a misleading loading label after a failed account request.
- Guard balance access in shared member chrome/settings/reward/activity views. Validate creator-list response shape before slicing.
- If and only if `dc_wallet` is missing, use authenticated SELECT-only RLS queries for the current user's original balance, points ledger and bank-order history. Always apply the user ID filter, paginate deterministically, preserve actual deposit statuses and never infer balance snapshots or settlement success. No fallback on access denial, timeout or general failure.
- Show `Balance unavailable` when no balance row is returned, not fake 0 DC. Missing advanced backend dependencies have a clear upgrade message.
- Failed deposit setup clears stale configuration/history and does not show false “no orders” or invite transfers through an unverified legacy mutation path. New transfers remain disabled unless current deposit settings load successfully.
- No old payment/approval/reward write fallback; no Paystack integration; no changes to roles, Auth users, production balances or ledger.

## Tests passed

- Full `npm test`, including existing admin compatibility and new member compatibility database/helper tests.
- `npm run test:deployment` (fresh build and artifact tests).
- `npm run test:secrets`; `git diff --check`.
- `tests/member-compatibility-browser.smoke.mjs`: real local Chromium with mocked session/network, dashboard and read-only wallet at five viewport sizes; original ledger access; owner/deposit query filters; absent balance not zero; denial without fallback; malformed overview no crash/no stale balance; successful retry recovery. This is NOT production Auth acceptance.
- Isolated baseline 001–015 + 024 database tests cover overview for wallet/no-wallet accounts, transaction rollback preserving all original rows, and RLS cross-wallet isolation.

Logs: `/home/user/member-compat-{browser,regression,deployment,secrets}.log`.

## Still required to finish production

Owner selected “Verified—provide evidence” for backup availability in this follow-up. Actual backup reference/time, named restore owner and isolated restore-verification record were not supplied in that selection. Availability attestation is recorded honestly; the artifact's recovery metadata must not be fabricated.

After those details are provided/verified, re-audit production and follow `MIGRATION_RECONCILIATION.md`. Then execute the single guarded forward reconciliation, preserve original rows, confirm only the explicitly approved 10,000-DC launch delta, and run real member/admin/ordinary-user and manual Moniepoint acceptance. SMTP/push/provider operations still need their secure configuration and real delivery tests. Source PR updates are not a deployed Render release; no complete-live-success claim is made.
