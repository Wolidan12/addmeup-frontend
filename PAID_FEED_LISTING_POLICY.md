# Purchased-DC paid feed release

## Release status

Backend and frontend implementation are complete and locally tested. **Production paid-feed installation/activation and release merge are not yet performed.** The owner’s earlier recovery waiver was explicitly limited to the standalone manual-deposit installation. A separate activation/recovery decision is required for this new spending-and-visibility release. Do not represent local SQL/Chromium fixtures as production signup, settlement, concurrency or deployment acceptance.

Production was inspected read-only before implementation: 4 Auth users, 4 profiles, 3 wallets, 90 total DC, 6 ledger entries, 1 submitted deposit and 1 awaiting-transfer deposit. This is an inspection-time snapshot, not a permanent assertion. No approved manual deposits were present. No live order was approved, and none of the existing 90 DC was converted to purchased funds.

## Policy and prices

Every public feed profile must have an active paid listing funded with **purchased DC**, not reward DC. Editing a profile is free and distinct from purchasing feed time. Connections and favourites remain free.

| Duration | Hours | Purchased DC |
| --- | ---: | ---: |
| 7 hours | 7 | 1,200 |
| 24 hours | 24 | 2,400 |
| 48 hours | 48 | 4,600 |
| 72 hours | 72 | 6,800 |
| 1 week | 168 | 15,600 |
| 2 weeks | 336 | 31,000 |
| 3 weeks | 504 | 46,400 |
| 1 month (30 days) | 720 | 66,200 |

Owner supplied the first three prices and requested the rest. Whole-day extrapolation is `2,400 + (days - 1) × 2,200`; seven hours is a separate explicit rate. A month is 30 days/720 hours, not a variable calendar month. SQL seeds the authoritative packages; client constants are documentation/tests only, not debit authority.

## Forward backend installation

`supabase/manual/install_paid_feed_listings.sql` targets the inspected live baseline 001–015 + 024 + the already-installed standalone manual transfers. It does **not** replay absent migrations 016–023 or enable unrelated spending/providers/launch awards.

Inside one transaction it:
- Locks original tables, fingerprints original Auth/profile/managed-profile/wallet/ledger/deposit/notification/audit rows, and aborts if any original record changes.
- Adds listing packages, an independent purchase pause setting, and append-only owner-readable listing orders. Browser roles cannot insert/update/delete/truncate these tables.
- Adds a private derived purchased-credit calculation, owner listing state/history RPC, and atomic purchase RPC.
- Replaces the actual `public_directory` RPC used by the homepage, dashboard and Explore, and tightens public profile RLS to prevent a free REST-listing bypass.
- Adds the missing compatible `discovery_profile` read RPC, preserving owners’ private/unpaid/expired profile preview. Other visitors must have an active eligible listing to read a profile. Managed listings remain stored/admin-manageable but receive no free public feed exception; there is no fabricated Auth owner/payment on their behalf.
- Notifies PostgREST to reload schema. Existing records and unrelated `dc_settings.spending_enabled` remain untouched.

The installation is intentionally not blindly repeatable. Read migration history/catalogs after any ambiguous installation response; do not rerun to guess success.

### Purchased-credit provenance

Availability is derived from the existing immutable ledger, not a new grant, backfill or cached wallet total. A positive entry qualifies only when its unique `bank-order:<uuid>` reference matches an approved, independently reviewed manual deposit with the same owner, points, exact NGN amount, beneficiary and stored bank verification fields. Claimed receipt/reference, submitted/pending deposits, rewards, launch grants, XP, arbitrary admin adjustments and positive refund/reward entries do not qualify.

Every historical negative ledger movement consumes purchased funds first. Same-timestamp movements are grouped conservatively. Leading non-purchased spending is floored at zero, so it does not poison later genuine deposits. The result is capped by the actual common wallet balance. This is a conservative purchased sub-balance; unproven historical credits are not silently treated as purchased. Trusted financial operations must continue writing matching common-wallet and immutable-ledger movements, as the existing RPCs do. Direct owner SQL balance rewrites outside the ledger are not a supported money operation.

### Purchase, renewal and expiry

