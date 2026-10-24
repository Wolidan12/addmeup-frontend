# Member workspace, referrals, boosters and site controls

## Delivered in this increment

- Removed the bundled sample profiles (`src/lib/demoData.js`) from Home, Explore and detail routes. Home now queries real public profiles and managed listings; empty/error states never substitute fake users. **No Auth accounts or real production rows were deleted.** If there are actual test accounts in your database, identify/verify those IDs separately before deleting them.
- Removed the public “Live — connected to Supabase”, demo-build/login banners, technical reward copy and local fake authentication. Missing configuration fails closed with an unavailable message; it does not create a pretend user/session/balance. The old local demo-session key is removed on load.
- Authenticated users land on `/dashboard`, with a consistent desktop sidebar, mobile quick-navigation, account portrait, wallet balance, real profile views/streak/referrals, check-in actions, activity and creator discovery. Dedicated `/referrals` and `/boosts` pages join Explore, wallet and profile settings. Admin is lazy-loaded separately.
- All six supported social platforms have bundled logos (WhatsApp, Instagram, Snapchat, TikTok, Facebook, X); no third-party logo API calls. CC0 Simple Icons attribution/license is under `public/platforms`. Enabled-platform chips appear in Home, Explore, profile editing and profile-card links.
- Explore now uses bounded **server-side** search/filter/pagination (12/page), including public managed listings, and respects the signed-in user's blocks. Saving/removing favorites and submitting reports now wait for real database success; no fake success alerts for unsigned-in users. Managed-listing complaints continue to use Support.
- Profile/settings and wallet pages share the new design, loading/error states, real transaction pagination and refresh after successful claims/purchases. Only currently supported server-verified tasks are shown; unsupported browse/custom claims are not advertised as working.

## Referral programme — points, not cash

The reference screenshot contains deposit commissions and a cash withdrawal action. **This implementation does not promise cash income, withdrawals, or a default 20% commission.** Economics and financial/payout compliance have not been agreed or configured.

- A member gets a durable personal code, including users whose points balance was created without one.
- `/register?ref=<code>` links carry the invitation through signup/email confirmation. Pending intent is stored locally, but **linking and all rewards are authorized/checked in PostgreSQL**. If auto-linking fails, the member can review/apply the code on Referrals.
- A user can link one referrer **before their first approved point purchase**. Self-referrals, invalid/restricted inviters and referral cycles are rejected. Simply applying a code no longer awards the old immediate signup bonus.
- Existing referral relationships, codes, previous rewards and balances are preserved. Existing historical ledger entries are not recalculated or clawed back.
- Super Admin configures `referral_purchase_percent` in **Reward settings** (0–50). It starts at **0**, so no new purchase rewards are promised until configured.
- Eligible **manual bank-transfer point purchases** reward the inviter with `floor(purchased_points × percent / 100)` points on approval. The rate in effect at approval is recorded with the reward. No cashback/naira percentage, Paystack generic transaction commission, package-inflation reward, or retroactive reward on previously approved orders is implied.
- Example only: if the admin selects 20% and a new eligible order purchases 500 points, approval awards 100 points to the referrer. The example is not a seeded pricing promise.
- Buyer credit, referral reward, ledger entries, audit and notifications are transactional. A unique order reward ID prevents repeated approval/webhook-style retries from granting twice. Rejected/unsubmitted transfers grant nothing. Restricted or deleted inviters do not receive new purchase rewards.
- Referral page shows actual linked-member count, actual historical referral earnings, current purchase rate, copyable invite link and paginated referral history. Private profile names are not disclosed to inviters; the table shows “Member” instead.
- Frauds involving coordinated accounts/real-money cycling still require operational review. Add risk limits, refund/reversal accounting and payout compliance before introducing cash earnings. No cash Withdraw button exists because there is no implemented payout service.

## Point boosters

The example's x20/x30 “points per add” model cannot be verified from an outbound social click. **No points are granted merely for clicking Add, opening WhatsApp or claiming to have followed someone.** This avoids unverified social engagement rewards.

- Super Admin creates/edits/enables/disables **Booster plans**: title, activation cost in points, integer multiplier (2–10), duration (1–168 hours), total extra-point cap (1–1,000,000), and availability. No invented paid plans/prices are seeded.
- A user selects a plan and confirms the points cost, expiry and cap. The DB locks the wallet, checks sufficient balance, snapshots the plan, records a negative ledger entry and activates immediately. Client input cannot specify cost/multiplier. Request IDs make transport retries idempotent.
- Only one active plan at a time; no stacking. Consuming the cap does not cancel the expiry or enable stacking. Existing activations retain original terms if an admin edits the plan.
- Multipliers apply to verified daily check-ins and supported profile/social-link task claims. The **extra** points are limited by `bonus_cap`; claim/bonus/balance/ledger updates happen in one transaction. Rejected/duplicate claims roll back bonus consumption as well.
- Purchase credits, referrals and manual point adjustments are not multiplied. Expiry is checked at every claim, so no cron is required for reward correctness. Bonus helpers cannot be called directly by browser roles.
- This is a capped points utility, not an investment or guaranteed-profit scheme. UI explains the cost, cap, non-cash nature and expiry; no refund/cancellation product has been invented.

## Expanded admin controls

All controls below are Super Admin-only in trusted SQL (not just hidden UI), with confirmation, reason and protected audit logging:

