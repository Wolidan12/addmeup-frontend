# Targeted first-50 launch reward activation

## Owner authorization and scope

The owner requested the missing reward function and selected `activate_first50_reward_function → activate_with_scoped_waiver`. Backup/restore remains unverified. This narrowly authorizes this standalone first-50 release, not historical migration replay, mission activation, unrelated grants, or resets.

`supabase/manual/install_launch_rewards.sql` was installed successfully as **20261109202102**, `standalone_first50_launch_rewards`. **Do not replay it.** It adds campaign/history, restricted grant/status/claim/admin availability functions and automatic profile/Auth eligibility hooks. It does not replay migration 018 or depend on absent economy/mission cutovers.

## Rules

- First **50 successful eligible awards**, exactly **5,000 DC** each, at most **250,000 DC**; once per Auth account, immutable award history, unique ledger reference and slot.
- Existing documented profile eligibility retained: display name (at least two characters, not the placeholder), username, photo, bio, country, at least one interest. No social link required. Trusted Auth confirmation and no ban/deletion/account restriction are required; user metadata is not verification evidence. Existing email auto-confirm configuration is not changed.
- Profile completion and trusted Auth confirmation changes check eligibility automatically. The existing `claim_launch_reward()` button safely rechecks the signed-in account only. Installation does not backfill existing accounts; eligible existing accounts may subsequently claim or complete their profile. Registration alone does not reserve a slot.
- Profile-row + singleton campaign-row locking serialize claims, with unique user/slot/reference constraints. Award reservation, wallet increment, ledger entry and audit are in one transaction; any error rolls them all back. Paused campaigns/maintenance do not grant new awards.
- Grant helpers are inaccessible to browser roles. Members can read their own award, with finance visibility limited by existing trusted checks. Anonymous users may read aggregate campaign status, not claim or read reward history.
- Rewards are not purchased DC and cannot fund purchased-DC member listing time. Paid packages, deposit settlement, connections, managed listings and their existing function contracts are unchanged.

## Live evidence

- Preflight `851c3fd5-e5b6-4a85-b773-3f13c7140398`: 4 Auth users, 4 profiles, 3 wallets totaling **1,590 DC**, 7 ledger entries; campaign/history absent, zero possible prior 5,000/launch/first50 ledger awards. Earlier statements that the campaign was complete were not evidence of live launch awards; this inspection is the actual baseline.
- Installation request `fe5d89d5-e0d5-458d-80d0-725516feed45`: success; locked in-transaction preservation hashes passed for all original protected rows. No installation-time award, balance update or historical backfill.
- Postcheck `0abc1d0b-ec16-4045-af6f-b855b7f440a5`: migration **20261109202102**; campaign **active**, **50 remaining**, **0 awarded**, **0 distributed**; original users/profiles/wallets/1,590 DC/7 ledger unchanged. All four expected triggers installed; anon cannot claim, authenticated cannot call the arbitrary-user award helper. Purchased-balance/readiness/buy/connection/directory fingerprints exactly match preflight.
- Anonymous-role read `c8d5fb68-5068-49fa-8ef1-668c736c458a`: active, 50 remaining.

## Tests and limitations

`tests/standalone-launch-rewards.test.mjs` runs the actual targeted installer on the existing paid/connection/managed baseline in isolated PGlite. It verifies preservation/no backfill, automatic profile/Auth hooks, incomplete/unverified denial, private history and grant/anon/staff access restrictions, duplicate retries, pause/resume, atomic rollback after an injected ledger failure, 50 × 5,000 hard cap, immutable history, overflow denial and purchased-DC exclusion. Full `npm test`, production build, secret scan and whitespace checks passed.

No production account/profile was created or edited to force a reward. No live claims, wallet grants, financial approvals or backfills were performed for testing. Isolated tests are not a concurrent multi-session PostgreSQL stress run or real signed-in browser acceptance. Existing frontend RPC names are reused; no frontend deployment is needed for database hooks to operate. Mission controls may still depend on separate uninstalled mission features; none were activated here.
