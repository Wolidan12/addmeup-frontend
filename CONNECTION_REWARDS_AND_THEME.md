# Connection rewards, white/blue theme and bank review shortcuts

## Release status

Implemented and tested on `arena/dcaa5332-addmeup-frontend`. **Production backend installed and enabled** as `20261109063155_capped_connection_rewards` after the owner selected `activate_with_waiver` for this specific release and authorized the matching frontend release/merge. This new scoped waiver, not the earlier paid-feed waiver, authorizes the addition despite missing verified backup/restore evidence. Frontend merge is pending at this documentation commit; Render deployment/real password-session acceptance remain unverified. No live balances, deposit decisions, launch awards or account records were changed.

Read-only inspection of the existing project confirmed `points_balance`, `points_ledger`, `favourites`, `blocks`, the approved-bank purchased-DC derivation and paid-only feed RPCs. It confirmed **no `member_connections`, `discovery_relationship` or `discovery_connections`**. Therefore this release provides the narrow forward installer `supabase/manual/install_connection_rewards.sql`. **Do not replay historical 020 or any absent 016–023 migrations. Do not rerun the already-installed deposits or paid-feed installers.**

## Authorized reward policy

- A genuine **in-platform** connect to an actively paid-listed, public, eligible profile credits the **connecting member** 7 reward DC. This is not evidence of an external social follow, human identity or off-platform engagement.
- One financial decision per connecting-user/profile pair, permanently. Renewing the same profile’s listing does not create a new eligible pair. No self, save, block, reconnect or tutorial rewards; no XP change or deduction for connecting.
- Maximum **50 rewarded connections per user per UTC calendar day = 350 reward DC/day**, as selected by the owner. Connections beyond the cap are still created free, but their zero-reward decision is permanent; reconnecting tomorrow does not farm the missed reward. Only a new eligible pair can earn tomorrow.
- Private, expired, unlisted, restricted/banned or reciprocally blocked targets cannot receive new connections/rewards. Restricted/banned actors are denied. Server-time paid expiry is rechecked after acquiring the wallet lock.
- These grants use `connection-reward:<actor UUID>:<profile UUID>` in the existing ledger. They are **not purchased DC**, cannot fund listing fees, and do not alter the verified-bank provenance function or payment rules.

## Atomicity, permissions and privacy

`discovery_relationship` is authenticated-only/security-definer with explicit public table references. An unordered-pair advisory lock serializes reciprocal block/connect operations. The existing actor wallet row lock serializes different-pair rewards and wallet changes; initialization uses conflict-safe zero-balance insertion, never resets a wallet. The UTC cap is counted after waiting for the lock. A connection, permanent decision, unique ledger credit, wallet update and audit entry commit together. A failed final audit insertion rolls everything back.

`connection_reward_events` has a permanent pair primary key, 0/7 constraints, UTC timestamp/date consistency and update/delete/truncate rejection. It deliberately has no cascading account/profile foreign key, so deletion cannot erase financial dedup history. Authenticated users can read only their own events/connections and cannot directly write connections, rewards, favourites, blocks or financial balances. Blocking removes both directions of connections/favourites, never financial history. The `connection_reward_settings` row is private to trusted backend administration: pausing rewards still permits free connections and records zero/paused decisions. It is not a browser-editable grant switch.

The existing paid directory/profile SQL, filters, paging and `purchased_dc_v1` contract are retained, adding only current-viewer `is_connected`/`is_saved` flags. The paginated connections endpoint returns only currently paid-listed profiles; blocked lists reveal IDs, not hidden profile contents. Anonymous users cannot invoke relationship mutations or read another member’s relationships.

The installer locks and fingerprints original users/profiles/managed profiles/wallets/ledger/deposits/notifications/audit/paid orders/favourites/blocks in the same transaction, aborting if any existing row changes. Installation itself creates **no connections or credits**. It refuses a replay or an unexpected baseline.

## Bank deposit review

Eligible finance/root reviewers see **Approve / Decline first**, with a secondary View details action. Below 1024px, compact cards replace the horizontally scrolling bank table, so the actions are not off-screen. Touch targets are at least 44px. Self-review remains prohibited and explained; awaiting evidence cannot be approved; ordinary/read-only roles receive no financial controls. Existing statement-reference/received-funds confirmation, decline reasons, trusted RPC authorization, exact-once credit and append-only audit remain unchanged. Opening a dialog never verifies a bank transfer or credits a wallet.

## Site-wide display preference

A global accessible 44px Light mode / Dark mode control is available on public, authentication, member, admin and error pages. The device-local `danqel_theme` choice persists, synchronizes across tabs and tolerates unavailable storage. Dark is the unchanged default. `/theme-init.js` applies the choice and browser colour scheme before React, preventing a light/dark first-paint flash; browser chrome metadata updates too.