| Section | Controls |
|---|---|
| Site & platforms | Brand name, homepage headline/description, monitored support email, enabled social platforms, maintenance switch |
| Bank configuration | Beneficiary bank/name/10-digit account number; old orders keep original snapshots |
| Booster plans | Create/edit/deactivate plans; review activations |
| Reward settings | Daily reward configuration and referral purchase percentage |
| Daily tasks | Edit title/description/base points/daily limit for supported verified task types; unsafe custom-task activation fails closed |
| Users & profiles | Edit display name, username, bio, country, public visibility; existing restrictions/roles/point controls remain |
| Referrals / Referral earnings | Review relationships and order-based reward ledger |
| Managed listings / Point packages / Bank transfers | Previous increment remains available |

Finance Admin may read booster activations and referral purchase rewards in addition to existing financial scopes. It cannot configure programmes or site settings.

Maintenance mode pauses user claim/order/booster functions and direct profile/social-link mutations; Super Admin retains recovery/configuration access. It is **not a global shutdown of Supabase Auth, all public reads or Storage**. Public browsing can remain available; existing users may still view their records. Backend role/permission checks remain in place even if the frontend is bypassed.

Disabled social platforms are hidden from public directory/card links, blocked for new client link writes, and do not satisfy new social-link task eligibility. Existing stored links are not deleted. Direct public link RLS also requires a public parent profile and enabled platform.

These are expanded real controls, **not a claim that every originally requested subsystem is complete**. Campaign fulfilment, arbitrary evidence-review tasks, email delivery, advanced moderation appeals/fraud tools, subscriptions/refunds and legal-policy editing still need their previously documented stages. Public Support no longer displays a fake `support@example.com`; configure a real monitored address in Site & platforms. Without it, the UI says support contact is not yet published. Existing deletion requests remain a manual support process, not a new unverified destructive admin action.

## Database and deployment

1. Back up and compare the live schema. Apply prior migrations 001–009 only as required by actual history—never rerun the initial bundle on existing production tables.
2. Apply **`supabase/migrations/010_member_programmes.sql`** after 009 in staging first. It is transactional and additive for tables/data; it intentionally replaces relevant reward, referral, directory and admin functions/policies. It does not delete user accounts or clear balances.
3. New RLS tables: `site_settings`, `boost_plans`, `user_boosts`, `referral_purchase_rewards`. Browser clients cannot write them directly. Member API derives identity exclusively from `auth.uid()`; privileged programme helpers are not executable by browser roles.
4. Deploy frontend on the existing Render static service (`npm ci && npm run build`, `dist`, SPA rewrite). No Node backend, new Supabase project or additional secret needed for these points-only programmes.
5. In Supabase Auth, configure the deployed Site URL and redirect allowlist, including login/reset routes and referral query parameters as allowed by your redirect rules. Test the entire signup → email confirmation → first session → referral linking flow with real email.
6. In Admin, set the branding/support email/platforms. Configure programme rules, booster plans and point packages deliberately. Referral rate is initially 0 and booster plans are empty. Don't advertise rewards until configured and tested.
7. Replace old cached PWA assets: accept the app update or reload/clear the old service worker as needed during rollout. API responses remain NetworkOnly, not persisted in the service-worker cache.
8. Manually reconcile any previously created fake/test database profiles before removing them. Nothing here guesses which production users are test users.

## Testing and files

`npm test` passes against isolated PostgreSQL (PGlite with mocked Supabase Auth/Storage schemas). Added tests cover:

- Server-side directory filters, no private managed-listing leak, authenticated-only member API.
- Site/plan configuration permissions, maintenance enforcement and disabled-platform writes.
- Personal codes, self/duplicate referral rejection, approved-purchase commission and approval-retry idempotency.
- Booster activation debit/idempotency, no stacking, plan snapshot immutability, daily/task bonus calculation, cap exhaustion, expiry, and direct helper execution denial.
- Previous permissions, bank reconciliation, receipt privacy and upload tests remain in the suite.

`npm run build` passes, with admin code split into its own lazy chunk. A **mock-network Playwright browser smoke test** also passed at desktop 1440px and mobile 390px, covering public homepage/sample removal, member navigation and horizontal overflow, referrals link, booster confirmation/cancel, platform filtering, settings hydration, wallet, and admin plan/site configuration dialogs. It checks browser exceptions. Fixtures exist only inside the test script; there are no test-statistics fallbacks or test login bypasses in the app.

Optional browser test: `tests/member-browser.smoke.mjs`. Install Playwright and a Chromium runtime as noted in its header, run a **test-only** Vite server with the documented `test.supabase.co` environment, then execute it. This sandbox needed the bundled Chromium `al2023` shared libraries. No mock configuration was written into `.env`/Render and the test-only server was stopped afterward.

Not yet verified: hosted Supabase migration drift, real Auth email redirects, live Storage and bank flows, actual Render deployment, simultaneous-request load, full screen-reader audit, cash payouts (not implemented). Existing dependency advisories remain documented in `ADMIN_DASHBOARD.md`; no blanket production-readiness claim is made.

Main files: `010_member_programmes.sql`; `src/member/*`; `MemberDashboard.jsx`, `Referrals.jsx`, `Boosters.jsx`; rewritten Home/Explore/Rewards/Settings/Auth context; `SiteContext.jsx`, `PlatformLogo.jsx`; admin `ProgrammeDialog.jsx`/resource/actions; platform SVGs; App routes and tests. Removed `src/lib/demoData.js`.
