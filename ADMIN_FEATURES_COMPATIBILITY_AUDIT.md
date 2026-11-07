# Admin feature compatibility audit — 2026-10-31

## Outcome and boundaries

This patch restores the existing **read-only bank-order report** without requiring the pending financial migrations. It does **not** install missing feature tables, enable legacy financial writes, complete the broad admin rollout, or prove a production deployment.

The earlier social-platform directory fix is already merged in PR #8. The directory uses the existing catalogue and protected save function; do not reapply the missing generic workspace migration just to list platforms.

## Production findings from the read-only schema audit

The audit recorded 2 Auth users, 2 profiles, 1 balance record holding 90 DC, 6 legacy ledger entries and **0 bank orders**. These are audit-time observations, not live dashboard constants.

Present: `bank_point_orders`, `social_platforms`, `notifications`, protected `admin_list`, `admin_overview`, `admin_review_bank_order` and `admin_save_social_platform`.

Absent tables checked: `missions`, `mission_submissions`, `launch_awards`, `promotion_campaigns`, `dc_transactions`, `credit_coupons`, `support_tickets`, `member_connections`, `push_subscriptions`.

Absent functions checked: `admin_manual_deposits`, `admin_confirm_manual_deposit`, `admin_metrics`, `admin_user_detail`, `admin_review_promotion`.

No production writes, balance changes, migration applications, backups or restore operations were performed for this patch.

## Section-level diagnosis

| Section | Diagnosis / safe behavior |
| --- | --- |
| Bank transfers | Existing legacy orders can be listed through protected `admin_list`. This patch supports native payer-name/status search, server count/pagination, page CSV and read-only inspection. Production had no orders at audit time. |
| Statement-verified deposits and refunds | Modern functions absent. Approve/reject/refund controls are withheld on the legacy report. Migration 021 and its dependencies still require verified staged rollout. |
| Launch award history | `launch_awards` absent; migration 018 and dependencies pending. Do not fabricate history or credit the two authorized awards through old payment/reward functions. |
| Missions and evidence | Checked mission tables absent; migration 019 and dependencies pending. |
| Promotion campaigns | `promotion_campaigns` and review function absent; migration 020 and dependencies pending. Legacy promotion packages are not paid campaign history. |
| DC journal | `dc_transactions` absent. The existing rewards ledger remains a separate historical report, not a substitute for the new journal. |
| Support, coupons, free connections | Checked tables absent; consolidated workspace rollout in 023 and its dependencies pending. |
| Push delivery | Existing notifications do not imply push subscriptions or device delivery are configured; subscription table absent. Migration 022, Edge secrets and real-device acceptance remain required. |
| Analytics | Existing protected overview compatibility is retained when the modern metrics function is missing. No fallback on permission or network failures. |
| Social platform directory | Existing catalogue compatibility already merged; audited save and table refresh retained. |
| Other legacy sections | This patch preserves their existing paths. It does not claim all actions, live authenticated sessions or missing member-detail functions have been validated in production. |

## Bank-report safeguards

- Try `admin_manual_deposits` first. Only missing-function errors `PGRST202` / `42883` permit the protected legacy report fallback.
- Permission, network, timeout and malformed-response failures do not trigger a second, less restrictive route.
- Legacy results explicitly carry a read-only marker. The UI hides all financial mutation controls and operation dialogs, modern funding totals, date filters, unsupported email/reference search and the unsupported refunded-status filter.
- The report retains the original database records and native statuses. It does not synthesize deposit totals or merge old orders into modern deposit history.
- Failed refreshes clear records, totals, open inspection and pending operation state; tab changes clear pending operations.
- Ordinary-user denial remains enforced by the database RPC. Frontend visibility is not an authorization boundary.

## Verification performed

- `npm test`: PASS, including baseline migrations 001–015 + 024 in PGlite and all existing regression suites.
- Added SQL fixtures verify protected bank reporting, payer/status filtering, 25-row pagination, ordinary-user denial and unchanged fixture Auth/profile/balance/ledger/order snapshots after report reads.
- Added helper tests cover missing-only fallback, modern report retention, malformed counts, permission failures, protected fallback denial and thrown network errors.
- Local Chromium compatibility smoke: PASS for legacy bank rows, search, page CSV, inspection without mutation controls, modern report UI retention, existing platform flows and prior compatibility checks. Supabase transport/Auth are mocked; this is **not** a real production login, bank settlement or live endpoint acceptance test.
- `npm run test:deployment`, `npm run test:secrets`, `git diff --check`: PASS.

