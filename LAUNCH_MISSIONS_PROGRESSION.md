# Launch rewards, useful missions and creator progression

## Status — implemented/tested, not yet live

This branch contains the implementation. **Production migrations 016–019 and the frontend release have not been deployed. Do not announce the promotion as live yet.** Read-only inspection of the existing Supabase project `lohlvenibvohoxtfucfa` still found no DC journal, launch-award or mission tables, two Auth accounts and six existing earned ledger entries totalling 90. No production rewards/accounts/roles were modified in this task.

The existing account migrations 013–015 are live. The prior economy work in `GROWTH_CREDITS_ECONOMY.md` supplies staged migrations 016/017; this work adds **018_launch_reward.sql** and **019_missions_progression.sql**. Apply only missing migrations, once, in order. Never replay/reset 001–015.

## Official launch policy

- Exactly **5,000 DC per successfully awarded account**, only **50 unique accounts**, at most **250,000 DC**. No multiplier applies to launch credits and no expiration is attached.
- Registration alone is insufficient. Verification is the trusted Supabase Auth `email_confirmed_at`, not a URL query parameter, client boolean or user metadata. Restricted, banned and soft-deleted accounts do not qualify.
- Required profile fields are explicitly: display name (at least two characters), username, profile photo, bio, country and at least one interest. A social account is **not** required for launch. The profile-strength score may include optional social completeness; it is not the launch eligibility test.
- Eligible awards are automatic when a qualifying profile edit or trusted Auth email confirmation is recorded. The member-facing recheck RPC safely handles retries and already-eligible accounts.
- At migration opening, already-registered, verified, complete accounts are considered in deterministic registration-time/UUID order. This is not restricted to new registrations after deployment. **Review this existing-account policy before production rollout.** Their actual award timestamps are the new transaction times, not fabricated historical eligibility dates.
- The profile is locked, then the campaign row is locked, before counting actual awards and reserving a slot. A unique user constraint prevents double claims; unique slots constrained to 1–50 independently enforce the hard cap. Slot reservation, wallet movement, immutable DC journal, legacy ledger and audit write are in one transaction. A failure rolls back everything, including the qualifying profile/Auth edit.
- Successful award history is append-only and survives account deletion. Deletion/re-registration does not reopen previously distributed campaign slots. This prevents campaign capacity from being reset by deleting accounts.
- The public status RPC returns actual successful award count, remaining slots, distributed DC, status, capacity and current member eligibility/award timestamp. Homepage and registration display that result, refreshed every 30 seconds. Loading/failure never substitutes a fake `50 remaining` counter. Personal history and staff award history respect RLS.
- Super admins can pause/resume new awards with a reason. They cannot change 5,000 DC, the 50-slot cap or historical awards through the interface. Existing awards never expire when paused.

## Missions and earning limits

Initial editable configurations:

| Mission | Base DC | Separate XP | Verification / recurrence |
|---|---:|---:|---|
| Daily login | 20 | 10 | Verified account and trusted Auth sign-in today; once per UTC day |
| Complete profile | 100 | 50 | Server validates the six required fields; once per account |
| Verify a supported social account | 150 | 75 | Independent staff ownership review; once per account |
| Daily original creator post | 100 | 50 | Staff review; daily; new original evidence |
| Weekly original creator project | 500 | 250 | Staff review; weekly; independent original evidence |
| Successful active referral | 300 | 150 | Linked, verified, complete account plus independently reviewed meaningful creator activity |

All DC/XP values, descriptions, instructions, availability and deadlines are editable by super admins. New daily/weekly/special-event missions are supported and always require evidence review; administrators cannot turn a new custom mission into an unverified automatic click reward. Verification type and recurrence of seeded missions cannot be weakened by editing amounts.

Initial mission earning limits are **1,000 DC/day and 3,000 DC/week**, independently editable (zero pauses new earnings). UTC day/Monday-week boundaries and actual successful award timestamps determine usage. Launch credits, deposits and existing historical balances are outside mission earning caps. Spending/refunds do not reset earned totals. Existing capped booster benefits apply only to eligible automatic daily/profile mission rewards and count towards these earning limits; launch rewards never multiply.

### Completion and evidence processing

- The browser sends a mission/reference/evidence, not a reward amount or target balance. Rewards and XP are snapshotted server-side when submitted. Pending submissions retain their agreed price/XP if the mission is subsequently repriced. A rejected resubmission receives a fresh current snapshot and a new revision/proof reference.
- A unique user/mission/UTC-period key prevents duplicate daily/weekly/special awards. Profile/social one-time rewards are also checked across mission IDs, preventing recreation of a mission from resetting eligibility.
- Evidence remains pending until independently approved. Rejections do not move DC or XP. Rejected evidence can be resubmitted while the submission window is open; stale admin revisions cannot approve a changed submission.
- Social submissions bind an ownership challenge/reference and the actual platform/URL snapshot. Review fails if the linked account changes before approval. Staff must independently verify the public challenge and a canonical account identity; a link or screenshot alone is insufficient. Canonical account identities cannot fund rewards for multiple users.
- Original creator evidence is deduplicated across daily/weekly/special missions using the reviewer's canonical artifact reference, not client-supplied click or follower counts. Referrals have a global referred-account key, so one active referral cannot be reused across mission IDs or repeat approvals.
- An active referral is not inferred from signup, clicks or a purchase. The relationship must already exist through the trusted referral flow, the referred account must be verified/profile-complete, and staff must independently inspect meaningful original creator activity.
- Only active, verified super admins review evidence; they cannot review their own submissions. Finance can read award histories, not approve evidence. Raw-table RLS also denies other users and restricted staff. Review reasons/proof references are retained in the audit trail; member-visible review notes should not contain private internal information.
- Profile locking serializes awards for each user, so concurrent approvals cannot overshoot earning caps. Deadline checks apply to submission/resubmission; already-timely submissions may be reviewed after their deadline or after pausing a mission.

