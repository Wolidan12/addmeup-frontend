# Admin reporting / journal incident — 31 October 2026

## Confirmed cause

The screenshots show the newly deployed frontend calling an older live backend. A fresh read-only catalog inspection confirmed:

- `admin_metrics` does not exist; `admin_overview` and the original `admin_list` do.
- `dc_transactions`, launch awards and pending feature tables do not exist.
- Existing `admin_list` rejects `dc_transactions` and other unsupported resources.
- Analytics also unnecessarily requested `admin_list('analytics')` before rendering its own report.

The existing protected report was executed successfully in a **read-only SQL transaction under a simulated authenticated staff subject**, then rolled back. It returned two profiles, two social links, zero open reports, a 14-day profile-creation history and zero recorded funding. The original ledger listing returned six records. This is SQL permission verification, **not an actual password login/browser session**. The production baseline remains 2 users / 2 profiles / 6 ledger entries / 90 DC. No production data/schema/Auth/role changes were performed.

## Safe frontend fix

1. Analytics no longer requests a table listing; its own reporting component controls its read/error state.
2. If (and only if) the modern metrics function is missing, the component uses the existing protected `admin_overview` report. No alternate path is attempted for permission denial, timeout, invalid data or generic server failure.
3. Compatibility mode displays only actual returned fields with accurate labels: profile records, social links, open reports, recorded gross funding and 14-day profile creation. It does NOT call profile counts verified users, activity or Auth registrations. Unavailable metrics are omitted, not filled with zero. CSV uses those same facts/units.
4. A confirmed missing backend function/table or unsupported list resource shows an explicit backend-upgrade state rather than a misleading empty table. The unavailable DC journal offers navigation to the original working rewards ledger. No journal rows or balance snapshots are fabricated.
5. Failed metric refresh clears data and disables export; no export of stale figures after an error. Modern reporting still works when its backend exists. Staff authorization is unchanged and stays server-enforced.

## Verification

- `npm test`: PASS, including new actual-baseline 001–015 + 024 PGlite compatibility test, original-row preservation, existing report/list success, ordinary-account denial, missing-only fallback and modern path.
- `npm run test:deployment`: PASS, fresh build and deployment artifacts.
- `npm run test:secrets`: PASS, no supported private patterns found.
- `tests/admin-compatibility-browser.smoke.mjs`: PASS in real local Chromium with mocked Supabase/Auth; five screen sizes, report/CSV, no analytics list request, original-ledger navigation, permission denial without fallback or export, modern metrics and ordinary-user denial. Not live browser login.
- `git diff --check`: PASS.

Logs: `/home/user/admin-compat-{browser,regression,deployment,secrets}.log`.

## What still needs production work

This patch is not a substitute for missing tables/functions. Full DC journal, missions, launch rewards, enhanced manual settlement, support and push cannot operate normally until the tested backend upgrade is actually applied. Earlier financial authorization covers two 5,000-DC launch awards only; no additional adjustments are authorized.

The recovery gate is still pending: real recent backup reference/time, named restore owner and verified isolated restore. Do not fake that evidence, backdate migration history, replay all migrations or reset production. Use `MIGRATION_RECONCILIATION.md` for the single guarded forward rollout. No financial migration was executed as part of this fix.

Source/PR publication is not live Render acceptance. After the frontend fix is reviewed and deployed, verify the exact clean commit and real staff/ordinary sessions on the published domain. Check compatibility reports and original ledger, then separately complete recovery/backend rollout and full feature acceptance. Never claim every page is operational merely because generic errors are replaced by honest rollout states.