## Required next stage — not completed here

Migrations 016–023 are pending while 024 is already applied. Do not blindly run them out of order, reset production, or repair migration history merely to dismiss the upgrade screens.

Follow `MANUAL_BACKUP_AND_RESTORE.md` to obtain an actual private production backup and matching isolated restore verification. The merged backup tooling alone is not backup evidence. Then follow `MIGRATION_RECONCILIATION.md`, `SAFE_STAGED_ROLLOUT.md` and the gated reconciliation tooling, review current preflight results and apply the approved additive rollout only after recovery evidence exists.

After rollout, verify real admin and ordinary-user sessions, exact Moniepoint statement-verified deposits/refunds, idempotent launch/mission awards, paid promotion review, support/coupons/connections and supported-device push. The two approved 5,000 DC launch awards remain uncredited by this patch. No Paystack integration is reinstated.

## Member payment-screen follow-up — 2026-11-07

The owner reported the same upgrade gate on `/credits`. A fresh read-only production audit confirmed `dc_settings`, `create_manual_deposit`, `admin_confirm_manual_deposit`, `admin_manual_deposits`, `launch_status`, `missions_overview` and `admin_review_promotion` are absent (function names checked across overloads). `launch_awards`, `missions`, `promotion_campaigns` and `support_tickets` are also absent. Existing bank-order count remains 0.

The previous payment loader bundled settings and history into a single success/failure branch: a missing `dc_settings` table incorrectly discarded a successful owner-scoped history read. The new `src/member/depositData.js` handles these independently, validates record ownership and exact count, and distinguishes unreadable history from an empty history.

`BuyPoints` now hides payment-entry/package-buy controls and transfer instructions when funding configuration is unavailable, explicitly warns against sending money or paying twice, and preserves readable order history and pagination. Unreadable history also prevents creating new payments without knowing existing requests. Server-paused deposits still allow evidence submission on an existing order; enabled deposits retain the current flow. No legacy payment mutation fallback was added. Missing mutation dependencies disable further payment entry. Outdated load responses cannot replace newer account/page data.

Verification: full `npm test`, `npm run test:deployment`, `npm run test:secrets` and `git diff --check` pass. Local Chromium member compatibility smoke passes, including unavailable funding at 320, 390, 844, 768 and 1440px widths, preserved order history, no transfer instructions/payment form, paused/current states and zero payment-write calls. These use mocked Auth/transport, not real settlement or production login.

**Still blocked:** actual backup and matching isolated restore evidence, the reconciled additive backend rollout, real authenticated payment acceptance, and deployment of these source changes. This follow-up does not enable payments or claim every dashboard feature works.

## Requested production execution preflight — 2026-11-07

The owner authorized the backup → isolated restore → reconciled migration → real acceptance → Render deployment sequence. Authorization is recorded, but does not establish technical access or recovery evidence.

A new read-only production check found PostgreSQL 17.11, **4 users, 4 profiles, 3 wallet records, total 90 DC, 6 ledger entries and 0 bank orders**. The earlier 2-user counts above are historical observations, not current invariants. Deposit settings, launch awards, missions and campaigns remain absent. The migration registry still lists browser truncate hardening, user accounts, signup compatibility, financial grants and launch least privilege; it does not show the pending feature rollout. Do not reset or overwrite newly registered accounts.

Execution is blocked before step 1: no private PostgreSQL backup connection, PostgreSQL backup clients or Docker were found in this workspace. The available Supabase connector has SQL/project-management operations, not a verified recovery archive export/restore workflow. Render connector lookup reports unsupported, and no Render CLI or deployment credential configuration was found. Do not export Auth data through chat/query results as a substitute for a private backup. Outbound sandbox networking also does not allow direct Supabase database or Render access.

The full regression suite, deployment-artifact/build checks, secret scan and whitespace checks were rerun successfully. The compatibility patch is being prepared as a draft pull request; this is not a production deployment. No production writes, real bank transfers, Auth-session impersonation, credential resets or migration-history edits were attempted.

To unblock execution, use an appropriately provisioned trusted runner/workstation with the private connection configured via the existing interactive recovery workflow, PostgreSQL 17 clients and a pinned matching Supabase PostgreSQL Docker image. Provide only a sanitized recovery verification outcome, never credentials or the archive in chat. Live acceptance additionally requires legitimate admin/member sessions and independently verified Moniepoint receiving-bank evidence; mocked tests cannot supply these. Deployment requires authorized Render access (or the repository's confirmed auto-deploy path) after the rollout and acceptance gates pass.