White/blue light colour overrides are generated from route styles by `scripts/build-light-theme.mjs` using PostCSS/selector parsing, with scoped selectors and retained media/support conditions and gradient-text clipping. `npm run build` regenerates the deterministic file; `tests/theme.test.mjs` checks it is current. Source dark styles are untouched. `src/design/theme.css` supplies the global control, primary/input contrast, faithful artwork’s navy backing and bank card layout. Brand/platform artwork and the bot workspace’s intentional Matrix/neon-green visual identity are preserved. The generator skips the bot stylesheet; it does not invert photographs, SVG artwork or canvas pixels.

## Verification completed locally

- `npm test`: existing regressions plus isolated real-SQL 7 DC/cap/UTC/dedup/block/RLS/purchased-exclusion/rollback/history tests and preference/bootstrap/generated-style/message tests.
- `npm run test:deployment`, `npm run test:secrets`, `git diff --check`.
- `tests/theme-rewards-browser.smoke.mjs`: Chromium public/home/sign-in/register/help, member dashboard/wallet/connections/settings and admin; persisted themes, React-entry-blocked prepaint, clipped gradient headings, 320–1440px layouts, direct bank actions/statement dialog/self/ordinary denials, reward confirmation/wallet refresh, reconnect/cap/error notices with raw-detail suppression.
- Updated existing admin-compatibility and manual-bank Chromium fixtures retain read-only fallback, actual statement payloads and confirmed external refund paths. Fixtures are not production authentication or bank settlement proof.
- `tests/connection-rewards-concurrency.test.mjs`: **real isolated PostgreSQL 18**, 142 concurrent requests across 16 sessions and 2 actors. Exactly 50×7 DC each, a free 51st connection each, duplicates credited once, original 90 DC retained, safe first-wallet initialization, purchased balance unchanged, reciprocal block/connect serialization. Disposable database dropped and server stopped. This is stronger than PGlite concurrency simulation, but is not live PostgreSQL 17/real-user acceptance.

To repeat the opt-in concurrency test, use a dedicated disposable PostgreSQL cluster listening **only** on the Unix socket `/home/user/.cache/connection-reward-postgres`, port 55432, test superuser `postgres`; no TCP/public exposure or production credentials. A local binary may be installed with `npm install --no-save --package-lock=false @embedded-postgres/linux-x64`. Initialize/run it outside Git, then run `CONNECTION_TEST_SOCKET=/home/user/.cache/connection-reward-postgres npm run test:connections:concurrency`. The test refuses remote configuration/non-disposable database names, creates/drops its own database and uses fixture users only. Stop the server afterward. Do not run the historical admin database test against a live project.

## Verified production activation

- Trusted migration `capped_connection_rewards` succeeded (request `92f5d90a-904c-4084-b7d5-2da3f8accea1`); registry readback resolved **20261109063155**. **Do not run the installer again.**
- Before/after: **4 Auth users, 4 profiles, 3 wallets, total 90 DC, 6 ledger rows totaling 90 DC**, unchanged. Three deposits remain **2 submitted + 1 awaiting_transfer**. No listing purchases, connections or reward events were manufactured.
- In-transaction original-row fingerprints passed for every protected original table. Postcheck confirmed the reward switch enabled, RLS enabled on all three new tables, anonymous mutation denied/authenticated mutation allowed, client insert/update/delete/truncate of reward history denied, client connection inserts denied and no direct client favourite/block/settings writes.
- The paid directory still returns `purchased_dc_v1`, zero rows/zero paid rows with no listing orders. No free listing, deposit approval, test charge or historical launch grant was introduced.
- Postcheck request: `db52bdf0-c274-4138-b529-c9192cd20fbb`. This verifies installation/preservation/ACLs, not a real logged-in production grant or frontend deployment.

## Activation procedure (already completed for this backend)


Obtain verified backup/restore evidence **or a new explicit owner recovery waiver specifically for this connection-reward release**, plus release approval. Then re-inspect the existing project’s registry, expected paid-feed functions/tables, current original-row counts and financial aggregates; reconcile unexpected changes. Apply **only** the reviewed forward installer through the trusted migration channel and record its actual returned registry version. Verify original rows/aggregate balances/deposit states unchanged, new tables empty/RLS enabled, authenticated-only mutation and no client write privileges; read back the private enable flag. Installation may enable future eligible 7 DC grants but must not backfill credits, approve deposits or manufacture test charges. Do not incidentally apply the two historical launch awards.

After authorization and postchecks, merge the matching frontend release and verify the actual Render commit and real authorized/ordinary password sessions, refresh, theme persistence and a separately authorized real connection if acceptance requires a financial event. Never announce a grant, deployment or production acceptance based only on build success/mocks. If pausing after activation, pause only the private reward flag through the trusted backend and retain all rows/credits/history; do not uninstall or delete financial tables.
