# Social Discovery and Boost Center — staged implementation

## Release status

Implemented locally on `arena/24d9981d-addmeup-frontend`; **not deployed**. Migration 020 was executed against isolated full 001–020 PGlite and real embedded PostgreSQL databases, not production Supabase. Production migrations 016–020, the frontend release and any associated earlier Edge Function changes still require an authorized coordinated rollout. No production data was reset or rewritten in this task.

## Product behaviour

- Explore searches username/display name (also bio) and filters platform, country and interests on the server, with 12 organic records per page.
- A separately labelled **Paid promotions** rail shows up to three eligible active placements, using a deterministic UTC-day ordering. Purchased placement is not an exclusive slot or a guaranteed number of appearances. Organic ordering remains newest-first; old `is_sponsored` flags cannot create paid placements.
- Member profiles expose explicitly selected public fields and permitted, public, enabled social links. Managed listings remain listings, not Auth users, and cannot receive member connections or purchase campaigns.
- Connect is a unilateral connection/follow, not an invitation requiring acceptance. Connections and saved favourites are separate and always free. They create neither DC deductions nor XP/automatic rewards.
- Block confirmation removes both directions of connections/favourites and hides each account from the other's directory, profile/link reads and paid placements. My connections has connected/saved/blocked tabs and unblock actions. Blocked records show identifiers, not hidden profile contents.
- Reports require a visible non-self member target and an 8–500 character reason. Clients cannot forge reporter identity, status or moderation fields. Managed-listing concerns go through support.

### Starting packages

| Package | Starting price | Duration |
|---|---:|---:|
| Profile Spotlight | 500 DC | 24 hours |
| Visibility Boost | 800 DC | 168 hours / 7 days |
| Featured Profile | 1,000 DC | 24 hours |
| Social Promotion Campaign | 1,500 DC | **168 hours / 7 days** |
| Premium Profile Badge | 400 DC | 720 hours / 30 days |

Social Promotion's previously unspecified duration is explicitly implemented as **seven days of reviewed in-app placement**, not off-platform advertising or purchased engagement. The Premium badge is labelled **paid cosmetic**, never verification. All non-badge packages share the labelled Explore placement inventory; their package name, description, price and booked duration distinguish the offerings. There is no unimplemented off-platform delivery promise.

Admin → Promotion campaigns includes package controls for price, duration, availability and description, with reason and authorization. Existing configured prices and explicitly disabled priced packages are preserved by 020; initially unpriced seeded packages receive the starting defaults above. Existing campaign contracts retain price/title/description/duration snapshots after package edits. The fixed exchange remains ₦1 = 1 DC; no withdrawals are introduced.

## Purchases, review and financial integrity

1. Buyer must be an active account with trusted email verification and a complete public profile. A confirmation dialog displays price/duration and requires submission copy and explicit authorization.
2. `buy_promotion(product, request_uuid, details, expected_cost, expected_hours)` locks the request and owner profile, verifies the current package against the displayed quote, then atomically debits the existing wallet through the established DC journal/order implementation. A changed quote fails without charging. Clients cannot set the charge.
3. Campaign UUID equals order/request UUID. Identical retries reuse the existing purchase even after price changes; changing owner/product/submission with the same reference fails. Owner serialization and a pending-kind unique index prevent duplicate same-kind pending/running campaigns. Locked conditional wallet updates prevent different-kind overspending. Expired campaigns do not prevent a new purchase.
4. Purchases begin **pending**, with no paid delivery and no start/end date until independent review. Verified Super Admins review the submitted copy and can inspect the creator's public profile/social links; finance staff have read-only campaign oversight. A buyer cannot review their own campaign.
5. Approval activates delivery and sets an exact start/end window from the booked duration. Pause/resume preserve that end date. Private/restricted/unverified accounts are excluded from public placements regardless of the stored campaign state. An admin should reject inappropriate active content; profile/link edits remain subject to continued moderation, not an immutable social-account ownership guarantee.
6. Rejection of a pending, active or paused campaign refunds its **full snapshotted DC cost exactly once**, even if some delivery occurred. It never returns cash. Rejecting an already rejected campaign is idempotent. Expired bookings cannot be resumed or rejected through this workflow; exceptional corrections use the existing separately authorized audited financial process.
7. Expiry is derived server-side from the stored window. Stored `active`/`paused` rows may remain unchanged, but directory eligibility and all campaign history/admin listings use the effective expired status. No cron is required to stop delivery. Direct campaign SELECT is owner/authorized-finance only; UI uses effective-status RPCs.

Legacy promotional `dc_spend` calls must use the new quote-confirmed Boost Center. Generic non-promotion orders retain their prior flow, while promotional orders cannot be fulfilled/refunded through the generic review RPC. Private legacy helper EXECUTE privileges are revoked. DC journal and audit protections are preserved; spending/refunds do not change independently earned XP/rank or launch awards.

The staged 019 staff helper and its defensive 020 replacement now explicitly coalesce a missing role to `false`. This closes SQL-NULL authorization ambiguity for new package/review functions. No privileged role is granted by this change.

## Honest performance measurement

Owner history shows actual recorded **profile-open requests** and **outbound-open requests**, not fabricated views, reach or followers. Valid public paid-placement context is carried to profile/social links. Events are accepted only for an active eligible campaign, correct target and enabled public platform; self-events are excluded. Signed-in requests are deduplicated per campaign/member/UTC day/kind (plus platform for outbound opens). Anonymous activity is uncounted.

