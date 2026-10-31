> **Current payment policy (2026-10-31): MANUAL BANK TRANSFER ONLY.** Online Paystack processing/actions have been retired. Provider setup, secret and webhook instructions below are historical and must not be followed. Use `MANUAL_DEPOSITS_ONLY.md` and migration 021 for the current implementation and rollout. Historical payment records are preserved.

# Profile pictures, Moniepoint point purchases and managed listings

## Confirmed configuration

- **Bank:** MONIEPOINT
- **Account number:** 6977298247
- **Account name:** LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST
- **Pricing:** configured by Super Admin; no invented prices or seed packages.
- **Manual profiles:** admin-managed public listings, not Auth accounts/invitations.

These features are implemented in the repository but **not applied to the live Supabase project**. Existing production schema still needs comparison and staging validation.

## Deploy

1. Apply the previous admin migrations **006–008** if not yet applied (after the existing 001–005 schema). Never rerun the initial SQL bundle on production.
2. Compare your live schema and policies, back up, then apply **`supabase/migrations/009_manual_payments_and_listings.sql`** once. It creates five new tables, RLS policies, functions and two buckets, configures image limits, and extends the admin list/overview APIs. Existing profiles, balances and payments are not reset.
3. Confirm the seeded bank details are correct in a real Moniepoint beneficiary lookup **before accepting payments**. They are user-supplied instructions, not bank-verified by this implementation. Future changes should be made only through trusted SQL and existing orders keep their original bank-detail snapshot.
4. Deploy the frontend to Render using the existing build and SPA rewrite. No new backend, payment provider API key or Edge Function is needed for **manual bank transfers**; trusted execution is PostgreSQL RPCs. Existing Paystack functionality remains separate.
5. Sign in as a Super Admin, go to `/admin?view=point_packages`, click **Create package**, enter points, price in naira, active status and an audit reason. Purchases remain unavailable until at least one active package exists.
6. Run the staging workflow below with real Supabase Storage and different user/finance sessions before launch. Set an operational review SLA and support channel for paid transfers that need assistance.

## User workflow

### Profile photo

- **Settings → Profile picture → Upload your picture.** Every authenticated user with a writable profile can upload JPG, PNG or WebP up to 5 MB. Restricted accounts still cannot edit their profile.
- Photo uploads have a random immutable filename under the authenticated user's folder. The profile is updated only after successful upload; failed profile saves attempt cleanup.
- Pictures now render on existing `ProfileCard` components in Discover, profile detail and other places using that shared card. Managed listings also display their portrait.
- Avatars are in **public** buckets. Do not upload IDs, payment receipts or private documents. Previous avatar objects are retained (no destructive migration); add a retention/cleanup job for obsolete files as appropriate.

### Buy points

1. **Rewards → Buy points by bank transfer** → choose an active package.
2. The database creates an order with immutable price, points, package-title and beneficiary snapshots. The browser cannot choose the credited amount. Each account has at most five unfinished orders.
3. The dialog shows that order's beneficiary and amount. The user verifies the beneficiary in their banking app, transfers funds, and provides payer name, transfer reference and a private receipt image.
4. Submitted orders await manual finance review. Users can cancel only unsubmitted orders. They can view only their own orders; a screenshot does not credit any points.
5. After finance approval, points and ledger/audit records are saved in the **same database transaction** and an in-app notification is created. Refresh Rewards to update the displayed balance/order state. The rewards ledger also reloads on page navigation/reload.
6. Rejected payments show the review note. There is no automatic refund or resubmission action: the user should contact support for reconciliation. Never tell a user to pay again solely because an order is rejected or delayed.

## Admin workflow

### Bank transfers

- **Super Admin and Finance Admin → Bank transfers** (`/admin?view=bank_point_orders`). Filter `submitted`, inspect the order and receipt. Evidence uses a private bucket and a **two-minute signed URL**; refresh the link if expired. Do not share it.
- **Approval requires checking actual received funds in the receiving bank statement**, not trusting the screenshot. Match the amount, beneficiary, payer and exact unique receiving-bank transaction ID.
- Enter the bank-statement transaction reference, check the confirmation and provide a review reason. Approve or reject. Finance/admin cannot review their own order.
- Approved order retries return without a second credit. Unique ledger references and an order-row lock prevent double credit; a normalized bank transaction ID cannot fund a second order. Submitted transfer references are also unique case-insensitively.
- Manual banking is **not automatic provider verification**. The system cannot detect a dishonest reviewer, fabricated statement reference, partial/combined payments or all reused receipt images. Do not credit the same transfer under different IDs. Establish reconciliation, staff review controls and reversal procedures. Existing Super Admin point adjustments remain a separate, audited privilege.
- Dashboard revenue now combines provider-verified payments and bank-approved orders, and displays the bank review queue separately. This is not a complete accounting/refund report.

### Managed listings