`buy_feed_listing(text,uuid,integer,integer)` uses `auth.uid()` only; clients cannot select another owner. It validates the authoritative enabled package and quoted cost/duration, locks the owner’s common wallet, checks genuine purchased funds and eligible public profile plus a valid enabled public social link, and atomically inserts the listing, debits once, and appends ledger/audit/notification entries.

A durable unique request UUID is reused after failures/reloads. Replays must match owner/package/price/duration and return the original order without another debit. Different requests for one wallet serialize on the row lock; a unique primary key/ref prevents duplicates. Purchased availability is read after the wallet lock with a fresh volatile SQL read.

Activation is immediate for a new listing. Renewals start at the last booked end, preserving all remaining time. There is no recurring billing or automatic cash refund/withdrawal. Hiding/restricting the profile, removing its public link or disabling the social platform hides the listing without pausing/rewriting paid time. Users consent to these terms before checkout.

Feed eligibility checks database time (`starts_at <= now() < ends_at`), public visibility, valid public social link, active/non-banned account, restrictions and blocks in both directions. It never relies on a cron job, a sponsorship flag or a client wallet check. Expired/unpaid profiles leave directory counts/search/pages and anonymous REST reads; owners retain accounts and previews. Client cards additionally use server-clock offsets, known-expiry timers, visibility refresh and 30-second polling on all three feed surfaces.

## Simple frontend

- `/list-profile`: existing saved profile, authoritative purchased-versus-total DC, one duration selector and one confirmation. No repeat name/bio/social form.
- Settings step 3 embeds the same working purchase component and refreshes readiness when profile/links are saved.
- Owner-scoped local storage preserves an ambiguous request ID; corrupt/unavailable storage prevents an unsafe fresh purchase. Reloads offer **Resume saved listing request**. A verified SQL business rejection may clear the failed ID; ambiguous results retain it.
- Exact start/end time, queued/active/expired purchase history, fixed renewal terms and purchase pause/error/retry states are displayed.
- Missing/unavailable backend fails closed: no price fallback or fake successful purchase.
- Beginner guide, Explore CTA, sidebar and profile-card disclosure align with paid feed placement. Deposit remains independent statement-verified manual Moniepoint flow.

## Validation completed

- `npm test`, `npm run test:deployment`, `npm run test:secrets`, `git diff --check` pass.
- `tests/paid-feed-database.test.mjs`: actual installation and RPC/RLS execution against the matching isolated PGlite baseline, preserved original rows, exact catalogue, real receipt upload/submission/admin approval fixture, proven purchased funds, reward-only/anonymous/cross-owner/forged quote/private/no-public-link denials, exact debit/replay, renewal duration, restrictions/blocks, expiry without scheduler, no free managed/REST bypass, owner preview/history, other negative spending and append-only audit/ledger.
- `tests/feed-listings.test.mjs`: request payload, durable retry key, corrupt-storage behavior, malformed/cross-owner state denial and source guard coverage.
- `tests/paid-feed-browser.smoke.mjs`: local real Chromium with mocked Auth/transport; reward-only/unfinished profile denial, five portrait/landscape confirmations, no repeat profile fields, consent and busy guards, committed-but-lost result + reload/replay without second debit, renewal, missing-backend fail-closed and automatic expiry.
- Existing simple-profile, beginner-guide, manual-deposit, compact bank-review, admin/member compatibility and signup browser fixtures pass. One aggregate-run Chromium startup crashed; isolated rerun passed without changing application code.

PGlite serializes requests and is not a real production concurrency test. Browser transport/Auth are fixtures. A real owner-approved bank settlement and signed-in device purchase/expiry check remain production acceptance work, not something to fabricate with privileged balance edits.

## Activation and emergency pause

After the separate recovery/activation decision: verify current schema/migration history and baseline, apply exactly this forward installation once through the migration registry, verify registry/functions/packages/RLS and unchanged original record counts/fingerprints, then merge/deploy the frontend release. Do not approve the member’s pending receipt as an installation test.

Emergency pause: trusted owner SQL may set `public.feed_listing_settings.enabled=false` for the singleton row. This stops new charges while preserving booked service time, wallet/ledger history and paid eligibility. Do not drop financial tables, restore free feed policies, relabel balances, or manually erase ledger entries to roll back a purchase.