These are authenticated request telemetry, **not verified human engagement**, proof an external page loaded, globally unique people, conversions or independent platform analytics. Direct callers can submit valid deduplicated requests. No event pays DC/XP. No engagement is guaranteed. Raw viewer events are not exposed to members; they receive own aggregate counts. Event history rejects update/delete/truncate.

## Main implementation files

- `supabase/migrations/020_discovery_promotions.sql`: additive tables, RLS/ACLs, free relationship/report rules, block-aware discovery, quote-confirmed purchases, moderation/refunds, package configuration and measured events.
- `src/pages/BoostCenter.jsx`: catalogue, balance, authorized purchase dialog, server-filtered/paginated history, statuses/dates/refunds/telemetry disclosures and loading/error/empty states.
- `src/pages/Discover.jsx`, `Connections.jsx`, `ProfileDetail.jsx`, `src/components/RelationshipActions.jsx`, `ui.jsx`: discovery, free actions, public dossier, reporting and clearly attributed paid placements.
- `src/admin/PromotionPackages.jsx`, `resources.js`, `ActionDialog.jsx`, `src/pages/Admin.jsx`: package controls, campaign inspection and independent moderation.
- `src/App.jsx`, member/shared navigation and `src/design/premium.css`: guarded routes and responsive premium presentation. `/boosts` and `/spend-credits` open Boost Center; previous capped earning multipliers remain at `/reward-boosts`.

## Verification performed

- `npm test`: full unit/database/provider regression suite, including dedicated discovery tests through all migrations 001–020.
- `npm run test:discovery:concurrency`: real embedded PostgreSQL authenticated parallel sessions: 20 competing same-kind requests, 20 identical retries, 20 simultaneous refund attempts, and competing different-kind purchases against one finite wallet. Exactly-once debit/refund and no overspend asserted.
- Dedicated DB workflows cover free actions with unchanged ledger/balance/XP, bidirectional blocks/direct RLS, private profiles, filters, prices/durations, stale quote refusal, retries, insufficient funds/rollback, independent approvals, snapshots, pause/resume/expiry, cosmetic badge, reports, denied raw financial/legacy writes and immutable deduplicated events.
- `tests/discovery-browser.smoke.mjs`: explicit intercepted-network fixtures for purchase confirmation, safe errors/retry, filters, separate sponsored/organic rails, connect/save/block/unblock, profile report, package edits/review and 25 phone/tablet/desktop portrait/landscape layouts (320–1440px), asserting no document overflow or uncaught JS errors.
- `tests/launch-browser.smoke.mjs`: launch/mission browser regression with explicit fixtures, including 25 responsive layouts. `TEST_BASE_URL` selects the isolated test server.
- `npm run test:deployment`, `npm run test:secrets`, `git diff --check`.

Browser fixtures do **not** prove real GoTrue login/refresh, CAPTCHA/email delivery, actual provider payment acceptance, live moderation or deployed UI correctness. No real administrator/ordinary-user production sign-in was performed for this change.

### Reproduce optional browser/race tests

Install optional tools together without modifying the lockfile:

```sh
npm install --no-save --package-lock=false embedded-postgres@18.6.0-beta.19 playwright @sparticuz/chromium
npm run test:discovery:concurrency
# Test-only server; never deploy these test settings:
VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=test-key npm run dev -- --host 0.0.0.0 --port 5174
LD_LIBRARY_PATH=/home/user/.cache/browser-libs/lib node tests/discovery-browser.smoke.mjs
TEST_BASE_URL=http://localhost:5174 LD_LIBRARY_PATH=/home/user/.cache/browser-libs/lib node tests/launch-browser.smoke.mjs
```

The library path is sandbox-specific. Stop the test-only server after verification; never publish fixture credentials/content.

## Manual coordinated rollout and acceptance

1. Review backup/recovery posture and existing migration history in the **existing** Supabase project. Apply only missing migrations in order: 016, 017, 018, 019, then 020. Do not replay 001–015, reset data, create a second project or manually patch balances. See the previous economy/launch documents for their separate provider/Edge requirements.
2. Review the 7-day in-app Social Promotion scope and full-DC-rejection refund/fixed-window pause policies. Confirm enabled packages/prices before inviting purchases. No legacy sponsored flag/order is retroactively activated as a campaign.
3. Build/deploy the matching React/Vite frontend on Render with existing public Supabase configuration only. Never put service-role/payment secrets or test settings in frontend variables. Verify release marker/service-worker update.
4. Sign in with a real approved administrator, refresh and inspect package controls/campaigns; verify an ordinary member is denied privileged calls. Check the null-role denial too. Staff must be independently verified; no backdoor role assignment is added.
5. With consenting test members and a small approved actual DC balance, verify purchase/refresh/retry, insufficient balance, independent approval, paid placement vs organic, public profile/social opens and recorded request counts. Confirm block/private visibility through both UI and direct public SELECTs. Verify full exactly-once DC refund and journal snapshots, plus pause/end/expiry.
6. Recheck the preserved launch counters/50-award cap and mission/XP workflows. Record actual live evidence separately. Email/provider tests, real external-load/ownership verification and production deployment are currently **unperformed**, not passed.
