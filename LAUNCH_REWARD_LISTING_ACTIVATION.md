# First-50 launch reward listing payments

## Change requested

The owner explicitly requested that new members be able to spend the **5,000 DC first-50 launch reward** on their own feed listing, and asked for an easy-to-follow listing page. This narrowly supersedes the previous purchased-DC-only rule for the launch reward only. Connection, mission, referral, and other reward DC remain ineligible for listing. No other economy, package, deposit, or managed-listing policy was changed.

## Live Supabase migration

Migration **20261110074712**, `launch_reward_listing_funds`, was installed successfully. It installs `supabase/manual/install_launch_reward_listing.sql`. **Do not replay this migration or the earlier launch/paid-feed installers.**

The migration preserves the owner wallet, balances, paid deposits, ledger and audit history, launch campaign/awards, listing orders/catalogue/settings, profiles, Auth users, managed profiles, connections, blocks and favourites. It makes no wallet or ledger changes and does not grant, backfill, convert, or expire credits. It does not edit package prices or add listing slots.

`feed_listing_dc(user)` derives spendable listing DC from already-approved Moniepoint deposit ledger entries plus an exact 5,000-DC ledger credit whose reference and account/slot match a real immutable `launch_awards` row. It never trusts a client-supplied reason, total wallet, connection rewards, or arbitrary positive ledger credit. Normal debits reduce the available balance. The purchase locks the member profile then wallet (the same lock order as launch rewards), rechecks profile readiness and package terms server-side, and atomically writes the order, wallet debit, immutable ledger, audit, and notification. Existing owner-scoped idempotency and time scheduling remain in place. A private server function calculates the balance; the browser cannot call it for arbitrary users.

The authenticated listing status now returns the fixed funding-policy identifier and separate purchased / launch / combined listing balances. Older frontend/backend combinations fail closed to purchased DC until the updated status is available. Public feed visibility, saved profile data, and public social links are unchanged.

## User-facing listing instructions

The existing guarded `/list-profile` route now opens a responsive four-step guide:

1. Reuse and save the member's existing profile—no second username or repeated profile form.
2. Turn on public profile visibility, publish at least one approved public social link, then recheck readiness.
3. View verified purchased and unspent launch balances, choose the exact package price, and understand that a full 5,000 launch award covers 48 hours (4,600 DC), leaving 400 DC.
4. Review and explicitly confirm once; the page then verifies the member's public feed result and profile. It provides direct links to the listing/profile and clearly warns not to pay again if status/visibility cannot be confirmed. Booked time does not pause when a profile/link is hidden; no auto-renewal or engagement guarantee.

The page uses the existing saved profile, catalogue and purchase RPCs. An optional collapsed launch-reward helper lets an already-eligible member recheck a reward. `How it works`, discovery, dashboard, connection-reward, and payment-error copy now distinguish the launch reward from non-listing rewards.

## Live checks

- Before and after migration, the live Auth/profile/wallet/ledger, listing-order/catalogue, award and campaign records were protected by table locks and matched in-transaction preservation fingerprints. The three existing successful launch awards each matched their immutable ledger reference; there were no pre-existing member listing purchases. No account identifiers or wallet totals are included in this repository record.
- Migration **20261110074712** installed successfully. The original eight enabled package rows remained unchanged at their established prices/durations.
- Live postchecks: the campaign remains active with **3 successful awards and 47 slots remaining**; no award or member listing purchase was created during installation. Anonymous callers cannot invoke the purchase/private balance function or read raw award rows; authenticated members can use only the self-scoped purchase RPC.
- Original purchased-balance, profile-readiness, visibility, directory and public-detail function fingerprints all match preflight. Only `my_feed_listing` and `buy_feed_listing` were intentionally updated.
- A privileged aggregate-only check confirmed the new server calculation recognizes only verified deposit credits and valid launch-award history; connection/other reward credits remain ineligible. No member-level balances or identities are published here.

## Verification and limitations

`npm test`, production build, 701-text secret scan, and `git diff --check` passed. The new isolated SQL suite uses the exact installer and verifies original-row/catalogue preservation, genuine-vs-forged reward sources, reward-only 48-hour purchase, 400-DC remainder, public feed/detail eligibility, no cross-owner/anonymous purchase, verified deposit + launch balance, idempotency, atomic rollback on ledger failure, renewal and expiry. A separate disposable PostgreSQL 18 run exercised 64 requests / 16 IDs / 8 sessions and six launch-award-vs-purchase races without overspend, duplicate credit, or deadlock. The optional concurrency harness is gated by `LISTING_POSTGRES_TEST=1`, targets only loopback port 5451 / the blank `listing_test` database (`LISTING_POSTGRES_TEST_USER` selects the local superuser), and refuses to proceed when application tables or Supabase roles already exist.

Local Chromium fixtures verify the staged instructions, reward-funded purchase, responsive screens, public visibility confirmation and uncertain-result handling. These use mocked Supabase responses. They are **not** proof of a live signed-in member checkout or Render deployment; no production claims, listing purchases, fake accounts, or forced profile changes were made to test payments.