- **Super Admin → Managed listings** (`/admin?view=managed_profiles`) → **Create profile**.
- Enter display name, listing username, bio, country, interests, optional photo and official HTTPS social URLs. WhatsApp uses `https://wa.me/<international-number>`.
- Publish immediately or save a private draft. Published listings appear alongside real profiles in Discover, clearly labelled **Managed listing**, and open at `/listing/:username`.
- **Inspect → Edit listing** to change the listing or unpublish it. Changes are database-authorized and audit-logged. This does not create a login, password, email, points account or referral code.
- Existing auth profile ownership/FKs are untouched. Managed listings do not use ordinary user favorites/block/report FKs; their cards/details direct complaints to the existing support page. Publish only photos/details the owner has authorized. Implement ownership-claim and dedicated managed-listing moderation workflows if needed later.

## Database additions and security

- `point_packages`: positive bounded points and kobo pricing; active packages readable publicly; writes only via Super Admin RPC.
- `bank_transfer_details`: authenticated read-only beneficiary configuration, seeded with the confirmed account above.
- `bank_point_orders`: own-order read RLS, **no client table writes**; status transitions through dedicated functions. User IDs are set null if an Auth account is deleted so financial records survive; a deleted account's pending order cannot be approved for points. Define a financial/personal-data retention policy for the retained payer/receipt metadata.
- `managed_profiles`: public rows only via ordinary RLS; admin draft reads via the role-scoped RPC. No ordinary user writes. Social links checked against official HTTPS domain allowlists in SQL.
- `bank-receipts`: private, 5 MB, image-only. Owner can upload only under their own unsubmitted order. Owner/finance/super admin can read; **no client update/delete** so submitted evidence cannot be replaced. Browser MIME/size checks improve usability; Supabase bucket rules enforce declared MIME/size. A content-scanning service, file quota/rate limits and orphan-object cleanup are not included.
- `managed-avatars`: public, 5 MB, image-only; uploads/deletes restricted to Super Admin's own folder.
- Existing `avatars`: configured to accept only JPG/PNG/WebP up to 5 MB; cross-bucket/path updates prevented by explicit `WITH CHECK`. Existing files/data are not removed. Older avatar objects do not retroactively acquire new content validation.
- New functions deny anonymous execution; every admin mutation checks the database role. All order approvals/rejections and package/listing saves are audit logged. No browser-held service role or payment secret.

## Files changed for this follow-up

- `supabase/migrations/009_manual_payments_and_listings.sql`
- `src/lib/imageValidation.js`, `src/lib/uploads.js`
- `src/components/ProfilePhoto.jsx`, `BuyPoints.jsx`, `ui.jsx`
- `src/admin/CreateDialog.jsx`, `ReceiptEvidence.jsx`, `ActionDialog.jsx`, `resources.js`
- `src/pages/Settings.jsx`, `Rewards.jsx`, `Admin.jsx`, `Discover.jsx`, `ProfileDetail.jsx`, `src/App.jsx`
- `tests/admin-database.test.mjs`, `tests/admin-resources.test.mjs`
- This guide and the follow-up note in `ADMIN_DASHBOARD.md`.

## Tests and remaining verification

`npm test` now applies all nine migrations to isolated PostgreSQL (PGlite, mocked Auth/Storage schemas) and covers:

- Positive package configuration, negative unauthorized package edits, frozen order terms after a price change.
- Own-order access, cross-user evidence upload/read denial, missing evidence denial and submitted-evidence immutability.
- No ordinary-user/moderator approval, no self-approval, required receiving-bank reference, duplicate transfer/bank references.
- Approval retries credit once with one ledger entry; rejection cannot be changed to approval through this flow.
- Private/public managed listings, authorized creation, invalid social-link rejection.
- Avatar folder isolation and cross-bucket mutation denial, browser image MIME/size checks.
- Overview manual revenue and pending bank-order counts.

`npm run build` passes. These are not hosted Supabase Storage/HTTP, browser, real bank-transfer, concurrency/load or production-schema tests. The earlier dependency advisories remain documented in `ADMIN_DASHBOARD.md`.

### Staging acceptance

- Upload valid/oversized/invalid image types, confirm photo display in Settings/Discover/detail and test restricted users.
- Create/edit/deactivate a package; verify public pricing and old order snapshots.
- Make a small real test transfer after confirming beneficiary details. Upload a receipt, verify it is not publicly accessible, inspect using finance credentials and confirm only after locating received funds.
- Test duplicate clicks, two concurrent approvals and separate-session retries: exactly one credit/audit/notification.
- Verify another user, moderator and support agent cannot fetch receipts, read orders or approve; finance cannot edit packages/listings or approve their own payment.
- Create a draft managed listing with portrait/links, publish, confirm discover/detail, unpublish, and verify anonymous access disappears.
- Check mobile dialogs, keyboard navigation, error/retry behavior and signed-link expiry with real browsers.