### Legacy cutover

Migration 019 revokes browser access to old repeatable `claim_task` / `claim_daily_checkin` endpoints. Adding a social link alone no longer earns credits. Legacy task/rule controls are archived read-only in the new UI; edit current mission values under **Missions & launch**.

Automatic legacy purchase-referral commissions are retired at this cutover in favour of reviewed active referrals. Previous referral earnings are retained; the referral dashboard/history includes new active-referral awards and preserved older rewards. Review any newly created legacy pending orders before rollout. Existing paid booster benefits and actual daily streak tracking are carried into eligible automatic missions rather than silently selling nonfunctional plans.

## Non-spendable creator XP

- Existing XP is preserved with an opening XP journal entry. Mission XP has its own immutable `creator_xp_events`, separate amounts and source references. A 10 DC mission can grant 77 XP; XP is not calculated from the credit balance.
- Spending, deposits, launch credits and DC refunds do not reduce or purchase XP. Existing numeric level compatibility remains; the member interface displays server-derived named ranks.
- Suggested named ranks: **Starter** (0), **Rising Creator** (100), **Influencer** (500), **Trendsetter** (1,500), **Elite Creator** (5,000 XP). These are implementation thresholds, not user counts or engagement metrics.

## Interface and admin integration

- Public homepage and registration: launch terms, live successful-award counters, exact amount/cap and non-expiry disclosure.
- `/missions` and legacy `/rewards`: launch eligibility/award timestamp, server XP/rank, actual daily/weekly usage, paginated cadence-filtered mission catalogue, confirmation/evidence dialogs, completion/review history and deadlines.
- Referral page: genuine active-referral programme and database-recorded reward totals; no obsolete purchase-percentage sales pitch.
- Profile settings: server creator rank and clarification that optional profile strength differs from launch eligibility.
- Admin: **Missions & launch**, **Mission evidence**, **Mission awards**, **Launch award history**. Controls cover catalogue creation/editing, earning limits, launch availability, independent evidence review, canonical references and reasons. History/search/filter/pagination use trusted SQL/RLS, never invented statistics.

## Tests actually performed

- Full `npm test` passed, including all new migrations, SQL/RLS/ACL tests and preceding account/economy regressions. The legacy economy fixtures are deliberately frozen through 017 because 019 retires their old claim endpoints; `launch-missions.test.mjs` tests the complete 001–019 cutover and explicitly proves the old endpoints are denied.
- **Real embedded PostgreSQL multi-session tests passed**: 60 independent authenticated backend sessions concurrently completed their own eligible profiles; the result stopped at 50 awards / 250,000 DC. Twenty concurrent same-account retries issued no extra awards. Forced failure after slot reservation rolled back the slot, journal, credit and profile edit. These are real local PostgreSQL sessions, **not production GoTrue acceptance tests**.
- Workflow tests cover unverified/incomplete/metadata-spoof denial, verification-before-profile and profile-before-verification, eligible existing-user backfill, immutable histories, price/XP snapshots, changed social link denial, canonical evidence reuse, review revisions, self-review denial, active referrals, daily/weekly caps, expired deadlines, rank progress, DC spending without XP loss and restricted-staff RLS.
- Browser fixtures passed for homepage/registration counters, eligibility/award timestamp, mission claim/evidence confirmations, filters, safe errors/retry, admin pricing/XP/limits/evidence approval and 25 responsive route combinations. Previous DC (30 combinations), account and member browser regressions also passed; one parallel account-browser navigation timeout was rerun successfully in isolation.
- Production build/deployment artifact checks, secret scan and whitespace checks passed. The browser smoke tests use explicit test-network fixtures; no fake production accounts or reward histories were created.

Reproduce:

```sh
npm test
npm run test:rewards
# Optional real-session concurrency test, local fixture only:
npm install --no-save --package-lock=false embedded-postgres@18.6.0-beta.19
npm run test:rewards:concurrency
```

The embedded test is optional and not a production dependency. It starts an isolated loopback PostgreSQL cluster in a temporary directory and shuts it down after testing. Browser smoke dependencies/setup follow the existing test conventions; the fixture server must never be deployed as the real site.

## Production acceptance still outstanding

1. Recheck/backup the existing Supabase project and coordinate application of missing **016 → 017 → 018 → 019**, followed by the Render frontend release. Applying 018 can issue real 5,000 DC awards to existing eligible accounts immediately. Do not apply it as a speculative test or replay it to reset capacity.
2. Confirm existing balances/roles/history, actual Auth column availability, campaign opening/backfill, exact ledger snapshots and public counters. Exercise real GoTrue signup, delivered email confirmation, profile completion and refresh with controlled legitimate accounts; do not manufacture production users to test volume.
3. Manually verify real supported-social ownership and genuine active-referral evidence before approving production missions. No OAuth/social-provider ownership integration or independent real-world ownership acceptance test was performed here; approval is a real staff workflow, not a claim that a pasted link is verified.
4. Monitor abuse, use appropriate sign-in/signup rate limits and design/test CAPTCHA or risk screening before a public high-volume launch. Verified email, one-account idempotency, earning caps and manual evidence review are implemented; **they are not a guarantee that every account belongs to a unique human or that all automated sign-ins can be detected**. No device fingerprinting, identity-provider KYC or comprehensive bot/Sybil detection service is claimed.
5. Preserve the outstanding SMTP/provider/frontend deployment steps in the account/economy reports. No real production signup/mail/reward award was tested in this task, and no production promotion was activated.
