# Admin workflow repair

## Status and scope

Implemented on `arena/7b18da27-addmeup-frontend`. The targeted free managed-profile backend repair was activated under the owner’s explicit scoped recovery waiver; see the activation record below. No production users, balances, deposits or stored managed-profile rows were changed. Matching frontend release is a separate step; build/merge is not proof of Render deployment or real password-session acceptance. A separate, narrowly scoped **read-only** user-directory installer is included for review, **not applied**. Do not replay absent historical migrations to get these interface changes working.

## Confirmed problems and fixes

- **Users → Deposits navigation crash:** an old profile row briefly rendered through the new bank-row schema before the tab-reset effect ran. Results are now tagged with their loaded view, so records from another screen cannot render or expose actions on the wrong screen. Missing field labels also fail safely.
- **Difficult phone navigation:** persistent Home / Deposits / Users / Support task shortcuts; common tasks first in the drawer; other sections inside More admin tools; a permission-filtered Find an admin tool search jumps directly to a section. Selecting the current section no longer wipes its search.
- **Wide mobile tables:** readable cards replace generic record tables below 1024px, with primary fields and real record actions. Bank cards retain direct Approve / Decline. Desktop tables and CSV remain available. Empty/loading/error messages remain visible when the mobile table is hidden.
- **Lost search context:** search, status, page and deposit dates live in the URL. Reload and browser Back retain them. Clear search & filters is explicit. Changing a filter resets pagination without overwriting the new filter. Debouncing remains server-side search, not filtering just the visible page.
- **Review queue buried below a report:** bank funding/date explanations are a closed disclosure; the daily Deposits shortcut opens submitted transfers. Needs review / Awaiting evidence / All deposits are real server filters, not client-only fake counts. Compact phone headings make the first review action visible above the fold in the 390px browser test.
- **Forms interrupted by refresh:** background polling pauses while a review/detail/member dialog or drawer is open, a search is being typed, or a load is in progress. Auth token refresh for the same user ID no longer restarts access checking/unmounts a form. Account changes still clear sensitive dialogs. Stale overview metrics are cleared on a failed refresh.
- **Unnecessary repeated loading:** the home screen reuses the already-returned protected overview instead of probing the missing extended metrics RPC and requesting the same overview again. Metrics are not remounted every minute.
- **User details dead end:** one Open user action opens the account panel. Only an absent detail endpoint can fall back to that already-authorized, same-ID user-list snapshot. Real permission/network failures never use a snapshot fallback. Manage this user retains the original role-filtered actions, each opening its existing confirmation dialog; the panel itself does not write data.
- **Buttons spinning indefinitely:** general mutations, profile/configuration saves and package/listing saves now have bounded waits. General mutations also have a synchronous in-flight guard and retain the original request reference on retry. Bank verification, idempotency, audited reasons and independent review remain unchanged. A timeout is not proof the server rolled back; inspect status before a new financial attempt.
- **Missing tools:** existing rollout-required states remain explicit and provide working return paths to users/deposits. No unsupported table is shown as a successful empty result and no finance/reward/provider features are silently activated.

## User search: actual server mismatch

Read-only production inspection confirmed that `admin_list('profiles',...)` searches **username only** and ignores profile status, while the interface advertised email/UUID search and verification/restriction filters. It also confirmed `admin_user_directory` and `admin_user_detail` are absent.

`loadAdminUsers` first uses the new directory when available. Only a missing-function response permits the baseline fallback, which is clearly labelled **username only**, omits unsupported columns/filters and does not pretend unreturned verification values are false. A stale status-filter URL on that baseline produces a clear-filter instruction rather than silently returning unfiltered users. Permission, timeout, auth and server errors never trigger fallback.

`supabase/manual/install_admin_user_directory.sql` is a reviewed narrow forward addition ready for separate release approval. It adds one stable read-only RPC with server search by username/display name/email/exact UUID, true Auth email-confirmation and account restriction/banned filters, count, deterministic paging and limited profile metadata. It calls the existing active-account and `admin_can('profiles')` checks and does not extend staff scopes or expose wallets, passwords, tokens, auth metadata or financial mutations. It does not replace `admin_list`, create accounts, update any rows, change RLS, approve deposits or enable rewards. The frontend’s general-profile role visibility now matches the inspected server: finance retains its deposit/wallet tools but is not advertised a general-profile scope the server denies.

**Pending:** apply that read-only function only through a separately approved release; until then the truthful username fallback is intentional. Rich historical user sections/support/missions that were absent before remain unavailable; this repair does not fabricate their data or replay 016–023.

## Verification

- `npm test`: original suites plus `tests/admin-workflow.test.mjs` test the actual isolated SQL search, filters, paging, original-row preservation, stable/read-only function, ordinary/anonymous/finance denial, support’s existing scope, and missing-only fallback semantics.
- `tests/admin-workflow-browser.smoke.mjs`: Chromium network fixtures, phone core navigation/tool search, above-fold review actions, Users → Deposits/Back crash regression, URL search/status/date retention/reload/clear, one-tap same-ID user snapshot, retained edit confirmation, no redundant metrics call, a 61-second simulated idle interval while a filled bank review remains unchanged, legacy/missing/denied handling and 320–1440px light/dark layouts.
- Existing admin compatibility and manual bank browser suites updated to open the funding disclosure and inspect mobile cards where appropriate. They retain the original verified bank payload, self-review/permission safeguards, readonly fallback, external refund path and audit expectations.
- Production build/artifact/offline checks, secret scan and `git diff --check`.

