# Migration reconciliation — 31 October 2026

**Production execution BLOCKED.** This runbook and generated SQL have not been executed against production. Backup reference/timestamp, restore owner and recovery evidence remain pending. Isolated rollback tests do not verify production backup restoration.

## Observed production state

Existing project `lohlvenibvohoxtfucfa`, PostgreSQL 17.11. Named recent migrations: browser_truncate_hardening, user_accounts, signup_rollout_compatibility, account_financial_grants and `20261031131450_launch_least_privilege` (024). The original bootstrap history is incomplete; compare catalogs, not just filename numbers. Never replay 001–015 or falsify/backdate 016–023 history.

Read-only baseline: 2 Auth users, 2 profiles, 6 original points-ledger rows, **one wallet, 90 DC total**, no bank/provider orders; 31 baseline tables. Both existing profiles meet launch eligibility. The owner explicitly approved **2 × 5,000 DC = 10,000 DC**, expected aggregate balance **10,090 DC**. No other financial adjustment is authorized. A changed baseline requires a fresh review, not forcing these numbers into the database.

Catalog checks found no pending feature tables, renamed legacy helper aliases, new columns or pending-feature function prefixes. All eight function-rename sources exist. The three policies replaced by 020 exist (`public profiles readable`, `public links readable`, `own reports insert`); the old bank status constraint exists; `official_dc_rate` does not yet exist; balance/ledger/order point columns are integer as expected. No known collision was found in these checks; they are point-in-time, not an exhaustive guarantee against drift.

## Ordering and preservation

| Source | Dependency / deliberate change |
|---|---|
| 016 | Existing balances/ledger/orders become numeric DC; existing balances are carried forward; six old ledger records produce explicitly reconstructed DC journal snapshots; fixed ₦1 = 1 DC; original helper names are renamed |
| 017 | Uses 016 journal/settings for products, orders and atomic spending |
| 018 | Uses 016 accounting; immediately awards eligible existing users, hence explicit 10,000-DC authorization is required |
| 019 | Uses launch/accounting/product foundation for reviewed missions, caps and separate XP; disables repetitive purchase rewards |
| 020 | Uses products/XP for discovery, free connections and reviewed promotions; replaces three existing policies |
| 021 | Uses accounting/orders; hardens statement-verified manual funding/refunds and disables provider settlement |
| 022 | Uses notifications/roles for private subscriptions, preferences and delivery/release queues |
| 023 | Extends the combined schema for staff workspace, support and audited controls |
| 024 again | Reasserts table/default privileges and notification read-state-only browser writes after the feature schema |

024 is an independent privilege hardening migration, not a financial dependency. Real isolated PostgreSQL tests proved 001–015 → 024 → 016–023 preserves its restrictions at every step. The intended production path is nevertheless **one atomic forward reconciliation**, with 024 reapplied last: no partially operational feature schema if a later statement fails.

`supabase/diagnostics/migration-inventory.json` records 016–024 source SHA-256, direct object names and renames. Regex inventory does not fully expand dynamic SQL; catalog and executable rehearsal checks complement it.

## Reproducible preparation (no production connection)

```sh
npm run prepare:reconciliation
npm run test:reconciliation
npm run test:reconciliation:postgres
```

Generated artifact: `supabase/manual/reconcile_016_023_after_024.sql`. Generator: `scripts/build-reconciliation.mjs`. Review/hash the exact artifact immediately before eventual execution. The PostgreSQL rehearsal uses synthetic users and balances, NOT a production dump. Tests cover preservation, grants, reconstructed history, legacy admin mapping, ordinary-user RLS/financial-write denial, missing-evidence refusal and deliberately injected final-postcheck failure rolling back all schema/data changes.

## Required recovery evidence — not supplied yet

Obtain a recent production backup/PITR reference, capture time, retention/recovery window, named restore owner and a documented successful restore verification in an **isolated** environment. Confirm it includes the relevant database/Auth state and separately inventory Storage objects/provider secrets/configuration not covered by that backup. Record recovery procedure and expected recovery time. Do not restore over production as a test. Reconfirm the launch authorization if eligibility/baseline changes.

Hosted preview creation was denied with `402 entitlement_required` / branching limit. One earlier branch call registered the existing **default production branch**, ID `472fe8c6-0c71-477b-8ba7-28de946176c9`; it is NOT staging. Do not reset/delete/merge/push it. Do not create another project to evade the entitlement restriction.

## Eventual authorized execution — STOP until recovery gates clear

1. Re-read live migration history, policies/functions/constraints, all baseline counts/financial totals and launch eligibility. Confirm a maintenance window and stop conflicting writes; do not silently discard activity. The artifact locks Auth/profiles/balance/ledger and has short lock/statement timeouts; lock refusal means abort and reschedule.
2. Review source hashes and artifact; record immutable backup/recovery evidence and the owner-approved financial delta in the private execution record. Do not put credentials or personal backup access URLs in Git.
3. Use ONE new migration named `reconcile_016_023_after_024`, retaining original SQL source provenance. Do not insert fake historical versions for 016–023. A future blank environment can still apply the numbered sources in order; an existing production environment must not blindly run the entire directory.
4. Recovery settings must exist **in the same trusted SQL session and transaction** as the generated statements. Insert these transaction-local settings immediately AFTER the artifact's existing `begin;`, using real verified values:
   - `SET LOCAL danqel.recovery_verified = 'yes';`
   - `SET LOCAL danqel.backup_reference = '<actual verified reference>';`
   - `SET LOCAL danqel.restore_owner = '<actual responsible owner>';`
   - `SET LOCAL danqel.backup_verified_at = '<actual ISO timestamp>';`
   - `SET LOCAL danqel.authorize_launch_dc = '10000';`
   These placeholders are documentation, NOT evidence. Do not execute them as-is. A separate connector SQL call cannot be assumed to retain session state. For a migration API, assemble the reviewed transaction-local statements inside the single submitted migration body. Record that execution-wrapper difference alongside the source artifact hash. Settings are operator attestations, not independent proof of recovery.
5. The guard requires verification within 24 hours, unchanged baseline, absent pending tables and intact 024 privileges. Final checks require all original Auth/profile/ledger rows unchanged, only two awards totaling 10,000 DC, total 10,090 DC, eight ledger entries, six reconstructed journal rows, no provider settlement privilege and no dangerous browser grants. Any failure rolls back; investigate rather than bypassing guards.
6. After commit, capture actual migration version, per-wallet before/after and journal linkage privately, RLS/privilege results, mapped-admin results and original-record preservation. Do not infer correct per-user accounting solely from an aggregate. Run real staff/ordinary-account acceptance before frontend launch.
7. Paystack TEST and live integrations have been removed by owner request. Do not register a Paystack sandbox migration or deploy payment processors. Retain legacy 410 guards and use statement-verified Moniepoint transfers only.

## Failure / recovery

Before commit, SQL failure rolls back the entire forward transaction. Do not remove checks to force a pass. After commit, prefer a reviewed corrective forward migration; do not drop feature tables, delete ledger rows or reset wallets. If restoration is necessary, the designated owner follows the verified recovery plan and accounts for writes after the recovery point. Database transaction rollback tests do not replace that recovery plan.