Browser fixtures and isolated SQL are not proof of production password login, actual bank settlement or deployed Render acceptance. No passwords or privileged secrets were requested or retrieved. The new read-only RPC still needs production activation and live authorized/ordinary account acceptance when the release is approved.


## Managed profile publishing: confirmed backend defect and explicit policy decision

Read-only live inspection found two managed profiles, but the existing directory admitted only paid member accounts and the managed detail endpoint always returned null. Raw managed-profile REST reads are correctly closed because stored JSON may include private social links. Replacing the hosting provider would not fix this rule conflict.

The owner explicitly selected **free publication for authorized admin-created managed listings**. This exception does not apply to normal members: their eight purchased-DC packages, purchased-versus-reward accounting, expiry, readiness and blocking checks stay intact. Managed listings are not Auth users and saving/publishing them cannot grant connection rewards or wallet credits.

`supabase/manual/install_free_admin_managed_feed.sql` is a targeted forward reconciliation, **installed as `20261109153204`**, for the inspected reward/paid-feed baseline. It validates active super-admin saves with the existing validator and append-only audit; adds an internal-only public projection; admits public managed listings into the same paginated directory; and restores `/listing/:username` public details. Public projections exclude creator metadata and nonpublic/invalid/disabled social links. Raw REST remains closed. Exact `@handle` search confirms a particular listing without confusing similarly named profiles with pagination. Transactional preservation hashes and short table locks protect existing Auth/profile/managed/wallet/ledger/deposit/audit/notification/order/package/settings/relationship/reward rows. It creates no users, orders, connections, rewards or credits and never replays historical migrations.

Single and bulk creation now require actual feed and public-page reads before claiming public success. Private drafts are labelled as such. A save whose public reads fail stays open with an explicit **saved, publication unconfirmed** warning; single retries preserve the profile ID, bulk retries preserve the server-idempotent batch ID. In-flight guards prevent duplicate clicks. Managed cards provide direct Edit, public-page and exact feed-check links. Discover explains the mixed member-paid/admin-free policy.

Verification completed on this branch:

- `tests/free-admin-managed-feed.test.mjs`: isolated SQL activation preserves original rows; trusted create→feed→detail, draft/unpublish privacy, hidden private social links/raw REST/creator metadata, official-domain validation, anonymous/member/moderator/finance denial, idempotent atomic batch creation, 12-row paging; ordinary unpaid/expired members stay hidden, paid members remain visible and blocked members remain hidden; no incidental wallet/ledger/Auth/reward writes.
- `tests/managed-publication.test.mjs`: both actual public paths and matching IDs/types required, exact handle verification, missing/denied/malformed responses cannot claim success; drafts do not trigger public reads.
- `tests/managed-publication-browser.smoke.mjs`: explicit network fixtures; mobile single create→feed→public listing, no managed connection-award control, unconfirmed-publication warning and stable-ID retry, private drafts/unpublish, mixed public/private bulk confirmation and same-batch retry.
- Full `npm test`, build, deployment artifacts, secret scan and existing workflow/compatibility/manual-deposit browser regression suites passed. These are branch/fixture checks, **not production password-login or financial acceptance**.

Latest read-only production preflight: 4 Auth users, 4 member profiles, 2 managed profiles (1 marked public), 3 wallets/90 DC, 6 ledger entries, 0 listing orders, 0 connection rewards and all 8 packages. That preflight preceded activation. The owner selected `activate_with_targeted_waiver`, explicitly authorizing this repair and matching frontend release while accepting the unverified backup/restore risk. The free-managed backend is now active; matching frontend release and real-account acceptance are separate checkpoints. No Railway project or separate backend was created.


### Production activation record (targeted exception only)

- Owner decision: `activate_free_managed_profile_repair → activate_with_targeted_waiver`. No backup or restore verification is claimed. This is not permission to replay other migrations or install the separate user-directory endpoint.
- Preflight request `503cbf2e-e876-4656-b65b-4eca4acb388d`: free helper absent; original totals unchanged; saved fingerprints of purchased-DC, active-listing, purchase and connection/reward contracts.
- `create_migration free_admin_managed_feed_repair`, request `5c44bad5-8a2b-49f6-b761-c71eb4140608`, succeeded. Installed version **20261109153204**. In-transaction locked preservation hashes passed for every protected table in the installer. **Do not replay this installer.**
- Postcheck `bca71bfc-ed4f-4e2a-a3b6-20f092e3ad60`: original 4 Auth/4 profiles/2 managed/3 wallets/90 DC/6 ledger/8 packages unchanged; 0 listing orders/0 connection reward events. All four member purchase/readiness/connection financial-contract fingerprints exactly match preflight.
- Anonymous-role public read, request `00c489da-d2bc-43cf-8138-f7fb741dba14`: policy `purchased_dc_with_admin_exception_v1`, **1 public managed feed row**, same-ID managed public detail resolves, exact-handle search finds it; **0 private links or creator metadata exposed**.
- Privacy/ACL postcheck `698eb81a-f267-42d9-acb4-ffcf83813105`: **0 private drafts exposed, 0 unpaid members exposed**; raw managed SELECT remains closed; neither anon nor authenticated may call the internal helper, anon cannot call managed save.
- No test listings, Auth accounts, wallet grants, deposit reviews, connection awards or notifications were created in production. Publication was demonstrated using the already-public-enabled existing listing. New-create UI checks used isolated SQL/browser fixtures, not a real admin password session. Render deployment and a real authorized admin create→feed→detail check must not be described as verified until actually observed.
